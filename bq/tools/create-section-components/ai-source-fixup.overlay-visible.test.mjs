import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  forceOverlayVisibilitySeeds,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

describe('forceOverlayVisibilitySeeds', () => {
  const overlayInfo = {
    track: 'overlay',
    isOverlay: true,
    detectedVisible: true,
    rect: { x0: 0, y0: 0, x1: 1440, y1: 40 },
  };

  it('forces Visible true and Dismissed false for overlay track', () => {
    const src = `
export const def = {
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: "Visible", type: "Checkbox", default: false },
          { name: "Dismissed", type: "Checkbox", default: true },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: "Bar",
      fields: {
        Visible: false,
        Dismissed: true,
      },
    }],
  },
} satisfies X;
`;
    const out = forceOverlayVisibilitySeeds(src, overlayInfo);
    assert.match(out, /name:\s*"Visible"[^}]*default:\s*true/);
    assert.match(out, /name:\s*"Dismissed"[^}]*default:\s*false/);
    assert.match(out, /Visible:\s*true/);
    assert.match(out, /Dismissed:\s*false/);
  });

  it('is a no-op for content-track sections', () => {
    const src = `content: { items: [{ fields: { Visible: false } }] }`;
    const out = forceOverlayVisibilitySeeds(src, { track: 'content' });
    assert.equal(out, src);
  });

  it('normalizeDefinitionTs applies overlay visibility fixup', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/about.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foo"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{
        name: "Data",
        sortOrder: 100,
        fields: [
          { name: "Message", type: "Single-Line Text" },
          { name: "Visible", type: "Checkbox", default: false },
        ],
      }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    culture: "en",
    location: { root: "data", folder: ["Foo"] },
    items: [{
      name: "Item",
      displayName: "Item",
      fields: { Message: "Hi", Visible: false },
    }],
  },
} satisfies ComponentTemplateDefinition;
`;
    const out = normalizeDefinitionTs(src, {
      definitionKey: 'foo',
      sectionInfo: overlayInfo,
      skipParseAssert: true,
    });
    assert.match(out, /Visible:\s*true/);
    assert.match(out, /default:\s*true/);
  });
});
