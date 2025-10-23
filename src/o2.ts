import { RestAPI } from '../lib/o2-connector-ts/src/rest-api/client';
import { FuelSessionSigner } from '../lib/o2-connector-ts/src/rest-api/signers/fuel-signer';
import { Action, OrderType, OrderSide } from '../lib/o2-connector-ts/src/rest-api/types';
import type { Account } from '../lib/o2-connector-ts/node_modules/fuels';
import { MarketConfig } from './types/config';
import { Wallet } from 'fuels';

export class O2Client {
  private client: RestAPI;
  private wallet: Wallet;
  private signer: FuelSessionSigner;
  private initialized: boolean = false;

  constructor(baseUrl: string, privateKey: string) {
    this.client = new RestAPI({ basePath: baseUrl });
    this.wallet = Wallet.fromPrivateKey(privateKey);
    this.signer = new FuelSessionSigner();
  }

  async init() {
    if (!this.initialized) {
      await this.client.initTradeAccountManager({
        account: this.wallet as unknown as Account,
        signer: this.signer,
      });
      this.initialized = true;
    }
  }

  async getMarket(marketConfig: MarketConfig) {
    const markets: any[] = (await (await this.client.getMarkets()).data()).markets;
    return markets.find(
      (m: any) => m.base.symbol === marketConfig.base_symbol && m.quote.symbol === marketConfig.quote_symbol
    );
  }

  async placeOrder(market: any, price: string, quantity: string, side: OrderSide): Promise<boolean> {
    await this.init();
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
