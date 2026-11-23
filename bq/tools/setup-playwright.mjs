/**
 * Install Playwright Chromium into the durable bq/.playwright folder
 * (or PLAYWRIGHT_BROWSERS_PATH override). Survives Cursor sandbox cache wipes.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  bqRoot,
  ensureDurablePlaywrightBrowsersPath,
} from './capture/lib/playwright-resolve.mjs';

const browsersPath = ensureDurablePlaywrightBrowsersPath();
const requireFromBq = createRequire(path.join(bqRoot, 'package.json'));

let cliJs;
try {
  const pkgJson = requireFromBq.resolve('playwright/package.json');
  cliJs = path.join(path.dirname(pkgJson), 'cli.js');
} catch {
  console.error(
    'playwright is not installed in bq/. Run: npm install (from bq/)',
  );
  process.exit(1);
}

console.log(`Playwright browsers path: ${browsersPath}`);
console.log('Installing Chromium…');

const result = spawnSync(process.execPath, [cliJs, 'install', 'chromium'], {
  cwd: bqRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
