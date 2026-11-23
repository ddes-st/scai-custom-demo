/**
 * Nested Link/CTA inside Image seed fixup.
 * Run: node --test tools/create-section-components/ai-source-fixup.image-seed.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stripNestedLinkPropsFromImageSeeds,
  normalizeDefinitionTs,
} from './ai-source-fixup.mjs';

describe('stripNestedLinkPropsFromImageSeeds', () => {
  it('removes nested CTA from Image when sibling CTA exists', () => {
    const src = `
fields: {
  Image: { url: "https://x/a.svg", alt: "", CTA: { text: "Go", url: "/go" } },
  CTA: { text: "Go", url: "/go" },
}
`;
    const out = stripNestedLinkPropsFromImageSeeds(src);
    assert.match(out, /Image:\s*\{\s*url:[^}]*alt:\s*""\s*\}/);
    assert.doesNotMatch(out, /Image:\s*\{[^}]*CTA:/);
    assert.match(out, /CTA:\s*\{\s*text:\s*"Go"/);
  });

  it('strips nested CTA from Icon image seeds', () => {
    const src = `
fields: {
  Icon: { url: "https://x/a.svg", alt: "CMS", CTA: { text: "Lees meer", url: "/" } },
  Title: "CMS",
  CTA: { text: "Master the CMS", url: "https://example.com" },
}
`;
    const out = stripNestedLinkPropsFromImageSeeds(src);
    assert.doesNotMatch(out, /Icon:\s*\{[^}]*CTA:/);
    assert.match(out, /Icon:\s*\{\s*url:[^}]*alt:\s*"CMS"/);
    assert.match(out, /CTA:\s*\{\s*text:\s*"Master the CMS"/);
  });

  it('strips nested Link when Image alt contains commas', () => {
    const src = `
fields: {
  Image: {
    url: "https://x/bootcamp.jpg",
    alt: "Back-to-School Bootcamp: AI, Content & Customer Experience | Sitecore",
    Link: { text: "Lees meer", url: "/" },
  },
  Type: "Webinar",
  Title: "Back-to-School Bootcamp: AI, Content & Customer Experience",
  Link: {
    text: "Back-to-School Bootcamp: AI, Content & Customer Experience",
    url: "/resources/events-webinars/bootcamp",
  },
}
`;
    const out = stripNestedLinkPropsFromImageSeeds(src);
    // Image object must close without an inner Link key (sibling Link stays).
    assert.match(
      out,
      /Image:\s*\{\s*url:\s*"https:\/\/x\/bootcamp\.jpg",\s*alt:\s*"Back-to-School Bootcamp: AI, Content & Customer Experience \| Sitecore"\s*\}/,
    );
    assert.match(
      out,
      /Link:\s*\{\s*text:\s*"Back-to-School Bootcamp: AI, Content & Customer Experience"/,
    );
  });
});

describe('normalizeDefinitionTs strips nested image links', () => {
  it('cleans Image+CTA nest via pipeline', () => {
    const src = `
export const fooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  collectionSystem: "axa",
  siteSystem: "axa-be",
  datasourceLocation: { scope: "site", root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foo Folder" },
    itemTemplate: {
      name: "Foo",
      sections: [{ name: "Data", fields: [
        { name: "Image", type: "Image" },
        { name: "CTA", type: "General Link" },
      ] }],
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Foos"] },
    culture: "nl-BE",
    cultures: ["nl-BE"],
    items: [{
      name: "One",
      fields: {
        Image: { url: "https://x/a.svg", alt: "", CTA: { text: "Go", url: "/go" } },
        CTA: { text: "Go", url: "/go" },
      },
    }],
  },
};
`;
    const out = normalizeDefinitionTs(src, { definitionKey: 'foo' });
    assert.doesNotMatch(out, /Image:\s*\{[^}]*CTA:/);
  });
});
