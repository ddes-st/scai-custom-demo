/**
 * Run: node --test tools/brandkit/site-link.test.mjs
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stampSiteDefinitionBrandKitId } from './site-link.mjs';

describe('stampSiteDefinitionBrandKitId', () => {
  /** @type {string} */
  let dir;
  /** @type {string} */
  let siteFile;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bq-brandkit-site-'));
    siteFile = path.join(dir, 'demo-site.definition.ts');
    await writeFile(
      siteFile,
      `export const demo = {
  kind: "site",
  definitionKey: "demo-site",
  name: "Demo",
  systemName: "demo",
  description: "x",
  descriptionSource: "ai",
  collectionSystem: "demo-col",
  api: {
    languages: ["en"],
  },
} satisfies SiteDefinition;
`,
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('injects brandKitId into api block', async () => {
    const r = await stampSiteDefinitionBrandKitId(siteFile, 'kit-abc');
    assert.equal(r.ok, true);
    const text = await readFile(siteFile, 'utf8');
    assert.match(text, /brandKitId:\s*"kit-abc"/);
  });

  it('is idempotent for same id', async () => {
    await stampSiteDefinitionBrandKitId(siteFile, 'kit-abc');
    const r = await stampSiteDefinitionBrandKitId(siteFile, 'kit-abc');
    assert.equal(r.unchanged, true);
  });
});
