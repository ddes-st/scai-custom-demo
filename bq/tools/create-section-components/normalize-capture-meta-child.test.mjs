/**
 * Run: node --test tools/create-section-components/normalize-capture-meta-child.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeCaptureMetaChild } from './naming.mjs';

describe('normalizeCaptureMetaChild', () => {
  it('reads componentName and definitionKey from object children', () => {
    const out = normalizeCaptureMetaChild({
      componentName: 'MenzisFooterQuickLinkList',
      definitionKey: 'menzis-footer-quick-link-list',
      placeholderKey: 'footer-quick-links',
    });
    assert.deepEqual(out, {
      componentName: 'MenzisFooterQuickLinkList',
      definitionKey: 'menzis-footer-quick-link-list',
    });
  });

  it('derives Pascal componentName from definitionKey when name missing', () => {
    const out = normalizeCaptureMetaChild({
      definitionKey: 'menzis-footer-account-link',
    });
    assert.ok(out);
    assert.equal(out.definitionKey, 'menzis-footer-account-link');
    assert.equal(out.componentName, 'MenzisFooterAccountLink');
  });

  it('still accepts legacy string children', () => {
    const out = normalizeCaptureMetaChild('MenzisFooterQuickLinkList');
    assert.deepEqual(out, {
      componentName: 'MenzisFooterQuickLinkList',
      definitionKey: 'menzis-footer-quick-link-list',
    });
  });

  it('rejects String(object) accident — never returns object-object', () => {
    const accident = String({
      componentName: 'MenzisFooterQuickLinkList',
      definitionKey: 'menzis-footer-quick-link-list',
    });
    assert.equal(accident, '[object Object]');
    assert.equal(normalizeCaptureMetaChild(accident), null);
    assert.equal(normalizeCaptureMetaChild({}), null);
    assert.equal(normalizeCaptureMetaChild(null), null);
  });

  it('does not produce object-object from object entries', () => {
    const kids = [
      {
        componentName: 'MenzisFooterQuickLinkList',
        definitionKey: 'menzis-footer-quick-link-list',
      },
      {
        componentName: 'MenzisFooterAccountLink',
        definitionKey: 'menzis-footer-account-link',
      },
    ].map(normalizeCaptureMetaChild);
    assert.equal(kids.length, 2);
    for (const k of kids) {
      assert.ok(k);
      assert.notEqual(k.definitionKey, 'object-object');
      assert.notEqual(k.componentName, 'ObjectObject');
    }
  });
});
