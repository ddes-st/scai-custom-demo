#!/usr/bin/env node
/**
 * Deprecated entry — capture tooling lives in bq/tools/capture.
 * Forwards to: cd bq && npm run capture:webpage -- …
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bqDir = path.join(repoRoot, 'bq');
const scriptName = process.env.CAPTURE_FORWARD_SCRIPT || 'capture:webpage';
const args = process.argv.slice(2);

console.warn(
  `[deprecated] .cursor/capture-website/scripts → use from bq/: npm run ${scriptName} -- …`
);

const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', scriptName, '--', ...args],
  { cwd: bqDir, stdio: 'inherit', shell: true }
);

child.on('exit', (code) => process.exit(code ?? 1));
