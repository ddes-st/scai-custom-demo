/**
 * Run: node --import tsx --test tools/create-section-components/section-codegen-orphan-child.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SITECOREIZE_MULTI_BAND_MAX_RETRIES,
  SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES,
  SITECOREIZE_OUTPUT_JSON_SCHEMA,
  buildOrphanChildRetryChanges,
  isOrphanChildPackageList,
  repairOrphanChildPackagesWithSketchHost,
} from './section-codegen.mjs';

describe('isOrphanChildPackageList', () => {
  it('detects child-only packages', () => {
    assert.equal(
      isOrphanChildPackageList([
        {
          role: 'child',
          componentName: 'MenzisFooterLinkList',
          parentPlaceholder: 'footer-link-groups',
        },
      ]),
      true,
    );
  });

  it('is false when a section parent exists', () => {
    assert.equal(
      isOrphanChildPackageList([
        { role: 'section', componentName: 'MenzisFooterNavigation' },
        {
          role: 'child',
          componentName: 'MenzisFooterLinkList',
          parentPlaceholder: 'footer-link-groups',
        },
      ]),
      false,
    );
  });

  it('is false for a lone section package', () => {
    assert.equal(
      isOrphanChildPackageList([
        { role: 'section', componentName: 'MenzisFooterNavigation' },
      ]),
      false,
    );
  });

  it('detects parentPlaceholder without role:section', () => {
    assert.equal(
      isOrphanChildPackageList([
        {
          role: 'child',
          parentPlaceholder: 'footer-link-groups',
          componentName: 'X',
        },
      ]),
      true,
    );
  });
});

describe('buildOrphanChildRetryChanges', () => {
  it('names the orphan child and locked section', () => {
    const changes = buildOrphanChildRetryChanges(
      [
        {
          role: 'child',
          componentName: 'MenzisFooterLinkList',
          definitionKey: 'menzis-footer-link-list',
          parentPlaceholder: 'footer-link-groups',
        },
      ],
      {
        sectionComponentName: 'MenzisFooterNavigation',
        sectionDefinitionKey: 'menzis-footer-navigation',
      },
    );
    assert.ok(changes.length >= 2);
    assert.match(changes[0], /MenzisFooterLinkList/);
    assert.match(changes[0], /footer-link-groups/);
    assert.match(changes[1], /MenzisFooterNavigation/);
    assert.match(changes[1], /menzis-footer-link-list/);
    assert.match(changes[1], /role:"section"/);
  });
});

describe('SITECOREIZE_OUTPUT_JSON_SCHEMA', () => {
  it('HARD-rejects child-only packages', () => {
    assert.match(
      SITECOREIZE_OUTPUT_JSON_SCHEMA,
      /Child-only responses are invalid/i,
    );
    assert.match(
      SITECOREIZE_OUTPUT_JSON_SCHEMA,
      /exactly one role "section"/i,
    );
  });
});

describe('repairOrphanChildPackagesWithSketchHost', () => {
  it('synthesizes role:section from layoutSketch host', () => {
    const packages = [
      {
        role: 'child',
        componentName: 'MenzisHeaderInteractionTopBand',
        definitionKey: 'menzis-header-interaction-top-band',
        parentPlaceholder: 'header-top-band',
        tsx: 'export default function C(){return null}',
        definitionTs: 'export const x = {}',
      },
    ];
    const layoutSketch = {
      renderings: [
        {
          componentName: 'MenzisHeaderInteractionChrome',
          placeholders: {
            'header-top-band': [
              { componentName: 'MenzisHeaderInteractionTopBand' },
            ],
            'header-navigation-band': [
              { componentName: 'MenzisHeaderInteractionNavBand' },
            ],
          },
        },
      ],
    };
    const out = repairOrphanChildPackagesWithSketchHost(packages, layoutSketch, {
      sectionComponentName: 'MenzisHeaderInteractionChrome',
      sectionDefinitionKey: 'menzis-header-interaction-chrome',
    });
    assert.equal(out.repaired, true);
    assert.equal(out.packages[0].role, 'section');
    assert.equal(out.packages[0].componentName, 'MenzisHeaderInteractionChrome');
    assert.equal(isOrphanChildPackageList(out.packages), false);
    assert.match(out.packages[0].definitionTs, /header-top-band/);
    assert.match(
      out.packages[0].definitionTs,
      /menzis-header-interaction-top-band/,
    );
  });
});

describe('sitecoreize retry budgets', () => {
  it('keeps orphan retries; multi-band fails on first emit (no AI regen)', () => {
    assert.equal(SITECOREIZE_ORPHAN_CHILD_MAX_RETRIES, 2);
    assert.equal(SITECOREIZE_MULTI_BAND_MAX_RETRIES, 0);
  });
});

describe('buildOrphanChildRetryChanges completeness', () => {
  it('requires complete packages[] not a child-only delta', () => {
    const changes = buildOrphanChildRetryChanges(
      [
        {
          role: 'child',
          componentName: 'Child',
          parentPlaceholder: 'slot',
        },
      ],
      {
        sectionComponentName: 'Host',
        sectionDefinitionKey: 'host',
      },
    );
    assert.ok(
      changes.some((c) =>
        /every child named in layoutSketch|host-only|patch delta/i.test(c),
      ),
    );
  });
});
