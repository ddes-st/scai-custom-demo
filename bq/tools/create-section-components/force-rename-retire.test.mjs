/**
 * Force-rename index scrub helpers.
 * Run: node --import tsx --test tools/create-section-components/force-rename-retire.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  remapCaptureMetaChildren,
  refreshCaptureMetaPlaceholderAgainstHost,
  remapPresentationObjectKeys,
  remapQuotedDefinitionKey,
  retireCasingSiblingPackageFiles,
  scrubIndexEntriesForOldName,
} from './force-rename-retire.mjs';
import { toKebabCase } from './naming.mjs';
import { remapLayoutSketchComponentNames } from './sitecoreize-child-names.mjs';

const HOST = '__test-force-rename-retire__';

describe('scrubIndexEntriesForOldName', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const indexPath = path.join(hostDir, 'section-name-index.json');

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
    await mkdir(hostDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('remaps section + child slots from old package name to new', async () => {
    await writeFile(
      indexPath,
      `${JSON.stringify(
        {
          'page/sections/section-01': {
            componentName: 'CrelanHeader',
            definitionKey: 'crelan-header',
            children: ['CrelanNavItem'],
          },
          'page/sections/section-02': {
            componentName: 'CrelanOther',
            children: ['CrelanHeader', 'CrelanKeep'],
          },
        },
        null,
        2,
      )}\n`,
    );

    const result = await scrubIndexEntriesForOldName(HOST, 'CrelanHeader', {
      newComponentName: 'CrelanLocalServicesAndNavigation',
      newDefinitionKey: 'crelan-local-services-and-navigation',
    });
    assert.equal(result.changed, true);

    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    assert.equal(
      index['page/sections/section-01'].componentName,
      'CrelanLocalServicesAndNavigation',
    );
    assert.equal(
      index['page/sections/section-01'].definitionKey,
      'crelan-local-services-and-navigation',
    );
    assert.deepEqual(index['page/sections/section-02'].children, [
      'CrelanLocalServicesAndNavigation',
      'CrelanKeep',
    ]);
  });

  it('remaps object-shaped children in the index', async () => {
    await writeFile(
      indexPath,
      `${JSON.stringify(
        {
          'page/sections/section-04': {
            componentName: 'CrelanHost',
            definitionKey: 'crelan-host',
            children: [
              {
                componentName: 'CrelanLinkList',
                definitionKey: 'crelan-link-list',
                placeholderKey: 'bands',
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
    );
    const result = await scrubIndexEntriesForOldName(HOST, 'CrelanLinkList', {
      newComponentName: 'CrelanStoryBand',
      newDefinitionKey: 'crelan-story-band',
    });
    assert.equal(result.changed, true);
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    assert.deepEqual(index['page/sections/section-04'].children, [
      {
        componentName: 'CrelanStoryBand',
        definitionKey: 'crelan-story-band',
        placeholderKey: 'bands',
      },
    ]);
  });
});

describe('force-rename local remap helpers', () => {
  it('remapQuotedDefinitionKey rewrites allowedControls keys', () => {
    const src = `placeholders: [{ key: 'bands', allowedControls: ['crelan-link-list', 'crelan-keep'] }]`;
    const out = remapQuotedDefinitionKey(
      src,
      'crelan-link-list',
      'crelan-story-band',
    );
    assert.match(out, /crelan-story-band/);
    assert.doesNotMatch(out, /crelan-link-list/);
    assert.match(out, /crelan-keep/);
  });

  it('remapPresentationObjectKeys remaps nested page children', () => {
    const { presentation, remapped } = remapPresentationObjectKeys(
      {
        availableRenderings: {
          'Page Content': ['crelan-link-list', 'crelan-host'],
        },
        pages: {
          home: {
            renderings: [
              {
                definitionKey: 'crelan-host',
                children: [
                  { definitionKey: 'crelan-link-list' },
                  { definitionKey: 'crelan-keep' },
                ],
              },
            ],
          },
        },
      },
      'crelan-link-list',
      'crelan-story-band',
    );
    assert.ok(remapped >= 2);
    assert.deepEqual(presentation.availableRenderings['Page Content'], [
      'crelan-story-band',
      'crelan-host',
    ]);
    assert.equal(
      presentation.pages.home.renderings[0].children[0].definitionKey,
      'crelan-story-band',
    );
  });

  it('remapCaptureMetaChildren + layoutSketch rename', () => {
    const meta = {
      children: [
        {
          componentName: 'CrelanLinkList',
          definitionKey: 'crelan-link-list',
        },
      ],
    };
    assert.equal(
      remapCaptureMetaChildren(
        meta,
        'CrelanLinkList',
        'crelan-link-list',
        'CrelanStoryBand',
        'crelan-story-band',
      ),
      true,
    );
    assert.equal(meta.children[0].componentName, 'CrelanStoryBand');
    assert.equal(meta.children[0].definitionKey, 'crelan-story-band');

    const sketch = {
      renderings: [
        {
          componentName: 'CrelanHost',
          placeholders: {
            bands: [{ componentName: 'CrelanLinkList' }],
          },
        },
      ],
    };
    remapLayoutSketchComponentNames(sketch, {
      CrelanLinkList: 'CrelanStoryBand',
    });
    assert.equal(
      sketch.renderings[0].placeholders.bands[0].componentName,
      'CrelanStoryBand',
    );
    assert.equal(sketch.renderings[0].componentName, 'CrelanHost');
  });

  it('refreshCaptureMetaPlaceholderAgainstHost remaps stale PH from definitionKey', () => {
    const meta = {
      definitionKey: 'menzis-footer-account-links',
      placeholderKey: 'footer-support-links',
      placeholderKeys: ['footer-support-links'],
    };
    assert.equal(
      refreshCaptureMetaPlaceholderAgainstHost(meta, {
        definitionKey: 'menzis-footer-account-links',
        hostPlaceholderKeys: [
          'footer-account-links',
          'footer-help-links',
          'footer-quick-links',
        ],
      }),
      true,
    );
    assert.equal(meta.placeholderKey, 'footer-account-links');
    assert.deepEqual(meta.placeholderKeys, ['footer-account-links']);
  });

  it('remapCaptureMetaChildren refreshes own package placeholderKey on rename', () => {
    const meta = {
      definitionKey: 'menzis-footer-support-link-list',
      componentName: 'MenzisFooterSupportLinkList',
      placeholderKey: 'footer-support-links',
      placeholderKeys: ['footer-support-links'],
      children: [],
    };
    assert.equal(
      remapCaptureMetaChildren(
        meta,
        'MenzisFooterSupportLinkList',
        'menzis-footer-support-link-list',
        'MenzisFooterAccountLinks',
        'menzis-footer-account-links',
      ),
      true,
    );
    assert.equal(meta.definitionKey, 'menzis-footer-account-links');
    assert.equal(meta.placeholderKey, 'footer-account-links');
  });
});

describe('retireCasingSiblingPackageFiles', () => {
  const survivor = 'SitecoreAiAssistedHeroBanner';
  const sibling = 'SitecoreAIAssistedHeroBanner';
  const dir = path.join(bqRoot, 'src', 'components', HOST, survivor);

  beforeEach(async () => {
    await rm(path.join(bqRoot, 'src', 'components', HOST), {
      recursive: true,
      force: true,
    });
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${toKebabCase(survivor)}.capture-meta.json`),
      '{}\n',
    );
    await writeFile(
      path.join(dir, `${toKebabCase(sibling)}.definition.ts`),
      'export const stale = 1;\n',
    );
    await writeFile(
      path.join(dir, `${toKebabCase(sibling)}.capture-meta.json`),
      '{}\n',
    );
  });

  afterEach(async () => {
    await rm(path.join(bqRoot, 'src', 'components', HOST), {
      recursive: true,
      force: true,
    });
  });

  it('deletes sibling kebab files and keeps survivor', async () => {
    const result = await retireCasingSiblingPackageFiles({
      hostSlug: HOST,
      survivorComponentName: survivor,
      siblingComponentName: sibling,
    });
    assert.ok(result.removed.length >= 2);
    const { access } = await import('node:fs/promises');
    await assert.rejects(() =>
      access(path.join(dir, `${toKebabCase(sibling)}.definition.ts`)),
    );
    await access(path.join(dir, `${toKebabCase(survivor)}.capture-meta.json`));
  });
});
