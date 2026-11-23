/**
 * Premature fields: { … } close leaves CTA/Link as item siblings.
 * Run: node --test tools/create-section-components/ai-source-fixup.stray-fields.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  liftStrayContentItemFieldSeeds,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

const BROKEN = `
export const demoDefinition = {
  kind: "component",
  definitionKey: "demo",
  name: "demo",
  displayName: "Demo",
  componentName: "Demo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Demos"] },
  model: {
    folderTemplate: { name: "Demo Folder" },
    itemTemplate: {
      name: "Demo",
      sections: [{
        name: "Data",
        sortOrder: 100,
        fields: [
          { name: "Description", type: "Rich Text" },
          { name: "CTA", type: "General Link" },
        ],
      }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Demos"] },
    culture: "en",
    cultures: ["nl-BE","fr-BE"],
    items: [
      {
        name: "Customer Stories",
        displayName: "How ENMAX transformed their digital experience",
        fields: { Eyebrow: "Customer stories",
          Headline: "See how brands are winning with Sitecore",
          Description: "Hear directly from organizations." },
          CTA: { text: "See all customers", url: "/solutions/customers" }
      }
    ]
  }
} satisfies ComponentTemplateDefinition;
`;

describe('liftStrayContentItemFieldSeeds', () => {
  it('pulls CTA back inside fields when closed too early', () => {
    const out = liftStrayContentItemFieldSeeds(BROKEN);
    assert.match(out, /fields:\s*\{[\s\S]*CTA:\s*\{\s*text:/);
    assert.doesNotMatch(
      out,
      /fields:\s*\{[\s\S]*?\}\s*,\s*\n\s*CTA\s*:/,
    );
    // Item meta still outside fields
    assert.match(out, /name:\s*"Customer Stories"/);
    assert.match(out, /displayName:\s*"How ENMAX/);
  });

  it('normalizeDefinitionTs applies the lift and survives stripNested', () => {
    const out = normalizeDefinitionTs(BROKEN, {
      definitionKey: 'demo',
      componentName: 'Demo',
    });
    assert.match(out, /fields:\s*\{[\s\S]*CTA:\s*\{/);
    assert.doesNotMatch(
      out,
      /Description:\s*"[^"]*"\s*\}\s*,\s*\n\s*CTA\s*:/,
    );
    // CTA must not sit as a sibling of fields on the item
    const item = out.slice(out.indexOf('items:'));
    assert.match(
      item,
      /fields:\s*\{[\s\S]*CTA:\s*\{\s*text:\s*"See all customers"[\s\S]*\}\s*,?\s*\}/,
    );
  });
});
