/**
 * Unit tests for Link/CTA url fill from section HTML.
 * Run: node --test tools/create-section-components/ai-source-fixup.link-url.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnchorHrefMapFromHtml,
  dedupeContentItemFieldKeys,
  fillLinkUrlsFromSectionHtml,
  injectSeedLinkUrls,
  isPlaceholderLinkUrl,
  normalizeDefinitionTs,
  normalizeLinkLabel,
  resolveHrefForLinkText,
} from './ai-source-fixup.mjs';

const FOOTER_HTML = `
<nav>
  <a href="https://www.axa.be/nl/jobs"><span>Jobs</span></a>
  <a href="https://www.axa.be/nl/pers"><span>Pers</span></a>
  <a href="https://www.axa.be/nl/over-axa"><span>Over AXA</span></a>
  <a href="https://www.axa.be/nl/blog">Blog</a>
</nav>
`;

describe('normalizeLinkLabel', () => {
  it('strips tags and normalizes whitespace', () => {
    assert.equal(normalizeLinkLabel('<span>  Jobs </span>'), 'jobs');
  });
});

describe('isPlaceholderLinkUrl', () => {
  it('treats empty / and # as placeholders', () => {
    assert.equal(isPlaceholderLinkUrl(''), true);
    assert.equal(isPlaceholderLinkUrl('/'), true);
    assert.equal(isPlaceholderLinkUrl('#'), true);
    assert.equal(isPlaceholderLinkUrl('https://www.axa.be/nl/jobs'), false);
  });
});

describe('buildAnchorHrefMapFromHtml / resolveHrefForLinkText', () => {
  it('maps labels to hrefs and resolves English aliases', () => {
    const map = buildAnchorHrefMapFromHtml(FOOTER_HTML);
    assert.equal(map.get('jobs'), 'https://www.axa.be/nl/jobs');
    assert.equal(map.get('pers'), 'https://www.axa.be/nl/pers');
    assert.equal(
      resolveHrefForLinkText(map, 'Jobs'),
      'https://www.axa.be/nl/jobs',
    );
    assert.equal(
      resolveHrefForLinkText(map, 'Press'),
      'https://www.axa.be/nl/pers',
    );
    assert.equal(
      resolveHrefForLinkText(map, 'About AXA'),
      'https://www.axa.be/nl/over-axa',
    );
  });
});

describe('fillLinkUrlsFromSectionHtml', () => {
  it('fills missing Link url from matching HTML href (not /)', () => {
    const def = `
content: {
  items: [
    { name: "Jobs", fields: { Link: { text: "Jobs" } } },
    { name: "Press", fields: { Link: { text: "Press", url: "/" } } },
  ]
}
`;
    const out = fillLinkUrlsFromSectionHtml(def, FOOTER_HTML);
    assert.match(out, /text: "Jobs", url: "https:\/\/www\.axa\.be\/nl\/jobs"/);
    // English AI label overwritten with capture HTML label
    assert.match(out, /text: "Pers", url: "https:\/\/www\.axa\.be\/nl\/pers"/);
    assert.doesNotMatch(out, /Link: \{ text: "Jobs" \}/);
  });

  it('does not overwrite a real external url', () => {
    const def = `Link: { text: "Jobs", url: "https://example.com/keep" }`;
    const out = fillLinkUrlsFromSectionHtml(def, FOOTER_HTML);
    assert.match(out, /url: "https:\/\/example\.com\/keep"/);
  });

  it('overwrites English link text when url already matches capture HTML', () => {
    const def = `Link: { text: "Press", url: "https://www.axa.be/nl/pers" }`;
    const out = fillLinkUrlsFromSectionHtml(def, FOOTER_HTML);
    assert.match(out, /text: "Pers", url: "https:\/\/www\.axa\.be\/nl\/pers"/);
  });
});

describe('injectSeedLinkUrls', () => {
  it('patches placeholder url from seed with matching text', () => {
    const def = `Link: { text: "Jobs", url: "/" }`;
    const out = injectSeedLinkUrls(def, {
      suggestedFields: [
        {
          name: "Link",
          type: "link",
          value: { text: "Jobs", url: "https://www.axa.be/nl/jobs" },
        },
      ],
    });
    assert.match(out, /url: "https:\/\/www\.axa\.be\/nl\/jobs"/);
  });
});

describe('normalizeDefinitionTs with sectionHtml', () => {
  it('fills urls before last-resort slash default', () => {
    const source = `
export const footerLinkGroupDefinition = {
  kind: "component",
  definitionKey: "footer-link-group",
  name: "footer-link-group",
  displayName: "Footer Link Group",
  componentName: "FooterLinkGroup",
  icon: "Office/32x32/link.png",
  datasourceLocation: { scope: "site", root: "data", folder: ["Link Lists"] },
  model: {
    folderTemplate: { name: "Footer Link Group Folder" },
    itemTemplate: {
      name: "Footer Link Group",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Link", type: "General Link" },
        ],
      }],
    },
    childItemTemplate: {
      name: "Footer Link Item",
      sections: [{
        name: "Data",
        fields: [{ name: "Link", type: "General Link" }],
      }],
    },
  },
  variants: [{ name: "Default" }],
  content: {
    location: { root: "data", folder: ["Link Lists"] },
    items: [
      {
        name: "AXA",
        fields: { Title: "AXA" },
        children: [
          { name: "Jobs", fields: { Link: { text: "Jobs" } } },
          { name: "Blog", fields: { Link: { text: "Blog", url: "" } } },
        ],
      },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;
    const out = normalizeDefinitionTs(source, {
      definitionKey: 'footer-link-group',
      sectionHtml: FOOTER_HTML,
      allowSeedSalvage: true,
    });
    assert.match(out, /url: "https:\/\/www\.axa\.be\/nl\/jobs"/);
    assert.match(out, /url: "https:\/\/www\.axa\.be\/nl\/blog"/);
    assert.doesNotMatch(out, /Link: \{ text: "Jobs", url: "\/" \}/);
  });

  it('always-on fills capture hrefs when salvage is off (never invents "/")', () => {
    const source = `
export const footerLinkGroupDefinition = {
  kind: "component",
  definitionKey: "footer-link-group",
  name: "footer-link-group",
  displayName: "Footer Link Group",
  componentName: "FooterLinkGroup",
  icon: "Office/32x32/link.png",
  datasourceLocation: { scope: "site", root: "data", folder: ["Link Lists"] },
  model: {
    folderTemplate: { name: "Footer Link Group Folder" },
    itemTemplate: {
      name: "Footer Link Item",
      sections: [{
        name: "Data",
        fields: [{ name: "Link", type: "General Link" }],
      }],
    },
  },
  variants: [{ name: "Default" }],
  content: {
    location: { root: "data", folder: ["Link Lists"] },
    items: [
      { name: "Jobs", fields: { Link: { text: "Jobs", url: "/" } } },
      { name: "Unknown", fields: { Link: { text: "NoMatchInHtml" } } },
    ],
  },
} satisfies ComponentTemplateDefinition;
`;
    const out = normalizeDefinitionTs(source, {
      definitionKey: 'footer-link-group',
      sectionHtml: FOOTER_HTML,
      allowSeedSalvage: false,
      skipParseAssert: true,
    });
    assert.match(out, /url: "https:\/\/www\.axa\.be\/nl\/jobs"/);
    assert.doesNotMatch(out, /Link: \{ text: "Jobs", url: "\/" \}/);
    // Unmatched labels stay without invented "/"
    assert.match(out, /Link: \{ text: "NoMatchInHtml" \}/);
    assert.doesNotMatch(out, /text: "NoMatchInHtml", url: "\/"/);
  });
});

describe('dedupeContentItemFieldKeys', () => {
  it('keeps the last Link when fields lists Link twice', () => {
    const source = `
content: {
  items: [{
    name: "Climate",
    fields: {
      Title: "Klimaat",
      Link: { text: "Lees meer", url: "https://www.axa.be/nl/over-axa/strategy" },
      Description: "<p>x</p>",
      Link: { text: "Lees meer", url: "https://www.axa.be/nl/over-axa/axa-research-fund" }
    }
  }]
}
`;
    const out = dedupeContentItemFieldKeys(source);
    assert.equal((out.match(/\bLink\s*:/g) || []).length, 1);
    assert.match(out, /axa-research-fund/);
    assert.doesNotMatch(out, /over-axa\/strategy/);
  });

  it('normalizeDefinitionTs collapses duplicates reintroduced after inject', () => {
    const source = `
export const x = {
  kind: "component",
  definitionKey: "editorial-hero-banner",
  name: "editorial-hero-banner",
  model: {
    itemTemplate: {
      name: "Hero",
      sections: [{
        name: "Data",
        fields: [
          { name: "Heading", type: "Single-Line Text" },
          { name: "CTA", type: "General Link" },
          { name: "Mobile Image", type: "Image" },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: "Hero",
      fields: {
        Heading: "Hi",
        CTA: { text: "Meer weten", url: "/nl/a" },
        "Mobile Image": { url: "https://cdn.example/m.jpg", alt: "" },
        CTA: { text: "Meer weten", url: "https://www.axa.be/nl/a" },
      },
    }],
  },
};
`;
    const out = normalizeDefinitionTs(source, {
      definitionKey: 'editorial-hero-banner',
      skipParseAssert: true,
    });
    assert.equal((out.match(/\bCTA\s*:/g) || []).length, 1);
    assert.match(out, /https:\/\/www\.axa\.be\/nl\/a/);
  });
});
