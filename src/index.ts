import { loadConfig } from './config';

const configPath = process.env.CONFIG_PATH || 'config.yaml';
const config = loadConfig(configPath);

console.log('Loaded config:', config);
console.log('Hello from Volume Mining Bot!');
