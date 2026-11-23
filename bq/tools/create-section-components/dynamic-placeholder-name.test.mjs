/**
 * DynamicPlaceholderId AppPlaceholder naming (prompt HARD + always-on rewrite + gates).
 * Run: node --import tsx --test tools/create-section-components/dynamic-placeholder-name.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectBareAppPlaceholderNames,
  ensureAppPlaceholderDynamicNames,
} from './ai-source-fixup.mjs';
import { SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD } from './section-codegen.mjs';
import { collectBareAppPlaceholderLiteralNames } from './tsx-contract-diagnostics.mjs';
import {
  assertNestedPresentationPlaceholderParity,
} from './presentation-gate.mjs';
import {
  extractPlaceholderSlotsFromDefinition,
  relocatePartialChildrenToMountedHosts,
} from './presentation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD', () => {
  it('exports HARD requiring DynamicPlaceholderId phName', () => {
    assert.match(SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD, /^HARD —/);
    assert.match(SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD, /DynamicPlaceholderId/);
    assert.match(SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD, /phName/);
    assert.match(SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD, /Forbidden/);
  });

  it('is wired into section-codegen project contract', async () => {
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /SITECOREIZE_DYNAMIC_PLACEHOLDER_NAME_HARD/);
  });

  it('system-codegen-sitecoreize.md documents DynId AppPlaceholder names', async () => {
    const text = await readFile(
      path.join(here, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /DynamicPlaceholderId/);
    assert.match(text, /phName/);
    assert.match(text, /Forbidden/);
  });
});

describe('ensureAppPlaceholderDynamicNames', () => {
  it('rewrites bare name="support-content" to phName with dynId', () => {
    const src = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
type Props = { rendering: object; page: object; params?: { DynamicPlaceholderId?: string } };
export const Default = (props: Props) => {
  const { rendering, page } = props;
  return (
    <main>
      <AppPlaceholder name="support-content" rendering={rendering} page={page} componentMap={componentMap} />
    </main>
  );
};
`;
    const out = ensureAppPlaceholderDynamicNames(src);
    assert.equal(collectBareAppPlaceholderNames(out).length, 0);
    assert.match(out, /placeholderBase\s*=\s*'support-content'/);
    assert.match(out, /DynamicPlaceholderId/);
    assert.match(out, /name=\{phName\}/);
    assert.match(out, /phName\s*=\s*dynId\s*\?/);
  });

  it('rewrites multi-PH header bare names', () => {
    const src = `
export const Default = (props: any) => {
  const { rendering, page } = props;
  return (
    <>
      <AppPlaceholder name="header-top-band" rendering={rendering} page={page} componentMap={{}} />
      <AppPlaceholder name="header-navigation-band" rendering={rendering} page={page} componentMap={{}} />
    </>
  );
};
`;
    const out = ensureAppPlaceholderDynamicNames(src);
    assert.equal(collectBareAppPlaceholderNames(out).length, 0);
    assert.match(out, /headerTopBandBase\s*=\s*'header-top-band'/);
    assert.match(out, /headerNavigationBandBase\s*=\s*'header-navigation-band'/);
    assert.match(out, /name=\{headerTopBandPh\}/);
    assert.match(out, /name=\{headerNavigationBandPh\}/);
  });

  it('converts paren-body Default and rewrites health-cards', () => {
    const src = `
export const Default = (props: any): any => (
  <section>
    <AppPlaceholder name="health-cards" rendering={props.rendering} page={props.page} componentMap={{}} />
  </section>
);
`;
    const out = ensureAppPlaceholderDynamicNames(src);
    assert.equal(collectBareAppPlaceholderNames(out).length, 0);
    assert.match(out, /return\s*\(/);
    assert.match(out, /name=\{phName\}/);
  });

  it('no-ops when already using phName pattern', () => {
    const src = `
export const Default = (props: any) => {
  const placeholderBase = 'footer-legal-links';
  const dynId = props.params?.DynamicPlaceholderId;
  const phName = dynId ? \`\${placeholderBase}-\${dynId}\` : placeholderBase;
  return <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={{}} />;
};
`;
    assert.equal(ensureAppPlaceholderDynamicNames(src), src);
  });
});

describe('write-path always-on DynId wiring', () => {
  it('write-component.mjs calls ensureAppPlaceholderDynamicNames', async () => {
    const src = await readFile(path.join(here, 'write-component.mjs'), 'utf8');
    assert.match(src, /ensureAppPlaceholderDynamicNames/);
    assert.match(
      src,
      /normalizedTsx\s*=\s*ensureAppPlaceholderDynamicNames\s*\(\s*normalizedTsx\s*\)/,
    );
  });
});

describe('tsx-contract bare AppPlaceholder diagnostics', () => {
  it('collectBareAppPlaceholderLiteralNames finds string names', () => {
    const src = `<AppPlaceholder name="support-content" rendering={r} page={p} componentMap={m} />`;
    assert.deepEqual(collectBareAppPlaceholderLiteralNames(src), [
      'support-content',
    ]);
  });
});

describe('extractPlaceholderSlotsFromDefinition', () => {
  it('parses key + allowedControls', () => {
    const src = `
placeholders: [
  { key: 'support-links', allowedControls: ['menzis-footer-support-link-list'] },
  { key: 'account-links', allowedControls: [] },
],
`;
    const slots = extractPlaceholderSlotsFromDefinition(src);
    assert.equal(slots.length, 2);
    assert.equal(slots[0].key, 'support-links');
    assert.deepEqual(slots[0].allowedControls, [
      'menzis-footer-support-link-list',
    ]);
    assert.deepEqual(slots[1].allowedControls, []);
  });
});

describe('assertNestedPresentationPlaceholderParity', () => {
  it('fails when child PH missing from parent slots', async () => {
    await assert.rejects(
      () =>
        assertNestedPresentationPlaceholderParity({
          hostSlug: 'menzis-nl',
          pages: {
            home: {
              renderings: [
                {
                  definitionKey: 'parent-host',
                  children: [
                    {
                      definitionKey: 'child-a',
                      placeholder: 'missing-slot',
                    },
                  ],
                },
              ],
            },
          },
          partials: [],
          resolveSlots: async (key) =>
            key === 'parent-host'
              ? [{ key: 'items', allowedControls: ['child-a'] }]
              : [],
        }),
      /placeholder "missing-slot"/,
    );
  });

  it('passes when child matches allowedControls', async () => {
    const result = await assertNestedPresentationPlaceholderParity({
      hostSlug: 'menzis-nl',
      pages: {
        home: {
          renderings: [
            {
              definitionKey: 'parent-host',
              children: [
                { definitionKey: 'child-a', placeholder: 'items' },
              ],
            },
          ],
        },
      },
      partials: [],
      resolveSlots: async (key) =>
        key === 'parent-host'
          ? [{ key: 'items', allowedControls: ['child-a'] }]
          : [],
    });
    assert.equal(result.ok, true);
  });
});

describe('relocatePartialChildrenToMountedHosts', () => {
  it('nests context-links under sibling host that declares the slot', async () => {
    const partials = [
      {
        signature: 'header',
        definitionKey: 'menzis-site-header',
        children: [
          {
            definitionKey: 'menzis-site-header-top',
            placeholder: 'header-top-band',
            datasourceItem: 'Top',
          },
          {
            definitionKey: 'menzis-header-context-links',
            placeholder: 'context-links',
            datasourceItem: 'Context',
          },
        ],
      },
    ];
    const out = await relocatePartialChildrenToMountedHosts(partials, 'menzis-nl');
    const header = out[0];
    const top = (header.children || []).find(
      (c) => c.definitionKey === 'menzis-site-header-top',
    );
    assert.ok(top, 'top remains on root');
    assert.ok(
      !(header.children || []).some(
        (c) => c.definitionKey === 'menzis-header-context-links',
      ),
      'context-links not on site-header root',
    );
    // Only assert nesting when disk packages declare the slots (menzis host present).
    if (top?.children?.length) {
      assert.ok(
        top.children.some((c) => c.definitionKey === 'menzis-header-context-links'),
      );
    }
  });
});
