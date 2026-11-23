/**
 * Layout hints + placeholder mode inference tests.
 * Run: node --test tools/create-section-components/layout-hints.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatLayoutHintsForPrompt,
  hasCarouselArrows,
  hasCarouselDots,
  inferCarouselChromeMode,
  inferPlaceholderLayoutMode,
  looksLikeCarouselByHtml,
  looksLikeCarouselByName,
  looksLikeMediaTabs,
  prefersContinuousMarquee,
} from './layout-hints.mjs';

describe('inferPlaceholderLayoutMode', () => {
  it('detects media-tabs for CustomerStorySlider / MediaSlider aliases', () => {
    assert.equal(
      inferPlaceholderLayoutMode({ cmsName: 'CustomerStorySlider' }, ''),
      'media-tabs',
    );
    const html = `
      <section data-component-name="MediaSlider" class="media-slider">
        <div role="tabpanel">video</div>
        <nav role="tablist"><button role="tab">Story</button></nav>
      </section>`;
    assert.equal(looksLikeMediaTabs({}, html), true);
    assert.equal(inferPlaceholderLayoutMode({ cmsName: 'MediaSlider' }, html), 'media-tabs');
  });

  it('detects media-tabs from structural tab+tabpanel + media cues (name-free)', () => {
    const html = `
      <section class="product-stories">
        <div role="tabpanel"><video src="/clip.mp4"></video></div>
        <nav role="tablist">
          <button role="tab">Acme</button>
          <button role="tab">Beta</button>
        </nav>
      </section>`;
    assert.equal(
      looksLikeMediaTabs(
        {
          purpose: 'customer stories with thumbnail left and side selectors',
        },
        html,
      ),
      true,
    );
    assert.equal(
      inferPlaceholderLayoutMode(
        { purpose: 'video left with side selectors that swap media' },
        html,
      ),
      'media-tabs',
    );
  });

  it('detects media-tabs from generic pattern name', () => {
    assert.equal(
      inferPlaceholderLayoutMode({ cmsName: 'TabbedMediaSwitcher' }, ''),
      'media-tabs',
    );
  });

  it('does not treat bare tablist as carousel dots', () => {
    const html = `<nav role="tablist"><button role="tab">A</button></nav>`;
    assert.equal(looksLikeCarouselByHtml(html), false);
  });

  it('detects carousel from swiper HTML', () => {
    const html = `
      <div class="swiper" data-component="swiper">
        <div class="imgcard">a</div>
        <div class="imgcard">b</div>
      </div>`;
    assert.equal(inferPlaceholderLayoutMode({}, html), 'carousel');
  });

  it('detects carousel from cmsName even without HTML', () => {
    assert.equal(
      inferPlaceholderLayoutMode({ cmsName: 'CapabilityCarousel' }, ''),
      'carousel',
    );
  });

  it('detects carousel from aria + prev/next controls', () => {
    const html = `
      <section aria-roledescription="carousel">
        <button aria-label="Previous slide"></button>
        <div class="carousel-item">a</div>
        <div class="carousel-item">b</div>
        <button aria-label="Next slide"></button>
        <div class="swiper-pagination"></div>
      </section>`;
    assert.equal(looksLikeCarouselByHtml(html), true);
    assert.equal(inferPlaceholderLayoutMode({}, html), 'carousel');
  });

  it('detects metric from purpose text', () => {
    assert.equal(
      inferPlaceholderLayoutMode({ purpose: 'Trust metrics strip with KPIs' }, ''),
      'metric',
    );
  });

  it('defaults to auto when unknown', () => {
    assert.equal(inferPlaceholderLayoutMode({ purpose: 'Hero banner' }, '<div/>'), 'auto');
  });
});

describe('looksLikeCarouselByName', () => {
  it('matches Slider / Swiper aliases', () => {
    assert.equal(looksLikeCarouselByName({ cmsName: 'EventCardSlider' }), true);
    assert.equal(looksLikeCarouselByName({ name: 'HeroBanner' }), false);
  });
});

describe('inferCarouselChromeMode', () => {
  it('returns none for non-carousel sections', () => {
    assert.equal(
      inferCarouselChromeMode({ purpose: 'Hero banner' }, '<div/>'),
      'none',
    );
  });

  it('returns arrows when prev/next controls exist', () => {
    const html = `
      <section aria-roledescription="carousel">
        <button class="TilesCarouselArrow" aria-label="Previous slide"></button>
        <div class="carousel-item">a</div>
        <div class="carousel-item">b</div>
        <button class="TilesCarouselArrow" aria-label="Next slide"></button>
      </section>`;
    assert.equal(hasCarouselArrows(html), true);
    assert.equal(hasCarouselDots(html), false);
    assert.equal(
      inferCarouselChromeMode({ cmsName: 'CapabilityCarousel' }, html),
      'arrows',
    );
  });

  it('returns arrows from interactionNotes when HTML lacks controls', () => {
    assert.equal(
      inferCarouselChromeMode(
        {
          cmsName: 'ResourceCarousel',
          layout: {
            interactionNotes:
              'Previous Slide and Next Slide buttons navigate the carousel.',
          },
        },
        '<section><div class="card">a</div><div class="card">b</div></section>',
      ),
      'arrows',
    );
  });

  it('returns auto when carousel has neither arrows nor dots', () => {
    const html = `
      <section aria-roledescription="carousel" style="transform: translate3d(0,0,0)">
        <img alt="badge 1" />
        <img alt="badge 2" />
      </section>`;
    assert.equal(hasCarouselArrows(html), false);
    assert.equal(hasCarouselDots(html), false);
    assert.equal(
      inferCarouselChromeMode(
        {
          cmsName: 'RecognitionCarousel',
          layout: {
            pattern: 'horizontal-logo-carousel',
            interactionNotes:
              'The track is continuously or programmatically translated; no visible controls.',
          },
        },
        html,
      ),
      'auto',
    );
    assert.equal(
      prefersContinuousMarquee({
        layout: { pattern: 'horizontal-logo-carousel' },
      }),
      true,
    );
  });

  it('returns dots when pagination bullets exist', () => {
    const html = `
      <div class="swiper">
        <button aria-label="Previous"></button>
        <div class="swiper-slide">a</div>
        <div class="swiper-pagination"><span class="swiper-pagination-bullet"></span></div>
      </div>`;
    assert.equal(hasCarouselDots(html), true);
    assert.equal(inferCarouselChromeMode({ cmsName: 'HeroCarousel' }, html), 'dots');
  });
});

describe('formatLayoutHintsForPrompt', () => {
  it('includes viewport contract bands', () => {
    const text = formatLayoutHintsForPrompt({ purpose: 'x' }, '<div/>');
    assert.match(text, /Desktop Small ≥1024/);
    assert.match(text, /Tablet: 768 ≤ width ≤ 1023/);
    assert.match(text, /Mobile: width < 768/);
    assert.match(text, /layoutMode:/);
  });

  it('includes carousel hard contract when mode is carousel', () => {
    const text = formatLayoutHintsForPrompt(
      { cmsName: 'RecognitionBadgeCarousel' },
      '',
    );
    assert.match(text, /CAROUSEL HARD CONTRACT/);
    assert.match(text, /vertical stack/i);
    assert.match(text, /clientTsx/);
  });

  it('includes auto-scroll contract for logo carousel without controls', () => {
    const text = formatLayoutHintsForPrompt(
      {
        cmsName: 'RecognitionCarousel',
        layout: {
          pattern: 'horizontal-logo-carousel',
          interactionNotes: 'continuously translated; no visible controls',
        },
      },
      '<section aria-roledescription="carousel"><img alt="a"/><img alt="b"/></section>',
    );
    assert.match(text, /carouselChromeMode=auto/);
    assert.match(text, /continuous marquee/i);
    assert.match(text, /ContinuousMarquee/);
    assert.match(text, /components\/primitives\/continuous-marquee/);
  });

  it('includes arrows contract when crop shows prev/next', () => {
    const html = `
      <section>
        <button aria-label="Previous slide"></button>
        <div class="carousel-item">a</div>
        <button aria-label="Next slide"></button>
      </section>`;
    const text = formatLayoutHintsForPrompt(
      { cmsName: 'CapabilityCarousel' },
      html,
    );
    assert.match(text, /carouselChromeMode=arrows/);
    assert.match(text, /scrollBy prev\/next/);
  });

  it('includes tabbed media switcher hard contract (pattern-first)', () => {
    const text = formatLayoutHintsForPrompt({ cmsName: 'CustomerStorySlider' }, '');
    assert.match(text, /TABBED MEDIA SWITCHER HARD CONTRACT/);
    assert.match(text, /FORBIDDEN on CHILD/);
    assert.match(text, /data-media-tab-title/);
    assert.match(text, /legacy data-story-\* equivalents accepted/i);
    assert.doesNotMatch(text, /=== MEDIA-TABS HARD CONTRACT/);
    // Product names may appear as aliases, not as the hard-contract title definition
    assert.doesNotMatch(
      text,
      /TABBED media switcher \(CustomerStorySlider \/ MediaSlider\)/i,
    );
    assert.doesNotMatch(text, /CAROUSEL HARD CONTRACT/);
  });

  it('includes stacked-footer hard contract + structure notes', () => {
    const text = formatLayoutHintsForPrompt(
      {
        layout: {
          pattern: 'stacked-footer',
          structureNotes: 'signposts then five nav columns then social then legal',
        },
        purpose: 'footer with signposts navigation social legal',
      },
      '<div data-component-name="LegalFooter"></div>',
    );
    assert.match(text, /STACKED-FOOTER HARD CONTRACT/);
    assert.match(text, /STRUCTURE NOTES HARD CONTRACT/);
    assert.match(text, /footer-signposts/);
    assert.match(text, /never a single footer-content dump/i);
  });

  it('serializes composition objects with JSON.stringify', () => {
    const text = formatLayoutHintsForPrompt(
      { purpose: 'x', composition: { strategy: 'single' } },
      '<div/>',
    );
    assert.match(text, /composition: \{"strategy":"single"\}/);
    assert.doesNotMatch(text, /\[object Object\]/);
  });

  it('emits CHROME KIND header for track:header', () => {
    const text = formatLayoutHintsForPrompt(
      {
        track: 'header',
        chromeKind: 'header-stack',
        isOverlay: false,
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            stickyTopPx: 0,
            pinnedEdge: 'top',
            hidesOnScrollDown: false,
          },
        },
      },
      '<div/>',
    );
    assert.match(text, /CHROME KIND \(hard\): track=header/);
    assert.match(text, /not a float overlay/);
  });

  it('emits STICKY PUBLISH when hidesOnScrollDown', () => {
    const text = formatLayoutHintsForPrompt(
      {
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            stickyTopPx: 0,
            pinnedEdge: 'top',
            hidesOnScrollDown: true,
            hideAfterScrollYPx: 2475,
            hideAfterViewports: 2.75,
            showsOnScrollUp: true,
          },
        },
      },
      '<div/>',
    );
    assert.match(text, /HIDE-ON-SCROLL \(hard\)/);
    assert.match(text, /STICKY PUBLISH \(hard\)/);
    assert.match(text, /useStickyChromeLayer/);
  });

  it('emits CTA MASK ARROW when capture CSS has cta-arrow mask', () => {
    const text = formatLayoutHintsForPrompt(
      { layout: { pattern: 'hero' } },
      '<a class="cta">Request a demo</a>',
      '.cta::after { content: ""; width: 22px; height: 22px; background-color: currentcolor; mask-image: url("https://example.com/static/cta-arrow.svg"); }',
    );
    assert.match(text, /CTA MASK ARROW \(HARD\)/);
    assert.match(text, /sc-cta-after-arrow/);
  });

  it('emits CTA MASK ARROW for pill rounded-full button HTML with trailing arrow', () => {
    const text = formatLayoutHintsForPrompt(
      { layout: { pattern: 'stacked-footer' }, cmsName: 'SiteFooter' },
      '<a class="rounded-full px-5 py-2 cta">Request a demo →</a>',
      '',
    );
    assert.match(text, /CTA MASK ARROW \(HARD\)/);
    assert.match(text, /sc-cta-after-arrow/);
    assert.match(text, /pill/i);
  });

  it('does not emit CTA MASK ARROW for pill button without arrow cue', () => {
    const text = formatLayoutHintsForPrompt(
      { layout: { pattern: 'hero' } },
      '<a class="rounded-full px-5 py-2 btn">Get started</a>',
      '',
    );
    assert.doesNotMatch(text, /CTA MASK ARROW \(HARD\)/);
  });

  it('emits STICKY INSET when stickyTopPx > 0 or precedingMayCollapse', () => {
    const text = formatLayoutHintsForPrompt(
      {
        scrollBehavior: {
          desktop: {
            cssPosition: 'fixed',
            sticky: true,
            stickyTopPx: 34,
            pinnedEdge: 'top',
            hidesOnScrollDown: false,
          },
        },
        chromeStack: {
          desktop: {
            edge: 'top',
            restingInsetPx: 34,
            precedingMayCollapse: true,
            precedingSlots: ['section-02'],
            stackIndex: 1,
            stackSize: 2,
          },
        },
      },
      '<div/>',
    );
    assert.match(text, /STICKY INSET \(hard\)/);
    assert.match(text, /useStickyChromeInset/);
    assert.match(text, /stickyTopPx=34/);
    assert.match(text, /chromeStack:/);
  });
});
