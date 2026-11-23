/**
 * Remove stale `.next/dev` before `next build`.
 *
 * Next.js keeps both `.next/types` (prod) and `.next/dev/types` (dev) in
 * tsconfig `include`. A concurrent/crashed `next dev` can leave a truncated
 * `validator.ts` that fails production typecheck with TS1109/TS1128 even when
 * app sources are fine.
 */
import { rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bqRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nextDevDir = path.join(bqRoot, '.next', 'dev');

if (existsSync(nextDevDir)) {
  rmSync(nextDevDir, { recursive: true, force: true });
  console.log(`cleaned ${path.relative(bqRoot, nextDevDir)}`);
}
