import fs from 'fs';
import yaml from 'yaml';
import { BotConfig } from './types/config';

export function loadConfig(path: string = 'config.yaml'): BotConfig {
  const file = fs.readFileSync(path, 'utf8');
  return yaml.parse(file) as BotConfig;
}
