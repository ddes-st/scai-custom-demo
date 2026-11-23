/**
 * Run: node --import tsx --test tools/shared/platform-link-list-path.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proposeValidItemName } from './naming.ts';

describe('link-list Path leaf stability (proposeValidItemName)', () => {
  it('keeps authored EN names stable across repeated calls', () => {
    const parent = '/sitecore/content/menzis/menzis-nl/Data/Link Lists/Can you use some help';
    const a = proposeValidItemName('Service and contact', 'Service and contact', {
      forUrl: false,
    });
    const b = proposeValidItemName('Service and contact', 'Service and contact', {
      forUrl: false,
    });
    assert.equal(a, 'Service and contact');
    assert.equal(a, b);
    assert.equal(
      proposeValidItemName('Log in', 'Log in', { forUrl: false }),
      'Log in',
    );
    void parent;
  });

  it('does not collapse spaces into Service andcontact', () => {
    const name = proposeValidItemName(
      'Service and contact',
      'Service and contact',
    );
    assert.equal(name, 'Service and contact');
    assert.doesNotMatch(name, /andcontact/);
  });
});
