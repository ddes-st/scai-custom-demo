/**
 * Placeholders sync must not truncate at allowedControls and drop content.location
 * (cookie-modal finalize regression).
 * Run: node --test tools/create-section-components/patch-definition-placeholders.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDefinitionTsSeedShape,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';
import { replacePlaceholdersArray } from './sync-definition-from-tsx.mjs';

const COOKIE_PARENT_DEF = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const crelanCookiePreferenceModalDefinition = {
  kind: 'component',
  definitionKey: 'crelan-cookie-preference-modal',
  name: 'crelan-cookie-preference-modal',
  componentName: 'CrelanCookiePreferenceModal',
  displayName: 'Cookie Preference Modal',
  datasourceLocation: {
    scope: 'site',
    root: 'data',
    folder: ['Cookie Preference Modals'],
  },
  model: {
    folderTemplate: { name: 'Cookie Preference Modal Folder' },
    itemTemplate: {
      name: 'Cookie Preference Modal',
      sections: [{
        name: 'Content',
        fields: [
          { name: 'Title', type: 'Single-Line Text' },
          { name: 'Reject Cookies', type: 'General Link' },
        ],
      }],
    },
  },
  placeholders: [
    {
      key: 'cookie-categories',
      allowedControls: ['crelan-cookie-category-item'],
    },
  ],
  content: {
    location: { root: 'data', folder: ['Cookie Preference Modals'] },
    culture: 'nl-BE',
    items: [{
      name: 'Cookie Preference Modal',
      fields: {
        Title: 'Voorkeuren',
        'Reject Cookies': { text: 'Weigeren', url: '#' },
      },
    }],
  },
} satisfies ComponentTemplateDefinition;
`.trim();

describe('replacePlaceholdersArray preserves content.location', () => {
  it('does not truncate at allowedControls ],', () => {
    const next = replacePlaceholdersArray(
      COOKIE_PARENT_DEF,
      '[{ key: "cookie-categories", allowedControls: ["crelan-cookie-category-item"] }]',
    );
    assert.match(
      next,
      /\bcontent\s*:\s*\{[\s\S]*?\blocation\s*:\s*\{/,
      'content.location must survive placeholders rewrite',
    );
    assert.match(next, /placeholders:\s*\[\s*\{\s*key:\s*"cookie-categories"/);
    assertDefinitionTsSeedShape(next, 'cookie-parent.definition.ts');
  });

  it('naive regex would truncate; balanced replace + normalize keeps location', () => {
    const naive = COOKIE_PARENT_DEF.replace(
      /placeholders\s*:\s*\[[\s\S]*?\],/,
      'placeholders: [{ key: "cookie-categories", allowedControls: ["crelan-cookie-category-item"] }],',
    );
    // Prove the old bug: naive replace leaves orphan braces / breaks keepExpected path.
    assert.notEqual(naive, COOKIE_PARENT_DEF);
    assert.match(naive, /\},\s*\],\s*content:/);

    const balanced = replacePlaceholdersArray(
      COOKIE_PARENT_DEF,
      '[{ key: "cookie-categories", allowedControls: ["crelan-cookie-category-item"] }]',
    );
    const out = normalizeDefinitionTs(balanced, {
      definitionKey: 'crelan-cookie-preference-modal',
      componentName: 'CrelanCookiePreferenceModal',
      codePrefix: 'Crelan',
      planMode: 'composite',
    });
    assert.match(
      out,
      /\bcontent\s*:\s*\{[\s\S]*?\blocation\s*:\s*\{/,
      'finalize normalize must not drop content.location',
    );
    assert.match(
      out,
      /placeholders:\s*\[[\s\S]*allowedControls:\s*\["crelan-cookie-category-item"\]/,
    );
    assertDefinitionTsSeedShape(
      out,
      'crelan-cookie-preference-modal.definition.ts',
    );
  });
});
