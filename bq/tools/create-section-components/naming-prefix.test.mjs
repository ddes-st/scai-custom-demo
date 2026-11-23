/**
 * Run: node --test tools/create-section-components/naming-prefix.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  componentCodePrefixFromHostSlug,
  componentCodePrefixFromUrl,
  displayNameFromComponentName,
  ensureBrandComponentPrefix,
  ensureBrandDefinitionKeyPrefix,
  sitecoreSpacedStemFromComponent,
  stripBrandComponentPrefix,
  stripLeadingBrandSpacedLabel,
} from './naming.mjs';

describe('component brand prefixes', () => {
  it('derives Axa / DomSecurity from URL and host slug', () => {
    assert.equal(componentCodePrefixFromUrl('https://www.axa.be/nl/particulieren'), 'Axa');
    assert.equal(
      componentCodePrefixFromUrl('https://www.dom-security.com/be/en'),
      'DomSecurity',
    );
    assert.equal(componentCodePrefixFromHostSlug('axa-be'), 'Axa');
    assert.equal(componentCodePrefixFromHostSlug('dom-security-com'), 'DomSecurity');
    assert.equal(componentCodePrefixFromHostSlug('www-dom-security-com'), 'DomSecurity');
  });

  it('prefixes component names idempotently', () => {
    assert.equal(ensureBrandComponentPrefix('SiteFooter', 'Axa'), 'AxaSiteFooter');
    assert.equal(ensureBrandComponentPrefix('AxaSiteFooter', 'Axa'), 'AxaSiteFooter');
    assert.equal(
      ensureBrandComponentPrefix('SiteFooter', 'DomSecurity'),
      'DomSecuritySiteFooter',
    );
  });

  it('prefixes definition keys and skips platform keys', () => {
    assert.equal(
      ensureBrandDefinitionKeyPrefix('footer-link-list', 'Axa'),
      'axa-footer-link-list',
    );
    assert.equal(
      ensureBrandDefinitionKeyPrefix('axa-footer-link-list', 'Axa'),
      'axa-footer-link-list',
    );
    assert.equal(ensureBrandDefinitionKeyPrefix('link-list', 'Axa'), 'link-list');
    assert.equal(
      ensureBrandDefinitionKeyPrefix('site-footer', 'DomSecurity'),
      'dom-security-site-footer',
    );
  });

  it('strips brand prefix and builds spaced displayName without brand', () => {
    assert.equal(
      stripBrandComponentPrefix('SitecoreCapabilityCarousel', 'Sitecore'),
      'CapabilityCarousel',
    );
    assert.equal(
      displayNameFromComponentName('SitecoreCapabilityCarousel', 'Sitecore'),
      'Capability Carousel',
    );
    assert.equal(
      displayNameFromComponentName('AxaSiteFooter', 'Axa'),
      'Site Footer',
    );
    assert.equal(
      displayNameFromComponentName('CapabilityCarousel', 'Sitecore'),
      'Capability Carousel',
    );
  });

  it('strips leading brand from spaced / Pascal Sitecore labels', () => {
    assert.equal(
      stripLeadingBrandSpacedLabel('Menzis Introduction Hero', 'Menzis'),
      'Introduction Hero',
    );
    assert.equal(
      stripLeadingBrandSpacedLabel('MenzisIntroductionHero', 'Menzis'),
      'Introduction Hero',
    );
    assert.equal(
      stripLeadingBrandSpacedLabel('MenzisHeroImage', 'Menzis'),
      'Hero Image',
    );
    assert.equal(
      stripLeadingBrandSpacedLabel('Anderzorg becomes Menzis', 'Menzis'),
      'Anderzorg Becomes Menzis',
    );
    assert.equal(
      stripLeadingBrandSpacedLabel('Dom Security Site Footer', 'DomSecurity'),
      'Site Footer',
    );
  });

  it('derives unbranded spaced Path stem from component / displayName', () => {
    assert.equal(
      sitecoreSpacedStemFromComponent({
        componentName: 'MenzisIntroductionHero',
        displayName: 'Introduction Hero',
        codePrefix: 'Menzis',
      }),
      'Introduction Hero',
    );
    assert.equal(
      sitecoreSpacedStemFromComponent({
        componentName: 'MenzisIntroductionHero',
        displayName: 'Menzis Introduction Hero',
        codePrefix: 'Menzis',
      }),
      'Introduction Hero',
    );
    assert.equal(
      sitecoreSpacedStemFromComponent({
        componentName: 'MenzisIntroductionHero',
        codePrefix: 'Menzis',
      }),
      'Introduction Hero',
    );
  });
});
