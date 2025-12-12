import { RestAPI } from '../lib/rest-api/client';
import { FuelSessionSigner } from '../lib/rest-api/signers/fuel-signer';
import { OrderType, OrderSide, MarketResponse as Market } from '../lib/rest-api/types';
import type { Account } from 'fuels';
import { MarketConfig } from './types/config';
import { Wallet, Provider } from 'fuels';
import pino from 'pino';

export class O2Client {
  private client: RestAPI;
  private wallet!: Wallet;
  private signer!: FuelSessionSigner;
  private provider: Provider;
  private initialized: boolean = false;
  private logger: pino.Logger;

  constructor(baseUrl: string, networkUrl: string, logger: pino.Logger) {
    this.client = new RestAPI({ basePath: baseUrl });
    this.provider = new Provider(networkUrl);
    this.logger = logger;
  }

  async init(privateKey: string, contractId: string) {
    if (!this.initialized) {
      await this.provider.init();
      this.wallet = Wallet.fromPrivateKey(privateKey, this.provider);
      this.signer = new FuelSessionSigner();
      await this.client.initTradeAccountManager({
        account: this.wallet as Account,
        signer: this.signer,
        contractIds: [contractId],
      });
      this.initialized = true;
    }
  }

  async getMarket(marketConfig: MarketConfig): Promise<Market | undefined> {
    if (!this.initialized) {
      this.logger.error('O2Client not initialized. Call init() before using this method.');
      throw new Error('O2Client not initialized');
    }

    const markets: Market[] = (await (await this.client.getMarkets()).data()).markets;
    return markets.find((m: Market) => m.market_id === marketConfig.market_id);
  }

  async placeOrder(market: Market, price: string, quantity: string, side: OrderSide, orderType: OrderType): Promise<boolean> {
    if (!this.initialized) {
      this.logger.error('O2Client not initialized. Call init() before using this method.');
      throw new Error('O2Client not initialized');
    }

    const response = await this.client.sessionSubmitTransaction({
      market,
      actions: [
        {
          CreateOrder: {
            side,
            order_type: orderType,
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
