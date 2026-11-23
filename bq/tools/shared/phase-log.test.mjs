/**
 * Run: node --test tools/shared/phase-log.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  BQ_SER_OPS_LOG_ENV,
  clearPhaseHistory,
  clearPhaseNest,
  clearSerOps,
  clearSummaryHistory,
  formatIntentionalSkipReason,
  formatSummaryDuration,
  getPhaseHistory,
  getSerOps,
  getSummaryHistory,
  logPhase,
  logPhaseDone,
  logPhaseSkip,
  logRunStart,
  logRunSummary,
  logShellCommand,
  logStepStart,
  mergeSerOpsFromLogFile,
  parseSkippedPhaseTitle,
  pushPhaseHistoryScope,
  popPhaseHistoryScope,
  recordSerOp,
  setPhaseNest,
  withPhaseHistoryScope,
} from './phase-log.mjs';

describe('phase-log slim lines', () => {
  /** @type {string[]} */
  let lines;
  /** @type {typeof console.log} */
  let origLog;

  beforeEach(() => {
    lines = [];
    origLog = console.log;
    console.log = (...args) => {
      lines.push(args.map(String).join(' '));
    };
    clearPhaseHistory();
    clearSummaryHistory();
    clearSerOps();
    clearPhaseNest();
    delete process.env.BQ_RUN_T0;
    delete process.env[BQ_SER_OPS_LOG_ENV];
    process.env.BQ_RUN_T0 = String(Date.now());
    logPhaseDone();
  });

  afterEach(() => {
    console.log = origLog;
    clearPhaseNest();
    clearPhaseHistory();
    clearSummaryHistory();
    clearSerOps();
    delete process.env[BQ_SER_OPS_LOG_ENV];
  });

  it('prints -> start and ok done without ==== or What this does', () => {
    logPhase({
      tool: 'bq:definitions:generate',
      phase: 9,
      total: 10,
      title: 'Ser validate',
      detail: ['This should not appear'],
    });
    logPhaseDone();
    const joined = lines.join('\n');
    assert.ok(!joined.includes('===='));
    assert.ok(!joined.includes('What this does'));
    assert.match(joined, /-> 9\/10 Ser validate/);
    assert.match(joined, /ok 9\/10/);
  });

  it('prints blank line before ->', () => {
    logPhase({
      tool: 'bq:create:sectioncomponents',
      phase: 1,
      total: 7,
      title: 'Merge host section registry',
    });
    assert.equal(lines[0], '');
    assert.match(lines[1], /-> 1\/7/);
  });

  it('nests with indent when BQ_PHASE_NEST set', () => {
    setPhaseNest({
      tool: 'bq:create:sectioncomponents',
      phase: 7,
      total: 7,
      title: 'Final authoring generate',
    });
    logPhase({
      tool: 'bq:definitions:generate',
      phase: 9,
      total: 10,
      title: 'Ser validate',
    });
    const start = lines.find((l) => l.includes('-> 9/10'));
    assert.ok(start);
    assert.match(start, /^\s{2}\[bq:definitions:generate\]/);
  });

  it('logShellCommand uses >', () => {
    logShellCommand('dotnet sitecore ser validate -i BQ');
    assert.match(lines.join('\n'), /> dotnet sitecore ser validate/);
  });

  it('logPhaseSkip records skip without fractional phases', () => {
    logPhaseSkip({
      tool: 'bq:create:sectioncomponents',
      phase: 3,
      total: 7,
      title: 'Initial authoring generate',
      reason: 'not used in --all',
    });
    const joined = lines.join('\n');
    assert.match(joined, /skip 3\/7/);
    assert.match(joined, /intentional — not used in --all/);
    assert.equal(getPhaseHistory().length, 1);
    assert.equal(getPhaseHistory()[0].skipped, true);
    assert.match(getPhaseHistory()[0].skipReason, /^intentional —/);
  });

  it('formatIntentionalSkipReason marks skips as intentional', () => {
    assert.equal(
      formatIntentionalSkipReason('--skipPull'),
      'intentional — --skipPull (create/final emit or CLI requested no ser pull)',
    );
    assert.equal(
      formatIntentionalSkipReason('API ensure first; pull after site'),
      'intentional — API ensure first; pull after site (Sites API GET/create, then one ser pull)',
    );
    assert.equal(
      formatIntentionalSkipReason('skipped'),
      'intentional — not needed for this run',
    );
    assert.equal(
      formatIntentionalSkipReason('intentional — already said'),
      'intentional — already said',
    );
  });

  it('parseSkippedPhaseTitle extracts why from title', () => {
    assert.deepEqual(
      parseSkippedPhaseTitle('Ser pull (start) — skipped (--skipPull)'),
      { title: 'Ser pull (start)', reason: '--skipPull' },
    );
    assert.deepEqual(
      parseSkippedPhaseTitle(
        'Ser pull (start) — skipped (API ensure first; pull after site)',
      ),
      {
        title: 'Ser pull (start)',
        reason: 'API ensure first; pull after site',
      },
    );
    assert.deepEqual(
      parseSkippedPhaseTitle('Final authoring generate — skipped'),
      { title: 'Final authoring generate', reason: 'not needed for this run' },
    );
  });

  it('logPhase skipped titles print intentional why', () => {
    logPhase({
      tool: 'bq:definitions:generate',
      phase: 3,
      total: 10,
      title: 'Ser pull (start) — skipped (--skipPull)',
    });
    const joined = lines.join('\n');
    assert.match(joined, /skip 3\/10 Ser pull \(start\)/);
    assert.match(
      joined,
      /intentional — --skipPull \(create\/final emit or CLI requested no ser pull\)/,
    );
  });

  it('logStepStart has no N/M', () => {
    logStepStart({
      tool: 'bq:create:sectioncomponents',
      title: 'Phase A — registry codegen',
    });
    logPhaseDone();
    const joined = lines.join('\n');
    assert.match(joined, /-> Phase A — registry codegen/);
    assert.ok(!/-> \d+\/\d+ Phase A/.test(joined));
  });

  it('formatSummaryDuration uses MM:SS,cc', () => {
    assert.equal(formatSummaryDuration(144), '00:00,14');
    assert.equal(formatSummaryDuration(899), '00:00,89');
    assert.equal(formatSummaryDuration(3200), '00:03,20');
    assert.equal(formatSummaryDuration(12000), '00:12,00');
    assert.equal(formatSummaryDuration(146000), '02:26,00');
  });

  it('logRunSummary includes total and phase titles', () => {
    logPhase({
      tool: 'bq:create:sectioncomponents',
      phase: 1,
      total: 7,
      title: 'Merge host section registry',
    });
    logPhaseDone();
    logStepStart({
      tool: 'bq:create:sectioncomponents',
      title: 'Phase A — registry codegen',
    });
    logPhaseDone();
    logRunSummary({
      tool: 'bq:create:sectioncomponents',
      ai: { callCount: 2, promptTokens: 10, completionTokens: 5, totalTokens: 15, costEstimateUsd: 0.01 },
      ser: { validate: 'ok', push: 'ok' },
    });
    const joined = lines.join('\n');
    assert.match(joined, /-- Run summary --/);
    assert.match(joined, /total /);
    assert.match(joined, /1\/7\s+Merge host section registry/);
    assert.match(joined, /Phase A — registry codegen/);
    assert.match(joined, /AI\s+calls=2/);
    assert.match(joined, /ser\s+validate=ok/);
    assert.ok(!/\d+ms/.test(joined.split('-- Run summary --')[1] || ''));
  });

  it('withPhaseHistoryScope discards nested live history but keeps outer in summary', async () => {
    logRunStart({ tool: 'bq:create:sectioncomponents' });
    lines.length = 0;
    logPhase({
      tool: 'bq:create:sectioncomponents',
      phase: 1,
      total: 7,
      title: 'Outer merge',
    });
    logPhaseDone();
    await withPhaseHistoryScope(async () => {
      logPhase({
        tool: 'bq:create:sectioncomponents',
        phase: 2,
        total: 7,
        title: 'Nested convert',
      });
      logPhaseDone();
      assert.equal(getPhaseHistory().length, 1);
      assert.equal(getPhaseHistory()[0].title, 'Nested convert');
    });
    assert.equal(getPhaseHistory().length, 1);
    assert.equal(getPhaseHistory()[0].title, 'Outer merge');
    assert.equal(getSummaryHistory().length, 1);
    assert.equal(getSummaryHistory()[0].title, 'Outer merge');

    lines.length = 0;
    logRunSummary({ tool: 'bq:create:sectioncomponents' });
    const joined = lines.join('\n');
    assert.match(joined, /Outer merge/);
    assert.ok(!joined.includes('Nested convert'));
  });

  it('push/pop phase history scope restores outer', () => {
    logPhaseSkip({
      tool: 'bq:create:sectioncomponents',
      phase: 3,
      total: 7,
      title: 'Initial authoring generate',
    });
    pushPhaseHistoryScope();
    logPhase({
      tool: 'bq:create:sectioncomponents',
      phase: 5,
      total: 7,
      title: 'Convert sections',
    });
    logPhaseDone();
    assert.equal(getPhaseHistory()[0].phase, 5);
    popPhaseHistoryScope();
    assert.equal(getPhaseHistory().length, 1);
    assert.equal(getPhaseHistory()[0].phase, 3);
    assert.equal(getSummaryHistory().length, 1);
    assert.equal(getSummaryHistory()[0].phase, 3);
  });

  it('recordSerOp under nest prints indented under matching phase', () => {
    logPhase({
      tool: 'bq:create:sectioncomponents',
      phase: 7,
      total: 7,
      title: 'Final authoring generate',
    });
    setPhaseNest({
      tool: 'bq:create:sectioncomponents',
      phase: 7,
      total: 7,
      title: 'Final authoring generate',
    });
    recordSerOp({
      action: 'validate',
      reason: 'validate',
      ms: 899,
      ok: true,
    });
    recordSerOp({
      action: 'push',
      reason: 'definitions:generate end',
      ms: 153000,
      ok: true,
    });
    clearPhaseNest();
    logPhaseDone();
    logRunSummary({ tool: 'bq:create:sectioncomponents' });
    const joined = lines.join('\n');
    assert.match(joined, /7\/7\s+Final authoring generate/);
    assert.match(joined, /^\s+ser\s+validate\s+validate\s+00:00,89/m);
    assert.match(joined, /^\s+ser\s+push\s+definitions:generate end\s+02:33,00/m);
    assert.ok(!joined.includes('ser  validate=ok'));
    // Nested ser lines are deeper than phase rows.
    const serLine = lines.find((l) => /ser\s+validate/.test(l));
    assert.ok(serLine.startsWith('          ser'));
  });

  it('untagged ser ops print under orphan ser header', () => {
    recordSerOp({ action: 'pull', reason: 'Ser pull start', ms: 72000, ok: true });
    logRunSummary({ tool: 'bq:create:sectioncomponents' });
    const joined = lines.join('\n');
    assert.match(joined, /^ {8}ser$/m);
    assert.match(joined, /^\s+ser\s+pull\s+Ser pull start\s+01:12,00/m);
  });

  it('mergeSerOpsFromLogFile loads child JSONL with phase', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-ser-ops-'));
    const logPath = path.join(tmp, 'ops.jsonl');
    fs.writeFileSync(
      logPath,
      `${JSON.stringify({ action: 'pull', reason: 'after site create', ms: 48000, ok: true, phase: 3, phaseTitle: 'Initial' })}\n`,
      'utf8',
    );
    mergeSerOpsFromLogFile(logPath);
    assert.equal(getSerOps().length, 1);
    assert.equal(getSerOps()[0].reason, 'after site create');
    assert.equal(getSerOps()[0].phase, 3);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('recordSerOp appends JSONL when BQ_SER_OPS_LOG set', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-ser-ops-'));
    const logPath = path.join(tmp, 'ops.jsonl');
    process.env[BQ_SER_OPS_LOG_ENV] = logPath;
    setPhaseNest({
      tool: 'bq:create:sectioncomponents',
      phase: 3,
      total: 7,
      title: 'Initial authoring generate',
    });
    recordSerOp({ action: 'pull', reason: 'child pull', ms: 1000, ok: true });
    const text = fs.readFileSync(logPath, 'utf8');
    assert.match(text, /"action":"pull"/);
    assert.match(text, /child pull/);
    assert.match(text, /"phase":3/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
