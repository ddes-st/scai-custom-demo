/**
 * Dual-write retired: strip content.linkLists sidecars.
 * Run: node --import tsx --test tools/create-section-components/strip-content-link-lists.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeDefinitionTs,
  stripContentLinkListsDualWrite,
} from './ai-source-fixup.mjs';

const WITH_SIDECAR = `
export const demoHeaderDefinition = {
  kind: 'component',
  definitionKey: 'demo-header',
  name: 'demo-header',
  componentName: 'DemoHeader',
  displayName: 'Header',
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Site Headers'] },
  model: {
    folderTemplate: { name: 'Site Headers Folder' },
    itemTemplate: {
      name: 'Site Header',
      sections: [
        {
          name: 'Content',
          fields: [{ name: 'Context Links', type: 'Multi-Line Text' }],
        },
      ],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Site Headers'] },
    culture: 'en',
    items: [
      {
        name: 'Site Header',
        fields: {
          'Context Links': JSON.stringify([
            { text: 'Home', url: 'https://example.com/' },
          ]),
        },
      },
    ],
    linkLists: [
      {
        name: 'Context Links',
        title: 'Context Links',
        sourceField: 'Context Links',
        links: [
          { name: 'Home', link: { text: 'Home', url: 'https://example.com/' } },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;

describe('stripContentLinkListsDualWrite', () => {
  it('removes content.linkLists sidecar', () => {
    const out = stripContentLinkListsDualWrite(WITH_SIDECAR);
    assert.doesNotMatch(out, /\blinkLists\s*:/);
    assert.match(out, /'Context Links':\s*JSON\.stringify/);
  });

  it('normalizeDefinitionTs strips dual-write sidecars', () => {
    const out = normalizeDefinitionTs(WITH_SIDECAR, {
      definitionKey: 'demo-header',
      skipParseAssert: true,
      skipIntegrityAssert: true,
    });
    assert.doesNotMatch(out, /\blinkLists\s*:/);
  });
});
