/**
 * Run: node --import tsx --test tools/create-section-components/provenance-sanitize.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPoisonedConversionComponent,
  sanitizeSectionConversionPayload,
} from './provenance.mjs';

describe('sanitizeSectionConversionPayload', () => {
  it('drops object-object / [object Object] components', () => {
    const { payload, removed } = sanitizeSectionConversionPayload({
      components: [
        {
          role: 'child',
          componentName: '[object Object]',
          definitionKey: 'object-object',
          contentItemNames: [],
        },
        {
          role: 'section',
          componentName: 'MenzisFooter',
          definitionKey: 'menzis-footer',
        },
      ],
      emitted: [
        'src/components/x/[object Object].tsx',
        'src/components/x/menzis-footer.tsx',
      ],
      allFiles: [
        'src/components/x/menzis-footer.tsx',
        'src/components/x/[object Object]/object-object.tsx',
      ],
    });
    assert.equal(removed, 3);
    assert.equal(payload.components.length, 1);
    assert.equal(payload.components[0].definitionKey, 'menzis-footer');
    assert.deepEqual(payload.emitted, [
      'src/components/x/menzis-footer.tsx',
    ]);
    assert.deepEqual(payload.allFiles, [
      'src/components/x/menzis-footer.tsx',
    ]);
  });

  it('isPoisonedConversionComponent detects classic poison', () => {
    assert.equal(
      isPoisonedConversionComponent({
        componentName: '[object Object]',
        definitionKey: 'object-object',
      }),
      true,
    );
    assert.equal(
      isPoisonedConversionComponent({
        componentName: 'MenzisFooter',
        definitionKey: 'menzis-footer',
      }),
      false,
    );
  });
});
