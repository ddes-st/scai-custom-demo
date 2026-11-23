/**
 * Run: node --test --import tsx tools/definitions/apply/component-to-rendering.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapComponentToRenderingDefinition,
  projectRenderingPathLeaf,
} from './component-to-rendering.ts';
import {
  JSS_LINK_LIST_RENDERING,
  PLATFORM_LINK_LIST_COMPONENT_GQL,
} from '../../shared/platform-link-list.ts';

describe('mapComponentToRenderingDefinition childItemTemplate GQL', () => {
  it('synthesizes ComponentQuery when childItemTemplate is present', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'demo-feature-tile-grid',
      name: 'demo-feature-tile-grid',
      componentName: 'DemoFeatureTileGrid',
      displayName: 'Feature Tile Grid',
      collectionSystem: 'Demo',
      model: {
        folderTemplate: { name: 'Feature Tile Grid Folder' },
        itemTemplate: {
          name: 'Feature Tile Grid',
          sections: [
            {
              name: 'Data',
              fields: [{ name: 'Heading' }, { name: 'Eyebrow' }],
            },
          ],
        },
        childItemTemplate: {
          name: 'Feature Tile',
          sections: [
            {
              name: 'Data',
              fields: [{ name: 'Title' }, { name: 'Logo' }],
            },
          ],
        },
      },
      content: {
        location: { root: 'data', folder: ['Feature Tile Grids'] },
        items: [],
      },
    });
    assert.ok(rendering.componentGraphQLQuery);
    assert.match(rendering.componentGraphQLQuery, /children\(first:/);
    assert.match(rendering.componentGraphQLQuery, /heading: field\(name: "Heading"\)/);
    assert.match(rendering.componentGraphQLQuery, /eyebrow: field\(name: "Eyebrow"\)/);
    assert.match(rendering.componentGraphQLQuery, /title: field\(name: "Title"\)/);
    assert.match(rendering.componentGraphQLQuery, /logo: field\(name: "Logo"\)/);
  });

  it('derives Path leaf from componentName stem, never displayName; keeps shared itemTemplate', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'crelan-navigation-card',
      name: 'crelan-navigation-card',
      componentName: 'CrelanNavigationCard',
      displayName: 'Totally Different Marketing Title That Should Not Become Path',
      collectionSystem: 'crelan',
      model: {
        folderTemplate: { name: 'Navigation Card Folder' },
        itemTemplate: {
          name: 'Navigation Card',
          sections: [],
        },
      },
    });
    assert.equal(rendering.name, 'Navigation Card');
    assert.equal(rendering.model?.itemTemplate?.name, 'Navigation Card');
    assert.equal(rendering.model?.folderTemplate?.name, 'Navigation Card Folder');
  });

  it('keeps shared Link List itemTemplate while Path leaf follows componentName', () => {
    const quick = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-footer-quick-link-list',
      name: 'menzis-footer-quick-link-list',
      componentName: 'MenzisFooterQuickLinkList',
      displayName: 'Footer Quick Link List',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      datasourceLocation: { scope: 'site', root: 'data', folder: ['Link Lists'] },
      model: {
        folderTemplate: { name: 'Link List Folder' },
        itemTemplate: { name: 'Link List', sections: [] },
      },
    });
    const account = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-footer-account-link-list',
      name: 'menzis-footer-account-link-list',
      componentName: 'MenzisFooterAccountLinkList',
      displayName: 'Footer Account Link List',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      datasourceLocation: { scope: 'site', root: 'data', folder: ['Link Lists'] },
      model: {
        folderTemplate: { name: 'Link List Folder' },
        itemTemplate: { name: 'Link List', sections: [] },
      },
    });
    assert.equal(quick.model?.itemTemplate?.name, 'Link List');
    assert.equal(account.model?.itemTemplate?.name, 'Link List');
    assert.equal(quick.model?.folderTemplate?.name, 'Link List Folder');
    assert.equal(account.model?.folderTemplate?.name, 'Link List Folder');
    assert.equal(quick.name, 'Footer Quick Link List');
    assert.equal(account.name, 'Footer Account Link List');
    assert.notEqual(quick.name, account.name);
  });

  it('strips JSON.stringify quote chars from itemTemplate names; Path leaf from componentName', () => {
    // Evaluated definition value includes literal " from JSON.stringify('…')
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-cookie-wall',
      name: 'menzis-cookie-wall',
      componentName: 'MenzisCookieWall',
      displayName: '"Cookie Consent Overlay"',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: '"Cookie Consent Overlay Folder"' },
        itemTemplate: {
          name: '"Cookie Consent Overlay"',
          sections: [],
        },
      },
    });
    assert.equal(rendering.model?.itemTemplate?.name, 'Cookie Consent Overlay');
    assert.equal(
      rendering.model?.folderTemplate?.name,
      'Cookie Consent Overlay Folder',
    );
    assert.equal(rendering.name, 'Cookie Wall');
    assert.doesNotMatch(rendering.model?.itemTemplate?.name || '', /"/);
  });

  it('falls back to unbranded componentName-spaced when itemTemplate.name missing', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'demo-widget',
      name: 'demo-widget',
      componentName: 'DemoWidget',
      displayName: 'Should Not Win Path Leaf',
      collectionSystem: 'Demo',
      siteSystem: 'demo-nl',
      model: {
        folderTemplate: {},
        itemTemplate: { sections: [] },
      },
    });
    assert.equal(rendering.model?.itemTemplate?.name, 'Widget');
    assert.equal(rendering.model?.folderTemplate?.name, 'Widget Folder');
    assert.equal(rendering.name, 'Widget');
    assert.equal(rendering.componentName, 'demo-widget');
  });

  it('strips site brand from Path; keeps branded Component Name kebab', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-introduction-hero',
      name: 'menzis-introduction-hero',
      componentName: 'MenzisIntroductionHero',
      displayName: 'Introduction Hero',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: 'Menzis Introduction Hero Folder' },
        itemTemplate: {
          name: 'Menzis Introduction Hero',
          sections: [],
        },
      },
    });
    assert.equal(rendering.name, 'Introduction Hero');
    assert.equal(rendering.model?.itemTemplate?.name, 'Introduction Hero');
    assert.equal(
      rendering.model?.folderTemplate?.name,
      'Introduction Hero Folder',
    );
    assert.equal(rendering.componentName, 'menzis-introduction-hero');
  });

  it('does not override explicit componentGraphQLQuery', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'demo-x',
      name: 'demo-x',
      componentName: 'DemoX',
      collectionSystem: 'Demo',
      componentGraphQLQuery: 'query Custom { datasource: item { id } }',
      model: {
        folderTemplate: { name: 'X Folder' },
        itemTemplate: { name: 'X', sections: [] },
        childItemTemplate: {
          name: 'Y',
          sections: [{ name: 'Data', fields: [{ name: 'Title' }] }],
        },
      },
    });
    assert.equal(
      rendering.componentGraphQLQuery,
      'query Custom { datasource: item { id } }',
    );
  });
});

describe('mapComponentToRenderingDefinition JSS LinkList parity', () => {
  it('applies JSS LinkList rendering fields for folder Link Lists', () => {
    const rendering = mapComponentToRenderingDefinition({
      kind: 'component',
      definitionKey: 'menzis-footer-info-link-list',
      name: 'menzis-footer-info-link-list',
      componentName: 'MenzisFooterInfoLinkList',
      displayName: 'Footer Info Link List',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      datasourceLocation: {
        scope: 'site',
        root: 'data',
        folder: ['Link Lists'],
      },
      model: {
        folderTemplate: { name: 'Link Lists Folder' },
        itemTemplate: { name: 'Link List', sections: [] },
      },
      content: {
        location: { root: 'data', folder: ['Link Lists'] },
        items: [
          {
            name: 'Legal Links',
            fields: { Title: 'Legal Links' },
            children: [
              {
                name: 'Privacy',
                fields: {
                  Link: { text: 'Privacy', url: 'https://www.menzis.nl/privacy' },
                },
              },
            ],
          },
        ],
      },
    });
    assert.equal(
      rendering.datasourceTemplate,
      JSS_LINK_LIST_RENDERING.datasourceTemplate,
    );
    assert.equal(
      rendering.datasourceLocationQuery,
      JSS_LINK_LIST_RENDERING.datasourceLocation,
    );
    assert.equal(
      rendering.parametersTemplateId,
      JSS_LINK_LIST_RENDERING.parametersTemplateId,
    );
    assert.equal(
      rendering.pageEditorButtons,
      JSS_LINK_LIST_RENDERING.pageEditorButtons,
    );
    assert.equal(
      rendering.addFieldEditorButton,
      JSS_LINK_LIST_RENDERING.addFieldEditorButton,
    );
    assert.equal(rendering.icon, JSS_LINK_LIST_RENDERING.icon);
    assert.equal(rendering.componentGraphQLQuery, PLATFORM_LINK_LIST_COMPONENT_GQL);
    assert.equal(rendering.componentName, 'menzis-footer-info-link-list');
    assert.equal(rendering.name, 'Footer Info Link List');
    assert.equal(rendering.model?.itemTemplate?.name, 'Link List');
  });
});

describe('projectRenderingPathLeaf', () => {
  it('uses unbranded componentName stem for MenzisMediaHero (not itemTemplate Image Hero)', () => {
    const leaf = projectRenderingPathLeaf({
      kind: 'component',
      definitionKey: 'menzis-media-hero',
      name: 'menzis-media-hero',
      componentName: 'MenzisMediaHero',
      displayName: 'Media Hero',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: 'Image Hero Folder' },
        itemTemplate: { name: 'Image Hero', sections: [] },
      },
    });
    assert.equal(leaf, 'Media Hero');
  });

  it('uses Support And Health Path leaf from componentName (not itemTemplate Content suffix)', () => {
    const leaf = projectRenderingPathLeaf({
      kind: 'component',
      definitionKey: 'menzis-support-and-health',
      name: 'menzis-support-and-health',
      componentName: 'MenzisSupportAndHealth',
      displayName: 'Support And Health',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: 'Support And Health Content Folder' },
        itemTemplate: { name: 'Support And Health Content', sections: [] },
      },
    });
    assert.equal(leaf, 'Support And Health');
  });

  it('uses rendering.name for kind rendering (not kebab/Pascal componentName)', () => {
    const leaf = projectRenderingPathLeaf({
      kind: 'rendering',
      definitionKey: 'demo-rendering',
      name: 'Demo Spaced Leaf',
      componentName: 'demo-rendering',
      collectionSystem: 'Demo',
    });
    assert.equal(leaf, 'Demo Spaced Leaf');
  });

  it('keeps Support Guidance Tile Path leaf distinct from Support Feature Card', () => {
    const feature = projectRenderingPathLeaf({
      kind: 'component',
      definitionKey: 'menzis-support-feature-card',
      name: 'menzis-support-feature-card',
      componentName: 'MenzisSupportFeatureCard',
      displayName: 'Support Feature Card',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: 'Support Feature Card Folder' },
        itemTemplate: { name: 'Support Feature Card', sections: [] },
      },
    });
    const guidance = projectRenderingPathLeaf({
      kind: 'component',
      definitionKey: 'menzis-support-guidance-tile',
      name: 'menzis-support-guidance-tile',
      componentName: 'MenzisSupportGuidanceTile',
      displayName: 'Support Guidance Tile',
      collectionSystem: 'menzis',
      siteSystem: 'menzis-nl',
      model: {
        folderTemplate: { name: 'Support Guidance Tile Folder' },
        itemTemplate: { name: 'Support Guidance Tile', sections: [] },
      },
    });
    assert.equal(feature, 'Support Feature Card');
    assert.equal(guidance, 'Support Guidance Tile');
    assert.notEqual(feature, guidance);
  });
});
