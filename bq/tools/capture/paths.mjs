/**
 * Paths for the website capture tooling (`bq/tools/capture`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `bq/tools/capture` */
export const captureToolRoot = path.resolve(__dirname);
/** `bq/` package root */
export const bqRoot = path.resolve(captureToolRoot, '../..');
/** Monorepo root (parent of `bq/`) */
export const repoRoot = path.resolve(bqRoot, '..');
/** Repo-root `.bq/` */
export const bqDotDir = path.join(repoRoot, '.bq');
/**
 * Capture workspace: `.bq/captures/`
 * - `{domain}/{page}/…` site captures (domain keeps `www`, e.g. www-sitecore-net)
 * - `{domain}/capture.log` run log per project
 */
export const defaultCapturesDir = path.join(bqDotDir, 'captures');

/** `{project}/capture.log` written by capture.mjs */
export function captureLogPathFor(projectRoot) {
  return path.join(projectRoot, 'capture.log');
}

/** @deprecated Use captureLogPathFor */
export function captureGenerateLogPathFor(projectRoot) {
  return captureLogPathFor(projectRoot);
}
