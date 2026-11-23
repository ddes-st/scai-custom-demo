#!/usr/bin/env node
/**
 * Hybrid section detection only (legacy entry).
 * Prefer: npm run capture:webpage -- --urls "…"
 *
 * Usage (from bq/):
 *   node tools/capture/compare-section-detectors.mjs --url "https://www.sitecore.com"
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const captureScript = path.join(__dirname, 'capture.mjs');

const urls = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--url') urls.push(argv[++i]);
  if (argv[i] === '--urls') {
    urls.push(...String(argv[++i] || '').split(',').map((u) => u.trim()).filter(Boolean));
  }
  if (argv[i]?.startsWith('http')) urls.push(argv[i]);
}

if (urls.length === 0) {
  console.error('Usage: node tools/capture/compare-section-detectors.mjs --url "https://example.com"');
  console.error('Note: comparison bakeoff was removed. This now runs capture:webpage (hybrid only path).');
  process.exit(1);
}

console.warn(
  'compare-section-detectors.mjs is deprecated — running capture:webpage (hybrid detection included).',
);

const child = spawn(
  process.execPath,
  [captureScript, '--urls', urls.join(','), '--devices', 'desktop', '--manifest'],
  { stdio: 'inherit', env: process.env },
);
child.on('exit', (code) => process.exit(code ?? 1));
