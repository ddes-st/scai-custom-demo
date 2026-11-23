/**
 * Run: node --test tools/shared/write-file-if-changed.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  normalizeNewlinesForCompare,
  writeFileIfChanged,
} from './write-file-if-changed.mjs';

describe('writeFileIfChanged', () => {
  it('creates a new file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-wifc-'));
    const file = path.join(dir, 'a.definition.ts');
    const r = await writeFileIfChanged(file, 'export const x = 1;\n');
    assert.equal(r.wrote, true);
    assert.equal(r.reason, 'created');
    assert.equal(await readFile(file, 'utf8'), 'export const x = 1;\n');
  });

  it('does not bump mtime when contents are equal', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-wifc-'));
    const file = path.join(dir, 'b.definition.ts');
    const body = 'export const y = 2;\n';
    await writeFile(file, body, 'utf8');
    const past = new Date('2020-01-01T00:00:00.000Z');
    await utimes(file, past, past);
    const before = await stat(file);
    const r = await writeFileIfChanged(file, body);
    assert.equal(r.wrote, false);
    assert.equal(r.reason, 'unchanged');
    const after = await stat(file);
    assert.equal(after.mtimeMs, before.mtimeMs);
  });

  it('treats CRLF and LF as equal', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-wifc-'));
    const file = path.join(dir, 'c.definition.ts');
    await writeFile(file, 'line\r\n', 'utf8');
    const past = new Date('2020-06-01T00:00:00.000Z');
    await utimes(file, past, past);
    const before = await stat(file);
    const r = await writeFileIfChanged(file, 'line\n');
    assert.equal(r.wrote, false);
    assert.equal(before.mtimeMs, (await stat(file)).mtimeMs);
  });

  it('writes when contents differ', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-wifc-'));
    const file = path.join(dir, 'd.definition.ts');
    await writeFile(file, 'old\n', 'utf8');
    const r = await writeFileIfChanged(file, 'new\n');
    assert.equal(r.wrote, true);
    assert.equal(r.reason, 'updated');
    assert.equal(await readFile(file, 'utf8'), 'new\n');
  });
});

describe('normalizeNewlinesForCompare', () => {
  it('normalizes CRLF', () => {
    assert.equal(normalizeNewlinesForCompare('a\r\nb\r\n'), 'a\nb\n');
  });
});
