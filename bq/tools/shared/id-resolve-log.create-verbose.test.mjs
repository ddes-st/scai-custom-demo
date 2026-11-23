/**
 * Run: node --import tsx --test tools/shared/id-resolve-log.create-verbose.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  isCreateVerbose,
  warnCreateVerbose,
} from './id-resolve-log.ts';

describe('warnCreateVerbose / isCreateVerbose', () => {
  /** @type {string | undefined} */
  let prev;

  afterEach(() => {
    if (prev === undefined) delete process.env.BQ_CREATE_LOG;
    else process.env.BQ_CREATE_LOG = prev;
  });

  it('is silent by default', () => {
    prev = process.env.BQ_CREATE_LOG;
    delete process.env.BQ_CREATE_LOG;
    assert.equal(isCreateVerbose(), false);
    const warns = [];
    const orig = console.warn;
    console.warn = (...a) => warns.push(a.join(' '));
    try {
      warnCreateVerbose('should-not-appear');
    } finally {
      console.warn = orig;
    }
    assert.equal(warns.length, 0);
  });

  it('warns when BQ_CREATE_LOG=verbose', () => {
    prev = process.env.BQ_CREATE_LOG;
    process.env.BQ_CREATE_LOG = 'verbose';
    assert.equal(isCreateVerbose(), true);
    const warns = [];
    const orig = console.warn;
    console.warn = (...a) => warns.push(a.join(' '));
    try {
      warnCreateVerbose('verbose-line');
    } finally {
      console.warn = orig;
    }
    assert.deepEqual(warns, ['verbose-line']);
  });
});
