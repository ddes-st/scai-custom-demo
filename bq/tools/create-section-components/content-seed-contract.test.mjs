import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectBandScopedHeadingOwnershipDiagnostics,
  collectEnglishItemNameAndCultureDiagnostics,
  collectLinkSeedContractDiagnostics,
  collectRequiredLinkCtaSeeds,
  collectTitleSeedContractDiagnostics,
  detectBandScopedFeatureHeading,
  formatHeadingOwnershipForPrompt,
  formatRequiredLinkCtaSeedsForPrompt,
  formatRequiredTitleSeedsForPrompt,
} from './content-seed-contract.mjs';
import { normalizeDefinitionTs } from './ai-source-fixup.mjs';

const sampleInfo = {
  heading: 'Customer stories',
  repeats: [
    {
      name: 'stories',
      value: [
        {
          title: 'Travel Money Group',
          links: [{ text: 'Watch story', url: 'https://example.com/tmg' }],
        },
        {
          name: 'BOK Financial',
          link: { text: 'Read more', url: 'https://example.com/bok' },
        },
        { title: 'Sympli', cta: { text: 'Learn', url: 'https://example.com/sympli' } },
      ],
    },
  ],
  suggestedFields: [
    {
      name: 'conversionActions',
      value: [{ text: 'All customers', url: 'https://example.com/all' }],
    },
  ],
};

const proximityInfo = {
  heading: 'Dichtbij en betrokken',
  repeats: [
    {
      name: 'navigationItems',
      value: [
        { title: 'Zichtrekeningen' },
        { title: 'Spaarrekeningen' },
      ],
    },
  ],
  suggestedFields: [
    { name: 'proximityTitle', type: 'text', value: 'Dichtbij en betrokken' },
    {
      name: 'proximityText',
      type: 'richText',
      value: '<p>Bij Crelan geloven we…</p>',
    },
    {
      name: 'proximityImage',
      type: 'image',
      value: { src: 'https://example.com/map.png', alt: 'map' },
    },
    {
      name: 'proximityCta',
      type: 'link',
      value: { text: 'Vind uw kantoor', url: 'https://example.com/office' },
    },
  ],
};

describe('formatRequiredTitleSeedsForPrompt', () => {
  it('lists exact capture titles and forbids copying heading', () => {
    const block = formatRequiredTitleSeedsForPrompt(sampleInfo, { role: 'child' });
    assert.match(block, /REQUIRED TITLE \/ displayName SEEDS \(3\)/);
    assert.match(block, /"Travel Money Group"/);
    assert.match(block, /"BOK Financial"/);
    assert.match(block, /"Sympli"/);
    assert.match(block, /Customer stories/);
    assert.match(block, /NEVER copy onto child Title/);
  });

  it('returns empty when no repeats titles', () => {
    assert.equal(formatRequiredTitleSeedsForPrompt({ heading: 'X' }), '');
  });

  it('points at HEADING OWNERSHIP when proximityTitle is band-scoped', () => {
    const block = formatRequiredTitleSeedsForPrompt(proximityInfo, {
      role: 'parent',
    });
    assert.match(block, /proximityTitle/);
    assert.match(block, /HEADING OWNERSHIP/);
    assert.match(block, /feature-band Heading is owned by the child/);
  });
});

describe('detectBandScopedFeatureHeading / formatHeadingOwnershipForPrompt', () => {
  it('detects proximityTitle as band-scoped', () => {
    const hit = detectBandScopedFeatureHeading(proximityInfo);
    assert.ok(hit);
    assert.equal(hit.fieldName, 'proximityTitle');
    assert.equal(hit.ownerHint, 'ProximityFeature');
    assert.equal(hit.value, 'Dichtbij en betrokken');
  });

  it('instructs parent not to seed feature heading as chrome', () => {
    const block = formatHeadingOwnershipForPrompt(proximityInfo, {
      role: 'parent',
    });
    assert.match(block, /HEADING OWNERSHIP/);
    assert.match(block, /proximityTitle/);
    assert.match(block, /ProximityFeature/);
    assert.match(block, /must NOT seed or render Heading/);
    assert.match(block, /nested feature-split/);
  });

  it('keeps classic chrome ownership when no band-scoped title', () => {
    const block = formatHeadingOwnershipForPrompt(sampleInfo, { role: 'parent' });
    assert.match(block, /parent Heading only/);
    assert.match(block, /Customer stories/);
    assert.doesNotMatch(block, /proximityTitle/);
  });

  it('keeps heroTitle on parent when plan children are promo cards only', () => {
    const heroInfo = {
      heading: 'Welkom bij Crelan',
      suggestedFields: [
        { name: 'heroTitle', type: 'text', value: 'Welkom bij Crelan' },
        {
          name: 'heroImage',
          type: 'image',
          value: { src: 'https://cdn.example.com/maureen.jpg', alt: 'Hero' },
        },
      ],
      repeats: [
        {
          name: 'promotionalCards',
          value: [{ title: 'Apple Pay' }, { title: 'Word klant' }],
        },
      ],
    };
    const plan = {
      mode: 'composite',
      children: [
        {
          componentName: 'CrelanPromotionalCard',
          definitionKey: 'crelan-promotional-card',
        },
      ],
    };
    assert.equal(
      detectBandScopedFeatureHeading(heroInfo, { plan }),
      null,
    );
    const block = formatHeadingOwnershipForPrompt(heroInfo, {
      role: 'parent',
      plan,
    });
    assert.match(block, /PARENT chrome/);
    assert.match(block, /heroTitle/);
    assert.doesNotMatch(block, /You are the CHILD package \(HeroFeature\)/);
    assert.doesNotMatch(block, /leave feature-band Heading/);
  });

  it('still hands proximityTitle to ProximityFeature when plan has that child', () => {
    const plan = {
      mode: 'composite',
      children: [
        {
          componentName: 'CrelanProximityFeature',
          definitionKey: 'crelan-proximity-feature',
        },
        {
          componentName: 'CrelanNavigationCard',
          definitionKey: 'crelan-navigation-card',
        },
      ],
    };
    const hit = detectBandScopedFeatureHeading(proximityInfo, { plan });
    assert.ok(hit);
    assert.equal(hit.ownerHint, 'ProximityFeature');
    const block = formatHeadingOwnershipForPrompt(proximityInfo, {
      role: 'parent',
      plan,
    });
    assert.match(block, /ProximityFeature/);
    assert.match(block, /leave feature-band Heading/);
  });
});

describe('collectBandScopedHeadingOwnershipDiagnostics', () => {
  it('flags parent Heading seed that matches proximityTitle', () => {
    const diags = collectBandScopedHeadingOwnershipDiagnostics({
      role: 'parent',
      sectionInfo: proximityInfo,
      definitionTs: `
        content: {
          items: [{ name: "Nav", fields: { Heading: "Dichtbij en betrokken" } }],
        }
      `,
    });
    assert.ok(diags.some((d) => /proximityTitle/i.test(d)));
    assert.ok(diags.some((d) => /ProximityFeature/i.test(d)));
  });

  it('passes when parent has no Heading seed', () => {
    const diags = collectBandScopedHeadingOwnershipDiagnostics({
      role: 'parent',
      sectionInfo: proximityInfo,
      definitionTs: `content: { items: [{ name: "Nav", fields: {} }] }`,
    });
    assert.equal(diags.length, 0);
  });
});

describe('formatRequiredLinkCtaSeedsForPrompt', () => {
  it('lists per-item links and conversion CTAs', () => {
    const links = collectRequiredLinkCtaSeeds(sampleInfo);
    assert.ok(links.length >= 4);
    const block = formatRequiredLinkCtaSeedsForPrompt(sampleInfo);
    assert.match(block, /REQUIRED LINK \/ CTA SEEDS/);
    assert.match(block, /Watch story/);
    assert.match(block, /All customers/);
  });
});

describe('collectTitleSeedContractDiagnostics', () => {
  it('flags Titles collapsed to section heading', () => {
    const def = `
content: {
  items: [
    { name: "A", displayName: "Customer stories", fields: { Title: "Customer stories" } },
    { name: "B", displayName: "Customer stories", fields: { Title: "Customer stories" } },
    { name: "C", displayName: "Customer stories", fields: { Title: "Customer stories" } },
  ],
}
`;
    const diags = collectTitleSeedContractDiagnostics({
      definitionTs: def,
      sectionInfo: sampleInfo,
      role: 'child',
    });
    assert.ok(diags.some((d) => /collapsed|copied from section Heading/i.test(d)));
  });

  it('passes when Titles match capture', () => {
    const def = `
content: {
  items: [
    { name: "Travel Money Group", fields: { Title: "Travel Money Group" } },
    { name: "BOK Financial", fields: { Title: "BOK Financial" } },
    { name: "Sympli", fields: { Title: "Sympli" } },
  ],
}
`;
    const diags = collectTitleSeedContractDiagnostics({
      definitionTs: def,
      sectionInfo: sampleInfo,
      role: 'child',
    });
    assert.equal(diags.length, 0);
  });
});

describe('allowSeedSalvage gating', () => {
  it('skips Title inject unless allowSeedSalvage is explicitly true', () => {
    const src = `
export const d = {
  model: {
    itemTemplate: {
      name: "Story Card",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
    },
  },
  content: {
    items: [
      { name: "Card One", displayName: "Customer stories", fields: { Title: "Customer stories" } },
      { name: "Card Two", displayName: "Customer stories", fields: { Title: "Customer stories" } },
      { name: "Card Three", displayName: "Customer stories", fields: { Title: "Customer stories" } },
    ],
  },
  placeholders: [],
};
`;
    const salvaged = normalizeDefinitionTs(src, {
      sectionInfo: sampleInfo,
      allowSeedSalvage: true,
      skipParseAssert: true,
    });
    const clean = normalizeDefinitionTs(src, {
      sectionInfo: sampleInfo,
      skipParseAssert: true,
    });
    // Default is detect/validate path — no salvage rewrite.
    assert.match(salvaged, /Title: "Travel Money Group"/);
    assert.match(clean, /Title: "Customer stories"/);
    assert.doesNotMatch(clean, /Title: "Travel Money Group"/);
  });
});

describe('collectLinkSeedContractDiagnostics', () => {
  it('flags text-only, empty, and slash placeholder Link seeds', () => {
    const diags = collectLinkSeedContractDiagnostics({
      definitionTs: `
        Link: { text: "Jobs" },
        CTA: { text: "Go", url: "" },
        Link: { text: "Home", url: "/" },
      `,
    });
    assert.ok(diags.some((d) => /text but no url/.test(d)));
    assert.ok(diags.some((d) => /empty url/.test(d)));
    assert.ok(diags.some((d) => /placeholder url: "\/"/.test(d)));
  });
});

describe('collectEnglishItemNameAndCultureDiagnostics', () => {
  it('flags Dutch content item names', () => {
    const diags = collectEnglishItemNameAndCultureDiagnostics({
      definitionTs: `
        content: {
          culture: "nl-BE",
          items: [
            { name: "Ons aanbod", fields: { Title: "Ons aanbod" } },
            { name: "Contacteer ons", fields: { Title: "Contacteer ons" } },
          ],
        }
      `,
    });
    assert.ok(diags.some((d) => /English Title Case/i.test(d)));
  });

  it('flags culture en when seeds look Dutch', () => {
    const diags = collectEnglishItemNameAndCultureDiagnostics({
      definitionTs: `
        content: {
          culture: "en",
          items: [
            { name: "Our Offer", fields: { Title: "Ons aanbod" } },
          ],
        }
      `,
    });
    assert.ok(diags.some((d) => /content\.culture is "en"/i.test(d)));
  });

  it('passes English names with nl-BE culture', () => {
    const diags = collectEnglishItemNameAndCultureDiagnostics({
      definitionTs: `
        content: {
          culture: "nl-BE",
          items: [
            { name: "Our Offer", fields: { Title: "Ons aanbod" } },
            { name: "Contact Us", fields: { Title: "Contacteer ons" } },
          ],
        }
      `,
    });
    assert.equal(diags.length, 0);
  });

  it('flags apostrophe / invalid Sitecore item names', () => {
    const diags = collectEnglishItemNameAndCultureDiagnostics({
      definitionTs: `
        content: {
          culture: "nl-BE",
          items: [
            { name: "Thema's", fields: { Heading: "Thema's" } },
          ],
        }
      `,
    });
    assert.ok(diags.some((d) => /valid Sitecore item name/i.test(d)));
  });
});
