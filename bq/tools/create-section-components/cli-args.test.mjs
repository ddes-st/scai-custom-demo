import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from './cli.mjs';

describe('parseArgs — --only implies --page-only', () => {
  it('--url alone stays host-wide', () => {
    const args = parseArgs(['--url', 'https://www.crelan.be/']);
    assert.equal(args.all, true);
    assert.equal(args.pageOnly, false);
    assert.equal(args.only, null);
  });

  it('--url --only section-02 implies page-only', () => {
    const args = parseArgs([
      '--url',
      'https://www.crelan.be/',
      '--only',
      'section-02',
    ]);
    assert.equal(args.only, 'section-02');
    assert.equal(args.pageOnly, true);
    assert.equal(args.all, false);
  });

  it('--url --only section-02 --force implies page-only', () => {
    const args = parseArgs([
      '--url',
      'https://www.crelan.be/',
      '--only',
      'section-02',
      '--force',
    ]);
    assert.equal(args.only, 'section-02');
    assert.equal(args.pageOnly, true);
    assert.equal(args.all, false);
    assert.equal(args.force, true);
  });

  it('--url --page-only without --only stays page-only', () => {
    const args = parseArgs([
      '--url',
      'https://www.crelan.be/',
      '--page-only',
    ]);
    assert.equal(args.pageOnly, true);
    assert.equal(args.all, false);
    assert.equal(args.only, null);
  });

  it('--only wins over --all', () => {
    const args = parseArgs([
      '--url',
      'https://www.crelan.be/',
      '--all',
      '--only',
      'section-04',
    ]);
    assert.equal(args.only, 'section-04');
    assert.equal(args.pageOnly, true);
    assert.equal(args.all, false);
  });
});
