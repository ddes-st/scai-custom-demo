/**
 * Resolve Playwright from the bq package (devDependency).
 * Pins browser binaries under bq/.playwright so Cursor sandbox temp
 * does not wipe installs between agent runs.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { bqRoot } from '../paths.mjs';

export { bqRoot, defaultCapturesDir, captureToolRoot } from '../paths.mjs';

const requireFromBq = createRequire(path.join(bqRoot, 'package.json'));

/** Absolute default: `<bqRoot>/.playwright` */
export function defaultPlaywrightBrowsersPath() {
  return path.join(bqRoot, '.playwright');
}

/**
 * Cursor (and similar) inject PLAYWRIGHT_BROWSERS_PATH into ephemeral temp
 * caches that get wiped — treat those as unset so we stay durable.
 * @param {string} p
 */
export function isEphemeralPlaywrightBrowsersPath(p) {
  const n = String(p || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (!n) return true;
  if (n.includes('/cursor-sandbox-cache/')) return true;
  if (n.includes('/tmp/cursor-')) return true;
  // Windows %TEMP%\…\playwright without a durable project root
  if (/\/temp\/[^/]*cursor[^/]*\//.test(n)) return true;
  return false;
}

/**
 * Ensure PLAYWRIGHT_BROWSERS_PATH points at a durable folder.
 * Respects a non-ephemeral explicit env override; otherwise pins to bq/.playwright.
 * Always overwrites Cursor sandbox temp paths.
 * @returns {string} resolved browsers path
 */
export function ensureDurablePlaywrightBrowsersPath() {
  const existing = String(process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim();
  if (existing && !isEphemeralPlaywrightBrowsersPath(existing)) {
    return path.resolve(existing);
  }
  const durable = defaultPlaywrightBrowsersPath();
  process.env.PLAYWRIGHT_BROWSERS_PATH = durable;
  return durable;
}

// Pin as soon as this module loads (capture / fidelity / setup all import it).
ensureDurablePlaywrightBrowsersPath();

export function resolvePlaywright() {
  ensureDurablePlaywrightBrowsersPath();

  if (process.env.PLAYWRIGHT_MODULE_PATH) {
    try {
      return requireFromBq(process.env.PLAYWRIGHT_MODULE_PATH);
    } catch {
      // fall through
    }
  }

  try {
    return requireFromBq('playwright');
  } catch {
    throw new Error(
      `Could not find playwright in the bq package.\n\n` +
        `From bq/:\n` +
        `  npm install\n` +
        `  npm run setup:playwright\n\n` +
        `Or set PLAYWRIGHT_MODULE_PATH to an existing Playwright install.\n` +
        `Browsers path: ${process.env.PLAYWRIGHT_BROWSERS_PATH || defaultPlaywrightBrowsersPath()}`,
    );
  }
}
