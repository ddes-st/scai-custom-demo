/**
 * Run: node --import tsx --test tools/shared/apply-api-run-log.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  __resetApplyApiRunForTests,
  beginApplyApiDefinition,
  beginApplyApiRun,
  endApplyApiDefinition,
  endApplyApiRun,
  recordApplyApiCall,
} from './apply-api-run-log.ts';
import { DEFINITION_APPLY_SNAPSHOT_SUFFIX } from './paths.ts';
import { runAuthoringGraphql } from './authoring-graphql.ts';

describe('apply-api-run-log', () => {
  afterEach(() => {
    __resetApplyApiRunForTests();
  });

  it('snapshots definition with non-discoverable suffix and logs API calls', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-apply-log-'));
    const defFile = path.join(tmp, 'demo-site.definition.ts');
    fs.writeFileSync(defFile, 'export default { kind: "site", definitionKey: "demo-site" };\n');

    const run = beginApplyApiRun({
      runId: 'test-run-1',
      verbose: true,
      endpointName: 'test',
    });
    // Force runDir under tmp by rewriting — begin already wrote under .bq;
    // for unit test we still assert snapshot naming via beginApplyApiDefinition
    // using real run dir from session.
    beginApplyApiDefinition({
      definitionKey: 'demo-site',
      definitionFile: defFile,
    });

    recordApplyApiCall({
      kind: 'authoring-graphql',
      operation: 'createItem',
      durationMs: 12,
      ok: true,
      attempts: 1,
      summary: { itemId: 'abc' },
      detail: { data: { createItem: { item: { itemId: 'abc' } } } },
    });
    endApplyApiDefinition();
    const closed = endApplyApiRun();
    assert.ok(closed);

    const snapDir = path.join(run.runDir, 'definitions', 'demo-site');
    const snaps = fs.readdirSync(snapDir).filter((f) =>
      f.endsWith(DEFINITION_APPLY_SNAPSHOT_SUFFIX),
    );
    assert.equal(snaps.length, 1);
    assert.ok(snaps[0].endsWith('.definition.ts.apply-snapshot'));
    assert.equal(snaps[0].endsWith('.definition.ts'), false);

    const jsonl = fs.readFileSync(path.join(run.runDir, 'api-calls.jsonl'), 'utf8');
    assert.match(jsonl, /createItem/);
    assert.match(jsonl, /"itemId":"abc"/);

    const human = fs.readFileSync(path.join(run.runDir, 'api-calls.log'), 'utf8');
    assert.match(human, /createItem/);
    assert.match(human, /12ms/);

    // cleanup run folder created under repo .bq
    fs.rmSync(run.runDir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runAuthoringGraphql retries then succeeds and records attempts', async () => {
    __resetApplyApiRunForTests();
    const run = beginApplyApiRun({ runId: 'test-retry-1', verbose: false });
    let hits = 0;
    const fetchImpl = async () => {
      hits += 1;
      if (hits < 3) {
        throw new Error('fetch failed ECONNRESET');
      }
      return {
        ok: true,
        async json() {
          return {
            data: {
              createItem: {
                item: {
                  itemId: '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}',
                  path: '/sitecore/content/x',
                },
              },
            },
          };
        },
      };
    };

    const data = await runAuthoringGraphql({
      host: 'https://cm.example',
      token: 'tok',
      query: 'mutation { createItem(input: {}) { item { itemId } } }',
      fetchImpl,
      maxRetries: 3,
      delayMs: 1,
    });
    assert.equal(hits, 3);
    assert.ok(data.createItem);

    endApplyApiRun();
    const jsonl = fs.readFileSync(path.join(run.runDir, 'api-calls.jsonl'), 'utf8');
    const line = JSON.parse(jsonl.trim().split('\n').pop());
    assert.equal(line.ok, true);
    assert.equal(line.attempts, 3);
    assert.equal(line.summary.itemId, '{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}');

    fs.rmSync(run.runDir, { recursive: true, force: true });
  });
});
