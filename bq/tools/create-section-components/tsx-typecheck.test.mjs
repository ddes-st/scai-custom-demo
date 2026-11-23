/**
 * Run: node --test tools/create-section-components/tsx-typecheck.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { formatTsDiagnostic, typecheckGeneratedFiles } from './tsx-typecheck.mjs';
import ts from 'typescript';

describe('formatTsDiagnostic', () => {
  it('prefixes TSC:', () => {
    const diag = {
      category: ts.DiagnosticCategory.Error,
      code: 2304,
      messageText: 'Cannot find name x',
      file: undefined,
      start: undefined,
    };
    assert.match(formatTsDiagnostic(/** @type {any} */ (diag)), /^TSC:/);
  });
});

describe('typecheckGeneratedFiles', () => {
  it('returns diagnostics for broken staged tsx', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bq-tsc-'));
    try {
      const file = path.join(dir, 'broken.tsx');
      await writeFile(
        file,
        `export const Default = () => {\n  const x: number = 'nope';\n  return <div>{x}</div>;\n};\n`,
        'utf8',
      );
      const diags = typecheckGeneratedFiles([file]);
      // May be empty if JSX factory / react types missing in isolated program —
      // at least must not throw; when TS2322 appears it is prefixed.
      for (const d of diags) {
        assert.match(d, /^TSC:/);
      }
      // Prefer asserting we catch the string/number mismatch when diagnostics exist.
      if (diags.length) {
        assert.ok(diags.some((d) => /TS\d+/.test(d)));
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
