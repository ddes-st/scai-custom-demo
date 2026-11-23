/**
 * Run: node --test tools/create-section-components/shared-section-bridge.footer-ph.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stackedFooterPlaceholderKeys } from './shared-section-bridge.mjs';

describe('stackedFooterPlaceholderKeys', () => {
  it('prefers plan section placeholderKey over legacy four-band', () => {
    assert.deepEqual(
      stackedFooterPlaceholderKeys(
        { layout: { pattern: 'stacked-footer' } },
        {
          role: 'partial-footer',
          section: { placeholderKey: 'footer-columns' },
        },
      ),
      [{ key: 'footer-columns' }],
    );
  });

  it('does not inject four-band keys when plan is silent', () => {
    assert.deepEqual(
      stackedFooterPlaceholderKeys(
        { layout: { pattern: 'stacked-footer' } },
        { role: 'partial-footer', section: {} },
      ),
      [],
    );
  });

  it('uses child placeholders when section key missing', () => {
    assert.deepEqual(
      stackedFooterPlaceholderKeys(
        { layout: { pattern: 'four-column-footer-navigation' } },
        {
          role: 'partial-footer',
          section: {},
          children: [
            { componentName: 'FooterColumn', placeholder: 'footer-columns' },
          ],
        },
      ),
      [{ key: 'footer-columns' }],
    );
  });
});
