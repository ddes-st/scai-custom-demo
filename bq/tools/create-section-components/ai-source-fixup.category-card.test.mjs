/**
 * Unit tests: image/category card Description + headless variant fixups.
 * Run: node --test tools/create-section-components/ai-source-fixup.category-card.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  stripVacuousDescriptionFromDefinition,
  ensureHeadlessVariantsForVisualModes,
  stripShowDownArrowLayoutFlag,
  ensureTeaserShowDownArrowSeeds,
  normalizeImageCategoryCardTsx,
  normalizeDefinitionTs,
  normalizeComponentTsx,
  stripOrphanVariantsNotInTsx,
} from './ai-source-fixup.mjs';
import {
  inferChildVariantFromSignals,
  contentItemsWithVariantsFromDefinition,
} from './presentation-variant.mjs';

const defWithEmptyDescription = `
export const insuranceCategoryCardDefinition = {
  kind: "component",
  definitionKey: "insurance-category-card",
  name: "insurance-category-card",
  model: {
    folderTemplate: { name: "Insurance Category Cards" },
    itemTemplate: {
      name: "Insurance Category Card",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Description", type: "Single-Line Text" },
          { name: "Image", type: "Image" },
          { name: "Link", type: "General Link" },
          { name: "Promo Label", type: "Single-Line Text" }
        ]
      }]
    }
  },
  variants: [{ name: "Default" }],
  content: {
    location: { root: "data", folder: ["Insurance Category Cards"] },
    items: [
      { name: "Woning", fields: { Title: "Woning", Description: "", Image: { url: "https://x/a.svg", alt: "Woning" }, Link: { text: "Woning", url: "/w" }, "Promo Label": "Ontdek onze korting" } },
      { name: "Bekijk al onze producten", fields: { Title: "Bekijk al onze producten", Description: "", Link: { text: "Bekijk", url: "#all" } } }
    ]
  }
};
`;

describe('stripVacuousDescriptionFromDefinition', () => {
  it('removes Description when all seeds are empty on image cards', () => {
    const out = stripVacuousDescriptionFromDefinition(defWithEmptyDescription);
    assert.doesNotMatch(out, /name:\s*["']Description["']/);
    assert.doesNotMatch(out, /Description\s*:\s*["']/);
    assert.match(out, /name:\s*["']Title["']/);
    assert.match(out, /name:\s*["']Image["']/);
  });

  it('keeps Description when a seed has text', () => {
    const src = defWithEmptyDescription.replace(
      'Description: ""',
      'Description: "Some body"',
    );
    const out = stripVacuousDescriptionFromDefinition(src);
    assert.match(out, /name:\s*["']Description["']/);
  });
});

describe('ensureHeadlessVariantsForVisualModes', () => {
  it('adds Promo and Teaser variants from seeds', () => {
    const stripped = stripVacuousDescriptionFromDefinition(defWithEmptyDescription);
    const out = ensureHeadlessVariantsForVisualModes(stripped);
    assert.match(out, /name:\s*["']Default["']/);
    assert.match(out, /name:\s*["']Promo["']/);
    assert.match(out, /name:\s*["']Teaser["']/);
  });

  it('strips Show Down Arrow when Teaser variant present', () => {
    const withArrow = defWithEmptyDescription.replace(
      '{ name: "Promo Label", type: "Single-Line Text" }',
      '{ name: "Promo Label", type: "Single-Line Text" }, { name: "Show Down Arrow", type: "Checkbox" }',
    );
    const out = stripShowDownArrowLayoutFlag(
      ensureHeadlessVariantsForVisualModes(withArrow),
    );
    assert.doesNotMatch(out, /Show Down Arrow/);
    assert.match(out, /name:\s*["']Teaser["']/);
  });
});

describe('ensureTeaserShowDownArrowSeeds (compat alias)', () => {
  it('prefers variants over Show Down Arrow', () => {
    const stripped = stripVacuousDescriptionFromDefinition(defWithEmptyDescription);
    const out = ensureTeaserShowDownArrowSeeds(stripped);
    assert.match(out, /name:\s*["']Teaser["']/);
    assert.doesNotMatch(out, /Show Down Arrow/);
  });
});

describe('normalizeImageCategoryCardTsx', () => {
  it('strips Description and warns toward Teaser instead of Show Down Arrow', () => {
    const src = `
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  Description: TextField;
  Image: ImageField;
  Link: LinkField;
}
export const Default = (props) => {
  const { fields } = props;
  return (
    <Link field={fields.Link}>
      <Image field={fields.Image} />
      <Text field={fields.Title} />
      <Text field={fields.Description} />
      <span aria-hidden="true">↓</span>
    </Link>
  );
};
`;
    const out = normalizeImageCategoryCardTsx(src);
    assert.doesNotMatch(out, /Description\s*:\s*TextField/);
    assert.doesNotMatch(out, /fields\.Description/);
    assert.doesNotMatch(out, /Show Down Arrow/);
  });
});

describe('presentation-variant inference', () => {
  it('infers Promo and Teaser from signals', () => {
    assert.equal(
      inferChildVariantFromSignals({
        title: 'Woning',
        hasImage: true,
        hasPromoLabel: true,
      }),
      'Promo',
    );
    assert.equal(
      inferChildVariantFromSignals({
        title: 'Bekijk al onze producten',
        hasImage: false,
      }),
      'Teaser',
    );
    assert.equal(
      inferChildVariantFromSignals({
        title: 'Reis',
        hasImage: true,
        className: 'imgcard--teaser',
      }),
      'Teaser',
    );
    assert.equal(
      inferChildVariantFromSignals({ title: 'Reis', hasImage: true }),
      undefined,
    );
  });

  it('does not infer Teaser for rating-only / no-Image-alone cards', () => {
    assert.equal(
      inferChildVariantFromSignals({
        title: 'eKomi',
        hasImage: false,
        hasRating: true,
      }),
      undefined,
    );
    assert.equal(
      inferChildVariantFromSignals({
        title: 'Customer Reviews',
        hasImage: false,
      }),
      undefined,
    );
  });

  it('ensureHeadlessVariants does not add Teaser for rating cards without view-all', () => {
    const ratingDef = `
export const recommendationCardDefinition = {
  kind: "component",
  definitionKey: "recommendation-card",
  model: {
    itemTemplate: {
      name: "Recommendation Card",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Image", type: "Image" },
          { name: "Rating", type: "Number" },
          { name: "Rating Maximum", type: "Number" },
          { name: "Link", type: "General Link" }
        ]
      }]
    }
  },
  variants: [{ name: "Default" }, { name: "Teaser" }],
  content: {
    items: [
      { name: "Ekomi", fields: { Title: "eKomi", Rating: "4.5", "Rating Maximum": "5", Link: { text: "Reviews", url: "/r" } } },
      { name: "Illustration", fields: { Title: "Happy customers", Image: { url: "https://x/a.svg", alt: "x" }, Link: { text: "More", url: "/m" } } }
    ]
  }
};
`;
    const out = ensureHeadlessVariantsForVisualModes(ratingDef);
    // Must not invent Teaser from bare !hasImage on the rating item
    assert.match(out, /name:\s*["']Default["']/);
    // Existing Teaser in variants may remain until orphan strip — but hasTeaserItem is false
    // so ensureHeadlessVariants should not *require* Teaser from seeds alone.
    // If Teaser was already listed, it stays; stripOrphanVariantsNotInTsx removes it vs TSX.
    const withoutListedTeaser = ratingDef.replace(
      'variants: [{ name: "Default" }, { name: "Teaser" }]',
      'variants: [{ name: "Default" }]',
    );
    const out2 = ensureHeadlessVariantsForVisualModes(withoutListedTeaser);
    assert.doesNotMatch(out2, /name:\s*["']Teaser["']/);
  });

  it('parses definition content items with variants', () => {
    const items = contentItemsWithVariantsFromDefinition(defWithEmptyDescription);
    assert.equal(items.find((i) => i.name === 'Woning')?.variant, 'Promo');
    assert.equal(
      items.find((i) => i.name === 'Bekijk al onze producten')?.variant,
      'Teaser',
    );
  });

  it('parses only top-level content.items (ignores nested Link List children)', () => {
    const linkListDef = `
export const insuranceCatalogDefinition = {
  kind: "component",
  definitionKey: "insurance-catalog",
  model: {
    itemTemplate: {
      name: "Insurance Category",
      sections: [{ name: "Data", fields: [
        { name: "Title", type: "Single-Line Text" },
        { name: "Link", type: "General Link" }
      ]}]
    }
  },
  variants: [{ name: "Default" }],
  content: {
    items: [
      {
        name: "Home Insurance",
        fields: { Title: "Woning", Link: { text: "Woning", url: "/w" } },
        children: [
          { name: "Fire Cover", fields: { Title: "Brand", Link: { text: "Brand", url: "/fire" } } },
          { name: "Theft Cover", fields: { Title: "Diefstal", Link: { text: "Diefstal", url: "/theft" } } }
        ]
      },
      {
        name: "Auto Insurance",
        fields: { Title: "Auto", Link: { text: "Auto", url: "/a" } },
        children: [
          { name: "Liability", fields: { Title: "BA", Link: { text: "BA", url: "/ba" } } }
        ]
      }
    ]
  }
};
`;
    const items = contentItemsWithVariantsFromDefinition(linkListDef);
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((i) => i.name).sort(),
      ['Auto Insurance', 'Home Insurance'],
    );
    assert.ok(!items.some((i) => i.name === 'Fire Cover'));
    assert.ok(!items.some((i) => i.name === 'Liability'));
  });
});

describe('stripOrphanVariantsNotInTsx', () => {
  it('drops definition variants that have no matching TSX export', () => {
    const def = `
export const recommendationCardDefinition = {
  variants: [{ name: "Default" }, { name: "Teaser" }, { name: "Promo" }],
  content: { items: [] }
};
`;
    const tsx = `
export const Default = (props) => <div />;
`;
    const out = stripOrphanVariantsNotInTsx(def, tsx);
    assert.match(out, /name:\s*["']Default["']/);
    assert.doesNotMatch(out, /name:\s*["']Teaser["']/);
    assert.doesNotMatch(out, /name:\s*["']Promo["']/);
  });

  it('keeps variants that exist as export const in TSX', () => {
    const def = `
export const cardDefinition = {
  variants: [{ name: "Default" }, { name: "Teaser" }, { name: "Promo" }],
};
`;
    const tsx = `
export const Default = () => null;
export const Promo = () => null;
`;
    const out = stripOrphanVariantsNotInTsx(def, tsx);
    assert.match(out, /name:\s*["']Default["']/);
    assert.match(out, /name:\s*["']Promo["']/);
    assert.doesNotMatch(out, /name:\s*["']Teaser["']/);
  });

  it('no-ops when tsxSource is empty', () => {
    const def = `variants: [{ name: "Default" }, { name: "Teaser" }]`;
    assert.equal(stripOrphanVariantsNotInTsx(def, ''), def);
    assert.equal(stripOrphanVariantsNotInTsx(def, null), def);
  });

  it('normalizeDefinitionTs strips orphan Teaser when tsxSource is Default-only', () => {
    const def = `
export const recommendationCardDefinition = {
  kind: "component",
  definitionKey: "recommendation-card",
  name: "recommendation-card",
  displayName: "Recommendation Card",
  componentName: "RecommendationCard",
  icon: "Office/16x16/card.png",
  datasourceLocation: { scope: "site", root: "data", folder: ["Recommendation Cards"] },
  model: {
    folderTemplate: { name: "Recommendation Cards Folder" },
    itemTemplate: {
      name: "Recommendation Card",
      sections: [{
        name: "Data",
        fields: [
          { name: "Title", type: "Single-Line Text" },
          { name: "Image", type: "Image" },
          { name: "Rating", type: "Single-Line Text" },
          { name: "Link", type: "General Link" }
        ]
      }]
    }
  },
  variants: [{ name: "Default" }, { name: "Teaser" }],
  content: {
    culture: "nl-BE",
    cultures: ["nl-BE", "fr-BE"],
    location: { root: "data", folder: ["Recommendation Cards"] },
    items: [
      { name: "Ekomi", fields: { Title: "eKomi", Rating: "4.5", Link: { text: "x", url: "/r" } } }
    ]
  }
};
`;
    const tsx = `export const Default = (props) => <div>{props.fields?.Title?.value}</div>;`;
    const out = normalizeDefinitionTs(def, {
      definitionKey: 'recommendation-card',
      tsxSource: tsx,
    });
    assert.match(out, /name:\s*["']Default["']/);
    assert.doesNotMatch(out, /name:\s*["']Teaser["']/);
  });
});

describe('normalize pipelines include category card fixups', () => {
  it('normalizeDefinitionTs strips empty Description and adds variants', () => {
    const out = normalizeDefinitionTs(defWithEmptyDescription, {
      definitionKey: 'insurance-category-card',
    });
    assert.doesNotMatch(out, /name:\s*["']Description["']/);
    assert.match(out, /name:\s*["']Teaser["']/);
  });

  it('normalizeComponentTsx does not strip Description (AI must emit correctly)', () => {
    const src = `
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
interface Fields {
  Title: TextField;
  Description: TextField;
  Image: ImageField;
  Link: LinkField;
}
export const Default = (props) => {
  const { fields } = props;
  return (
    <article>
      <Link field={fields.Link}>
        <Text field={fields.Title} tag="span" />
        <Text field={fields.Description} tag="span" />
        <span className="mt-2" aria-hidden="true">↓</span>
      </Link>
    </article>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /fields\.Description/);
  });

  it('normalizeImageCategoryCardTsx helper still strips Description', () => {
    const src = `
interface Fields {
  Title: TextField;
  Description: TextField;
  Image: ImageField;
  Link: LinkField;
}
export const Default = (props) => (
  <Text field={fields.Description} tag="span" />
);
`;
    const out = normalizeImageCategoryCardTsx(src);
    assert.doesNotMatch(out, /fields\.Description/);
  });
});
