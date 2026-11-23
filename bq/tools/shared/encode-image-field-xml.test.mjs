/**
 * Run: node --import tsx --test tools/shared/encode-image-field-xml.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeImageFieldXml } from './media-from-source.ts';

const HEX = '0e76d4557cbc54e190d7f7206489028f';
const DASHED = '0e76d455-7cbc-54e1-90d7-f7206489028f';
const BRACED = '{0E76D455-7CBC-54E1-90D7-F7206489028F}';

describe('encodeImageFieldXml', () => {
  it('emits braced uppercase dashed mediaid from compact 32-hex', () => {
    assert.equal(
      encodeImageFieldXml(HEX),
      `<image mediaid="${BRACED}" />`,
    );
  });

  it('normalizes dashed and braced inputs to the same mediaid', () => {
    assert.equal(encodeImageFieldXml(DASHED), `<image mediaid="${BRACED}" />`);
    assert.equal(
      encodeImageFieldXml('{0e76d455-7cbc-54e1-90d7-f7206489028f}'),
      `<image mediaid="${BRACED}" />`,
    );
    assert.equal(encodeImageFieldXml(BRACED), `<image mediaid="${BRACED}" />`);
  });

  it('preserves alt (with quote escaping)', () => {
    assert.equal(
      encodeImageFieldXml(HEX, 'Crelan "logo"'),
      `<image mediaid="${BRACED}" alt="Crelan &quot;logo&quot;" />`,
    );
  });
});
