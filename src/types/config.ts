export interface GeneralConfig {
  log_level: string;
}

export interface MarketConfig {
  id: string;
  base_symbol: string;
  quote_symbol: string;
  order_usdc_value: number;
  order_interval_seconds: number;
  order_pairs_interval_seconds: number;
  bitget_symbol: string;
  convert_to_usdc: boolean;
}

export interface O2AccountConfig {
  private_key: string;
}

export interface O2Config {
  base_url: string;
  markets: MarketConfig[];
  account: O2AccountConfig;
}

export interface BotConfig {
  general: GeneralConfig;
  o2: O2Config;
}
