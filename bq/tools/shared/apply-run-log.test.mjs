/**
 * Run: node --import tsx --test tools/shared/apply-run-log.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApplyRunLog } from './apply-run-log.ts';

describe('ApplyRunLog.logApplySummaryToConsole', () => {
  it('counts created/updated/unchanged/pruned without throwing', () => {
    const log = new ApplyRunLog();
    log.beginDefinition('demo');
    log.recordWrite('created', '/tmp/a.yml');
    log.recordWrite('created', '/tmp/b.yml');
    log.recordWrite('updated', '/tmp/c.yml');
    log.recordWrite('unchanged', '/tmp/d.yml');
    log.recordPrune('removed', '/tmp/old.yml', 'orphaned');

    const lines = [];
    const orig = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      log.logApplySummaryToConsole({
        label: 'scoped generate',
        pruneDeleted: 1,
        pruneSkippedNotBq: 0,
        sampleLimit: 5,
      });
    } finally {
      console.log = orig;
    }

    const joined = lines.join('\n');
    assert.match(joined, /Apply summary \(scoped generate\)/);
    assert.match(joined, /created=2/);
    assert.match(joined, /updated=1/);
    assert.match(joined, /kept\/unchanged=1/);
    assert.match(joined, /pruned=1/);
  });
});
