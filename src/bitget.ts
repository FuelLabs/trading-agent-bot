import ccxt from 'ccxt';
import type { Exchange } from 'ccxt';

export class BitgetClient {
  private exchange: Exchange;

  constructor() {
    this.exchange = new ccxt.bitget({
      apiKey: '',
      secret: '',
      password: '',
      sandbox: false,
      enableRateLimit: true,
    });
  }

  async fetchPrice(symbol: string): Promise<number> {
    await this.exchange.loadMarkets();
    const ticker = await this.exchange.fetchTicker(symbol);
    return Number(ticker.last);
  }
}
