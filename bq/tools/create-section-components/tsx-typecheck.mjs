/**
 * Typecheck staged generated TSX/client files against bq/tsconfig.json.
 * Diagnostics are filtered to the staged paths only.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { bqRoot } from '../capture/paths.mjs';

/**
 * @param {string} absPath
 * @returns {string}
 */
function normPath(absPath) {
  return path.resolve(absPath).replace(/\\/g, '/').toLowerCase();
}

/**
 * Load compiler options from bq/tsconfig.json.
 * @returns {{ options: ts.CompilerOptions, configPath: string }}
 */
export function loadBqTsCompilerOptions() {
  const configPath = path.join(bqRoot, 'tsconfig.json');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    throw new Error(
      `tsx-typecheck: failed to read ${configPath}: ${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`,
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    bqRoot,
    undefined,
    configPath,
  );
  const options = {
    ...parsed.options,
    noEmit: true,
    skipLibCheck: true,
  };
  return { options, configPath };
}

/**
 * Format a TS diagnostic as a single line for AI revision briefs.
 * @param {ts.Diagnostic} diag
 * @param {string} [bqRootAbs]
 * @returns {string}
 */
export function formatTsDiagnostic(diag, bqRootAbs = bqRoot) {
  const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
  const code = typeof diag.code === 'number' ? `TS${diag.code}` : 'TS';
  if (diag.file && diag.start != null) {
    const { line, character } = diag.file.getLineAndCharacterOfPosition(
      diag.start,
    );
    let fileLabel = diag.file.fileName;
    const rootNorm = path.resolve(bqRootAbs).replace(/\\/g, '/');
    const fileNorm = path.resolve(diag.file.fileName).replace(/\\/g, '/');
    if (fileNorm.toLowerCase().startsWith(rootNorm.toLowerCase())) {
      fileLabel = fileNorm.slice(rootNorm.length).replace(/^\//, '');
    }
    return `TSC: ${fileLabel}:${line + 1}:${character + 1} — ${code}: ${msg}`;
  }
  return `TSC: ${code}: ${msg}`;
}

/**
 * Typecheck the given absolute file paths (must already exist on disk).
 * Only returns diagnostics whose file is in `filePaths`.
 *
 * @param {string[]} filePaths Absolute paths to generated .tsx files
 * @param {{ rootDir?: string }} [opts]
 * @returns {string[]} Diagnostic strings prefixed with `TSC: `
 */
export function typecheckGeneratedFiles(filePaths, opts = {}) {
  const paths = (filePaths || [])
    .map((p) => path.resolve(String(p || '')))
    .filter((p) => p && /\.tsx?$/i.test(p) && existsSync(p));
  if (!paths.length) return [];

  const rootDir = opts.rootDir || bqRoot;
  const { options } = loadBqTsCompilerOptions();
  const program = ts.createProgram({
    rootNames: paths,
    options: {
      ...options,
      rootDir: undefined,
    },
  });
  const allow = new Set(paths.map(normPath));
  const diags = ts.getPreEmitDiagnostics(program);
  /** @type {string[]} */
  const out = [];
  for (const d of diags) {
    if (d.category !== ts.DiagnosticCategory.Error) continue;
    if (!d.file) continue;
    if (!allow.has(normPath(d.file.fileName))) continue;
    out.push(formatTsDiagnostic(d, rootDir));
  }
  return out;
}
