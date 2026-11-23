/**
 * Unit tests for heading/CTA/metric/breakpoint/displayName fixups.
 * Run: node --test tools/create-section-components/ai-source-fixup.heading-cta.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTitleHeadingSeed,
  buildOrderedAnchorHrefsFromHtml,
  collapseEmptyMetricUnitFields,
  omitEmptyStringContentFieldSeeds,
  fillLinkUrlsFromSectionHtml,
  injectMissingLinkSeeds,
  isUrlLikeTextValue,
  normalizeComponentTsx,
  normalizeDefinitionTs,
  normalizeDesktopBreakpointPrefixes,
  normalizeDesktopLayoutToLg,
  ensureContentItemDisplayNames,
  stripItemTemplateDisplayName,
  stripTextOnLinkField,
  hasShowLinkTextOnChildlessLink,
  hasShowLinkTextPropOnLinkWithChildren,
  extractRichTextFieldNamesFromDefinition,
  collectRichTextFieldsRenderedAsText,
  collectTsxEmitContractDiagnostics,
  stripInvalidLinkBooleanProps,
  resolveCaptureHeading,
  resolveHrefForLinkText,
  buildAnchorHrefMapFromHtml,
} from './ai-source-fixup.mjs';

describe('isUrlLikeTextValue', () => {
  it('rejects http(s) and path-like titles', () => {
    assert.equal(isUrlLikeTextValue('https://www.axa.be/nl/Newsroom'), true);
    assert.equal(isUrlLikeTextValue('/nl/Newsroom'), true);
    assert.equal(isUrlLikeTextValue('Newsroom'), false);
    assert.equal(isUrlLikeTextValue('Interessant voor jou'), false);
  });
});

describe('resolveCaptureHeading', () => {
  it('prefers info.heading over URL suggestedFields', () => {
    const heading = resolveCaptureHeading({
      heading: 'Newsroom',
      suggestedFields: [
        { name: 'heading', type: 'text', value: 'https://www.axa.be/nl/Newsroom' },
      ],
    });
    assert.equal(heading, 'Newsroom');
  });

  it('falls back to non-URL suggestedFields', () => {
    const heading = resolveCaptureHeading({
      heading: '',
      suggestedFields: [{ name: 'title', type: 'text', value: 'Interessant voor jou' }],
    });
    assert.equal(heading, 'Interessant voor jou');
  });
});

describe('ordered Lees meer hrefs', () => {
  const html = `
    <a href="/nl/over-axa/strategy"><span>Lees meer</span></a>
    <a href="/nl/over-axa/axa-research-fund"><span>Lees meer</span></a>
    <a href="/nl/over-axa/diversity-en-inclusion"><span>Lees meer</span></a>
  `;

  it('consumes hrefs in document order', () => {
    const map = buildAnchorHrefMapFromHtml(html);
    const queues = buildOrderedAnchorHrefsFromHtml(html);
    assert.equal(resolveHrefForLinkText(map, 'Lees meer', queues), '/nl/over-axa/strategy');
    assert.equal(
      resolveHrefForLinkText(map, 'Lees meer', queues),
      '/nl/over-axa/axa-research-fund',
    );
    assert.equal(
      resolveHrefForLinkText(map, 'Lees meer', queues),
      '/nl/over-axa/diversity-en-inclusion',
    );
  });
});

describe('injectMissingLinkSeeds + fill urls', () => {
  it('injects CTA and fills ordered urls', () => {
    const source = `
export const def = {
  model: {
    itemTemplate: {
      sections: [{ fields: [{ name: "Title", type: "Single-Line Text" }, { name: "CTA", type: "General Link" }] }],
    },
  },
  content: {
    items: [
      { name: "A", fields: { Title: "One" } },
      { name: "B", fields: { Title: "Two" } },
    ],
  },
};
`;
    const html = `
      <a href="/a"><span>Lees meer</span></a>
      <a href="/b"><span>Lees meer</span></a>
    `;
    let out = injectMissingLinkSeeds(source, null, html);
    out = fillLinkUrlsFromSectionHtml(out, html);
    assert.match(out, /CTA:\s*\{\s*text:\s*"Lees meer",\s*url:\s*"\/a"\s*\}/);
    assert.match(out, /CTA:\s*\{\s*text:\s*"Lees meer",\s*url:\s*"\/b"\s*\}/);
    assert.match(out, /name:\s*"A"[\s\S]*?CTA:/);
    assert.match(out, /name:\s*"B"[\s\S]*?CTA:/);
  });
});

describe('collapseEmptyMetricUnitFields', () => {
  it('merges unit into Value and drops Unit field when mixed empties', () => {
    const source = `
      fields: [
        { name: "Value", type: "Single-Line Text" },
        { name: "Unit", type: "Single-Line Text" },
        { name: "Label", type: "Single-Line Text" },
      ],
      items: [
        { fields: { Value: "3", Unit: "miljoen", Label: "Trouwe klanten" } },
        { fields: { Value: "3 200", Unit: "", Label: "Makelaars" } },
      ],
    `;
    const out = collapseEmptyMetricUnitFields(source);
    assert.match(out, /Value:\s*"3 miljoen"/);
    assert.match(out, /Value:\s*"3 200"/);
    assert.doesNotMatch(out, /name:\s*"Unit"/);
    assert.doesNotMatch(out, /\bUnit\s*:/);
  });

  it('keeps Number+Unit model but omits Unit: "" seeds', () => {
    const source = `
      fields: [
        { name: "Number", type: "Single-Line Text" },
        { name: "Unit", type: "Single-Line Text" },
        { name: "Title", type: "Single-Line Text" },
      ],
      items: [
        { fields: { Number: "105", Unit: "miljoen", Title: "Klanten" } },
        { fields: { Number: "54", Unit: "", Title: "Landen" } },
      ],
    `;
    const out = collapseEmptyMetricUnitFields(source);
    assert.match(out, /name:\s*"Unit"/);
    assert.match(out, /Unit:\s*"miljoen"/);
    assert.doesNotMatch(out, /Unit:\s*""/);
    assert.match(out, /Number:\s*"54"/);
  });
});

describe('omitEmptyStringContentFieldSeeds', () => {
  it('omits top-level empty string fields but keeps nested url', () => {
    const source = `
      content: {
        items: [{
          fields: {
            Number: "54",
            Unit: "",
            Link: { text: "X", url: "" },
            Title: "Landen",
          },
        }],
      };
    `;
    const out = omitEmptyStringContentFieldSeeds(source);
    assert.doesNotMatch(out, /\bUnit\s*:\s*""/);
    assert.match(out, /url:\s*""/);
    assert.match(out, /Number:\s*"54"/);
  });
});

describe('normalizeDesktopBreakpointPrefixes', () => {
  it('leaves xl: intact (evidence-first; no remap)', () => {
    const src = 'className="grid xl:grid-cols-3 xl:gap-8"';
    assert.equal(normalizeDesktopBreakpointPrefixes(src), src);
  });
});

describe('normalizeDesktopLayoutToLg', () => {
  it('maps carousel wrap-at-desktop from md: to lg:', () => {
    const src =
      'className="flex snap-x md:grid md:grid-cols-3 md:overflow-visible md:hidden"';
    const out = normalizeDesktopLayoutToLg(src);
    assert.match(out, /\blg:grid\b/);
    assert.match(out, /\blg:grid-cols-3\b/);
    assert.match(out, /\blg:hidden\b/);
    assert.doesNotMatch(out, /\bmd:grid\b/);
  });

  it('maps side-by-side flex-row / w-1/2 from md: to lg:', () => {
    const out = normalizeDesktopLayoutToLg(
      'className="flex flex-col md:flex-row md:w-1/2"',
    );
    assert.equal(out, 'className="flex flex-col lg:flex-row lg:w-1/2"');
  });
});

describe('applyTitleHeadingSeed', () => {
  it('overwrites Title equal to componentName', () => {
    const out = applyTitleHeadingSeed(
      'fields: { Title: "RelatedContentCarousel" }',
      'Interessant voor jou',
    );
    assert.match(out, /Title:\s*"Interessant voor jou"/);
  });
});

describe('normalizeDefinitionTs heading rejection', () => {
  it('keeps Newsroom from info.heading when suggestedFields is URL', () => {
    const source = `
export const pressQuoteBannerDefinition = {
  kind: "component",
  definitionKey: "press-quote-banner",
  name: "press-quote-banner",
  displayName: "Press Quote Banner",
  componentName: "PressQuoteBanner",
  datasourceLocation: { scope: "site", root: "data", folder: ["Press Quote Banners"] },
  model: {
    folderTemplate: { name: "Press Quote Banner Folder" },
    itemTemplate: {
      name: "Press Quote Banner",
      sections: [{ name: "Data", fields: [{ name: "Heading", type: "Single-Line Text" }] }],
    },
  },
  content: {
    location: { root: "data", folder: ["Press Quote Banners"] },
    items: [{ name: "Newsroom Press Quote", fields: { Heading: "PressQuoteBanner" } }],
  },
};
`;
    const out = normalizeDefinitionTs(source, {
      definitionKey: 'press-quote-banner',
      sectionInfo: {
        heading: 'Newsroom',
        suggestedFields: [
          { name: 'heading', type: 'text', value: 'https://www.axa.be/nl/Newsroom' },
        ],
      },
      sectionHtml: '<h2>Newsroom</h2>',
      allowSeedSalvage: true,
    });
    assert.match(out, /Heading:\s*"Newsroom"/);
    assert.doesNotMatch(out, /Heading:\s*"https:\/\//);
  });
});

describe('stripItemTemplateDisplayName', () => {
  it('removes displayName from itemTemplate but keeps folderTemplate and content', () => {
    const source = `
export const d = {
  displayName: "Footer Link Group",
  model: {
    folderTemplate: {
      name: "Footer Link Group Folder",
      displayName: "Footer Link Group Folder",
    },
    itemTemplate: {
      name: "Footer Link Group",
      displayName: "Footer Link Group",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  content: {
    items: [{ name: "AXA", displayName: "AXA", fields: { Title: "AXA" } }],
  },
};
`;
    const out = stripItemTemplateDisplayName(source);
    assert.doesNotMatch(
      out,
      /itemTemplate:\s*\{[^}]*displayName\s*:/,
    );
    assert.match(out, /folderTemplate:[\s\S]*?displayName:\s*"Footer Link Group Folder"/);
    assert.match(out, /name:\s*"AXA",\s*displayName:\s*"AXA"/);
  });
});

describe('ensureContentItemDisplayNames', () => {
  it('collapses duplicates and prefers same-item Link.text (no sibling Title leak)', () => {
    const source = `
export const footerLinkGroupDefinition = {
  content: {
    items: [
      {
        name: "AXA",
     displayName: "AXA",  displayName: "AXA",  displayName: "AXA",
        fields: { Title: "AXA" },
        children: [
          { name: "Jobs",displayName: "Jobs",  displayName: "Belangrijke info", fields: { Link: { text: "Jobs", url: "https://www.axa.be/nl/jobs" } } },
        ],
      },
      {
        name: "Belangrijke Info",
     displayName: "Belangrijke Info",  displayName: "Belangrijke info",
        fields: { Title: "Belangrijke info" },
      },
    ],
  },
};
`;
    const out = ensureContentItemDisplayNames(source);
    assert.doesNotMatch(out, /displayName:[^,]+,\s*displayName:/);
    assert.match(out, /name:\s*"Jobs",\s*displayName:\s*"Jobs"/);
    assert.match(out, /name:\s*"Belangrijke Info",\s*displayName:\s*"Belangrijke info"/);
    assert.doesNotMatch(out, /name:\s*"Jobs",\s*displayName:\s*"Belangrijke info"/);
  });

  it('is idempotent when displayName already correct', () => {
    const source = `
export const d = {
  content: {
    items: [{ name: "Jobs", displayName: "Jobs", fields: { Link: { text: "Jobs", url: "/" } } }],
  },
};
`;
    const once = ensureContentItemDisplayNames(source);
    const twice = ensureContentItemDisplayNames(once);
    assert.equal(once, twice);
    assert.equal((once.match(/displayName:/g) || []).length, 1);
  });

  it('strips HTML from Title when copying into displayName', () => {
    const source = `
export const d = {
  content: {
    items: [{
      name: "Shorter Waiting",
      displayName: "Shorter Waiting",
      fields: { Title: "<p>Wacht 18 weken korter</p>" },
    }],
  },
};
`;
    const out = ensureContentItemDisplayNames(source);
    assert.match(out, /displayName:\s*"Wacht 18 weken korter"/);
    assert.doesNotMatch(out, /displayName:\s*"[^"]*<p>/);
  });
});

describe('normalizeComponentTsx strips invalid Text-on-LinkField', () => {
  it('removes <Text field={LinkField}> safety-net (AI should emit Title or showLinkText)', () => {
    const src = `
import { Link, Text } from '@sitecore-content-sdk/nextjs';
interface Fields {
  CTA: LinkField;
}
export const Default = () => (
  <Link field={fields.CTA} className="text-sm">
    <span className="underline"><Text field={fields.CTA} /></span>
    <span aria-hidden="true">→</span>
  </Link>
);
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\.CTA\}/);
    assert.match(out, /→/);
  });
});

describe('stripTextOnLinkField (helpers)', () => {
  it('removes Text on CTA and never adds showLinkTextWithChildrenPresent', () => {
    const src = `
import { Link, Text } from '@sitecore-content-sdk/nextjs';
interface Fields {
  CTA: LinkField;
}
export const Default = () => (
  <Link field={fields.CTA} className="text-sm">
    <span className="underline"><Text field={fields.CTA} /></span>
    <span aria-hidden="true">→</span>
  </Link>
);
`;
    const out = stripTextOnLinkField(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\.CTA\}/);
    assert.doesNotMatch(out, /showLinkTextWithChildrenPresent/);
    assert.match(out, /→/);
  });

  it('removes Text on spaced LinkField and keeps arrow without showLinkText', () => {
    const src = `
interface Fields {
  "All Press Releases": LinkField;
}
export const Default = () => (
  <Link field={fields["All Press Releases"]}>
    <span className="underline"><Text field={fields["All Press Releases"]} /></span>
    <span aria-hidden="true">→</span>
  </Link>
);
`;
    const out = stripTextOnLinkField(src);
    assert.doesNotMatch(out, /<Text\s+field=\{fields\["All Press Releases"\]\}/);
    assert.doesNotMatch(out, /value\?\.text/);
    assert.doesNotMatch(out, /showLinkTextWithChildrenPresent/);
  });
});

describe('showLinkText warn-only (no post-AI rewrite)', () => {
  it('normalizeComponentTsx leaves showLinkText on childless Links untouched', () => {
    const src = `import { Link } from '@sitecore-content-sdk/nextjs';
interface Fields { CTA: LinkField; }
export const Default = (props) => {
  const { fields } = props;
  return (
    <Link field={fields.CTA} className="x" showLinkTextWithChildrenPresent />
  );
};`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /showLinkTextWithChildrenPresent/);
    assert.match(out, /field=\{fields\.CTA\}/);
    const diags = collectTsxEmitContractDiagnostics(out);
    assert.ok(
      diags.some((w) => /never emit showLinkTextWithChildrenPresent/.test(w)),
      `expected forbid diag, got: ${JSON.stringify(diags)}`,
    );
  });

  it('normalizeComponentTsx leaves showLinkText on Links with children untouched', () => {
    const src = `import { Link } from '@sitecore-content-sdk/nextjs';
interface Fields { CTA: LinkField; }
export const Default = (props) => {
  const { fields } = props;
  return (
    <Link field={fields.CTA} className="x" showLinkTextWithChildrenPresent={false}>
      <span aria-hidden="true">→</span>
    </Link>
  );
};`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /showLinkTextWithChildrenPresent=\{false\}/);
  });

  it('detects self-closing childless prop', () => {
    assert.equal(
      hasShowLinkTextOnChildlessLink(
        `<Link field={fields.CTA} showLinkTextWithChildrenPresent />`,
      ),
      true,
    );
  });

  it('ignores Links with children for childless detector', () => {
    assert.equal(
      hasShowLinkTextOnChildlessLink(
        `<Link field={fields.CTA} showLinkTextWithChildrenPresent><span>→</span></Link>`,
      ),
      false,
    );
  });

  it('detects Links with children that still have the forbidden prop', () => {
    assert.equal(
      hasShowLinkTextPropOnLinkWithChildren(
        `<Link field={fields.CTA}><span>→</span></Link>`,
      ),
      false,
    );
    assert.equal(
      hasShowLinkTextPropOnLinkWithChildren(
        `<Link field={fields.CTA} showLinkTextWithChildrenPresent><span>→</span></Link>`,
      ),
      true,
    );
    assert.equal(
      hasShowLinkTextPropOnLinkWithChildren(
        `<Link field={fields.CTA} showLinkTextWithChildrenPresent={false}><span>→</span></Link>`,
      ),
      true,
    );
  });

  it('emit contract flags any showLinkText prop', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `<Link field={fields.CTA} showLinkTextWithChildrenPresent />`,
    );
    assert.ok(
      diags.some((w) => /never emit showLinkTextWithChildrenPresent/.test(w)),
      `expected forbid diag, got: ${JSON.stringify(diags)}`,
    );
  });

  it('emit contract flags malformed mid-slash showLinkText', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `<Link field={fields.CTA} className="x" / showLinkTextWithChildrenPresent={false}>`,
    );
    assert.ok(
      diags.some((w) => /never emit showLinkTextWithChildrenPresent/.test(w)),
      `expected forbid diag, got: ${JSON.stringify(diags)}`,
    );
  });
});

describe('RichText / Text field pairing (warn-only)', () => {
  const heroCardDef = `
fields: [
  { name: 'Title', type: 'Single-Line Text' },
  { name: 'Text', type: 'Rich Text' },
],
`;

  it('extracts RichText field names from definition', () => {
    assert.deepEqual(extractRichTextFieldNamesFromDefinition(heroCardDef), ['Text']);
  });

  it('detects RichText field mounted with Text', () => {
    assert.deepEqual(
      collectRichTextFieldsRenderedAsText(
        `<Text field={fields.Title} /><Text field={fields.Text} />`,
        heroCardDef,
      ),
      ['Text'],
    );
  });

  it('ignores RichText field mounted with RichText', () => {
    assert.deepEqual(
      collectRichTextFieldsRenderedAsText(
        `<Text field={fields.Title} /><RichText field={fields.Text} />`,
        heroCardDef,
      ),
      [],
    );
  });

  it('emit contract flags RichText + Text mismatch', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `export const Default = () => <Text field={fields.Text} />;`,
      { definitionTs: heroCardDef },
    );
    assert.ok(
      diags.some((w) => /Rich Text field "Text".*<RichText/.test(w)),
      `expected RichText pairing diag, got: ${JSON.stringify(diags)}`,
    );
  });
});

describe('stripInvalidLinkBooleanProps', () => {
  it('moves underline boolean prop into className', () => {
    const src = `<Link
            field={fields.CTA}
            underline
            showLinkTextWithChildrenPresent
            className="inline-flex text-white"
          >
            <span>→</span>
          </Link>`;
    const out = stripInvalidLinkBooleanProps(src);
    assert.doesNotMatch(out, /^\s*underline\s*$/m);
    assert.match(out, /className="inline-flex text-white underline"/);
    assert.match(out, /showLinkTextWithChildrenPresent/);
  });

  it('does not strip underline inside className', () => {
    const src = `<Link field={fields.CTA} className="underline text-white" />`;
    assert.equal(stripInvalidLinkBooleanProps(src), src);
  });
});
