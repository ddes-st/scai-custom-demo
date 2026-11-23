/**
 * Run: node --test tools/create-section-components/tsx-format-repair.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractTsxFromLlm,
  extractTsxPackageFromLlm,
  snippetAroundPrettierError,
  writeComponentPackageWithFormatRetries,
} from './tsx-format-repair.mjs';
import {
  isTsxFormatFailure,
  resolveTsxFormatMaxIters,
  TSX_FORMAT_AI_RETRIES_DEFAULT,
} from './tsx-format-iters.mjs';

describe('tsx-format-iters', () => {
  it('always defaults to one AI retry (no env gate)', () => {
    assert.equal(TSX_FORMAT_AI_RETRIES_DEFAULT, 1);
    assert.equal(resolveTsxFormatMaxIters(), 1);
  });

  it('detects prettier format failures', () => {
    assert.equal(
      isTsxFormatFailure(
        new Error('format: prettier failed for x.tsx — refusing to write'),
      ),
      true,
    );
    assert.equal(isTsxFormatFailure(new Error('ENOENT')), false);
  });
});

describe('extractTsxPackageFromLlm', () => {
  it('strips fences and markers', () => {
    const raw = `=== tsx ===
\`\`\`tsx
export const Default = () => <div />;
\`\`\`
=== clientTsx ===
'use client';
export default function C() { return null; }
`;
    const parsed = extractTsxPackageFromLlm(raw, { expectClient: true });
    assert.match(parsed.tsx, /export const Default/);
    assert.match(parsed.clientTsx || '', /use client/);
  });

  it('extractTsxFromLlm drops prose before import', () => {
    const out = extractTsxFromLlm('Here is the fix:\nimport React from "react";\nexport const X = 1;');
    assert.match(out, /^import React/);
  });
});

describe('snippetAroundPrettierError', () => {
  it('returns numbered window around loc', () => {
    const src = Array.from({ length: 40 }, (_, i) => `line${i + 1}`).join('\n');
    const snip = snippetAroundPrettierError(src, "err (21:10)", 2);
    assert.match(snip, /19\| line19/);
    assert.match(snip, /21\| line21/);
  });
});

describe('writeComponentPackageWithFormatRetries', () => {
  it('succeeds without repair when writeFn succeeds', async () => {
    let calls = 0;
    const out = await writeComponentPackageWithFormatRetries(
      { componentName: 'Demo', tsx: 'export const Default = () => null;' },
      {
        maxRetries: 1,
        writeFn: async (opts) => {
          calls += 1;
          return { tsx: opts.tsx, ok: true };
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(out.ok, true);
  });

  it('salvage path: write fails once then repair+write succeeds', async () => {
    let writes = 0;
    let repairs = 0;
    const out = await writeComponentPackageWithFormatRetries(
      {
        componentName: 'Demo',
        tsx: '<divclassName="x" />',
        clientTsx: null,
      },
      {
        maxRetries: 1,
        writeFn: async (opts) => {
          writes += 1;
          if (writes === 1) {
            throw new Error(
              'format: prettier failed for demo.tsx — refusing to write invalid/unformatted source',
            );
          }
          return { tsx: opts.tsx, ok: true };
        },
        repairFn: async () => {
          repairs += 1;
          return { ok: true, tsx: 'export const Default = () => <div className="x" />;' };
        },
      },
    );
    assert.equal(writes, 2);
    assert.equal(repairs, 1);
    assert.equal(out.ok, true);
  });

  it('opts.maxRetries=0 can disable AI retry (tests only)', async () => {
    await assert.rejects(
      () =>
        writeComponentPackageWithFormatRetries(
          { componentName: 'Demo', tsx: 'bad' },
          {
            maxRetries: 0,
            writeFn: async () => {
              throw new Error('format: prettier failed for demo.tsx');
            },
            repairFn: async () => {
              throw new Error('should not call repair');
            },
          },
        ),
      /prettier failed/,
    );
  });

  it('defaults to one AI retry when maxRetries omitted', async () => {
    let writes = 0;
    let repairs = 0;
    const out = await writeComponentPackageWithFormatRetries(
      { componentName: 'Demo', tsx: 'bad' },
      {
        writeFn: async () => {
          writes += 1;
          if (writes === 1) {
            throw new Error('format: prettier failed for demo.tsx');
          }
          return { ok: true };
        },
        repairFn: async () => {
          repairs += 1;
          return { ok: true, tsx: 'export const Default = () => null;' };
        },
      },
    );
    assert.equal(writes, 2);
    assert.equal(repairs, 1);
    assert.equal(out.ok, true);
  });

  it('throws when retries exhausted', async () => {
    await assert.rejects(
      () =>
        writeComponentPackageWithFormatRetries(
          { componentName: 'Demo', tsx: 'bad', clientTsx: 'also bad' },
          {
            maxRetries: 1,
            writeFn: async () => {
              throw new Error(
                'format: prettier failed for demo.client.tsx — refusing',
              );
            },
            repairFn: async () => ({
              ok: true,
              tsx: 'still-bad',
              clientTsx: 'still-bad-client',
            }),
          },
        ),
      /prettier failed/,
    );
  });
});
