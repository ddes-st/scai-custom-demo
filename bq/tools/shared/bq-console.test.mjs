/**
 * Run: node --test tools/shared/bq-console.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  colorizeTaggedMessage,
  detectSeverity,
  nestPrefixForTag,
  phaseNestConsoleIndent,
} from './bq-console.mjs';

describe('detectSeverity', () => {
  it('does not treat failed=0 counters as errors', () => {
    const line =
      'AI merge pairs: called=0, unsureNoAi=1, failed=0, tokens in=0 out=0 total=0 cost n/a';
    assert.equal(detectSeverity('log', line), null);
  });

  it('does not treat failed=12 counters as errors', () => {
    assert.equal(
      detectSeverity('log', 'Done. emitted=3 failed=12 unchanged=0'),
      null,
    );
  });

  it('still flags real failure phrases', () => {
    assert.equal(detectSeverity('log', 'Failed to push serialization'), 'red');
    assert.equal(detectSeverity('log', '[bq:apply:sites-api] Failed'), 'red');
    assert.equal(detectSeverity('log', 'ser push failed to complete'), 'red');
  });

  it('console.error level is always red', () => {
    assert.equal(detectSeverity('error', 'anything'), 'red');
  });

  it('keeps yellow for fixup / warn markers', () => {
    assert.equal(detectSeverity('log', '⚠ Codegen fixup: narrowed Link'), 'yellow');
  });

  it('flags bq:emit prune as yellow', () => {
    assert.equal(
      detectSeverity('log', '[bq:apply] prune obsolete section field YAML'),
      'yellow',
    );
  });

  it('flags CM delete via Authoring API as orange (between red and yellow)', () => {
    assert.equal(
      detectSeverity(
        'log',
        '[bq:apply:sites-api] CM delete via Authoring API (permanent): {FDAE9A16-16A6-5CD1-A492-01D9A49A04C9} /sitecore/content/…/investing',
      ),
      'orange',
    );
    assert.equal(
      detectSeverity(
        'log',
        '[bq:apply:sites-api] UpdateItem NRE ×1 — CM delete via Authoring API then re-push (round 1/20)…',
      ),
      'orange',
    );
  });

  it('flags failed Authoring API CM delete as yellow, not orange/red', () => {
    assert.equal(
      detectSeverity(
        'log',
        '[bq:apply:sites-api] ⚠ CM delete via Authoring API (permanent) failed for {AAAA}: not found',
      ),
      'yellow',
    );
    assert.equal(
      detectSeverity(
        'log',
        '  · ⚠ CM delete via Authoring API (permanent) failed for {80EA3AE7-36F6-4A25-885E-36FB6482B459}: template-in-use cascade exhausted after 3 round(s)',
      ),
      'yellow',
    );
  });

  it('paints Authoring API CM delete lines orange, not red', () => {
    const prevForce = process.env.FORCE_COLOR;
    const prevNoColor = process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    delete process.env.NO_COLOR;
    try {
      const out = colorizeTaggedMessage(
        'log',
        '[bq:apply:sites-api] CM delete via Authoring API (permanent): {AAAA}',
      );
      assert.match(out, /\u001b\[38;5;208m/);
      assert.doesNotMatch(out, /\u001b\[91m/);
    } finally {
      if (prevForce === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = prevForce;
      if (prevNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prevNoColor;
    }
  });
});

describe('nestPrefixForTag', () => {
  it('no longer special-cases emit tags (hierarchy via phase nest / >)', () => {
    assert.equal(nestPrefixForTag('bq:emit'), '');
    assert.equal(nestPrefixForTag('bq:emit:content'), '');
    assert.equal(nestPrefixForTag('bq:definitions:generate'), '');
  });
});

describe('phaseNestConsoleIndent', () => {
  it('indents when BQ_PHASE_NEST is set', () => {
    const prev = process.env.BQ_PHASE_NEST;
    process.env.BQ_PHASE_NEST = JSON.stringify({
      tool: 'bq:create:sectioncomponents',
      phase: 7,
      total: 7,
      title: 'Final',
    });
    try {
      assert.equal(phaseNestConsoleIndent(), '  ');
    } finally {
      if (prev === undefined) delete process.env.BQ_PHASE_NEST;
      else process.env.BQ_PHASE_NEST = prev;
    }
  });

  it('no indent without nest', () => {
    const prev = process.env.BQ_PHASE_NEST;
    delete process.env.BQ_PHASE_NEST;
    try {
      assert.equal(phaseNestConsoleIndent(), '');
    } finally {
      if (prev !== undefined) process.env.BQ_PHASE_NEST = prev;
    }
  });
});

describe('colorizeTaggedMessage indent', () => {
  it('leaves emit tags flush (no auto nest spaces)', () => {
    const out = colorizeTaggedMessage('log', '[bq:apply:media] wrote /path (12ms)');
    assert.match(out, /^\[bq:apply:media\]/);
  });

  it('leaves definitions:generate flush', () => {
    const out = colorizeTaggedMessage(
      'log',
      '[bq:definitions:generate] foo … emitting',
    );
    assert.match(out, /^\[bq:definitions:generate\]/);
  });
});
