/**
 * Run: node --import tsx --test tools/definitions/apply/module-json.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  expandModuleForSerSession,
  findSaiModuleJsonPath,
  getMinimalModuleJsonPath,
  resetModuleJsonToMinimal,
  scrubModuleCollectionRules,
  scrubModuleSiteRules,
} from './module-json.ts';

function sampleModule() {
  return {
    namespace: 'BQ',
    items: {
      path: 'sai',
      includes: [
        {
          name: 'templates',
          path: '/sitecore/templates/Project',
          rules: [
            {
              path: '/axa',
              scope: 'ItemAndDescendants',
              allowedPushOperations: 'CreateUpdateAndDelete',
            },
            {
              path: '/crelan',
              scope: 'ItemAndDescendants',
              allowedPushOperations: 'CreateUpdateAndDelete',
            },
            { path: '*', scope: 'Ignored' },
          ],
        },
        {
          name: 'media-library',
          path: '/sitecore/media library/Project',
          rules: [
            {
              path: '/crelan',
              scope: 'ItemAndDescendants',
              allowedPushOperations: 'CreateUpdateAndDelete',
            },
            { path: '*', scope: 'Ignored' },
          ],
        },
        {
          name: 'sites',
          path: '/sitecore/content',
          rules: [
            {
              path: '/axa',
              scope: 'ItemAndDescendants',
              rules: [
                {
                  path: '/axa-be',
                  rules: [{ path: '/home', scope: 'ItemAndDescendants' }],
                },
              ],
            },
            {
              path: '/crelan',
              scope: 'ItemAndDescendants',
              rules: [
                {
                  path: '/crelan-be',
                  rules: [{ path: '/home', scope: 'ItemAndDescendants' }],
                },
                {
                  path: '/crelan-other',
                  rules: [{ path: '/home', scope: 'ItemAndDescendants' }],
                },
              ],
            },
            { path: '*', scope: 'Ignored' },
          ],
        },
      ],
    },
  };
}

describe('scrubModuleCollectionRules', () => {
  it('removes /crelan from collection includes and sites; leaves axa', () => {
    const { data, changed } = scrubModuleCollectionRules(
      sampleModule(),
      'crelan',
    );
    assert.equal(changed, true);
    const templates = data.items.includes.find((i) => i.name === 'templates');
    assert.equal(
      templates.rules.some((r) => r.path === '/crelan'),
      false,
    );
    assert.ok(templates.rules.some((r) => r.path === '/axa'));
    assert.ok(templates.rules.some((r) => r.path === '*' && r.scope === 'Ignored'));

    const media = data.items.includes.find((i) => i.name === 'media-library');
    assert.equal(
      media.rules.some((r) => r.path === '/crelan'),
      false,
    );

    const sites = data.items.includes.find((i) => i.name === 'sites');
    assert.equal(
      sites.rules.some((r) => r.path === '/crelan'),
      false,
    );
    assert.ok(sites.rules.some((r) => r.path === '/axa'));
  });

  it('returns unchanged when collection absent', () => {
    const mod = sampleModule();
    const { data, changed } = scrubModuleCollectionRules(mod, 'missing');
    assert.equal(changed, false);
    assert.equal(data, mod);
  });
});

describe('scrubModuleSiteRules', () => {
  it('removes only /crelan-be under sites /crelan; keeps collection template rules', () => {
    const { data, changed } = scrubModuleSiteRules(
      sampleModule(),
      'crelan',
      'crelan-be',
    );
    assert.equal(changed, true);

    const templates = data.items.includes.find((i) => i.name === 'templates');
    assert.ok(templates.rules.some((r) => r.path === '/crelan'));

    const sites = data.items.includes.find((i) => i.name === 'sites');
    const crelan = sites.rules.find((r) => r.path === '/crelan');
    assert.ok(crelan);
    assert.equal(
      crelan.rules.some((r) => r.path === '/crelan-be'),
      false,
    );
    assert.ok(crelan.rules.some((r) => r.path === '/crelan-other'));
  });

  it('removes empty collection rule from sites when last site is deleted', () => {
    const mod = sampleModule();
    const sites = mod.items.includes.find((i) => i.name === 'sites');
    const crelan = sites.rules.find((r) => r.path === '/crelan');
    crelan.rules = [
      {
        path: '/crelan-be',
        rules: [{ path: '/home', scope: 'ItemAndDescendants' }],
      },
    ];

    const { data, changed } = scrubModuleSiteRules(mod, 'crelan', 'crelan-be');
    assert.equal(changed, true);
    const sitesAfter = data.items.includes.find((i) => i.name === 'sites');
    assert.equal(
      sitesAfter.rules.some((r) => r.path === '/crelan'),
      false,
    );
    // Template/media collection rules untouched
    const templates = data.items.includes.find((i) => i.name === 'templates');
    assert.ok(templates.rules.some((r) => r.path === '/crelan'));
  });
});

describe('expandModuleForSerSession + resetModuleJsonToMinimal', () => {
  it('expand then reset restores deep-equal to .minimal', () => {
    const active = findSaiModuleJsonPath();
    const minimalPath = getMinimalModuleJsonPath(active);
    assert.ok(fs.existsSync(minimalPath), `missing ${minimalPath}`);
    const backup = fs.readFileSync(active, 'utf8');
    const minimalRaw = fs.readFileSync(minimalPath, 'utf8');
    try {
      // Start from a non-minimal shape so expand/reset is observable
      fs.writeFileSync(
        active,
        JSON.stringify({ namespace: 'BQ', items: { path: 'sai', includes: [] } }, null, 2) +
          '\n',
        'utf8',
      );

      const expanded = expandModuleForSerSession({
        collectionSystem: 'lifecycle-test-brand',
        siteSystem: 'lifecycle-test-brand-com',
      });
      assert.equal(expanded.collectionSystem, 'lifecycle-test-brand');
      assert.equal(expanded.siteSystem, 'lifecycle-test-brand-com');

      const afterExpand = JSON.parse(fs.readFileSync(active, 'utf8'));
      const templates = afterExpand.items.includes.find(
        (i) => i.name === 'templates',
      );
      assert.ok(
        templates.rules.some((r) => r.path === '/lifecycle-test-brand'),
        'expand should add collection include rules',
      );

      const reset = resetModuleJsonToMinimal();
      assert.equal(reset.path, active);
      assert.equal(reset.from, minimalPath);

      const afterReset = fs.readFileSync(active, 'utf8');
      assert.deepEqual(
        JSON.parse(afterReset),
        JSON.parse(minimalRaw),
        'reset should restore .minimal JSON',
      );
    } finally {
      fs.writeFileSync(active, backup, 'utf8');
    }
  });
});

describe('create/apply must not expand module.json', () => {
  it('collection.ts and site.ts no longer call ensureModule*', () => {
    const collectionSrc = fs.readFileSync(
      path.join(import.meta.dirname, 'collection.ts'),
      'utf8',
    );
    const siteSrc = fs.readFileSync(
      path.join(import.meta.dirname, 'site.ts'),
      'utf8',
    );
    assert.equal(
      /ensureModule(Collection|Site)Rules/.test(collectionSrc),
      false,
    );
    assert.equal(/ensureModule(Collection|Site)Rules/.test(siteSrc), false);
    assert.equal(/from ["']\.\/module-json["']/.test(collectionSrc), false);
    assert.equal(/from ["']\.\/module-json["']/.test(siteSrc), false);
  });
});
