/**
 * Run: node --test tools/create-section-components/collapse-sitecoreize-package-singletons.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collapseSitecoreizePackageSingletons,
  parseSitecoreizeJsonContent,
} from './collapse-sitecoreize-package-singletons.mjs';

describe('collapseSitecoreizePackageSingletons', () => {
  it('string then null → exactly one clientTsx body', () => {
    const raw = `{
  "packages": [
    {
      "componentName": "Demo",
      "tsx": "export const Default = () => null;",
      "clientTsx": "'use client';\\nexport default function DemoChrome() { return null }",
      "definitionTs": "export const DemoDefinition = {};",
      "clientTsx": null
    }
  ]
}`;
    const parsed = parseSitecoreizeJsonContent(raw);
    assert.equal(parsed.packages.length, 1);
    assert.equal(typeof parsed.packages[0].clientTsx, 'string');
    assert.match(parsed.packages[0].clientTsx, /use client/);
    // Salvaged text should only contain one clientTsx key occurrence.
    const salvaged = collapseSitecoreizePackageSingletons(raw, { warn: false });
    assert.equal([...salvaged.matchAll(/"clientTsx"/g)].length, 1);
  });

  it('two non-empty strings → keep first only', () => {
    const raw = `{
  "packages": [
    {
      "componentName": "Demo",
      "tsx": "first",
      "clientTsx": "FIRST_BODY",
      "definitionTs": "def",
      "clientTsx": "SECOND_BODY"
    }
  ]
}`;
    const parsed = parseSitecoreizeJsonContent(raw);
    assert.equal(parsed.packages[0].clientTsx, 'FIRST_BODY');
    const salvaged = collapseSitecoreizePackageSingletons(raw, { warn: false });
    assert.equal([...salvaged.matchAll(/"clientTsx"/g)].length, 1);
    assert.ok(!salvaged.includes('SECOND_BODY'));
  });

  it('only null → single null, no throw', () => {
    const raw = `{
  "packages": [
    {
      "componentName": "Demo",
      "tsx": "export const Default = () => null;",
      "clientTsx": null,
      "definitionTs": "export const DemoDefinition = {};",
      "clientTsx": null
    }
  ]
}`;
    const parsed = parseSitecoreizeJsonContent(raw);
    assert.equal(parsed.packages[0].clientTsx, null);
    const salvaged = collapseSitecoreizePackageSingletons(raw, { warn: false });
    assert.equal([...salvaged.matchAll(/"clientTsx"/g)].length, 1);
  });

  it('collapses duplicate tsx the same way', () => {
    const raw = `{
  "packages": [
    {
      "componentName": "Demo",
      "tsx": "GOOD_TSX",
      "definitionTs": "def",
      "tsx": "",
      "clientTsx": null
    }
  ]
}`;
    const parsed = parseSitecoreizeJsonContent(raw);
    assert.equal(parsed.packages[0].tsx, 'GOOD_TSX');
  });

  it('real dump pattern: clientTsx body then null after definitionTs', () => {
    // Mirrors SitecorePlatformCapabilityExplorer sitecoreize mash-up.
    const raw = `{
  "packages": [
    {
      "componentName": "SitecorePlatformCapabilityExplorer",
      "role": "section",
      "tsx": "import Chrome from './x.client';",
      "clientTsx": "'use client';\\nexport default function Chrome() { return null }",
      "definitionTs": "export const Def = {};",
    "clientTsx": null
    },
    {
      "componentName": "Child",
      "role": "child",
      "tsx": "export const Default = () => null;",
      "definitionTs": "export const ChildDef = {};",
      "clientTsx": null
    }
  ]
}`;
    const parsed = parseSitecoreizeJsonContent(raw);
    assert.equal(typeof parsed.packages[0].clientTsx, 'string');
    assert.match(parsed.packages[0].clientTsx, /use client/);
    assert.equal(parsed.packages[1].clientTsx, null);
    const salvaged = collapseSitecoreizePackageSingletons(raw, { warn: false });
    assert.equal([...salvaged.matchAll(/"clientTsx"/g)].length, 2);
  });
});
