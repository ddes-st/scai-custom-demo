import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  AI_USAGE_META_FILE,
  buildAiUsageEntry,
  getAiUsageEntry,
  readAiUsageMeta,
  writeAiUsageMeta,
} from './ai-usage-meta.mjs';

describe('ai-usage-meta', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('buildAiUsageEntry normalizes usage and cost', () => {
    const entry = buildAiUsageEntry({
      purpose: 'ai-derived-design',
      model: 'gpt-test',
      ok: true,
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      costEstimate: {
        currency: 'USD',
        inputUsd: 0.001,
        outputUsd: 0.002,
        totalUsd: 0.003,
        rateNote: 'note',
        rateSource: 'retail',
      },
      context: { sourceHash: 'abc' },
    });
    assert.equal(entry.purpose, 'ai-derived-design');
    assert.equal(entry.usage.promptTokens, 10);
    assert.equal(entry.usage.completionTokens, 5);
    assert.equal(entry.costEstimate.totalUsd, 0.003);
    assert.equal(entry.context.sourceHash, 'abc');
    assert.equal(entry.aggregates, null);
  });

  it('writeAiUsageMeta upserts by purpose', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-meta-'));
    temps.push(dir);

    await writeAiUsageMeta(dir, {
      purpose: 'ai-derived-design',
      model: 'm1',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      costEstimate: { totalUsd: 0.01, inputUsd: 0.005, outputUsd: 0.005 },
      context: { sourceHash: 'h1' },
    });
    await writeAiUsageMeta(dir, {
      purpose: 'section-similarity-merge',
      aggregates: {
        calls: 3,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        costUsd: 0.02,
      },
      context: { called: 3 },
    });
    await writeAiUsageMeta(dir, {
      purpose: 'ai-derived-design',
      model: 'm2',
      usage: { promptTokens: 9, completionTokens: 1, totalTokens: 10 },
      costEstimate: { totalUsd: 0.05, inputUsd: 0.04, outputUsd: 0.01 },
      context: { sourceHash: 'h2' },
    });

    const raw = JSON.parse(await readFile(path.join(dir, AI_USAGE_META_FILE), 'utf8'));
    assert.equal(raw.entries.length, 2);
    const design = await getAiUsageEntry(dir, 'ai-derived-design');
    assert.equal(design.model, 'm2');
    assert.equal(design.context.sourceHash, 'h2');
    assert.equal(design.usage.promptTokens, 9);
    const merge = await getAiUsageEntry(dir, 'section-similarity-merge');
    assert.equal(merge.aggregates.calls, 3);
    assert.equal(merge.aggregates.costEstimateUsd, 0.02);

    const doc = await readAiUsageMeta(dir);
    assert.equal(doc.entries.length, 2);
  });

  it('requires purpose', () => {
    assert.throws(() => buildAiUsageEntry({}), /purpose/);
  });
});
