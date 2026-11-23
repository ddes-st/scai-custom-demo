import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAiLedger,
  formatAiUsageLine,
  isFidelityPurpose,
} from './ai-ledger.mjs';

function usage(promptTokens, completionTokens, totalUsd) {
  return {
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    costEstimate: { totalUsd },
  };
}

describe('isFidelityPurpose', () => {
  it('matches source and visual prefixes', () => {
    assert.equal(isFidelityPurpose('visual-fidelity-score'), true);
    assert.equal(isFidelityPurpose('visual-fidelity-codegen'), true);
    assert.equal(isFidelityPurpose('source-fidelity-score'), true);
    assert.equal(isFidelityPurpose('codegen'), false);
    assert.equal(isFidelityPurpose('visual-fidelity-score', 'source'), false);
    assert.equal(isFidelityPurpose('visual-fidelity-score', 'visual'), true);
  });
});

describe('formatAiUsageLine', () => {
  it('includes cost estimate', () => {
    const line = formatAiUsageLine({
      section: 'section-04',
      purpose: 'visual-fidelity-score',
      iteration: 1,
      ok: true,
      model: 'gpt-test',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      costEstimateUsd: 0.005,
    });
    assert.match(line, /visual-fidelity-score i1/);
    assert.match(line, /~\$0\.0050/);
  });
});

describe('createAiLedger brandkit', () => {
  it('includes brandkit-generate in run totals', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'brandkit-generate',
      ok: true,
      model: 'gpt-test',
      ...usage(2000, 400, 0.012),
    });
    ledger.record({
      purpose: 'brandkit-generate',
      ok: true,
      skipReason: 'draft cache hit (inputHash match)',
    });
    const all = ledger.totals();
    assert.equal(all.callCount, 1);
    assert.equal(all.costEstimateUsd, 0.012);
    assert.equal(all.promptTokens, 2000);
  });
});

describe('createAiLedger cost split', () => {
  it('splits without-fidelity vs fidelity totals', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-04',
      componentName: 'Hero',
      ok: true,
      ...usage(1000, 100, 0.03),
    });
    ledger.record({
      purpose: 'visual-fidelity-score',
      section: 'section-04',
      componentName: 'Hero',
      iteration: 1,
      ok: true,
      ...usage(500, 50, 0.005),
    });
    ledger.record({
      purpose: 'visual-fidelity-codegen',
      section: 'section-04',
      componentName: 'Hero',
      iteration: 1,
      ok: true,
      ...usage(2000, 200, 0.02),
    });

    const without = ledger.totalsNonFidelity({ section: 'section-04' });
    const fid = ledger.totalsFidelity(null, { section: 'section-04' });
    const all = ledger.totals((c) => c.section === 'section-04');

    assert.equal(without.callCount, 1);
    assert.equal(without.costEstimateUsd, 0.03);
    assert.equal(fid.callCount, 2);
    assert.equal(fid.costEstimateUsd, 0.025);
    assert.equal(all.callCount, 3);
    assert.equal(all.costEstimateUsd, 0.055);
  });

  it('printSectionTotals emits without / fidelity / with lines', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-04',
      ok: true,
      ...usage(100, 10, 0.01),
    });
    ledger.record({
      purpose: 'visual-fidelity-score',
      section: 'section-04',
      iteration: 1,
      ok: true,
      ...usage(50, 5, 0.002),
    });

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      ledger.printSectionTotals('section-04');
    } finally {
      console.log = orig;
    }

    assert.ok(
      lines.some((l) => l.includes('without fidelity') && l.includes('~$0.0100')),
      `missing without line: ${lines.join('\n')}`,
    );
    assert.ok(
      lines.some((l) => l.includes('AI fidelity [section-04]') && l.includes('~$0.0020')),
      `missing fidelity line: ${lines.join('\n')}`,
    );
    assert.ok(
      lines.some((l) => l.includes('with fidelity') && l.includes('~$0.0120')),
      `missing with line: ${lines.join('\n')}`,
    );
  });

  it('printSectionTotals omits with-fidelity when fidelity did not run', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-01',
      ok: true,
      ...usage(100, 10, 0.01),
    });

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      ledger.printSectionTotals('section-01');
    } finally {
      console.log = orig;
    }

    assert.equal(lines.length, 1);
    assert.match(lines[0], /without fidelity/);
    assert.doesNotMatch(lines.join('\n'), /with fidelity/);
  });

  it('printPageTotals emits without / fidelity / with lines', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-01',
      ok: true,
      ...usage(100, 10, 0.01),
    });
    ledger.record({
      purpose: 'visual-fidelity-codegen',
      section: 'section-01',
      iteration: 1,
      ok: true,
      ...usage(200, 20, 0.004),
    });

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      ledger.printPageTotals();
    } finally {
      console.log = orig;
    }

    assert.ok(lines.some((l) => l.includes('AI page without fidelity')));
    assert.ok(lines.some((l) => l.includes('AI fidelity run totals')));
    assert.ok(lines.some((l) => l.includes('AI page with fidelity') && l.includes('~$0.0140')));
  });

  it('printPageTotals omits with-fidelity when fidelity did not run', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'codegen',
      section: 'section-01',
      ok: true,
      ...usage(100, 10, 0.01),
    });

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      ledger.printPageTotals();
    } finally {
      console.log = orig;
    }

    assert.equal(lines.length, 1);
    assert.match(lines[0], /AI page without fidelity/);
    assert.doesNotMatch(lines.join('\n'), /with fidelity/);
  });

  it('totals callCount excludes skipped (no AI) ledger rows', () => {
    const ledger = createAiLedger();
    ledger.record({
      purpose: 'decompose',
      section: 'section-01',
      ok: true,
      skipReason: 'conversionSourceHash match',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costEstimateUsd: 0,
    });
    ledger.record({
      purpose: 'codegen',
      section: 'section-02',
      ok: true,
      ...usage(100, 20, 0.01),
    });

    const t = ledger.totals();
    assert.equal(t.callCount, 1);
    assert.equal(t.promptTokens, 100);
    assert.equal(t.completionTokens, 20);
    assert.equal(t.totalTokens, 120);
    assert.equal(t.costEstimateUsd, 0.01);
  });
});
