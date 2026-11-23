/**
 * Page file + partial DS alignment (create:sectioncomponents contract).
 * Run: node --test tools/create-section-components/presentation.page-ds.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  alignPartialsDatasourceItems,
  alignRenderingsDatasourceItems,
  rebindChildrenFromContentSeeds,
  writeSitePresentationDefinition,
} from './presentation.mjs';

describe('alignRenderingsDatasourceItems / alignPartialsDatasourceItems', () => {
  it('assigns sole seed from definition; multi-seed rebinds children from all seeds', async () => {
    // hostToHostSlugFolder strips leading underscores — use a clean slug.
    const host = `tmpds${Date.now()}`;
    const hostRoot = path.join(bqRoot, 'src', 'components', host);
    try {
      await mkdir(path.join(hostRoot, 'Hero'), { recursive: true });
      await writeFile(
        path.join(hostRoot, 'Hero', 'site-hero.definition.ts'),
        `export const d = {
  kind: "component",
  definitionKey: "site-hero",
  content: { items: [{ name: "Welcome Hero", fields: {} }] },
};
`,
        'utf8',
      );
      await mkdir(path.join(hostRoot, 'FooterCol'), { recursive: true });
      await writeFile(
        path.join(hostRoot, 'FooterCol', 'footer-col.definition.ts'),
        `export const d = {
  kind: "component",
  definitionKey: "footer-col",
  content: { items: [
    { name: "Our Offer", fields: {} },
    { name: "Themes", fields: {} },
    { name: "Direct Links", fields: {} },
    { name: "Contact Us", fields: {} },
  ] },
};
`,
        'utf8',
      );

      const renderings = await alignRenderingsDatasourceItems(
        [
          {
            definitionKey: 'site-hero',
            placeholder: 'headless-main',
            datasourceItem: 'SiteHero ab12cd34',
          },
        ],
        host,
      );
      assert.equal(renderings[0].datasourceItem, 'Welcome Hero');

      const partials = await alignPartialsDatasourceItems(
        [
          {
            definitionKey: 'site-hero',
            placeholder: 'headless-footer',
            datasourceItem: 'Banking Header',
            children: [
              {
                definitionKey: 'footer-col',
                placeholder: 'footer-columns',
                datasourceItem: 'FooterCol deadbeef',
              },
              {
                definitionKey: 'footer-col',
                placeholder: 'footer-columns',
                datasourceItem: 'Invented Orphan Name',
              },
            ],
          },
        ],
        host,
      );
      assert.equal(partials[0].datasourceItem, 'Welcome Hero');
      assert.equal(partials[0].children.length, 4);
      assert.deepEqual(
        partials[0].children.map((c) => c.datasourceItem),
        ['Our Offer', 'Themes', 'Direct Links', 'Contact Us'],
      );
    } finally {
      await rm(hostRoot, { recursive: true, force: true });
    }
  });
});

describe('rebindChildrenFromContentSeeds sketch order', () => {
  it('keeps interleaved peers (Split / Health / Split) in sketch order', async () => {
    const host = `tmprebind${Date.now()}`;
    const hostRoot = path.join(bqRoot, 'src', 'components', host);
    try {
      await mkdir(path.join(hostRoot, 'SplitBand'), { recursive: true });
      await writeFile(
        path.join(hostRoot, 'SplitBand', 'split-band.definition.ts'),
        `export const d = {
  definitionKey: "split-band",
  content: { items: [
    { name: "Anderzorg", fields: {} },
    { name: "Dan Is Er", fields: {} },
  ] },
};
`,
        'utf8',
      );
      await mkdir(path.join(hostRoot, 'HealthGrid'), { recursive: true });
      await writeFile(
        path.join(hostRoot, 'HealthGrid', 'health-grid.definition.ts'),
        `export const d = {
  definitionKey: "health-grid",
  content: { items: [{ name: "Health Card Grid", fields: {} }] },
};
`,
        'utf8',
      );

      const out = await rebindChildrenFromContentSeeds(
        [
          {
            definitionKey: 'split-band',
            placeholder: 'main',
            datasourceItem: 'Anderzorg',
          },
          {
            definitionKey: 'health-grid',
            placeholder: 'main',
            datasourceItem: 'Health Card Grid',
          },
          {
            definitionKey: 'split-band',
            placeholder: 'main',
            datasourceItem: 'Dan Is Er',
          },
        ],
        host,
      );
      assert.deepEqual(
        out.map((c) => c.datasourceItem),
        ['Anderzorg', 'Health Card Grid', 'Dan Is Er'],
      );
    } finally {
      await rm(hostRoot, { recursive: true, force: true });
    }
  });
});

describe('writeSitePresentationDefinition page + partial contract', () => {
  it('writes pages/{site}-{route}.definition.ts and omits presentation.pages', async () => {
    const host = `tmppres${Date.now()}`;
    const hostRoot = path.join(bqRoot, 'src', 'components', host);
    try {
      await mkdir(hostRoot, { recursive: true });
      // Seed so DS align can resolve
      await mkdir(path.join(hostRoot, 'Hero'), { recursive: true });
      await writeFile(
        path.join(hostRoot, 'Hero', 'tmp-hero.definition.ts'),
        `export const d = {
  kind: "component",
  definitionKey: "tmp-hero",
  content: { items: [{ name: "Tmp Hero Seed", fields: {} }] },
};
`,
        'utf8',
      );

      const out = await writeSitePresentationDefinition({
        siteSystem: host,
        collectionSystem: 'tmp-collection',
        hostSlug: host,
        components: [
          {
            definitionKey: 'tmp-hero',
            role: 'page',
            availableGroup: 'Page Content',
          },
        ],
        homeRenderings: [
          {
            definitionKey: 'tmp-hero',
            placeholder: 'headless-main',
            role: 'page',
            datasourceItem: 'TmpHero deadbeef',
          },
        ],
        partials: [
          {
            signature: 'cookie',
            definitionKey: 'tmp-hero',
            name: 'Cookie',
            placeholder: 'headless-header',
            datasourceItem: 'TmpHero deadbeef',
          },
        ],
        pageKey: 'particulieren',
        routePath: '/particulieren',
        navigationTitle: 'Particulieren',
        isHome: true,
        dryRun: false,
      });

      const presSrc = await readFile(out.file, 'utf8');
      assert.match(presSrc, /partialDesigns:/);
      assert.match(presSrc, /availableRenderings:/);
      assert.ok(!/\bpages\s*:/.test(presSrc), 'must not write presentation.pages');
      assert.match(presSrc, /"tmp-hero"/);

      assert.ok(out.pageFile);
      assert.ok(out.pageFile.includes(`${path.sep}pages${path.sep}`));
      assert.equal(out.pageFile.includes('_page-stubs'), false);
      const pageSrc = await readFile(out.pageFile, 'utf8');
      assert.match(pageSrc, /kind: "page"/);
      assert.match(pageSrc, /Tmp Hero Seed/);
      assert.ok(!pageSrc.includes('stub-'));
      assert.match(pageSrc, new RegExp(`${host}-home`));
    } finally {
      await rm(hostRoot, { recursive: true, force: true });
    }
  });
});
