/**
 * GraphQL-shaped definition seed reject/retry gate.
 * Run: node --test tools/create-section-components/definition-seed-shape.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertDefinitionTsSeedShape,
  definitionTsHasBareIdentifierFieldSeeds,
  definitionTsHasContentFieldsWithoutItems,
  definitionTsHasGraphqlChildrenResults,
} from './ai-source-fixup.mjs';
import {
  DEFINITION_SEED_SHAPE_FIX_HEADER,
  isDefinitionParseFailure,
} from './definition-validate-iters.mjs';
import { codegenWithDefinitionParseRetries } from './tsx-validate-loop.mjs';

const GOOD = `
export const cookieConsentBannerDefinition = {
  kind: "component",
  definitionKey: "cookie-consent-banner",
  name: "cookie-consent-banner",
  model: {
    folderTemplate: { name: "Consent Banners" },
    itemTemplate: { name: "Consent Banner" },
  },
  content: {
    location: { root: "data", folder: ["Consent Banners"] },
    culture: "en",
    items: [
      {
        name: "Cookie Consent Banner",
        fields: { Message: "Hello" },
        children: [
          { name: "Targeted Advertising", fields: { "Category Label": "Ads" } },
        ],
      },
    ],
  },
};
`;

const CONSENT_GRAPHQL = `
content: {
  fields: {
    Logo: { url: "https://example.com/logo.png", alt: "Crelan" },
    Title: "Voorkeurenmenu",
  },
  children: {
    results: [
      { name: "Strictly Necessary Cookies", fields: { Title: "Strict" } },
    ],
  },
}
`;

const NAV_NESTED_RESULTS = `
content: {
  culture: "nl-BE",
  location: { root: "data", folder: ["CrelanNavigation"] },
  items: [
    {
      name: "Betalen Teaser",
      fields: { Logo: { url: "https://example.com/l.svg", alt: "Home" } },
      children: {
        results: [
          { name: "Child A", fields: { Title: "A" } },
        ],
      },
    },
  ],
}
`;

describe('definitionTsHasGraphqlChildrenResults', () => {
  it('flags children: { results }', () => {
    assert.equal(definitionTsHasGraphqlChildrenResults(CONSENT_GRAPHQL), true);
    assert.equal(definitionTsHasGraphqlChildrenResults(NAV_NESTED_RESULTS), true);
  });

  it('accepts children arrays', () => {
    assert.equal(definitionTsHasGraphqlChildrenResults(GOOD), false);
  });
});

describe('definitionTsHasContentFieldsWithoutItems', () => {
  it('flags content.fields without items', () => {
    assert.equal(definitionTsHasContentFieldsWithoutItems(CONSENT_GRAPHQL), true);
  });

  it('accepts content.items with nested fields', () => {
    assert.equal(definitionTsHasContentFieldsWithoutItems(GOOD), false);
    assert.equal(definitionTsHasContentFieldsWithoutItems(NAV_NESTED_RESULTS), false);
  });
});

const BARE_IDENT_FIELDS = `
export const headerDefinition = {
  kind: "component",
  definitionKey: "header",
  name: "header",
  model: {
    folderTemplate: { name: "Headers" },
    itemTemplate: { name: "Header" },
  },
  content: {
    location: { root: "data", folder: ["Headers"] },
    culture: "en",
    items: [
      {
        name: "Header",
        fields: {
          "Context Links": contextLinks,
          "Menu Groups": menuGroups,
        },
      },
    ],
  },
};
`;

const JSON_STRINGIFY_FIELDS = `
export const headerDefinition = {
  kind: "component",
  definitionKey: "header",
  name: "header",
  model: {
    folderTemplate: { name: "Headers" },
    itemTemplate: { name: "Header" },
  },
  content: {
    location: { root: "data", folder: ["Headers"] },
    culture: "en",
    items: [
      {
        name: "Header",
        fields: {
          "Context Links": JSON.stringify([
            { text: "Home", url: "https://example.com/" },
          ]),
          Logo: { svgMarkup: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>', alt: "Brand" },
        },
      },
    ],
  },
};
`;

const SVG_MARKUP_BARE_IDENT = `
export const logoDefinition = {
  kind: "component",
  definitionKey: "logo-block",
  name: "logo-block",
  model: {
    folderTemplate: { name: "Logos" },
    itemTemplate: { name: "Logo Block" },
  },
  content: {
    location: { root: "data", folder: ["Logos"] },
    culture: "en",
    items: [
      {
        name: "Logo",
        fields: {
          Logo: { svgMarkup: energypriceLogoSvg, alt: "Brand" },
        },
      },
    ],
  },
};
`;

describe('definitionTsHasBareIdentifierFieldSeeds', () => {
  it('flags bare identifier field values', () => {
    assert.equal(definitionTsHasBareIdentifierFieldSeeds(BARE_IDENT_FIELDS), true);
  });

  it('flags bare identifier svgMarkup', () => {
    assert.equal(definitionTsHasBareIdentifierFieldSeeds(SVG_MARKUP_BARE_IDENT), true);
  });

  it('accepts JSON.stringify and quoted svgMarkup', () => {
    assert.equal(definitionTsHasBareIdentifierFieldSeeds(JSON_STRINGIFY_FIELDS), false);
    assert.equal(definitionTsHasBareIdentifierFieldSeeds(GOOD), false);
  });
});

describe('assertDefinitionTsSeedShape', () => {
  it('accepts SitecoreConsentBanner-style seeds', () => {
    assertDefinitionTsSeedShape(GOOD);
  });

  it('accepts JSON.stringify bag seeds', () => {
    assertDefinitionTsSeedShape(JSON_STRINGIFY_FIELDS);
  });

  it('rejects bare identifier field seeds', () => {
    assert.throws(
      () => assertDefinitionTsSeedShape(BARE_IDENT_FIELDS, 'header.definition.ts'),
      /DEFINITION SEED SHAPE|bare identifier/,
    );
  });

  it('rejects bare identifier svgMarkup', () => {
    assert.throws(
      () => assertDefinitionTsSeedShape(SVG_MARKUP_BARE_IDENT, 'logo.definition.ts'),
      /bare identifier/,
    );
  });

  it('rejects ConsentPreferencesModal GraphQL seed', () => {
    assert.throws(
      () => assertDefinitionTsSeedShape(CONSENT_GRAPHQL, 'consent.definition.ts'),
      /DEFINITION SEED SHAPE|GraphQL-shaped content seed/,
    );
  });

  it('rejects CrelanNavigation nested children.results', () => {
    assert.throws(
      () => assertDefinitionTsSeedShape(NAV_NESTED_RESULTS, 'nav.definition.ts'),
      /children: \{ results/,
    );
  });
});

describe('DEFINITION_SEED_SHAPE_FIX_HEADER', () => {
  it('names ComponentContentSeed and forbidden GraphQL keys', () => {
    assert.match(DEFINITION_SEED_SHAPE_FIX_HEADER, /ComponentContentSeed/);
    assert.match(DEFINITION_SEED_SHAPE_FIX_HEADER, /content\.fields/);
    assert.match(DEFINITION_SEED_SHAPE_FIX_HEADER, /children: \{ results/);
    assert.match(
      DEFINITION_SEED_SHAPE_FIX_HEADER,
      /location \| culture \| cultures \| items \| versions/,
    );
  });
});

describe('isDefinitionParseFailure (seed shape)', () => {
  it('treats seed-shape refusal as retryable', () => {
    assert.equal(
      isDefinitionParseFailure(
        new Error(
          '[codegen] x.definition.ts has GraphQL-shaped content seed — refusing to write broken definition (DEFINITION SEED SHAPE).\nfound children: { results: … }',
        ),
      ),
      true,
    );
  });
});

describe('codegenWithDefinitionParseRetries (seed shape)', () => {
  it('retries with DEFINITION SEED SHAPE FIX header', async () => {
    let codegenCalls = 0;
    const out = await codegenWithDefinitionParseRetries({
      definitionMaxRetries: 1,
      componentName: 'Test',
      codegenArgs: {},
      codegenFn: async (args) => {
        codegenCalls += 1;
        if (codegenCalls === 2) {
          assert.match(
            String(args.revisionBrief?.changes?.[0] || ''),
            /DEFINITION SEED SHAPE FIX/,
          );
          assert.match(
            String(args.revisionBrief?.changes?.[0] || ''),
            /ComponentContentSeed/,
          );
          assert.match(
            String(args.revisionBrief?.changes?.[0] || ''),
            /content\.fields/,
          );
          assert.match(
            String(args.revisionBrief?.changes?.[0] || ''),
            /children: \{ results/,
          );
          assert.equal(
            String(args.revisionBrief?.changes?.[0] || ''),
            DEFINITION_SEED_SHAPE_FIX_HEADER,
          );
        }
        return {
          definitionTs: codegenCalls === 1 ? CONSENT_GRAPHQL : GOOD,
          tsx: 'tsx',
          kebab: 'test',
        };
      },
      async finalizeDefinitionTs(definitionTs) {
        assertDefinitionTsSeedShape(definitionTs, 'test.definition.ts');
        return definitionTs;
      },
    });
    assert.equal(codegenCalls, 2);
    assert.equal(out.definitionAttempts, 2);
  });
});
