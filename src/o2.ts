import { RestAPI } from '../lib/o2-connector-ts/src/rest-api/client';
import { FuelSessionSigner } from '../lib/o2-connector-ts/src/rest-api/signers/fuel-signer';
import { Action, OrderType, OrderSide } from '../lib/o2-connector-ts/src/rest-api/types';
import type { Account } from '../lib/o2-connector-ts/node_modules/fuels';
import { MarketConfig } from './types/config';
import { Wallet, Provider } from 'fuels';
import pino from 'pino';

export class O2Client {
  private client: RestAPI;
  private wallet!: Wallet;
  private signer!: FuelSessionSigner;
  private provider: Provider;
  private initialized: boolean = false;

  constructor(baseUrl: string, networkUrl: string) {
    this.client = new RestAPI({ basePath: baseUrl });
    this.provider = new Provider(networkUrl);
  }

  async init(privateKey: string) {
    if (!this.initialized) {
      await this.provider.init();
      this.wallet = Wallet.fromPrivateKey(privateKey, this.provider);
      this.signer = new FuelSessionSigner();
      await this.client.initTradeAccountManager({
        account: this.wallet as Account,
        signer: this.signer,
      });
      this.initialized = true;
    }
  }

  async getMarket(marketConfig: MarketConfig, logger: pino.Logger) {
    if (!this.initialized) {
      logger.error('O2Client not initialized. Call init() before using this method.');
      throw new Error('O2Client not initialized');
    }

    const markets: any[] = (await (await this.client.getMarkets()).data()).markets;
    return markets.find(
      (m: any) => m.base.symbol === marketConfig.base_symbol && m.quote.symbol === marketConfig.quote_symbol
    );
  }

  async placeOrder(
    market: any,
    price: string,
    quantity: string,
    side: OrderSide,
    logger: pino.Logger
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.error('O2Client not initialized. Call init() before using this method.');
      throw new Error('O2Client not initialized');
    }

    const response = await this.client.sessionSubmitTransaction({
      market,
      actions: [
        {
          type: Action.CreateOrder,
          payload: {
            type: OrderType.Spot,
            side,
            price,
            quantity,
          },
        },
      ],
    });
    const orderIds = (await response.data()).orders.map((o: any) => o.order_id);
    return orderIds.length > 0;
  }
}
