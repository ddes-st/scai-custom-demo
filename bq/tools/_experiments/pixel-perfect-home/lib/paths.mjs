/**
 * Paths for the pixel-perfect experiment sandbox.
 * Outputs go under `.bq/experiments/pixel-perfect-home/` (gitignored via `.bq/`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const experimentToolRoot = path.resolve(__dirname, '..');
export const bqRoot = path.resolve(experimentToolRoot, '../../..');
export const repoRoot = path.resolve(bqRoot, '..');
export const bqDotDir = path.join(repoRoot, '.bq');

export const capturePageDir = path.join(
  bqDotDir,
  'captures',
  'www-sitecore-com',
  'www-sitecore-com--home'
);

export const experimentOutRoot = path.join(bqDotDir, 'experiments', 'pixel-perfect-home');
export const methodsOutRoot = path.join(experimentOutRoot, 'methods');
export const reportsOutRoot = path.join(experimentOutRoot, 'reports');

/** Sample sections used for method bake-off */
export const SAMPLE_SECTIONS = ['section-04', 'section-07', 'section-13'];

/** All section folders on this capture */
export const ALL_SECTIONS = Array.from({ length: 13 }, (_, i) => `section-${String(i + 1).padStart(2, '0')}`);
