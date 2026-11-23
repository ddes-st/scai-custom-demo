/**
 * AI usage flush on failure (create + capture helpers).
 * Run: node --test tools/create-section-components/ai-usage-on-failure.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAiLedger,
  flushCreateAiUsageSummary,
} from './ai-ledger.mjs';
import { flushCaptureAiUsageSummary } from '../capture/capture.mjs';

describe('flushCreateAiUsageSummary', () => {
  it('prints failure banner then page totals', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen-visual',
      section: 'section-01',
      ok: true,
      model: 'test',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      costEstimateUsd: 0.001,
    });

    const logs = [];
    const errs = [];
    const origLog = console.log;
    const origErr = console.error;
    let summaryArgs = null;
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    try {
      flushCreateAiUsageSummary({
        ledger,
        failed: true,
        error: new Error('authoring:generate exited 1'),
        tool: 'bq:create:sectioncomponents',
        logRunSummary: (opts) => {
          summaryArgs = opts;
        },
      });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    assert.ok(
      errs.some((l) =>
        /✗ bq:create:sectioncomponents failed — AI usage recorded before failure/.test(
          l,
        ),
      ),
      errs.join('\n'),
    );
    assert.ok(
      errs.some((l) => /authoring:generate exited 1/.test(l)),
      errs.join('\n'),
    );
    assert.ok(
      logs.some((l) => /AI page without fidelity/.test(l)),
      logs.join('\n'),
    );
    assert.equal(summaryArgs?.tool, 'bq:create:sectioncomponents');
    assert.ok(summaryArgs?.ai?.callCount >= 1);
  });

  it('success path has no failure banner', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-01',
      ok: true,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      costEstimateUsd: 0,
    });

    const errs = [];
    const logs = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    try {
      flushCreateAiUsageSummary({
        ledger,
        failed: false,
        tool: 'bq:create:sectioncomponents',
        logRunSummary: null,
      });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    assert.equal(errs.length, 0, errs.join('\n'));
    assert.ok(logs.some((l) => /AI page without fidelity/.test(l)));
  });
});

describe('flushCaptureAiUsageSummary', () => {
  it('prints failure banner and AI run total on stderr', () => {
    const errs = [];
    const origErr = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    try {
      flushCaptureAiUsageSummary({
        usage: {
          promptTokens: 100,
          completionTokens: 20,
          totalTokens: 120,
          costUsd: 0.01,
          calls: 2,
        },
        pages: 1,
        failed: true,
        error: new Error('boom'),
      });
    } finally {
      console.error = origErr;
    }

    assert.ok(
      errs.some((l) =>
        /✗ capture:webpage failed — AI usage recorded before failure/.test(l),
      ),
      errs.join('\n'),
    );
    assert.ok(errs.some((l) => /boom/.test(l)), errs.join('\n'));
    assert.ok(
      errs.some((l) => /AI run total: pages=1/.test(l) && /total=120/.test(l)),
      errs.join('\n'),
    );
  });

  it('success path logs AI run total without failure banner', () => {
    const logs = [];
    const errs = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    try {
      flushCaptureAiUsageSummary({
        usage: {
          promptTokens: 3,
          completionTokens: 1,
          totalTokens: 4,
          costUsd: 0,
          calls: 1,
        },
        pages: 2,
        failed: false,
      });
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    assert.equal(errs.length, 0);
    assert.ok(logs.some((l) => /✓ AI run total: pages=2/.test(l) && /total=4/.test(l)));
  });
});
