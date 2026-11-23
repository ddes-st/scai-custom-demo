/**
 * Run: node --import tsx --test tools/shared/id-resolve-log.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { isIdResolveVerbose, logIdResolve } from './id-resolve-log.ts';

describe('id-resolve-log', () => {
  /** @type {string|undefined} */
  let prev;

  beforeEach(() => {
    prev = process.env.BQ_CREATE_LOG;
    delete process.env.BQ_CREATE_LOG;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.BQ_CREATE_LOG;
    else process.env.BQ_CREATE_LOG = prev;
  });

  it('is silent by default', () => {
    assert.equal(isIdResolveVerbose(), false);
    const lines = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try {
      logIdResolve({
        sitecorePath: '/sitecore/x',
        source: 'cm',
        id: 'abc',
        ms: 12,
      });
    } finally {
      console.log = orig;
    }
    assert.equal(lines.length, 0);
  });

  it('verbose prints cm with ms', () => {
    process.env.BQ_CREATE_LOG = 'verbose';
    assert.equal(isIdResolveVerbose(), true);
    const lines = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try {
      logIdResolve({
        sitecorePath: '/sitecore/media library/Project/crelan/shared',
        source: 'cm',
        id: '8ee87fdfa73e4e89817bb12eb245389a',
        ms: 42,
      });
      logIdResolve({
        sitecorePath: '/sitecore/content/crelan/crelan-be/Data/Link Lists',
        source: 'disk',
        id: '0b0a83a3047948efa5b37e8dc0ec985f',
      });
    } finally {
      console.log = orig;
    }
    assert.match(
      lines[0],
      /\[bq:scaffold\] id \/sitecore\/media library\/Project\/crelan\/shared → cm 8ee87fdfa73e4e89817bb12eb245389a \(42ms\)/,
    );
    assert.match(lines[1], /→ disk 0b0a83a3047948efa5b37e8dc0ec985f/);
  });
});
