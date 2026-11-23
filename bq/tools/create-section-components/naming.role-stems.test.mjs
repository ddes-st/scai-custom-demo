/**
 * Run: node --test tools/create-section-components/naming.role-stems.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roleDerivedComponentNameStems } from './naming.mjs';

describe('roleDerivedComponentNameStems', () => {
  it('maps partial-header / header-stack to SiteHeader stems', () => {
    const stems = roleDerivedComponentNameStems({
      presentationRole: 'partial-header',
      chromeKind: 'header-stack',
      track: 'header',
    });
    assert.ok(stems.includes('SiteHeader'));
    assert.ok(stems.includes('MainNavigation'));
    assert.equal(
      stems.some((s) => /\d$/.test(s)),
      false,
    );
  });

  it('maps local-services purpose to LocalServicesBand', () => {
    const stems = roleDerivedComponentNameStems({
      presentationRole: 'page',
      purpose: 'Local services and nearby offices band',
    });
    assert.ok(stems.includes('LocalServicesBand'));
    assert.ok(stems.includes('LocalOfficesPromo'));
  });

  it('maps cookie partial to CookiePreferenceModal', () => {
    const stems = roleDerivedComponentNameStems({
      presentationRole: 'partial-cookie',
      purpose: 'Cookie consent overlay',
    });
    assert.ok(stems.includes('CookiePreferenceModal'));
  });
});
