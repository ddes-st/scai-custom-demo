/**
 * Run: node --test tools/create-section-components/create-log.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  configureCreateLog,
  drainFixupEvents,
  flushFixupsMeta,
  isCreateVerbose,
  noteFixup,
  peekFixupEventCount,
  resetFixupLog,
  takeFixupCount,
  warnVerbose,
  logVerbose,
} from './create-log.mjs';
import { warnTsxEmitContract } from './ai-source-fixup.mjs';

describe('create-log verbosity', () => {
  /** @type {string[]} */
  let warns;
  /** @type {string[]} */
  let logs;
  let origWarn;
  let origLog;
  let prevEnv;
  let prevPageSlug;

  beforeEach(() => {
    warns = [];
    logs = [];
    origWarn = console.warn;
    origLog = console.log;
    console.warn = (...a) => {
      warns.push(a.map(String).join(' '));
    };
    console.log = (...a) => {
      logs.push(a.map(String).join(' '));
    };
    prevEnv = process.env.BQ_CREATE_LOG;
    prevPageSlug = process.env.BQ_CREATE_PAGE_SLUG;
    delete process.env.BQ_CREATE_LOG;
    delete process.env.BQ_CREATE_PAGE_SLUG;
    configureCreateLog({ verbose: false });
    resetFixupLog();
  });

  afterEach(() => {
    console.warn = origWarn;
    console.log = origLog;
    if (prevEnv === undefined) delete process.env.BQ_CREATE_LOG;
    else process.env.BQ_CREATE_LOG = prevEnv;
    if (prevPageSlug === undefined) delete process.env.BQ_CREATE_PAGE_SLUG;
    else process.env.BQ_CREATE_PAGE_SLUG = prevPageSlug;
    resetFixupLog();
  });

  it('default suppresses verbose and fixup warns but counts fixups', () => {
    assert.equal(isCreateVerbose(), false);
    noteFixup('section-01', '  ⚠ Codegen fixup: example');
    noteFixup('section-01', '  ⚠ Codegen fixup: another');
    logVerbose('AI usage [section-01/codegen]: in=1');
    warnVerbose('should not show');
    assert.equal(warns.length, 0);
    assert.ok(!logs.some((l) => /AI usage/.test(l)));
    assert.equal(takeFixupCount('section-01'), 2);
  });

  it('verbose prints fixups and verbose lines', () => {
    configureCreateLog({ verbose: true });
    assert.equal(isCreateVerbose(), true);
    noteFixup('section-02', '  ⚠ Codegen fixup: example');
    logVerbose('AI usage [section-02/codegen]: in=1');
    assert.equal(warns.length, 1);
    assert.match(warns[0], /Codegen fixup/);
    assert.ok(logs.some((l) => /AI usage/.test(l)));
  });

  it('accumulates events for drain and preserves takeFixupCount', () => {
    process.env.BQ_CREATE_PAGE_SLUG = 'www-example--home';
    noteFixup('section-03', '  ⚠ Codegen salvage: quoted bare multi-word Fields keys');
    noteFixup('section-03', '  ⚠ Codegen fixup: stripped optional');
    assert.equal(peekFixupEventCount(), 2);
    assert.equal(takeFixupCount('section-03'), 2);
    assert.equal(peekFixupEventCount(), 2, 'takeFixupCount must not clear events');
    const events = drainFixupEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].section, 'section-03');
    assert.equal(events[0].pageSlug, 'www-example--home');
    assert.match(events[0].message, /salvage/);
    assert.ok(events[0].at);
    assert.equal(peekFixupEventCount(), 0);
    assert.deepEqual(drainFixupEvents(), []);
  });

  it('flushFixupsMeta writes only when events exist and deletes stale', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bq-fixups-meta-'));
    const stale = path.join(dir, 'fixups.meta.json');
    await writeFile(stale, '{"count":1}\n', 'utf8');

    const empty = await flushFixupsMeta(dir);
    assert.equal(empty, null);
    await assert.rejects(() => access(stale), /ENOENT/);

    noteFixup('section-01', '  ⚠ Codegen fixup: example');
    const written = await flushFixupsMeta(dir, {
      tool: 'create:sectioncomponents',
    });
    assert.ok(written);
    const payload = JSON.parse(await readFile(written, 'utf8'));
    assert.equal(payload.tool, 'create:sectioncomponents');
    assert.equal(payload.count, 1);
    assert.equal(payload.fixups.length, 1);
    assert.equal(payload.fixups[0].section, 'section-01');
    assert.ok(payload.generatedAt);
  });

  it('warnTsxEmitContract does not noteFixup (validation-only)', () => {
    resetFixupLog();
    process.env.BQ_CREATE_SECTION = 'section-01';
    warnTsxEmitContract('a interface Fields { Title: TextField; }');
    assert.equal(takeFixupCount('section-01'), 0);
    assert.equal(peekFixupEventCount(), 0);
    delete process.env.BQ_CREATE_SECTION;
  });
});
