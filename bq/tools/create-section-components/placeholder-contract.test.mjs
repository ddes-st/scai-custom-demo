/**
 * Run: node --test tools/create-section-components/placeholder-contract.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classNameHasExactToken,
  collectTsxEmitContractDiagnostics,
  hasLinkUnderlineWithChildNoUnderline,
} from './ai-source-fixup.mjs';
import {
  canonicalPlaceholderTsxSnippet,
  collectPathLeafCollisionDiagnostics,
  collectPlaceholderContractDiagnostics,
  collectRequiredPlaceholdersFromSection,
  ensureRequiredPlaceholdersFromResults,
  explicitChildParentPlaceholder,
  findPackageForPlaceholder,
  formatPlaceholderContractForPrompt,
  inferPlanChildPlaceholderKey,
  placeholderCovered,
  resolveChildPlaceholder,
  resolvePartialFooterRequiredPlaceholders,
  resolvePlanPlaceholderContract,
} from './placeholder-contract.mjs';
import { syncDefinitionFromTsx } from './sync-definition-from-tsx.mjs';

const PLAN = {
  mode: 'composite',
  section: {
    componentName: 'SitecoreMainNav',
    placeholderKey: 'main-nav-items',
  },
  children: [{ componentName: 'SitecoreNavigationItem', repeatHint: 5 }],
};

describe('resolvePlanPlaceholderContract', () => {
  it('builds exact placeholders literal with child key', () => {
    const c = resolvePlanPlaceholderContract(PLAN, 'sitecore-main-nav');
    assert.equal(c.mode, 'composite');
    assert.equal(c.placeholderKey, 'main-nav-items');
    assert.deepEqual(c.childKeys, ['sitecore-navigation-item']);
    assert.equal(
      c.placeholdersLiteral,
      'placeholders: [{ key: "main-nav-items", allowedControls: ["sitecore-navigation-item"] }],',
    );
    assert.equal(c.multiSlot, false);
  });

  it('builds multi-slot footer placeholders from band children', () => {
    const footerPlan = {
      mode: 'composite',
      role: 'partial-footer',
      section: {
        componentName: 'SitecoreGlobalFooter2',
        placeholderKey: 'footer-signposts',
        layoutPattern: 'multi-tier-footer',
      },
      children: [
        { componentName: 'SitecoreFooterSignpost', placeholder: 'footer-signposts' },
        { componentName: 'SitecoreFooterNavigationGroup', placeholder: 'footer-navigation' },
        { componentName: 'SitecoreFooterBrandingSocial', placeholder: 'footer-social' },
        { componentName: 'SitecoreFooterLegal', placeholder: 'footer-legal' },
      ],
    };
    const c = resolvePlanPlaceholderContract(footerPlan, 'sitecore-global-footer2');
    assert.equal(c.multiSlot, true);
    assert.deepEqual(c.placeholderKeys, [
      'footer-signposts',
      'footer-navigation',
      'footer-social',
      'footer-legal',
    ]);
    assert.match(c.placeholdersLiteral, /footer-signposts/);
    assert.match(c.placeholdersLiteral, /footer-navigation/);
    assert.match(c.placeholdersLiteral, /footer-social/);
    assert.match(c.placeholdersLiteral, /footer-legal/);
    assert.equal((c.placeholdersLiteral.match(/key:/g) || []).length, 4);
  });

  it('auto-partitions heterogeneous page-body children into multi-slot', () => {
    const plan = {
      mode: 'composite',
      section: {
        componentName: 'CrelanNavigationAndValuesContent',
        placeholderKey: 'navigation-and-value-items',
      },
      children: [
        { componentName: 'CrelanNavigationCard', repeatHint: 8 },
        { componentName: 'CrelanProximityFeature', repeatHint: 1 },
        { componentName: 'CrelanValueStatement', repeatHint: 4 },
      ],
    };
    const c = resolvePlanPlaceholderContract(
      plan,
      'crelan-navigation-and-values-content',
    );
    assert.equal(c.multiSlot, true);
    assert.equal(c.placeholderKeys.length, 3);
    assert.ok(c.placeholderKeys.some((k) => /navigation-card/.test(k)));
    assert.ok(c.placeholderKeys.some((k) => /proximity-feature/.test(k)));
    assert.ok(c.placeholderKeys.some((k) => /value-statement/.test(k)));
    assert.equal(plan.children[0].placeholder, 'crelan-navigation-card-items');
    assert.equal(plan.children[1].placeholder, 'crelan-proximity-feature');
    assert.equal(plan.children[2].placeholder, 'crelan-value-statement-items');
    assert.deepEqual(plan.section.placeholderKeys, c.placeholderKeys);
  });

  it('keeps single-slot for same-type carousel children', () => {
    const plan = {
      mode: 'composite',
      section: {
        componentName: 'FeatureCarousel',
        placeholderKey: 'carousel-slides',
      },
      children: [
        { componentName: 'FeatureSlide', repeatHint: 5 },
        { componentName: 'FeatureSlide', repeatHint: 5 },
      ],
    };
    // collapse to one child key via resolve — both map to feature-slide
    const c = resolvePlanPlaceholderContract(plan, 'feature-carousel');
    assert.equal(c.multiSlot, false);
    assert.equal(c.placeholderKey, 'carousel-slides');
  });
});

describe('formatPlaceholderContractForPrompt multi-slot', () => {
  it('requires all four footer AppPlaceholder mounts', () => {
    const footerPlan = {
      mode: 'composite',
      role: 'partial-footer',
      section: {
        componentName: 'SitecoreGlobalFooter2',
        placeholderKeys: [
          'footer-signposts',
          'footer-navigation',
          'footer-social',
          'footer-legal',
        ],
      },
      children: [
        { componentName: 'SitecoreFooterSignpost', placeholder: 'footer-signposts' },
        { componentName: 'SitecoreFooterNavigationGroup', placeholder: 'footer-navigation' },
        { componentName: 'SitecoreFooterBrandingSocial', placeholder: 'footer-social' },
        { componentName: 'SitecoreFooterLegal', placeholder: 'footer-legal' },
      ],
    };
    const prompt = formatPlaceholderContractForPrompt({
      plan: footerPlan,
      definitionKey: 'sitecore-global-footer2',
      role: 'section',
    });
    assert.match(prompt, /MULTI-SLOT/);
    assert.match(prompt, /footer-signposts/);
    assert.match(prompt, /footer-legal/);
    assert.match(prompt, /FORBIDDEN: collapsing to a single placeholder dump/);
    assert.match(
      prompt,
      /If definitionTs keeps placeholders: \[\] while presentation has children, authoring:generate fails \(parent placeholders empty\)/,
    );
  });
});

describe('formatPlaceholderContractForPrompt', () => {
  it('includes exact definitionTs line and canonical TSX snippet', () => {
    const prompt = formatPlaceholderContractForPrompt({
      plan: PLAN,
      definitionKey: 'sitecore-main-nav',
      role: 'section',
    });
    assert.match(
      prompt,
      /placeholders: \[{ key: "main-nav-items", allowedControls: \["sitecore-navigation-item"\] }\],/,
    );
    assert.match(prompt, /FORBIDDEN: allowedControls including THIS definitionKey/);
    assert.match(prompt, /const placeholderBase = 'main-nav-items'/);
    assert.match(prompt, /<AppPlaceholder name=\{phName\}/);
    assert.ok(prompt.includes(canonicalPlaceholderTsxSnippet('main-nav-items').split('\n')[0]));
    assert.match(
      prompt,
      /If definitionTs keeps placeholders: \[\] while presentation has children, authoring:generate fails \(parent placeholders empty\)/,
    );
  });

  it('single mode forbids placeholders', () => {
    const prompt = formatPlaceholderContractForPrompt({
      plan: { mode: 'single', section: { componentName: 'Hero' }, children: [] },
      definitionKey: 'sitecore-hero',
      role: 'section',
    });
    assert.match(prompt, /placeholders: \[\],/);
    assert.match(prompt, /FORBIDDEN: AppPlaceholder/);
    assert.doesNotMatch(
      prompt,
      /If definitionTs keeps placeholders: \[\] while presentation has children/,
    );
  });

  it('nested composite includes site-presentation empty-placeholders failure line', () => {
    const prompt = formatPlaceholderContractForPrompt({
      plan: PLAN,
      definitionKey: 'sitecore-navigation',
      role: 'child',
      nodeMode: 'composite',
      nodePlaceholderKey: 'nav-items',
      nodeChildren: [{ componentName: 'SitecoreNavLink' }],
    });
    assert.match(prompt, /NESTED COMPOSITE/);
    assert.match(
      prompt,
      /If definitionTs keeps placeholders: \[\] while presentation has children, authoring:generate fails \(parent placeholders empty\)/,
    );
  });
});

describe('collectPlaceholderContractDiagnostics', () => {
  it('flags unextractable AppPlaceholder', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'sitecore-main-nav',
      plan: PLAN,
      tsx: `<AppPlaceholder name={getPh()} rendering={r} page={p} componentMap={m} />`,
      definitionTs: `placeholders: [{ key: "main-nav-items", allowedControls: ["sitecore-navigation-item"] }],`,
    });
    assert.ok(diags.some((d) => /no extractable placeholderBase/.test(d)));
  });

  it('flags allowedControls self-reference', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'sitecore-main-nav',
      childPackages: [
        {
          definitionKey: 'sitecore-navigation-item',
          placeholderKey: 'main-nav-items',
        },
      ],
      tsx: `
const placeholderBase = 'main-nav-items';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`,
      definitionTs: `placeholders: [{ key: "main-nav-items", allowedControls: ["sitecore-main-nav"] }],`,
    });
    assert.ok(
      diags.some(
        (d) =>
          /allowedControls must not include own definitionKey/.test(d) &&
          /sitecore-navigation-item/.test(d),
      ),
    );
  });

  it('clean when canonical pattern matches TSX + childPackages', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'sitecore-main-nav',
      childPackages: [
        {
          definitionKey: 'sitecore-navigation-item',
          placeholderKey: 'main-nav-items',
        },
      ],
      tsx: `
const placeholderBase = 'main-nav-items';
const dynId = props.params?.DynamicPlaceholderId;
const phName = dynId ? \`\${placeholderBase}-\${dynId}\` : placeholderBase;
<div className="flex"><AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} /></div>
`,
      definitionTs: `placeholders: [{ key: "main-nav-items", allowedControls: ["sitecore-navigation-item"] }],`,
    });
    assert.deepEqual(diags, []);
  });

  it('unused AppPlaceholder import on leaf does not force composite CONTRACTs', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-cookie-preference-modal',
      trustTsxStructure: true,
      tsx: `import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = () => <div />;
`,
      definitionTs: `placeholders: [],`,
    });
    assert.deepEqual(diags, []);
  });

  it('child role does not require AppPlaceholder', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'child',
      definitionKey: 'sitecore-feature-tile',
      plan: PLAN,
      tsx: `export const Default = () => <article />;`,
      definitionTs: `placeholders: [],`,
    });
    assert.deepEqual(diags, []);
  });

  it('trustTsxStructure: planned single + AppPlaceholder does not use planned-mode-authoritative rule', () => {
    const tsx = `
const placeholderBase = 'hero-cards';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'crelan-image-hero',
      nodeMode: 'single',
      trustTsxStructure: true,
      plan: { mode: 'single', section: { placeholderKey: null }, children: [] },
      tsx,
      definitionTs: `placeholders: [{ key: "hero-cards", allowedControls: ["crelan-hero-card"] }],`,
    });
    assert.ok(
      !diags.some((d) => /planned mode is authoritative/i.test(d)),
      `unexpected planned-mode-authoritative diag: ${diags.join(' | ')}`,
    );
  });

  it('trustTsxStructure: role=child + AppPlaceholder upgrades to composite (no leaf AppPlaceholder CONTRACT)', () => {
    const tsx = `
const placeholderBase = 'insured-links';
const phName = placeholderBase;
export const Default = () => (
  <div className="grid items-stretch [&>*]:h-full">
    <AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
  </div>
);
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'child',
      definitionKey: 'menzis-support-links',
      nodeMode: 'single',
      trustTsxStructure: true,
      plan: { mode: 'single', section: { placeholderKey: null }, children: [] },
      tsx,
      definitionTs: `placeholders: [{ key: "insured-links", allowedControls: ["menzis-support-link-item"] }],`,
    });
    assert.ok(
      !diags.some((d) =>
        /AppPlaceholder in TSX requires definition placeholders/i.test(d),
      ),
      `unexpected leaf AppPlaceholder CONTRACT: ${diags.join(' | ')}`,
    );
    assert.ok(
      !diags.some((d) => /leaf package must not use AppPlaceholder/i.test(d)),
      `unexpected leaf must-not-use AppPlaceholder: ${diags.join(' | ')}`,
    );
  });

  it('trustTsxStructure: role=child leaf TSX stays single despite planned nested composite + childPhKeys', () => {
    const tsx = `
export const Default = () => (
  <div className="flex h-full flex-col">
    <ul className="list-none">{/* datasource.children */}</ul>
  </div>
);
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'child',
      definitionKey: 'menzis-help-link-list',
      nodeMode: 'composite',
      trustTsxStructure: true,
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'help-links' },
        children: [
          {
            definitionKey: 'menzis-help-link-item',
            placeholderKey: 'help-link-items',
          },
        ],
      },
      childPackages: [
        {
          definitionKey: 'menzis-help-link-item',
          placeholderKey: 'help-link-items',
        },
      ],
      tsx,
      definitionTs: `placeholders: [],`,
    });
    assert.ok(
      !diags.some((d) =>
        /nested composite child requires AppPlaceholder/i.test(d),
      ),
      `unexpected nested-composite CONTRACT: ${diags.join(' | ')}`,
    );
    assert.ok(
      !diags.some((d) =>
        /nested composite child definitionTs must declare placeholders/i.test(
          d,
        ),
      ),
      `unexpected nested-composite keys CONTRACT: ${diags.join(' | ')}`,
    );
  });

  it('flags AppPlaceholder host with empty allowedControls', () => {
    const tsx = `
const placeholderBase = 'footer-link-groups';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-footer-navigation',
      trustTsxStructure: true,
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'footer-link-groups' },
        children: [
          {
            componentName: 'MenzisFooterLinkList',
            definitionKey: 'menzis-footer-link-list',
          },
        ],
      },
      tsx,
      definitionTs: `placeholders: [{ key: 'footer-link-groups', allowedControls: [] }],`,
    });
    assert.ok(
      diags.some((d) => /empty allowedControls/i.test(d)),
      `expected empty allowedControls CONTRACT, got: ${diags.join(' | ')}`,
    );
  });

  it('flags orphan child packages not listed in parent allowedControls', () => {
    const tsx = `
const placeholderBase = 'support-cards';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-help-and-health',
      trustTsxStructure: true,
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'support-cards' },
        children: [
          {
            componentName: 'MenzisLinkCard',
            definitionKey: 'menzis-link-card',
            placeholderKey: 'support-cards',
          },
        ],
      },
      childPackages: [
        {
          definitionKey: 'menzis-link-card',
          placeholderKey: 'support-cards',
        },
      ],
      tsx,
      definitionTs: `placeholders: [{ key: 'support-cards', allowedControls: ['menzis-other-card'] }],`,
    });
    assert.ok(
      diags.some((d) => /orphan child package/i.test(d) && /menzis-link-card/.test(d)),
      `expected orphan sibling CONTRACT, got: ${diags.join(' | ')}`,
    );
  });

  it('does not flag nested grandchildren whose placeholderKey is not on the parent', () => {
    const tsx = `
const placeholderBase = 'support-cards';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-help-and-health',
      trustTsxStructure: true,
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'support-cards' },
        children: [
          {
            componentName: 'MenzisLinkCard',
            definitionKey: 'menzis-link-card',
            placeholderKey: 'support-cards',
          },
        ],
      },
      childPackages: [
        {
          definitionKey: 'menzis-link-list',
          placeholderKey: 'link-card-links',
        },
      ],
      tsx,
      definitionTs: `placeholders: [{ key: 'support-cards', allowedControls: ['menzis-link-card'] }],`,
    });
    assert.ok(
      !diags.some((d) => /orphan child package/i.test(d)),
      `link-list under link-card-links must not orphan on parent, got: ${diags.join(' | ')}`,
    );
  });

  it('flags clientTsx AppPlaceholder + placeholders: [] (header host miss)', () => {
    const mapEntry = `export default function H(props) { return <Client {...props} />; }`;
    const clientTsx = `
const contextPlaceholder = 'context-links';
<AppPlaceholder name={contextPlaceholder} rendering={r} page={p} componentMap={m} />
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-site-header',
      trustTsxStructure: true,
      nodeMode: 'single',
      plan: {
        mode: 'single',
        children: [
          {
            definitionKey: 'menzis-site-header-context-links',
            placeholderKey: 'context-links',
          },
        ],
      },
      tsx: mapEntry,
      clientTsx,
      definitionTs: `placeholders: [],`,
    });
    assert.ok(
      diags.some(
        (d) =>
          /placeholders: \[\]/.test(d) ||
          /child placeholderKey/.test(d) ||
          /client host does not make the parent a leaf/i.test(d),
      ),
      `expected host/empty-placeholders CONTRACT, got: ${diags.join(' | ')}`,
    );
  });

  it('clean when clientTsx AppPlaceholder matches definition placeholders', () => {
    const mapEntry = `export default function H(props) { return <Client {...props} />; }`;
    const clientTsx = `
const contextPlaceholder = 'context-links';
<div><AppPlaceholder name={contextPlaceholder} rendering={r} page={p} componentMap={m} /></div>
`;
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-site-header',
      trustTsxStructure: true,
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'context-links' },
        children: [
          {
            definitionKey: 'menzis-site-header-context-links',
            placeholderKey: 'context-links',
          },
        ],
      },
      tsx: mapEntry,
      clientTsx,
      definitionTs: `placeholders: [{ key: "context-links", allowedControls: ["menzis-site-header-context-links"] }],`,
    });
    assert.deepEqual(diags, []);
  });

  it('flags child placeholderKey with empty parent placeholders even without AppPlaceholder', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'section',
      definitionKey: 'menzis-site-header',
      trustTsxStructure: true,
      childPackages: [
        {
          definitionKey: 'menzis-site-header-context-links',
          placeholderKey: 'context-links',
        },
      ],
      tsx: `export default function H() { return <header />; }`,
      definitionTs: `placeholders: [],`,
    });
    assert.ok(
      diags.some((d) => /child placeholderKey/.test(d)),
      `expected child placeholderKey CONTRACT, got: ${diags.join(' | ')}`,
    );
  });
});

describe('underline / no-underline class tokens', () => {
  it('classNameHasExactToken does not treat no-underline as underline', () => {
    assert.equal(classNameHasExactToken('block no-underline p-5', 'underline'), false);
    assert.equal(classNameHasExactToken('block no-underline p-5', 'no-underline'), true);
    assert.equal(classNameHasExactToken('underline after:content-[\'→\']', 'underline'), true);
    assert.equal(classNameHasExactToken('md:underline', 'underline'), true);
  });

  it('card-shell Link with only no-underline is clean', () => {
    const tsx = `
export const Default = () => (
  <Link field={linkField} className="block h-full rounded-lg p-5 no-underline" showLinkTextWithChildrenPresent={false}>
    {cardContent}
  </Link>
);
`;
    assert.equal(hasLinkUnderlineWithChildNoUnderline(tsx), false);
    const diags = collectTsxEmitContractDiagnostics(tsx);
    assert.ok(!diags.some((d) => /underline AND a child has no-underline/.test(d)));
  });

  it('Link underline + child no-underline fires imperative diagnostic', () => {
    const tsx = `
export const Default = () => (
  <Link field={fields.Link} className="underline" showLinkTextWithChildrenPresent={false}>
    <Text field={fields.Link} />
    <span className="no-underline">→</span>
  </Link>
);
`;
    assert.equal(hasLinkUnderlineWithChildNoUnderline(tsx), true);
    const diags = collectTsxEmitContractDiagnostics(tsx);
    assert.ok(
      diags.some(
        (d) =>
          /Link className has underline AND a child has no-underline/.test(d) &&
          /remove no-underline/.test(d) &&
          /Card-shell Links with only no-underline are OK/.test(d),
      ),
    );
  });
});

describe('syncDefinitionFromTsx never fills from plan', () => {
  const opaqueTsx = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => (
  <AppPlaceholder name={getPh(props)} rendering={props.rendering} page={props.page} componentMap={componentMap} />
);
`;
  const def = `
export const x = {
  definitionKey: "sitecore-opaque-cards",
  placeholders: [],
};
`;

  it('ignores plan section/children when filling placeholders', () => {
    const out = syncDefinitionFromTsx(def, {
      tsxSource: opaqueTsx,
      role: 'section',
      plan: {
        mode: 'composite',
        section: { placeholderKey: 'opaque-cards', componentName: 'SitecoreOpaqueCards' },
        children: [{ componentName: 'SitecoreOpaqueCard', placeholderKey: 'opaque-cards' }],
      },
    });
    assert.deepEqual(out.placeholderKeys, []);
    assert.match(out.definitionTs, /placeholders:\s*\[\s*\]/);
  });

  it('fills from childPackages when TSX extract is empty', () => {
    const out = syncDefinitionFromTsx(def, {
      tsxSource: opaqueTsx,
      role: 'section',
      childPackages: [
        {
          componentName: 'SitecoreOpaqueCard',
          definitionKey: 'sitecore-opaque-card',
          placeholderKey: 'opaque-cards',
        },
      ],
    });
    assert.ok(out.placeholderKeys.includes('opaque-cards'));
    assert.match(out.definitionTs, /opaque-cards/);
  });
});

describe('placeholder coverage (generic)', () => {
  it('resolves explicit placeholder over name inference', () => {
    assert.equal(
      resolveChildPlaceholder({
        definitionKey: 'acme-widget-rail',
        placeholder: 'rail-a',
      }),
      'rail-a',
    );
  });

  it('treats drifted names as covering when placeholder or inference matches', () => {
    assert.equal(
      placeholderCovered(
        [{ definitionKey: 'acme-odd-name', placeholder: 'rail-a' }],
        'rail-a',
      ),
      true,
    );
    assert.equal(
      placeholderCovered(
        [
          {
            definitionKey: 'sitecore-footer-link-directory',
            placeholder: 'footer-legal-links',
          },
        ],
        'footer-legal-links',
      ),
      true,
    );
    assert.equal(
      findPackageForPlaceholder(
        [
          { role: 'section', definitionKey: 'acme-parent', componentName: 'AcmeParent' },
          {
            role: 'child',
            definitionKey: 'acme-odd-name',
            componentName: 'AcmeOddName',
            placeholder: 'rail-b',
          },
        ],
        'rail-b',
        'acme-parent',
      ),
      'acme-odd-name',
    );
  });

  it('wires missing required placeholders from packages; skips ghost when none', () => {
    const warns = [];
    const infos = [];
    const children = ensureRequiredPlaceholdersFromResults({
      children: [{ definitionKey: 'acme-odd-name', placeholder: 'rail-a' }],
      componentResults: [
        { role: 'section', definitionKey: 'acme-parent' },
        {
          role: 'child',
          definitionKey: 'acme-odd-name',
          placeholder: 'rail-a',
        },
        {
          role: 'child',
          definitionKey: 'acme-other',
          placeholder: 'rail-b',
        },
      ],
      requiredPlaceholders: ['rail-a', 'rail-b', 'rail-c'],
      parentKey: 'acme-parent',
      logWarn: (msg) => warns.push(String(msg)),
      logInfo: (msg) => infos.push(String(msg)),
    });
    assert.ok(
      children.some(
        (c) => c.definitionKey === 'acme-other' && c.placeholder === 'rail-b',
      ),
    );
    assert.ok(!children.some((c) => c.placeholder === 'rail-c'));
    assert.ok(infos.some((w) => /wired "rail-b"/.test(w)));
    assert.ok(warns.some((w) => /skipped ghost "rail-c"/.test(w)));
    assert.ok(!warns.some((w) => /wired/.test(w)));
    assert.ok(!warns.some((w) => /rail-a/.test(w)));
  });

  it('footer regression: drifted packages covering bands do not ghost-skip', () => {
    const warns = [];
    const sectionInfo = {
      layout: { pattern: 'stacked-footer' },
      purpose: 'signpost navigation social legal footer',
      repeats: [
        { name: 'SignpostLinks', count: 4 },
        { name: 'NavigationGroups', count: 5 },
        { name: 'SocialLinks', count: 6 },
        { name: 'LegalLinks', count: 4 },
      ],
    };
    const required = collectRequiredPlaceholdersFromSection({
      sectionInfo,
      sectionHtml:
        '<footer data-component-name="LegalFooter">copyright social branding-social</footer>',
    });
    // Enrich uses component-named PH keys (no legacy four-band invent).
    assert.ok(required.includes('footer-legal-links'));
    assert.ok(required.includes('footer-branding-social'));

    const children = ensureRequiredPlaceholdersFromResults({
      children: [
        {
          definitionKey: 'sitecore-footer-signpost',
          placeholder: 'footer-signpost',
        },
        {
          definitionKey: 'sitecore-footer-navigation-group',
          placeholder: 'footer-navigation-group',
        },
        {
          definitionKey: 'sitecore-footer-branding-social',
          placeholder: 'footer-branding-social',
        },
        {
          definitionKey: 'sitecore-footer-legal',
          placeholder: 'footer-legal-links',
        },
      ],
      componentResults: [
        { role: 'section', definitionKey: 'sitecore-global-footer2' },
        {
          role: 'child',
          definitionKey: 'sitecore-footer-legal',
          placeholder: 'footer-legal-links',
        },
        {
          role: 'child',
          definitionKey: 'sitecore-footer-branding-social',
          placeholder: 'footer-branding-social',
        },
      ],
      requiredPlaceholders: required,
      parentKey: 'sitecore-global-footer2',
      logWarn: (msg) => warns.push(String(msg)),
    });
    assert.ok(children.length >= 2);
    assert.ok(!warns.some((w) => /skipped ghost/.test(w)));
  });
});

describe('resolvePartialFooterRequiredPlaceholders', () => {
  it('uses parent AI keys only (peer footer-columns) — no legacy four-band', () => {
    const keys = resolvePartialFooterRequiredPlaceholders({
      parentPlaceholderKeys: ['footer-columns'],
      componentResults: [
        { role: 'section', definitionKey: 'crelan-footer-columns' },
        {
          role: 'child',
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-columns',
        },
      ],
    });
    assert.deepEqual(keys, ['footer-columns']);
  });

  it('peer footer-columns required list does not ghost-skip legacy bands', () => {
    const warns = [];
    const required = resolvePartialFooterRequiredPlaceholders({
      parentPlaceholderKeys: ['footer-columns'],
      componentResults: [
        { role: 'section', definitionKey: 'crelan-footer-columns' },
        {
          role: 'child',
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-columns',
        },
      ],
    });
    ensureRequiredPlaceholdersFromResults({
      children: [
        {
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-columns',
          datasourceItem: 'Ons aanbod',
        },
      ],
      componentResults: [
        { role: 'section', definitionKey: 'crelan-footer-columns' },
        {
          role: 'child',
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-columns',
        },
      ],
      requiredPlaceholders: required,
      parentKey: 'crelan-footer-columns',
      logWarn: (msg) => warns.push(String(msg)),
    });
    assert.ok(!warns.some((w) => /skipped ghost "footer-signposts"/.test(w)));
    assert.ok(!warns.some((w) => /skipped ghost "footer-navigation"/.test(w)));
    assert.ok(!warns.some((w) => /skipped ghost "footer-social"/.test(w)));
    assert.ok(!warns.some((w) => /skipped ghost "footer-legal"/.test(w)));
  });

  it('keeps four-band keys when parent AI definition declares them', () => {
    const keys = resolvePartialFooterRequiredPlaceholders({
      parentPlaceholderKeys: [
        'footer-signposts',
        'footer-navigation',
        'footer-social',
        'footer-legal',
      ],
      componentResults: [],
    });
    assert.deepEqual(keys, [
      'footer-signposts',
      'footer-navigation',
      'footer-social',
      'footer-legal',
    ]);
  });

  it('derives from child packages when parent keys are empty', () => {
    const keys = resolvePartialFooterRequiredPlaceholders({
      parentPlaceholderKeys: [],
      componentResults: [
        { role: 'section', definitionKey: 'crelan-footer-columns' },
        {
          role: 'child',
          definitionKey: 'crelan-footer-column',
          placeholder: 'footer-columns',
        },
      ],
    });
    assert.deepEqual(keys, ['footer-columns']);
  });
});

describe('explicitChildParentPlaceholder (proactive nesting)', () => {
  it('prefers placeholderKey / parentPlaceholder over name heuristics', () => {
    const child = {
      componentName: 'CrelanFooterLinkColumn',
      definitionKey: 'crelan-footer-link-column',
      placeholderKey: 'footer-columns',
    };
    assert.equal(explicitChildParentPlaceholder(child), 'footer-columns');
    assert.equal(inferPlanChildPlaceholderKey(child), 'footer-columns');
    assert.equal(resolveChildPlaceholder(child), 'footer-columns');
    // Without explicit key, do not invent a band from the name.
    assert.equal(
      inferPlanChildPlaceholderKey({
        definitionKey: 'crelan-footer-link-column',
      }),
      null,
    );
  });

  it('covers parent PH from placeholderKey so backstop is a no-op', () => {
    const infos = [];
    const warns = [];
    const nested = [
      {
        definitionKey: 'crelan-footer-link-column',
        placeholder: 'footer-columns',
      },
    ];
    const out = ensureRequiredPlaceholdersFromResults({
      children: nested,
      componentResults: [
        { role: 'section', definitionKey: 'crelan-footer-link-groups' },
        {
          role: 'child',
          definitionKey: 'crelan-footer-link-column',
          placeholderKey: 'footer-columns',
        },
      ],
      requiredPlaceholders: ['footer-columns'],
      parentKey: 'crelan-footer-link-groups',
      logWarn: (msg) => warns.push(String(msg)),
      logInfo: (msg) => infos.push(String(msg)),
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].placeholder, 'footer-columns');
    assert.deepEqual(infos, []);
    assert.deepEqual(warns, []);
  });

  it('findPackageForPlaceholder matches placeholderKey without placeholder field', () => {
    assert.equal(
      findPackageForPlaceholder(
        [
          { role: 'section', definitionKey: 'crelan-footer-link-groups' },
          {
            role: 'child',
            definitionKey: 'crelan-footer-link-column',
            placeholderKey: 'footer-columns',
          },
        ],
        'footer-columns',
        'crelan-footer-link-groups',
      ),
      'crelan-footer-link-column',
    );
  });

  it('treats leaf child without AppPlaceholder as single even if plan says composite', () => {
    const diags = collectPlaceholderContractDiagnostics({
      role: 'child',
      definitionKey: 'menzis-cookie-option-item',
      nodeMode: 'composite',
      plan: {
        mode: 'composite',
        section: { componentName: 'MenzisCookieOptionItem' },
        children: [],
      },
      tsx: `export const Default = () => <div>option</div>;`,
      definitionTs: `placeholders: [{ key: "cookie-options", allowedControls: ["menzis-cookie-option-item"] }],`,
    });
    assert.ok(
      diags.some((d) => /placeholders: \[\]/.test(d) || /no AppPlaceholder/.test(d)),
      diags.join('\n'),
    );
  });
});

describe('collectPathLeafCollisionDiagnostics', () => {
  it('flags shared rendering Path leaf from componentName stem', () => {
    const diags = collectPathLeafCollisionDiagnostics(
      [
        {
          definitionKey: 'menzis-support-feature-card',
          name: 'menzis-support-feature-card',
          componentName: 'MenzisSupportFeatureCard',
          itemTemplateName: 'Support Feature Card',
        },
        {
          definitionKey: 'menzis-support-guidance-tile',
          name: 'menzis-support-feature-card',
          componentName: 'MenzisSupportFeatureCard',
          itemTemplateName: 'Support Feature Card',
        },
      ],
      { codePrefix: 'Menzis' },
    );
    assert.ok(diags.some((d) => /rendering Path leaf "Support Feature Card"/.test(d)));
    assert.ok(diags.some((d) => /copies sibling definitionKey/.test(d)));
  });

  it('allows shared itemTemplate.name when componentName stems differ', () => {
    const diags = collectPathLeafCollisionDiagnostics(
      [
        {
          definitionKey: 'menzis-footer-quick-link-list',
          name: 'menzis-footer-quick-link-list',
          componentName: 'MenzisFooterQuickLinkList',
          itemTemplateName: 'Link List',
        },
        {
          definitionKey: 'menzis-footer-account-link-list',
          name: 'menzis-footer-account-link-list',
          componentName: 'MenzisFooterAccountLinkList',
          itemTemplateName: 'Link List',
        },
      ],
      { codePrefix: 'Menzis' },
    );
    assert.deepEqual(diags, []);
  });

  it('is clean when Path leaves are unique', () => {
    const diags = collectPathLeafCollisionDiagnostics(
      [
        {
          definitionKey: 'menzis-support-feature-card',
          name: 'menzis-support-feature-card',
          componentName: 'MenzisSupportFeatureCard',
        },
        {
          definitionKey: 'menzis-support-guidance-tile',
          name: 'menzis-support-guidance-tile',
          componentName: 'MenzisSupportGuidanceTile',
        },
      ],
      { codePrefix: 'Menzis' },
    );
    assert.deepEqual(diags, []);
  });
});
