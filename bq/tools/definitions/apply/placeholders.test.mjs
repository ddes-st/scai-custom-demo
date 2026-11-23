/**
 * Run: node --test tools/definitions/apply/placeholders.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  assertPlaceholderSettingId,
  placeholdersFieldValue,
  warnRegistryPathLeafCollisions,
} from './placeholders.ts';
import { formatMultilistItems } from '../../shared/authoring-item-model.ts';

describe('empty allowedControls apply policy', () => {
  it('still creates Placeholder Settings (does not skip)', () => {
    const src = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'placeholders.ts'),
      'utf8',
    );
    assert.match(src, /still creating Placeholder Settings/);
    assert.doesNotMatch(src, /skip empty allowedControls/);
  });
});

describe('warnRegistryPathLeafCollisions', () => {
  it('warns when two defs share a componentName Path leaf', () => {
    const registry = new Map([
      [
        'menzis-support-feature-card',
        {
          kind: 'component',
          definitionKey: 'menzis-support-feature-card',
          name: 'menzis-support-feature-card',
          componentName: 'MenzisSupportFeatureCard',
          collectionSystem: 'menzis',
          model: {
            itemTemplate: { name: 'Support Feature Card', sections: [] },
          },
        },
      ],
      [
        'menzis-support-feature-card-alt',
        {
          kind: 'component',
          definitionKey: 'menzis-support-feature-card-alt',
          name: 'menzis-support-feature-card-alt',
          componentName: 'MenzisSupportFeatureCard',
          collectionSystem: 'menzis',
          model: {
            itemTemplate: { name: 'Other Template', sections: [] },
          },
        },
      ],
    ]);
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      warnRegistryPathLeafCollisions(registry, 'menzis');
    } finally {
      console.warn = orig;
    }
    assert.ok(
      warnings.some((w) => /Path leaf collision.*Support Feature Card/.test(w)),
      warnings.join('\n'),
    );
  });

  it('does not warn when shared itemTemplate but distinct componentName Path leaves', () => {
    const registry = new Map([
      [
        'menzis-footer-quick-link-list',
        {
          kind: 'component',
          definitionKey: 'menzis-footer-quick-link-list',
          name: 'menzis-footer-quick-link-list',
          componentName: 'MenzisFooterQuickLinkList',
          collectionSystem: 'menzis',
          siteSystem: 'menzis-nl',
          model: {
            itemTemplate: { name: 'Link List', sections: [] },
          },
        },
      ],
      [
        'menzis-footer-account-link-list',
        {
          kind: 'component',
          definitionKey: 'menzis-footer-account-link-list',
          name: 'menzis-footer-account-link-list',
          componentName: 'MenzisFooterAccountLinkList',
          collectionSystem: 'menzis',
          siteSystem: 'menzis-nl',
          model: {
            itemTemplate: { name: 'Link List', sections: [] },
          },
        },
      ],
    ]);
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      warnRegistryPathLeafCollisions(registry, 'menzis');
    } finally {
      console.warn = orig;
    }
    assert.equal(warnings.length, 0, warnings.join('\n'));
  });
});

describe('placeholdersFieldValue / formatMultilistItems (TreeList pipes)', () => {
  it('joins multiple braced GUIDs with | for Authoring GraphQL', () => {
    const a = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const b = '11111111-2222-3333-4444-555555555555';
    const value = placeholdersFieldValue([a, b]);
    assert.match(value, /^\{[0-9A-Fa-f-]{36}\}\|\{[0-9A-Fa-f-]{36}\}$/);
    assert.doesNotMatch(value, /\n/);
    assert.equal(
      formatMultilistItems([`{${a}}`, `{${b}}`]).value,
      `{${a}}|{${b}}`,
    );
    assert.equal(formatMultilistItems([`{${a}}`]).value, `{${a}}`);
  });
});

describe('assertPlaceholderSettingId', () => {
  it('warns when path is under Project renderings', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      assertPlaceholderSettingId(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        '/sitecore/layout/Renderings/Project/menzis/Cookie Option Item',
        'menzis',
      );
    } finally {
      console.warn = orig;
    }
    assert.ok(
      warnings.some((w) => /JsonRendering path|not under Placeholder Settings/.test(w)),
      warnings.join('\n'),
    );
  });

  it('is quiet for Placeholder Settings paths with a GUID', () => {
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      assertPlaceholderSettingId(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        '/sitecore/layout/Placeholder Settings/Project/menzis/cookie-options',
        'menzis',
      );
    } finally {
      console.warn = orig;
    }
    assert.deepEqual(warnings, []);
  });

  it('keeps compact 32-hex GUID shape quiet unless BQ_CREATE_LOG=verbose', () => {
    const prev = process.env.BQ_CREATE_LOG;
    const warnings = [];
    const orig = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
      delete process.env.BQ_CREATE_LOG;
      assertPlaceholderSettingId(
        '35040202cfd54dc589959bd9940ddf15',
        '/sitecore/layout/Placeholder Settings/Project/menzis/context-links',
        'menzis',
      );
      assert.deepEqual(warnings, []);

      process.env.BQ_CREATE_LOG = 'verbose';
      assertPlaceholderSettingId(
        '35040202cfd54dc589959bd9940ddf15',
        '/sitecore/layout/Placeholder Settings/Project/menzis/context-links',
        'menzis',
      );
      assert.ok(
        warnings.some((w) => /Placeholders multilist value is not a GUID/.test(w)),
        warnings.join('\n'),
      );
    } finally {
      console.warn = orig;
      if (prev === undefined) delete process.env.BQ_CREATE_LOG;
      else process.env.BQ_CREATE_LOG = prev;
    }
  });
});
