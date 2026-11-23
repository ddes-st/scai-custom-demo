/**
 * Load bq/.env then bq/.env.local into process.env (mjs twin of tools/shared/load-local-env.ts).
 * Never log values from these files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bqRoot } from '../../paths.mjs';

export function loadLocalEnvFiles(options = {}) {
  const root = options.root ?? bqRoot;
  const lockedKeys = new Set();
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== '') lockedKeys.add(key);
  }

  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(root, fileName);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (lockedKeys.has(key)) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
