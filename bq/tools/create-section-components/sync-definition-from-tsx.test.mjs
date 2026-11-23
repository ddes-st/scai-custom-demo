import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAllowedControlsByPlaceholder,
  extractPlaceholderBasesFromChildren,
  extractPlaceholderBasesFromTsx,
  hasAppPlaceholderInSources,
  inferPlanModeFromTsx,
  replacePlaceholdersArray,
  syncDefinitionFromTsx,
  unionStructureTsxSources,
} from './sync-definition-from-tsx.mjs';

const DEF_EMPTY = `
import type { ComponentTemplateDefinition } from "x";
export const foo = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
} satisfies ComponentTemplateDefinition;
`;

describe('extractPlaceholderBasesFromTsx', () => {
  it('does not treat DOM id cookie-option-${index} as a placeholder base', () => {
    const tsx = `
export default function CookieChrome({ options }) {
  return (
    <ul>
      {options.map((opt, index) => (
        <li key={index} id={\`cookie-option-\${index}\`}>
          <span>{opt.label}</span>
        </li>
      ))}
    </ul>
  );
}
`;
    assert.deepEqual(extractPlaceholderBasesFromTsx(tsx), []);
  });

  it('reads placeholderBase and template dynId pattern', () => {
    const tsx = `
const placeholderBase = 'hero-actions';
const ph = dynId ? \`hero-actions-\${dynId}\` : 'hero-actions';
return <AppPlaceholder name={ph} />;
`;
    assert.deepEqual(extractPlaceholderBasesFromTsx(tsx), ['hero-actions']);
  });

  it('reads Sitecore brace dyn form key-{${id}}', () => {
    const tsx = `
const navigationCardsName = placeholderId
  ? \`navigation-cards-{\${placeholderId}}\`
  : 'navigation-cards';
const uspItemsName = placeholderId
  ? \`usp-items-{\${placeholderId}}\`
  : 'usp-items';
return (
  <>
    <AppPlaceholder name={navigationCardsName} />
    <AppPlaceholder name={uspItemsName} />
  </>
);
`;
    const keys = extractPlaceholderBasesFromTsx(tsx);
    assert.ok(keys.includes('navigation-cards'));
    assert.ok(keys.includes('usp-items'));
  });

  it('reads renderPlaceholder(ident) wrappers', () => {
    const tsx = `
const navigationCardsName = placeholderId
  ? \`navigation-cards-{\${placeholderId}}\`
  : 'navigation-cards';
const uspItemsName = placeholderId ? \`usp-items-{\${placeholderId}}\` : 'usp-items';
const renderPlaceholder = (name) => <AppPlaceholder name={name} />;
return (
  <>
    {renderPlaceholder(navigationCardsName)}
    {renderPlaceholder(uspItemsName)}
  </>
);
`;
    const keys = extractPlaceholderBasesFromTsx(tsx);
    assert.ok(keys.includes('navigation-cards'));
    assert.ok(keys.includes('usp-items'));
  });

  it('reads multi footer keys', () => {
    const tsx = `
const footerSignposts = dynId ? \`footer-signposts-\${dynId}\` : 'footer-signposts';
const footerNavigation = dynId ? \`footer-navigation-\${dynId}\` : 'footer-navigation';
<AppPlaceholder name={footerSignposts} />
<AppPlaceholder name={footerNavigation} />
`;
    const keys = extractPlaceholderBasesFromTsx(tsx);
    assert.ok(keys.includes('footer-signposts'));
    assert.ok(keys.includes('footer-navigation'));
  });

  it('reads placeholderName("footer-signposts") helper pattern', () => {
    const tsx = `
const placeholderName = (base) => (dynId ? \`\${base}-\${dynId}\` : base);
<AppPlaceholder name={placeholderName('footer-signposts')} />
<AppPlaceholder name={placeholderName('footer-navigation')} />
`;
    const keys = extractPlaceholderBasesFromTsx(tsx);
    assert.ok(keys.includes('footer-signposts'));
    assert.ok(keys.includes('footer-navigation'));
  });

  it('reads renderPlaceholder("insured-links") SupportLinkCards helper pattern', () => {
    const tsx = `
const renderPlaceholder = (placeholderBase: string): JSX.Element => {
  const placeholderName = dynId
    ? \`\${placeholderBase}-\${dynId}\`
    : placeholderBase;
  return (
    <AppPlaceholder name={placeholderName} rendering={r} page={p} componentMap={m} />
  );
};
{renderPlaceholder('insured-links')}
{renderPlaceholder('uninsured-links')}
{renderPlaceholder('help-links')}
`;
    const keys = extractPlaceholderBasesFromTsx(tsx).sort();
    assert.deepEqual(keys, ['help-links', 'insured-links', 'uninsured-links']);
  });

  it('reads baseKey + phName alias (Analyst Recognition Cards pattern)', () => {
    const tsx = `
const baseKey = 'analyst-recognition-cards-items';
const dynId = props.params?.DynamicPlaceholderId;
const phName = dynId ? \`\${baseKey}-\${dynId}\` : baseKey;
return (
  <AppPlaceholder
    name={phName}
    rendering={props.rendering}
    page={props.page}
    componentMap={componentMap}
  />
);
`;
    assert.deepEqual(extractPlaceholderBasesFromTsx(tsx), [
      'analyst-recognition-cards-items',
    ]);
  });
});

describe('syncDefinitionFromTsx', () => {
  it('fills empty allowedControls from childPackages when plan.children is empty', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'header-context-links';
export const Default = () => <AppPlaceholder name={placeholderBase} />;
`;
    const def = `export const d = {
  definitionKey: 'menzis-header-navigation',
  placeholders: [{ key: 'header-context-links', allowedControls: [] }],
};`;
    const out = syncDefinitionFromTsx(def, {
      tsxSource: tsx,
      role: 'section',
      trustTsxStructure: true,
      definitionKey: 'menzis-header-navigation',
      plan: { mode: 'single', children: [], section: {} },
      childPackages: [
        {
          definitionKey: 'menzis-header-context-link-list',
          placeholderKey: 'header-context-links',
        },
      ],
    });
    assert.match(out.definitionTs, /header-context-links/);
    assert.match(
      out.definitionTs,
      /allowedControls:\s*\[\s*["']menzis-header-context-link-list["']\s*\]/,
    );
  });

  it('preserves existing allowedControls when TSX key renames the slot', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'header-context-links';
export const Default = () => <AppPlaceholder name={placeholderBase} />;
`;
    const def = `export const d = {
  definitionKey: 'menzis-header-navigation',
  placeholders: [{ key: 'context-links', allowedControls: ['menzis-global-header-context-link-list'] }],
};`;
    const out = syncDefinitionFromTsx(def, {
      tsxSource: tsx,
      role: 'section',
      trustTsxStructure: true,
      definitionKey: 'menzis-header-navigation',
      plan: { mode: 'single', children: [], section: {} },
    });
    assert.match(out.definitionTs, /header-context-links/);
    assert.match(
      out.definitionTs,
      /menzis-global-header-context-link-list/,
    );
  });

  it('keeps placeholders for nested composite child when plannedMode=composite', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'column-links';
export const Default = (props) => (
  <AppPlaceholder name={dynId ? \`\${placeholderBase}-\${dynId}\` : placeholderBase} />
);
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'child',
      plannedMode: 'composite',
      nodeMode: 'composite',
      plan: {
        mode: 'composite',
        children: [{ componentName: 'SitecoreLinkItem', definitionKey: 'sitecore-link-item' }],
        section: { placeholderKey: 'column-links' },
      },
    });
    assert.equal(out.planMode, 'composite');
    assert.deepEqual(out.placeholderKeys, ['column-links']);
    assert.match(out.definitionTs, /key:\s*"column-links"/);
  });

  it('AppPlaceholder wins over planMode=single label (planMode is informational)', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'hero-actions';
export const Default = () => <AppPlaceholder name={placeholderBase} />;
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      plannedMode: 'single',
      plan: { mode: 'single', section: { componentName: 'Hero' }, children: [] },
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.tsxDisagreesWithPlan, false);
    assert.ok(out.placeholderKeys.includes('hero-actions'));
    assert.match(out.definitionTs, /key:\s*"hero-actions"/);
  });

  it('fills placeholders: [] when TSX has AppPlaceholder (Editorial Hero gap)', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'hero-actions';
export const Default = (props) => (
  <AppPlaceholder name={dynId ? \`\${placeholderBase}-\${dynId}\` : placeholderBase} />
);
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      plan: {
        mode: 'composite',
        children: [{ componentName: 'SitecoreHeroAction', definitionKey: 'sitecore-hero-action' }],
        section: { placeholderKey: 'hero-actions' },
      },
    });
    assert.equal(out.planMode, 'composite');
    assert.deepEqual(out.placeholderKeys, ['hero-actions']);
    assert.match(
      out.definitionTs,
      /placeholders:\s*\[\s*\{\s*key:\s*"hero-actions".*allowedControls:\s*\["sitecore-hero-action"\]/,
    );
  });

  it('clears placeholders when TSX has no AppPlaceholder', () => {
    const def = DEF_EMPTY.replace(
      'placeholders: [],',
      'placeholders: [{ key: "hero-actions", allowedControls: ["x"] }],',
    );
    const tsx = `export const Default = () => <section><Text field={fields.Title} /></section>;`;
    const out = syncDefinitionFromTsx(def, { tsxSource: tsx, role: 'section' });
    assert.equal(out.planMode, 'single');
    assert.match(out.definitionTs, /placeholders:\s*\[\],/);
    assert.doesNotMatch(out.definitionTs, /hero-actions/);
  });

  it('preserves multi-key footer placeholders from TSX', () => {
    const tsx = `
const footerSignposts = dynId ? \`footer-signposts-\${dynId}\` : 'footer-signposts';
const footerNavigation = dynId ? \`footer-navigation-\${dynId}\` : 'footer-navigation';
const footerSocial = dynId ? \`footer-social-\${dynId}\` : 'footer-social';
const footerLegal = dynId ? \`footer-legal-\${dynId}\` : 'footer-legal';
<>
  <AppPlaceholder name={footerSignposts} />
  <AppPlaceholder name={footerNavigation} />
  <AppPlaceholder name={footerSocial} />
  <AppPlaceholder name={footerLegal} />
</>
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      childPackages: [
        { componentName: 'SitecoreFooterSignpost', placeholderKey: 'footer-signposts' },
        { componentName: 'SitecoreFooterNavColumn', placeholderKey: 'footer-navigation' },
        { componentName: 'SitecoreFooterSocial', placeholderKey: 'footer-social' },
        { componentName: 'SitecoreFooterLegal', placeholderKey: 'footer-legal' },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.placeholderKeys.length, 4);
    assert.match(out.definitionTs, /footer-signposts/);
    assert.match(out.definitionTs, /footer-navigation/);
    assert.match(out.definitionTs, /footer-social/);
    assert.match(out.definitionTs, /footer-legal/);
  });

  it('inferPlanModeFromTsx', () => {
    assert.equal(inferPlanModeFromTsx('<AppPlaceholder name="x" />'), 'composite');
    assert.equal(inferPlanModeFromTsx('<Text field={f} />'), 'single');
  });

  it('replacePlaceholdersArray overwrites empty array', () => {
    const out = replacePlaceholdersArray(
      'placeholders: [],\n  variants: [',
      '[{ key: "a", allowedControls: ["b"] }]',
    );
    assert.match(out, /placeholders:\s*\[\s*\{\s*key:\s*"a"/);
  });

  it('fills placeholders from Analyst-shaped baseKey + phName TSX', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const baseKey = 'analyst-recognition-cards-items';
const dynId = props.params?.DynamicPlaceholderId;
const phName = dynId ? \`\${baseKey}-\${dynId}\` : baseKey;
export const Default = (props) => (
  <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
);
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      childPackages: [
        {
          componentName: 'SitecoreAnalystRecognitionCardsItem',
          definitionKey: 'sitecore-analyst-recognition-cards-item',
          placeholderKey: 'analyst-recognition-cards-items',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.deepEqual(out.placeholderKeys, ['analyst-recognition-cards-items']);
    assert.match(
      out.definitionTs,
      /placeholders:\s*\[\s*\{\s*key:\s*"analyst-recognition-cards-items".*allowedControls:\s*\["sitecore-analyst-recognition-cards-item"\]/,
    );
  });

  it('does not clear to [] when AppPlaceholder present but keys need childPackages fallback', () => {
    // Opaque name={getPh()} — extract finds nothing; childPackages supply the key.
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => (
  <AppPlaceholder name={getPh(props)} rendering={props.rendering} page={props.page} componentMap={componentMap} />
);
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      childPackages: [
        {
          componentName: 'SitecoreOpaqueCard',
          definitionKey: 'sitecore-opaque-card',
          placeholderKey: 'opaque-cards',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.ok(out.placeholderKeys.includes('opaque-cards'));
    assert.match(out.definitionTs, /key:\s*"opaque-cards"/);
    assert.doesNotMatch(
      out.definitionTs,
      /placeholders:\s*\[\s*\],/,
    );
  });

  it('trustTsxStructure: AppPlaceholder keeps composite placeholders from TSX extract', () => {
    const tsx = `
const placeholderBase = 'hero-cards';
const phName = placeholderBase;
export const Default = (props) => (
  <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
);
`;
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: tsx,
      role: 'section',
      plannedMode: 'single',
      trustTsxStructure: true,
      childPackages: [
        {
          componentName: 'HeroCard',
          definitionKey: 'crelan-hero-card',
          placeholderKey: 'hero-cards',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.tsxDisagreesWithPlan, false);
    assert.ok(out.placeholderKeys.includes('hero-cards'));
    assert.match(out.definitionTs, /key:\s*"hero-cards"/);
    assert.doesNotMatch(out.definitionTs, /placeholders:\s*\[\s*\]/);
  });

  it('fills from clientTsx AppPlaceholder when map-entry is a thin wrapper', () => {
    const mapEntry = `
import Client from './menzis-site-header.client';
export default function MenzisSiteHeader(props) {
  return <Client {...props} />;
}
`;
    const clientTsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export default function Client({ fields, rendering, page }) {
  const contextPlaceholder = 'context-links';
  return (
    <AppPlaceholder name={contextPlaceholder} rendering={rendering} page={page} componentMap={componentMap} />
  );
}
`;
    assert.equal(hasAppPlaceholderInSources(mapEntry, clientTsx), true);
    assert.ok(
      extractPlaceholderBasesFromTsx(
        unionStructureTsxSources(mapEntry, clientTsx),
      ).includes('context-links'),
    );
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: mapEntry,
      clientTsxSource: clientTsx,
      role: 'section',
      trustTsxStructure: true,
      plannedMode: 'single',
      childPackages: [
        {
          componentName: 'MenzisSiteHeaderContextLinks',
          definitionKey: 'menzis-site-header-context-links',
          placeholderKey: 'context-links',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.tsxDisagreesWithPlan, false);
    assert.deepEqual(out.placeholderKeys, ['context-links']);
    assert.match(
      out.definitionTs,
      /key:\s*"context-links".*allowedControls:\s*\["menzis-site-header-context-links"\]/s,
    );
  });

  it('fills from childPackages placeholderKeys when TSX extract is empty', () => {
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: `export default function Leaf() { return <header />; }`,
      role: 'section',
      trustTsxStructure: true,
      plannedMode: 'single',
      childPackages: [
        {
          definitionKey: 'menzis-site-header-context-links',
          placeholderKey: 'context-links',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.tsxDisagreesWithPlan, false);
    assert.deepEqual(out.placeholderKeys, ['context-links']);
    assert.deepEqual(
      extractPlaceholderBasesFromChildren([
        { placeholderKey: 'context-links' },
        { parentPlaceholder: 'context-links' },
      ]),
      ['context-links'],
    );
  });

  it('unused AppPlaceholder import does not force composite', () => {
    assert.equal(
      hasAppPlaceholderInSources(
        `import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = () => <div />;
`,
        null,
      ),
      false,
    );
  });

  it('leaf cookie DOM id does not invent PH even when planMode=composite', () => {
    const poisoned = DEF_EMPTY.replace(
      'placeholders: [],',
      'placeholders: [{ key: "cookie-option", allowedControls: [] }],',
    );
    const clientTsx = `
'use client';
export default function CookieChrome({ options = [] }) {
  return (
    <ul>
      {options.map((opt, index) => (
        <li key={index} id={\`cookie-option-\${index}\`}>{opt.label}</li>
      ))}
    </ul>
  );
}
`;
    const mapEntry = `
import CookieChrome from './foo.client';
export default function Foo(props) {
  return <CookieChrome fields={props.fields} />;
}
`;
    const out = syncDefinitionFromTsx(poisoned, {
      tsxSource: mapEntry,
      clientTsxSource: clientTsx,
      role: 'section',
      trustTsxStructure: true,
      plannedMode: 'composite',
      plan: { mode: 'composite', children: [] },
    });
    assert.equal(out.planMode, 'single');
    assert.deepEqual(out.placeholderKeys, []);
    assert.match(out.definitionTs, /placeholders:\s*\[\],/);
    assert.doesNotMatch(out.definitionTs, /cookie-option/);
  });

  it('trustTsxStructure: leaf role=child ignores section plan.children (LinkList leaf)', () => {
    const def = `
export const def = {
  definitionKey: "menzis-support-link-list",
  placeholders: [
    { key: "support-link-items", allowedControls: ["menzis-support-link-list"] },
  ],
};
`;
    const out = syncDefinitionFromTsx(def, {
      tsxSource: `export const Default = () => <ul><li>link</li></ul>;`,
      role: 'child',
      trustTsxStructure: true,
      plannedMode: 'single',
      definitionKey: 'menzis-support-link-list',
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'support-health-content' },
        children: [
          {
            definitionKey: 'menzis-support-link-list',
            placeholderKey: 'support-link-items',
          },
          {
            definitionKey: 'menzis-support-link-card',
            placeholderKey: 'support-health-content',
          },
        ],
      },
    });
    assert.equal(out.planMode, 'single');
    assert.deepEqual(out.placeholderKeys, []);
    assert.match(out.definitionTs, /placeholders:\s*\[\],?/);
    assert.doesNotMatch(out.definitionTs, /support-link-items/);
  });

  it('trustTsxStructure: strips own definitionKey from allowedControls on composites', () => {
    const tsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
const placeholderBase = 'support-link-items';
export const Default = (props) => (
  <AppPlaceholder name={dynId ? \`\${placeholderBase}-\${dynId}\` : placeholderBase} />
);
`;
    const def = `
export const def = {
  definitionKey: "menzis-support-and-health-content",
  placeholders: [],
};
`;
    const out = syncDefinitionFromTsx(def, {
      tsxSource: tsx,
      role: 'section',
      trustTsxStructure: true,
      definitionKey: 'menzis-support-and-health-content',
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'support-link-items' },
        children: [
          {
            definitionKey: 'menzis-support-and-health-content',
            placeholderKey: 'support-link-items',
          },
          {
            definitionKey: 'menzis-support-link-list',
            placeholderKey: 'support-link-items',
          },
        ],
      },
    });
    assert.equal(out.planMode, 'composite');
    assert.match(out.definitionTs, /menzis-support-link-list/);
    assert.doesNotMatch(
      out.definitionTs,
      /allowedControls:\s*\[[^\]]*menzis-support-and-health-content/,
    );
  });

  it('buildAllowedControlsByPlaceholder drops ownDefinitionKey', () => {
    const byPh = buildAllowedControlsByPlaceholder(
      {
        children: [
          { definitionKey: 'menzis-support-link-list', placeholder: 'support-link-items' },
          { definitionKey: 'self-host', placeholder: 'support-link-items' },
        ],
      },
      ['support-link-items'],
      { ownDefinitionKey: 'self-host' },
    );
    assert.deepEqual(byPh['support-link-items'], ['menzis-support-link-list']);
  });

  it('trustTsxStructure: hostFromChildren via childPackages (ignores plannedMode label)', () => {
    const out = syncDefinitionFromTsx(DEF_EMPTY, {
      tsxSource: `export default function Host() { return <header />; }`,
      role: 'section',
      trustTsxStructure: true,
      plannedMode: 'single',
      childPackages: [
        {
          definitionKey: 'menzis-footer-legal-link-list',
          placeholderKey: 'footer-legal-links',
        },
      ],
    });
    assert.equal(out.planMode, 'composite');
    assert.equal(out.tsxDisagreesWithPlan, false);
    assert.deepEqual(out.placeholderKeys, ['footer-legal-links']);
  });
});
