import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './build-user-manual';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(HERE, '..', 'docs', 'user-manual', 'manual.config.json');

describe('loadConfig', () => {
  it('reads manual.config.json and returns typed config', async () => {
    const cfg = await loadConfig(CONFIG_PATH);
    expect(cfg.title).toBe('Ace Tours Manager Manual');
    expect(cfg.version).toBe('1.0.0');
    expect(cfg.workflows).toHaveLength(10);
    expect(cfg.reference).toHaveLength(11);
  });
});
