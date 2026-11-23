import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertHtmlImagesInTsx,
  assertLogoRailChildHasImage,
  findChildSeedsOfParentOwnedImages,
  isCompositeChromeOnlyImageRole,
  isFooterTextOnlyImageBand,
  isLogoLikeImage,
  isLogoRailChildContext,
  isPlatformTextLinkListsFolder,
  appendImageCoverageRevisionHints,
  formatRequiredImageSeedsForPrompt,
  scopeImageInventoryForRole,
  hasParentChromeImageFields,
  collectRepeatCardImageUrls,
  dedupeImageHitsByAsset,
  imageAssetDedupeKey,
} from './html-image-coverage.mjs';

// Library unit tests only — pipeline no longer invokes assertHtmlImagesInTsx
// (see write-component / tsx-contract-diagnostics / visual-fidelity).
describe('assertHtmlImagesInTsx', () => {
  const logoHtml = `
<section>
  <img src="https://cdn.example.com/brand/logo.svg" alt="Acme Logo" class="site-logo" />
  <h1>Welcome</h1>
</section>`;

  it('fails when logo img is only rendered as Text', () => {
    const tsx = `
import { Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
interface Fields { Title: TextField }
export const Default = (props) => <Text field={props.fields.Title} />;
`;
    const out = assertHtmlImagesInTsx({
      sectionHtml: logoHtml,
      tsx,
      definitionTs: 'placeholders: [], content: { items: [] }',
      componentName: 'TestHero',
    });
    assert.equal(out.ok, false);
    assert.ok(out.uncovered.some((u) => u.logoLike));
    assert.ok(out.revisionHints.length > 0);
    assert.match(out.revisionHints[0], /Image/);
  });

  it('passes when logo is Image field with matching seed URL', () => {
    const tsx = `
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';
interface Fields { Logo: ImageField }
export const Default = (props) => <Image field={props.fields.Logo} />;
`;
    const def = `
export const d = {
  model: { itemTemplate: { sections: [{ fields: [{ name: "Logo", type: "Image" }] }] } },
  content: { items: [{ name: "A", fields: { Logo: { url: "https://cdn.example.com/brand/logo.svg", alt: "Acme Logo" } } }] },
  placeholders: [],
};
`;
    const out = assertHtmlImagesInTsx({
      sectionHtml: logoHtml,
      tsx,
      definitionTs: def,
      componentName: 'TestHero',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('isLogoLikeImage detects path heuristics', () => {
    assert.equal(
      isLogoLikeImage({ url: 'https://x.com/assets/wordmark.png', alt: '' }),
      true,
    );
    assert.equal(
      isLogoLikeImage({ url: 'https://x.com/photos/hero.jpg', alt: 'Beach' }),
      false,
    );
  });

  it('skips logo coverage for platform text Link Lists folders', () => {
    assert.equal(
      isPlatformTextLinkListsFolder(
        `datasourceLocation: { folder: ["Link Lists"] }`,
      ),
      true,
    );
    assert.equal(
      isPlatformTextLinkListsFolder(
        `datasourceLocation: { folder: ["Image Link Lists"] }`,
      ),
      false,
    );
    const out = assertHtmlImagesInTsx({
      sectionHtml: logoHtml,
      tsx: `export const Default = () => <div />;`,
      definitionTs: `
export const d = {
  datasourceLocation: { folder: ["Link Lists"] },
  model: { itemTemplate: { sections: [{ fields: [{ name: "Title", type: "Single-Line Text" }] }] } },
};
`,
      componentName: 'SitecoreFooterNavigationGroup',
      role: 'child',
      planMode: 'composite',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('appendImageCoverageRevisionHints dedupes', () => {
    const out = appendImageCoverageRevisionHints(['a'], ['a', 'b']);
    assert.deepEqual(out, ['a', 'b']);
  });

  it('fails when child seeds parent hero URL instead of card paint-owner URL', () => {
    const heroUrl =
      'https://cdn.example.com/media/Maureen-Chloe-part-hero.jpg';
    const cardUrl = 'https://cdn.example.com/media/Apple%20pay.png';
    const inv = {
      desktop: [
        { url: heroUrl, alt: 'Hero faces' },
        { url: cardUrl, alt: 'Apple Pay promotional' },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const tsx = `
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';
interface Fields { Image: ImageField }
export const Default = (props) => <Image field={props.fields.Image} />;
`;
    const def = `
export const d = {
  model: { itemTemplate: { sections: [{ fields: [{ name: "Image", type: "Image" }] }] } },
  content: { items: [{ name: "Card", fields: { Image: { url: "${heroUrl}", alt: "Hero" } } }] },
  placeholders: [],
};
`;
    const out = assertHtmlImagesInTsx({
      imageInventory: inv,
      tsx,
      definitionTs: def,
      componentName: 'Apple-Pay-Promotional-Card',
      role: 'child',
      planMode: 'single',
      plan: { mode: 'composite', section: { componentName: 'CrelanHero' } },
      parentDefinitionTs: `
content: { items: [{ fields: { Image: { url: "${heroUrl}", alt: "Hero" } } }] }
`,
    });
    assert.equal(out.ok, false);
    assert.ok(
      out.revisionHints.some((h) => /parent hero|paint-owner/i.test(h)),
      `expected parent-owned seed hint, got: ${out.revisionHints.join(' | ')}`,
    );
  });

  it('passes when child seeds its own card URL', () => {
    const heroUrl =
      'https://cdn.example.com/media/Maureen-Chloe-part-hero.jpg';
    const cardUrl = 'https://cdn.example.com/media/Apple%20pay.png';
    const inv = {
      desktop: [
        { url: heroUrl, alt: 'Hero faces' },
        { url: cardUrl, alt: 'Apple Pay promotional' },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const tsx = `
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';
interface Fields { Image: ImageField }
export const Default = (props) => <Image field={props.fields.Image} />;
`;
    const def = `
export const d = {
  model: { itemTemplate: { sections: [{ fields: [{ name: "Image", type: "Image" }] }] } },
  content: { items: [{ name: "Card", fields: { Image: { url: "${cardUrl}", alt: "Apple Pay" } } }] },
  placeholders: [],
};
`;
    const out = assertHtmlImagesInTsx({
      imageInventory: inv,
      tsx,
      definitionTs: def,
      componentName: 'Apple-Pay-Promotional-Card',
      role: 'child',
      planMode: 'single',
      plan: { mode: 'composite', section: { componentName: 'CrelanHero' } },
      parentDefinitionTs: `
content: { items: [{ fields: { Image: { url: "${heroUrl}", alt: "Hero" } } }] }
`,
    });
    assert.equal(out.ok, true, out.revisionHints.join(' | '));
    assert.equal(out.uncovered.length, 0);
  });
});

describe('findChildSeedsOfParentOwnedImages', () => {
  it('flags child seed that matches parent definition only', () => {
    const offenders = findChildSeedsOfParentOwnedImages({
      role: 'child',
      seedUrls: ['https://cdn.example.com/hero.jpg'],
      childHitUrls: ['https://cdn.example.com/card.png'],
      parentDefinitionTs:
        'Image: { url: "https://cdn.example.com/hero.jpg", alt: "H" }',
    });
    assert.deepEqual(offenders, ['https://cdn.example.com/hero.jpg']);
  });

  it('ignores seeds that are in the child inventory', () => {
    const offenders = findChildSeedsOfParentOwnedImages({
      role: 'child',
      seedUrls: ['https://cdn.example.com/card.png'],
      childHitUrls: ['https://cdn.example.com/card.png'],
      parentOwnedUrls: ['https://cdn.example.com/hero.jpg'],
    });
    assert.deepEqual(offenders, []);
  });
});

describe('assertLogoRailChildHasImage', () => {
  it('detects logo-rail child context from cmsName / pattern', () => {
    assert.equal(
      isLogoRailChildContext({
        role: 'child',
        sectionInfo: { cmsName: 'AwardsLogoCarousel' },
      }),
      true,
    );
    assert.equal(
      isLogoRailChildContext({
        role: 'child',
        sectionInfo: { layout: { pattern: 'infinite-logo-carousel' } },
      }),
      true,
    );
    assert.equal(
      isLogoRailChildContext({
        role: 'section',
        sectionInfo: { cmsName: 'AwardsLogoCarousel' },
      }),
      false,
    );
  });

  it('fails text-only capability card as logo-rail child', () => {
    const tsx = `
interface Fields { Category: TextField; Title: TextField; Description: TextField }
export const Default = (props) => (
  <article><Text field={props.fields.Title} /></article>
);
`;
    const out = assertLogoRailChildHasImage({
      role: 'child',
      sectionInfo: { cmsName: 'AwardsLogoCarousel' },
      parentComponentName: 'SitecoreAwardsLogoCarousel',
      tsx,
      definitionTs: 'fields: [{ name: "Title", type: "Single-Line Text" }]',
      componentName: 'SitecoreRecognitionBadge',
    });
    assert.equal(out.ok, false);
    assert.match(out.revisionHints[0], /Image-first/);
  });

  it('passes Image-first badge child', () => {
    const tsx = `
interface Fields { Logo: ImageField }
export const Default = (props) => <Image field={props.fields.Logo} />;
`;
    const out = assertLogoRailChildHasImage({
      role: 'child',
      sectionInfo: { layout: { pattern: 'infinite-logo-carousel' } },
      tsx,
      definitionTs: '{ name: "Logo", type: "Image" }',
      componentName: 'SitecoreRecognitionBadge',
    });
    assert.equal(out.ok, true);
  });
});

describe('formatRequiredImageSeedsForPrompt', () => {
  it('formatRequiredImageSeedsForPrompt lists URLs when inventory has hits', () => {
    assert.equal(formatRequiredImageSeedsForPrompt(null), '');
    const block = formatRequiredImageSeedsForPrompt({
      desktop: [{ url: 'https://cdn.example.com/a.png', alt: 'A' }],
      tablet: [],
      mobile: [{ url: 'https://cdn.example.com/b.png', alt: 'B' }],
      other: [],
    });
    assert.match(block, /REQUIRED IMAGE SEEDS \(2\)/);
    assert.match(block, /https:\/\/cdn\.example\.com\/a\.png/);
    assert.match(block, /never Text-only/);
    assert.match(block, /count for this role must match REQUIRED IMAGE SEEDS \(2\)/);
  });

  it('formatRequiredImageSeedsForPrompt lists every URL by default (no truncate)', () => {
    const desktop = Array.from({ length: 25 }, (_, i) => ({
      url: `https://cdn.example.com/img-${i}.png`,
      alt: `I${i}`,
    }));
    const block = formatRequiredImageSeedsForPrompt({
      desktop,
      tablet: [],
      mobile: [],
      other: [],
    });
    assert.match(block, /REQUIRED IMAGE SEEDS \(25\)/);
    assert.match(block, /25\. https:\/\/cdn\.example\.com\/img-24\.png/);
    assert.doesNotMatch(block, /and \d+ more/);
  });

  it('formatRequiredImageSeedsForPrompt respects explicit maxUrls cap', () => {
    const desktop = Array.from({ length: 5 }, (_, i) => ({
      url: `https://cdn.example.com/c-${i}.png`,
      alt: `C${i}`,
    }));
    const block = formatRequiredImageSeedsForPrompt(
      { desktop, tablet: [], mobile: [], other: [] },
      { maxUrls: 2 },
    );
    assert.match(block, /REQUIRED IMAGE SEEDS \(5\)/);
    assert.match(block, /and 3 more/);
    assert.doesNotMatch(block, /c-4\.png/);
  });

  it('composite parent gets REQUIRED IMAGE SEEDS (0) chrome-only message', () => {
    const inv = {
      desktop: [
        { url: 'https://cdn.example.com/card-1.png', alt: 'C1' },
        { url: 'https://cdn.example.com/logo.svg', alt: 'Logo' },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    assert.equal(
      isCompositeChromeOnlyImageRole({ role: 'section', planMode: 'composite' }),
      true,
    );
    const block = formatRequiredImageSeedsForPrompt(inv, {
      role: 'section',
      planMode: 'composite',
    });
    assert.match(block, /REQUIRED IMAGE SEEDS \(0\)/);
    assert.match(block, /CHILD packages/);
    assert.doesNotMatch(block, /card-1\.png/);
  });

  it('image-hero composite with heroImage is not chrome-only; parent seeds Maureen only', () => {
    const maureen =
      'https://www.crelan.be/sites/default/files/styles/header_homepage/public/2026-06/Maureen-Chloe-part-hero.jpg.webp?itok=0Q_jxNQB';
    const maureenMobile =
      'https://www.crelan.be/sites/default/files/styles/marketing_banner_400/public/2026-06/Maureen-Chloe-part-hero.jpg?itok=WPT7PKYz';
    const apple =
      'https://www.crelan.be/sites/default/files/styles/hero_card_lg/public/2026-06/Apple%20pay.png.webp?itok=13MfUmr8';
    const sectionInfo = {
      layout: { pattern: 'full-width-image-hero-with-overlapping-card-row' },
      suggestedFields: [
        {
          name: 'heroImage',
          type: 'image',
          value: { src: maureen, alt: 'Maureen' },
        },
      ],
      repeats: [
        {
          name: 'promotionalCards',
          value: [
            { title: 'Apple', image: { src: apple, alt: 'Apple Pay' } },
            { title: 'Word klant', image: null },
          ],
        },
      ],
    };
    assert.equal(hasParentChromeImageFields(sectionInfo), true);
    assert.equal(
      isCompositeChromeOnlyImageRole({
        role: 'section',
        planMode: 'composite',
        sectionInfo,
      }),
      false,
    );
    const inv = {
      desktop: [
        { url: maureen, alt: 'Maureen', evidence: 'suggestedFields:heroImage' },
        { url: maureenMobile, alt: 'Maureen', evidence: 'html' },
        { url: apple, alt: 'Apple', evidence: 'html' },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const parentBlock = formatRequiredImageSeedsForPrompt(inv, {
      role: 'section',
      planMode: 'composite',
      plan: { mode: 'composite' },
      sectionInfo,
    });
    assert.match(parentBlock, /REQUIRED IMAGE SEEDS \(1\)/);
    assert.match(parentBlock, /Maureen-Chloe-part-hero/);
    assert.doesNotMatch(parentBlock, /Apple%20pay|Apple pay/i);

    const childBlock = formatRequiredImageSeedsForPrompt(inv, {
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      sectionInfo,
      componentName: 'CrelanPromotionalCard',
      placeholder: 'promotional-cards',
    });
    assert.match(childBlock, /REQUIRED IMAGE SEEDS \(1\)/);
    assert.match(childBlock, /Apple%20pay|Apple pay/i);
    assert.doesNotMatch(childBlock, /Maureen-Chloe-part-hero/);
    assert.match(childBlock, /OPTIONAL IMAGE ROWS/);
    assert.match(childBlock, /image is null/);
  });

  it('dedupeImageHitsByAsset collapses responsive variants', () => {
    const hits = dedupeImageHitsByAsset([
      {
        url: 'https://cdn.example.com/styles/a/public/Hero.jpg.webp',
        alt: 'H',
        evidence: 'html',
      },
      {
        url: 'https://cdn.example.com/styles/b/public/Hero.jpg',
        alt: 'H',
        evidence: 'suggestedFields:heroImage',
      },
    ]);
    assert.equal(hits.length, 1);
    assert.equal(imageAssetDedupeKey(hits[0].url), 'hero');
  });

  it('collectRepeatCardImageUrls skips null image rows', () => {
    const { urls, hasNullImageRow } = collectRepeatCardImageUrls({
      repeats: [
        {
          value: [
            { image: { src: 'https://cdn.example.com/a.png' } },
            { image: null },
          ],
        },
      ],
    });
    assert.equal(urls.length, 1);
    assert.equal(hasNullImageRow, true);
  });
});

describe('role-scoped assertHtmlImagesInTsx', () => {
  const cardInv = {
    desktop: Array.from({ length: 8 }, (_, i) => ({
      url: `https://cdn.example.com/card-${i}.png`,
      alt: `Card ${i}`,
    })),
    tablet: [],
    mobile: [],
    other: [],
  };

  const parentTsx = `
import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => (
  <section>
    <Text field={props.fields.Heading} />
    <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={map} />
  </section>
);
`;

  it('composite parent does not fail for child card URLs (ResourceCarousel-style)', () => {
    const out = assertHtmlImagesInTsx({
      imageInventory: cardInv,
      tsx: parentTsx,
      definitionTs: 'placeholders: [{ key: "cards" }], content: { items: [] }',
      componentName: 'SitecoreResourceCarousel',
      role: 'section',
      planMode: 'composite',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('logo-rail parent does not fail for badge URLs (TrustBadgeCarousel-style)', () => {
    const badgeInv = {
      desktop: Array.from({ length: 15 }, (_, i) => ({
        url: `https://cdn.example.com/badge-${i}.svg`,
        alt: `Badge ${i} logo`,
      })),
      tablet: [],
      mobile: [],
      other: [],
    };
    const out = assertHtmlImagesInTsx({
      imageInventory: badgeInv,
      tsx: parentTsx,
      definitionTs: 'placeholders: [{ key: "badges" }]',
      componentName: 'SitecoreTrustBadgeCarousel',
      role: 'section',
      planMode: 'composite',
      sectionInfo: { layout: { pattern: 'infinite-logo-carousel' } },
    });
    assert.equal(out.ok, true);
  });

  it('child still fails when card images missing', () => {
    const out = assertHtmlImagesInTsx({
      imageInventory: cardInv,
      tsx: `
interface Fields { Title: TextField }
export const Default = (props) => <Text field={props.fields.Title} />;
`,
      definitionTs: 'content: { items: [{ name: "A", fields: { Title: "X" } }] }',
      componentName: 'SitecoreResourceCard',
      role: 'child',
      planMode: 'composite',
    });
    assert.equal(out.ok, false);
    assert.ok(out.uncovered.length > 0);
  });

  it('footer-style child drops sibling brandLogo when own Icons are seeded', () => {
    const footerInv = {
      desktop: [
        {
          url: 'https://cdn.example.com/signpost-icon-a.png',
          alt: 'use case icon',
        },
        {
          url: 'https://cdn.example.com/signpost-icon-b.png',
          alt: 'webinar icon',
        },
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const out = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `
interface Fields { Icon: ImageField; Title: TextField }
export const Default = (props) => (
  <article>
    <Image field={props.fields.Icon} />
    <Text field={props.fields.Title} />
  </article>
);
`,
      definitionTs: `
content: {
  items: [
    { name: "A", fields: { Icon: { url: "https://cdn.example.com/signpost-icon-a.png", alt: "a" }, Title: "A" } },
    { name: "B", fields: { Icon: { url: "https://cdn.example.com/signpost-icon-b.png", alt: "b" }, Title: "B" } },
  ],
}
`,
      componentName: 'SitecoreFooterSignpost',
      role: 'child',
      planMode: 'composite',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('footer signpost child does not fail on sibling corporate logo alone', () => {
    const footerInv = {
      desktop: [
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const out = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `
interface Fields { Title: TextField }
export const Default = (props) => <Text field={props.fields.Title} />;
`,
      definitionTs: 'content: { items: [{ name: "A", fields: { Title: "X" } }] }',
      componentName: 'SitecoreFooterSignpost',
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      placeholder: 'footer-signposts',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('FooterNavigationGroup does not demand corporate logo from full inventory', () => {
    const footerInv = {
      desktop: [
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
        {
          url: 'https://cdn.example.com/social/linkedin.svg',
          alt: 'LinkedIn',
        },
        {
          url: 'https://cdn.example.com/signpost-icon-a.png',
          alt: 'use case icon',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    assert.equal(
      isFooterTextOnlyImageBand({
        componentName: 'SitecoreFooterNavigationGroup',
        placeholder: 'footer-navigation',
      }),
      true,
    );
    const scoped = scopeImageInventoryForRole(footerInv, {
      role: 'child',
      plan: { mode: 'composite' },
      componentName: 'SitecoreFooterNavigationGroup',
      placeholder: 'footer-navigation',
    });
    assert.equal(
      scoped.desktop.length +
        scoped.tablet.length +
        scoped.mobile.length +
        scoped.other.length,
      0,
    );
    const out = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `export const Default = () => <div />;`,
      definitionTs: `
export const d = {
  datasourceLocation: { folder: ["Link Lists"] },
  model: { itemTemplate: { sections: [{ fields: [{ name: "Title", type: "Single-Line Text" }] }] } },
};
`,
      componentName: 'SitecoreFooterNavigationGroup',
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      placeholder: 'footer-navigation',
    });
    assert.equal(out.ok, true);
    assert.equal(out.uncovered.length, 0);
  });

  it('FooterNavigationGroup empty-filter does not fall back without placeholder (name hint)', () => {
    const footerInv = {
      desktop: [
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const out = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `export const Default = () => <div />;`,
      definitionTs: 'content: { items: [{ name: "Platform", fields: { Title: "Platform" } }] }',
      componentName: 'SitecoreFooterNavigationGroup',
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
    });
    assert.equal(out.ok, true);
  });

  it('social Image Link List requires social glyphs but not corporate logo', () => {
    const footerInv = {
      desktop: [
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
        {
          url: 'https://cdn.example.com/social/linkedin.svg',
          alt: 'LinkedIn',
        },
        {
          url: 'https://cdn.example.com/social/facebook.svg',
          alt: 'Facebook',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const scoped = scopeImageInventoryForRole(footerInv, {
      role: 'child',
      plan: { mode: 'composite' },
      componentName: 'SitecoreFooterBrandingSocial',
      placeholder: 'footer-social',
    });
    const urls = scoped.desktop.map((h) => h.url);
    assert.ok(urls.some((u) => /linkedin/.test(u)));
    assert.ok(urls.some((u) => /facebook/.test(u)));
    assert.ok(!urls.some((u) => /corporate-logo/.test(u)));

    const missSocial = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `export const Default = () => <div />;`,
      definitionTs: `
datasourceLocation: { folder: ["Image Link Lists"] },
model: { itemTemplate: { sections: [{ fields: [{ name: "Title", type: "Single-Line Text" }] }] } },
content: { items: [{ name: "Social", fields: { Title: "Social" }, children: [] }] },
`,
      componentName: 'SitecoreFooterBrandingSocial',
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      placeholder: 'footer-social',
    });
    assert.equal(missSocial.ok, false);
    assert.ok(missSocial.uncovered.every((u) => !/corporate-logo/.test(u.url)));
    assert.ok(missSocial.uncovered.some((u) => /linkedin|facebook/.test(u.url)));

    const okSocial = assertHtmlImagesInTsx({
      imageInventory: footerInv,
      tsx: `
import { Image } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => <Image field={props.fields.Image} />;
`,
      definitionTs: `
datasourceLocation: { folder: ["Image Link Lists"] },
content: {
  items: [{
    name: "Social",
    fields: { Title: "Social" },
    children: [
      { name: "LinkedIn", fields: { Image: { url: "https://cdn.example.com/social/linkedin.svg", alt: "LinkedIn" } } },
      { name: "Facebook", fields: { Image: { url: "https://cdn.example.com/social/facebook.svg", alt: "Facebook" } } },
    ],
  }],
},
`,
      componentName: 'SitecoreFooterBrandingSocial',
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      placeholder: 'footer-social',
    });
    assert.equal(okSocial.ok, true);
  });

  it('formatRequiredImageSeedsForPrompt footer-navigation is zero without definitionTs', () => {
    const inv = {
      desktop: [
        {
          url: 'https://cdn.example.com/sitecore-corporate-logo.svg',
          alt: 'Sitecore Corporate Logo',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const block = formatRequiredImageSeedsForPrompt(inv, {
      role: 'child',
      planMode: 'composite',
      plan: { mode: 'composite' },
      componentName: 'SitecoreFooterNavigationGroup',
      placeholder: 'footer-navigation',
    });
    assert.match(block, /REQUIRED IMAGE SEEDS \(0\)/);
    assert.match(block, /do not add Logo\/Image/i);
    assert.doesNotMatch(block, /corporate-logo/);
  });

  it('header Navigation child does not demand corporate logo from full inventory', () => {
    const inv = {
      desktop: [
        {
          url: 'https://cdn.example.com/brand/corporate-logo.svg',
          alt: 'Brand',
          evidence: 'logo',
        },
        {
          url: 'https://cdn.example.com/teaser/promo-card.jpg',
          alt: 'Promo',
          evidence: 'teaser',
        },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const missLogo = assertHtmlImagesInTsx({
      imageInventory: inv,
      sectionInfo: {
        layout: { pattern: 'responsive-header-with-mega-menu' },
      },
      role: 'child',
      // Leaf children are planMode=single under a composite parent plan.
      planMode: 'single',
      plan: { mode: 'composite' },
      componentName: 'CrelanNavigationMenuItem',
      placeholder: 'header-navigation',
      tsx: `export const Default = () => <Image field={fields['Teaser Image']} />;`,
      definitionTs: `fields: [{ name: 'Teaser Image', type: 'Image' }], content: { 'Teaser Image': { url: 'https://cdn.example.com/teaser/promo-card.jpg', alt: 'Promo' } }`,
    });
    assert.equal(missLogo.ok, true, JSON.stringify(missLogo.uncovered));
    assert.ok(
      !missLogo.uncovered.some((u) => /corporate-logo/.test(u.url)),
    );
  });

  it('logo-rail child still requires every badge URL', () => {
    const badgeInv = {
      desktop: [
        { url: 'https://cdn.example.com/badge-0.svg', alt: 'Badge 0 logo' },
        { url: 'https://cdn.example.com/badge-1.svg', alt: 'Badge 1 logo' },
      ],
      tablet: [],
      mobile: [],
      other: [],
    };
    const out = assertHtmlImagesInTsx({
      imageInventory: badgeInv,
      tsx: `
interface Fields { Image: ImageField }
export const Default = (props) => <Image field={props.fields.Image} />;
`,
      definitionTs: `
content: { items: [{ name: "A", fields: { Image: { url: "https://cdn.example.com/badge-0.svg", alt: "0" } } }] }
`,
      componentName: 'SitecoreRecognitionBadge',
      role: 'child',
      planMode: 'composite',
      sectionInfo: { layout: { pattern: 'infinite-logo-carousel' } },
    });
    assert.equal(out.ok, false);
    assert.ok(out.uncovered.some((u) => /badge-1/.test(u.url)));
  });
});
