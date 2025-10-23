import { loadConfig } from './config';
import { createLogger } from './utils/logger';
import { CronJob } from 'cron';
import { BotConfig, MarketConfig } from './types/config';

// Load configuration
const configPath = process.env.CONFIG_PATH || 'config.yaml';
const config: BotConfig = loadConfig(configPath);

// Create logger
const logger = createLogger(config.general?.log_level?.toLowerCase() || 'info');

// Worker function for each market
async function marketWorker(marketConfig: MarketConfig, isRunningRef: { value: boolean }) {
  if (isRunningRef.value) {
    logger.warn(
      `Previous job still running for market ${marketConfig.base_symbol}/${marketConfig.quote_symbol}, skipping this tick.`
    );
    return;
  }
  isRunningRef.value = true;

  logger.debug(`Starting worker for market ${marketConfig.base_symbol}/${marketConfig.quote_symbol}`);
  try {
    // TODO: Implement trading logic here using marketConfig
    // Use marketConfig.order_interval_seconds and marketConfig.order_pairs_interval_seconds for timing
  } finally {
    isRunningRef.value = false;
  }
}

// Start a cron job for each market
if (config.o2?.markets && Array.isArray(config.o2.markets)) {
  config.o2.markets.forEach((marketConfig: MarketConfig) => {
    const interval = Number(marketConfig.order_pairs_interval_seconds);
    const cronPattern = `*/${interval} * * * * *`;
    const isRunningRef = { value: false };
    const job = new CronJob(
      cronPattern,
      () => {
        marketWorker(marketConfig, isRunningRef);
      },
      null,
      true,
      'UTC'
    );
    logger.info(
      `Scheduled cron job for O2 market ${marketConfig.base_symbol}/${marketConfig.quote_symbol} with interval ${marketConfig.order_pairs_interval_seconds} seconds.`
    );
  });
} else {
  logger.warn('No markets found with correct structure in config.');
}
