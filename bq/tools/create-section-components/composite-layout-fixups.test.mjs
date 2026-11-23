/**
 * Run: node --test tools/create-section-components/composite-layout-fixups.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCarouselChromeStub,
  clientMatchesCarouselChromeMode,
  dedupeAppPlaceholderByName,
  ensureClientTrackHorizontalRow,
  ensureMobileNavToggleAttrs,
  ensureMobileNavToggleClickHandler,
  forbidSelfNestedAllowedControls,
  forceEmptyPlaceholdersForPlatformLinkLists,
  isPlatformLinkListDefinition,
  rewriteParentCopiedChildSeeds,
  stripDebugOutlineClasses,
  unwrapNestedTrackInsideCarouselChrome,
} from './composite-layout-fixups.mjs';
import {
  filterSelfNestedChildren,
  isSiteChromeDefinitionKey,
} from './presentation.mjs';

describe('dedupeAppPlaceholderByName', () => {
  it('keeps first mount of the same name', () => {
    const src = `
const ph = \`stories-\${id}\`;
<AppPlaceholder name={ph} rendering={r} page={p} componentMap={m} />
<div>
  <AppPlaceholder name={ph} rendering={r} page={p} componentMap={m} />
</div>
`;
    const out = dedupeAppPlaceholderByName(src);
    const count = (out.match(/<AppPlaceholder\b/g) || []).length;
    assert.equal(count, 1);
  });
});

describe('ensureClientTrackHorizontalRow', () => {
  it('wraps bare {children} in overflow-x track with flex row', () => {
    const src = `
export default function Chrome({ children }) {
  return (
    <div className="overflow-x-auto snap-x">
      {children}
    </div>
  );
}
`;
    const out = ensureClientTrackHorizontalRow(src);
    assert.match(out, /flex snap-x[\s\S]*\{children\}/);
  });
});

describe('ensureMobileNavToggleAttrs', () => {
  it('injects data attrs on hamburger button', () => {
    const src = `
<button type="button" className="lg:hidden" aria-label="Menu">
  <span className="h-0.5 w-6" />
  <span className="h-0.5 w-6" />
  <span className="h-0.5 w-6" />
</button>
<nav className="max-lg:hidden">links</nav>
`;
    const out = ensureMobileNavToggleAttrs(src);
    assert.match(out, /data-mobile-menu-toggle/);
    assert.match(out, /data-mobile-menu/);
  });

  it('leaves already-wired NavigationChrome unchanged', () => {
    const src = `
<button data-mobile-menu-toggle aria-expanded="false" className="lg:hidden">
  <span className="h-0.5" /><span className="h-0.5" /><span className="h-0.5" />
</button>
<nav data-mobile-menu>ok</nav>
`;
    const out = ensureMobileNavToggleAttrs(src);
    assert.equal(out, src);
  });
});

describe('ensureMobileNavToggleClickHandler', () => {
  it('injects click handler when attrs present without logic', () => {
    const src = `'use client';
import { useRef } from 'react';
export default function Chrome({ children }) {
  return <div data-mobile-menu-toggle>{children}</div>;
}
`;
    const out = ensureMobileNavToggleClickHandler(src);
    assert.match(out, /useEffect/);
    assert.match(out, /data-mobile-menu-toggle/);
    assert.match(out, /addEventListener\(\s*['"]click['"]/);
  });
});

describe('stripDebugOutlineClasses', () => {
  it('removes outline-indigo scaffolding', () => {
    const out = stripDebugOutlineClasses(
      'className="outline-2 outline-offset-2 outline-indigo-500 p-4"',
    );
    assert.doesNotMatch(out, /outline-indigo/);
  });
});

describe('unwrapNestedTrackInsideCarouselChrome', () => {
  it('unwraps snap wrapper around AppPlaceholder inside CarouselChrome', () => {
    const src = `
<CarouselChrome>
  <div className="flex snap-x overflow-x-auto">
    <AppPlaceholder name={ph} rendering={r} page={p} componentMap={m} />
  </div>
</CarouselChrome>
`;
    const out = unwrapNestedTrackInsideCarouselChrome(src);
    assert.match(out, /<CarouselChrome>[\s\S]*<AppPlaceholder\b/);
    assert.doesNotMatch(
      out,
      /<CarouselChrome>[\s\S]*snap-x[\s\S]*<AppPlaceholder\b/,
    );
  });
});

describe('buildCarouselChromeStub', () => {
  it('emits scrollBy arrows for arrows mode', () => {
    const stub = buildCarouselChromeStub('SitecoreFeatureCardCarousel', 'arrows');
    assert.match(stub, /scrollBy/);
    assert.match(stub, /Previous slide/);
    assert.equal(clientMatchesCarouselChromeMode(stub, 'arrows'), true);
    assert.equal(clientMatchesCarouselChromeMode(stub, 'auto'), false);
  });

  it('emits band ContinuousMarquee for auto + continuousMarquee + bandTicker', () => {
    const stub = buildCarouselChromeStub('SitecoreAnnouncementBar', 'auto', {
      continuousMarquee: true,
      bandTicker: true,
    });
    assert.match(stub, /ContinuousMarquee/);
    assert.match(stub, /variant="band"/);
    assert.match(stub, /Announcements/);
  });

  it('emits continuous marquee for auto + continuousMarquee', () => {
    const stub = buildCarouselChromeStub('SitecoreAwardsCarousel', 'auto', {
      continuousMarquee: true,
    });
    assert.match(stub, /ContinuousMarquee/);
    assert.match(stub, /components\/primitives\/continuous-marquee/);
    assert.doesNotMatch(stub, /Previous slide/);
    // Must not remount AppPlaceholder by rendering children twice.
    assert.equal((stub.match(/\{children\}/g) || []).length, 1);
    assert.equal(clientMatchesCarouselChromeMode(stub, 'auto'), true);
  });

  it('emits interval snap for auto without marquee', () => {
    const stub = buildCarouselChromeStub('SitecoreCardCarousel', 'auto', {
      continuousMarquee: false,
    });
    assert.match(stub, /setInterval/);
    assert.equal(clientMatchesCarouselChromeMode(stub, 'auto'), true);
  });
});

describe('forbidSelfNestedAllowedControls', () => {
  it('rewrites allowedControls self key to stripped child name', () => {
    const src = `
export const def = {
  definitionKey: "sitecore-feature-card-carousel",
  placeholders: [{ key: "cards", allowedControls: ["sitecore-feature-card-carousel"] }],
};
`;
    const out = forbidSelfNestedAllowedControls(src);
    assert.match(out, /allowedControls: \["sitecore-feature-card"\]/);
  });

  it('prefers explicit child definitionKey from plan', () => {
    const src = `
export const def = {
  definitionKey: "sitecore-card-grid",
  placeholders: [{ key: "cards", allowedControls: ["sitecore-card-grid"] }],
};
`;
    const out = forbidSelfNestedAllowedControls(src, {
      preferredChildDefinitionKey: 'sitecore-benefit-card',
    });
    assert.match(out, /allowedControls: \["sitecore-benefit-card"\]/);
  });

  it('clears placeholders on platform Link Lists self-reference (no fake child)', () => {
    const src = `
export const def = {
  definitionKey: "menzis-support-link-list",
  datasourceLocation: { scope: "site", root: "data", folder: ["Link Lists"] },
  placeholders: [
    { key: "support-health-content", allowedControls: ["menzis-support-link-card"] },
    { key: "support-link-items", allowedControls: ["menzis-support-link-list"] },
  ],
};
`;
    const out = forbidSelfNestedAllowedControls(src);
    assert.match(out, /placeholders:\s*\[\],?/);
    assert.doesNotMatch(out, /support-link-items/);
    assert.doesNotMatch(out, /menzis-support-link-list-item/);
  });
});

describe('forceEmptyPlaceholdersForPlatformLinkLists', () => {
  it('detects platform Link Lists folders', () => {
    assert.equal(
      isPlatformLinkListDefinition(`folder: ["Link Lists"]`),
      true,
    );
    assert.equal(
      isPlatformLinkListDefinition(`folder: ["Icon Link Lists"]`),
      true,
    );
    assert.equal(
      isPlatformLinkListDefinition(`folder: ["Cards"]`),
      false,
    );
  });

  it('clears non-empty placeholders on Link Lists definitions', () => {
    const src = `
export const def = {
  definitionKey: "menzis-support-link-list",
  datasourceLocation: { scope: "site", root: "data", folder: ["Link Lists"] },
  content: { location: { root: "data", folder: ["Link Lists"] } },
  placeholders: [
    { key: "support-link-items", allowedControls: ["menzis-support-link-list"] },
  ],
};
`;
    const out = forceEmptyPlaceholdersForPlatformLinkLists(src);
    assert.match(out, /placeholders:\s*\[\],?/);
    assert.doesNotMatch(out, /support-link-items/);
  });

  it('leaves non-list definitions alone', () => {
    const src = `
export const def = {
  definitionKey: "menzis-support-link-card",
  datasourceLocation: { folder: ["Support Link Cards"] },
  placeholders: [{ key: "support-link-items", allowedControls: ["menzis-support-link-list"] }],
};
`;
    const out = forceEmptyPlaceholdersForPlatformLinkLists(src);
    assert.equal(out, src);
  });
});

describe('rewriteParentCopiedChildSeeds', () => {
  it('rewrites duplicated Title matching parent Heading', () => {
    const src = `
Heading: "Customer stories",
items: [
  { name: "Acme", displayName: "Customer stories", fields: { Title: "Customer stories" } },
  { name: "Beta", displayName: "Customer stories", fields: { Title: "Customer stories" } },
]
`;
    const out = rewriteParentCopiedChildSeeds(src, { heading: 'Customer stories' });
    assert.match(out, /Title: "Acme"/);
    assert.match(out, /Title: "Beta"/);
  });
});

describe('isSiteChromeDefinitionKey nav', () => {
  it('treats site-navigation as chrome', () => {
    assert.equal(isSiteChromeDefinitionKey('sitecore-site-navigation'), true);
    assert.equal(isSiteChromeDefinitionKey('sitecore-technology-hero'), false);
  });
});

describe('filterSelfNestedChildren', () => {
  it('drops children equal to parent key', () => {
    const out = filterSelfNestedChildren('sitecore-card-grid', [
      { definitionKey: 'sitecore-card-grid', datasourceItem: 'A' },
      { definitionKey: 'sitecore-feature-tile', datasourceItem: 'B' },
    ]);
    assert.deepEqual(
      out.map((c) => c.definitionKey),
      ['sitecore-feature-tile'],
    );
  });
});
