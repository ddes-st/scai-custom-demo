/**
 * Brand display label casing (BQ_BRAND_LABEL_CASE).
 * Run: node --test tools/create-section-components/naming.brand-label.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  deriveCollectionDisplayName,
  deriveSiteDisplayName,
  formatBrandLabel,
  hostToDisplayName,
  parseHostnameBrandMarket,
  resolveBrandLabelCase,
} from './naming.mjs';

describe('formatBrandLabel / resolveBrandLabelCase', () => {
  const prev = process.env.BQ_BRAND_LABEL_CASE;

  afterEach(() => {
    if (prev === undefined) delete process.env.BQ_BRAND_LABEL_CASE;
    else process.env.BQ_BRAND_LABEL_CASE = prev;
  });

  it('defaults to title case', () => {
    delete process.env.BQ_BRAND_LABEL_CASE;
    assert.equal(resolveBrandLabelCase({}), 'title');
    assert.equal(formatBrandLabel('sitecore', 'title'), 'Sitecore');
    assert.equal(formatBrandLabel('axa', 'title'), 'Axa');
  });

  it('supports upper and lower', () => {
    assert.equal(formatBrandLabel('sitecore', 'upper'), 'SITECORE');
    assert.equal(formatBrandLabel('sitecore', 'lower'), 'sitecore');
  });
});

describe('parseHostnameBrandMarket brandLabel', () => {
  const prev = process.env.BQ_BRAND_LABEL_CASE;

  afterEach(() => {
    if (prev === undefined) delete process.env.BQ_BRAND_LABEL_CASE;
    else process.env.BQ_BRAND_LABEL_CASE = prev;
  });

  it('uses Title Case by default', () => {
    delete process.env.BQ_BRAND_LABEL_CASE;
    const parts = parseHostnameBrandMarket('https://www.sitecore.com/');
    assert.equal(parts.brandSystem, 'sitecore');
    assert.equal(parts.brandLabel, 'Sitecore');
    assert.equal(deriveCollectionDisplayName(parts), 'Sitecore Web Estate');
    assert.equal(deriveSiteDisplayName(parts), 'Sitecore');
  });

  it('uses UPPER when BQ_BRAND_LABEL_CASE=upper', () => {
    process.env.BQ_BRAND_LABEL_CASE = 'upper';
    const parts = parseHostnameBrandMarket('https://www.axa.be/');
    assert.equal(parts.brandLabel, 'AXA');
    assert.equal(deriveCollectionDisplayName(parts), 'AXA Web Estate');
    assert.match(deriveSiteDisplayName(parts), /^AXA /);
  });

  it('uses lower when BQ_BRAND_LABEL_CASE=lower', () => {
    process.env.BQ_BRAND_LABEL_CASE = 'lower';
    const parts = parseHostnameBrandMarket('https://www.sitecore.com/');
    assert.equal(parts.brandLabel, 'sitecore');
    assert.equal(deriveCollectionDisplayName(parts), 'sitecore Web Estate');
  });
});

describe('hostToDisplayName', () => {
  const prev = process.env.BQ_BRAND_LABEL_CASE;

  afterEach(() => {
    if (prev === undefined) delete process.env.BQ_BRAND_LABEL_CASE;
    else process.env.BQ_BRAND_LABEL_CASE = prev;
  });

  it('title-cases host labels by default', () => {
    delete process.env.BQ_BRAND_LABEL_CASE;
    assert.equal(hostToDisplayName('https://www.sitecore.com/'), 'Sitecore.Com');
  });

  it('uppercases when env is upper', () => {
    process.env.BQ_BRAND_LABEL_CASE = 'upper';
    assert.equal(hostToDisplayName('www.axa.be'), 'AXA.BE');
  });
});
