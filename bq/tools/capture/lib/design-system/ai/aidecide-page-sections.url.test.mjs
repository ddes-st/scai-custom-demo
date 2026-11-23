/**
 * Unit tests for suggestedFields URL absolute-ization (node:test).
 * Run: node --test tools/capture/lib/design-system/ai/aidecide-page-sections.url.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isRelativeUrlPath,
  normalizeSuggestedFields,
  resolveAbsoluteUrlsInValue,
  sanitizeFieldValueShapes,
  undoSpuriousAbsoluteUrl,
} from './aidecide-page-sections.mjs';

const PAGE = 'https://www.axa.be/nl/particulieren';

describe('isRelativeUrlPath', () => {
  it('rejects plain words and numbers', () => {
    assert.equal(isRelativeUrlPath('3'), false);
    assert.equal(isRelativeUrlPath('miljoen'), false);
    assert.equal(isRelativeUrlPath('3 200'), false);
  });

  it('accepts path-like and media filenames', () => {
    assert.equal(isRelativeUrlPath('/nl/foo'), true);
    assert.equal(isRelativeUrlPath('images/hero.png'), true);
    assert.equal(isRelativeUrlPath('logo.svg'), true);
  });
});

describe('resolveAbsoluteUrlsInValue', () => {
  it('leaves metric text intact', () => {
    assert.equal(resolveAbsoluteUrlsInValue(PAGE, '3'), '3');
    assert.equal(resolveAbsoluteUrlsInValue(PAGE, 'miljoen'), 'miljoen');
    assert.equal(resolveAbsoluteUrlsInValue(PAGE, '3 200'), '3 200');
  });

  it('absolutizes real paths and protocol-relative URLs', () => {
    assert.equal(
      resolveAbsoluteUrlsInValue(PAGE, '/nl/foo'),
      'https://www.axa.be/nl/foo',
    );
    assert.equal(
      resolveAbsoluteUrlsInValue(PAGE, '//cdn.example/x.png'),
      'https://cdn.example/x.png',
    );
  });

  it('leaves existing https URLs alone', () => {
    assert.equal(
      resolveAbsoluteUrlsInValue(PAGE, 'https://www.axa.be/nl/auto'),
      'https://www.axa.be/nl/auto',
    );
  });
});

describe('undoSpuriousAbsoluteUrl', () => {
  it('restores tokens that were wrongly resolved against the page', () => {
    assert.equal(
      undoSpuriousAbsoluteUrl(PAGE, 'https://www.axa.be/nl/3'),
      '3',
    );
    assert.equal(
      undoSpuriousAbsoluteUrl(PAGE, 'https://www.axa.be/nl/miljoen'),
      'miljoen',
    );
  });

  it('does not strip real deeper page paths', () => {
    assert.equal(
      undoSpuriousAbsoluteUrl(PAGE, 'https://www.axa.be/nl/particulieren/auto'),
      'https://www.axa.be/nl/particulieren/auto',
    );
  });
});

describe('normalizeSuggestedFields recovery', () => {
  it('recovers corrupted metric array seeds', () => {
    const fields = normalizeSuggestedFields(
      [
        {
          name: 'metrics',
          type: 'array',
          value: [
            {
              value: 'https://www.axa.be/nl/3',
              unit: 'https://www.axa.be/nl/miljoen',
              label: 'Trouwe klanten',
            },
          ],
        },
      ],
      PAGE,
    );
    assert.deepEqual(fields[0].value[0], {
      value: '3',
      unit: 'miljoen',
      label: 'Trouwe klanten',
    });
  });

  it('does not undo link/image typed values', () => {
    const link = sanitizeFieldValueShapes(
      'https://www.axa.be/nl/3',
      'link',
      PAGE,
    );
    assert.deepEqual(link, { text: '', url: 'https://www.axa.be/nl/3' });
  });
});
