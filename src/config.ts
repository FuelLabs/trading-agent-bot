import fs from 'fs';
import yaml from 'yaml';

export function loadConfig(path: string = 'config.yaml') {
  const file = fs.readFileSync(path, 'utf8');
  return yaml.parse(file);
}
