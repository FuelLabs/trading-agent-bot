import fs from 'fs';
import yaml from 'yaml';
import { BotConfig } from './types/config';
import { OrderType } from '../lib/rest-api/types';

export function loadConfig(path: string = 'config.yaml'): BotConfig {
  const file = fs.readFileSync(path, 'utf8');
  const configs = yaml.parse(file) as BotConfig;

  if (![OrderType.Spot, OrderType.FillOrKill].includes(configs.o2.market.order_type)) {
    throw new Error(`Invalid order_type: ${configs.o2.market.order_type}. Must be either 'Spot' or 'FillOrKill'.`);
  }

  if (!['evm', 'fuel'].includes(configs.o2.account.account_type)) {
    throw new Error(`Invalid account_type: ${configs.o2.account.account_type}. Must be either 'evm' or 'fuel'.`);
  }

  return configs;
}
