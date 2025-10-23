import { loadConfig } from './config';
import { createLogger } from './utils/logger';

// Load configuration
const configPath = process.env.CONFIG_PATH || 'config.yaml';
const config = loadConfig(configPath);

// Create logger
const logger = createLogger(config.general?.log_level?.toLowerCase() || 'info');
