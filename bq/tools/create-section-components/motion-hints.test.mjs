/**
 * Run: node --test tools/create-section-components/motion-hints.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractMotionHintsFromCapture,
  formatMotionBlockForPrompt,
  layoutMotionIsBandTicker,
  layoutMotionIsContinuousMarquee,
  layoutWantsEqualHeightChildren,
} from './motion-hints.mjs';

describe('layoutWantsEqualHeightChildren exemptions', () => {
  it('ignores equalHeightChildren on responsive-header + continuous-marquee', () => {
    assert.equal(
      layoutWantsEqualHeightChildren({
        layout: {
          pattern: 'responsive-header-with-mega-menu',
          equalHeightChildren: true,
          equalHeightEvidence:
            'Capture hints indicate stretch or equal-height treatment for peer header/menu items.',
          motion: { kind: 'continuous-marquee', loop: true },
        },
        enrichStructurePayload: { pageRole: 'partial-header' },
      }),
      false,
    );
  });

  it('still honors equalHeightChildren for card grids', () => {
    assert.equal(
      layoutWantsEqualHeightChildren({
        layout: {
          pattern: 'card-grid',
          equalHeightChildren: true,
          equalHeightEvidence: 'Peer cards share one row height',
        },
      }),
      true,
    );
  });
});

describe('motion-hints', () => {
  it('detects infinite CSS animation + marquee tokens', () => {
    const hints = extractMotionHintsFromCapture(
      '<div class="announcement-ticker"></div>',
      '.x { animation: announcementTicker 24s linear infinite; }',
    );
    assert.equal(hints.suggestsContinuousMarquee, true);
    assert.ok(hints.evidence.includes('css-infinite-animation'));
  });

  it('layoutMotionIsContinuousMarquee respects structured motion', () => {
    assert.equal(
      layoutMotionIsContinuousMarquee({
        layout: { motion: { kind: 'continuous-marquee', loop: true } },
      }),
      true,
    );
    assert.equal(
      layoutMotionIsContinuousMarquee({
        layout: { motion: { kind: 'none' } },
      }),
      false,
    );
  });

  it('layoutWantsEqualHeightChildren from flag or notes', () => {
    assert.equal(
      layoutWantsEqualHeightChildren({
        layout: { equalHeightChildren: true },
      }),
      true,
    );
    assert.equal(
      layoutWantsEqualHeightChildren({
        layout: { structureNotes: 'All cards share equal height in the track' },
      }),
      true,
    );
  });

  it('detects equal-height from flex basis slides without eh-grid', () => {
    const html = `
      <div class="flex overflow-x-auto">
        <div class="flex shrink-0 grow-0 basis-full px-2 md:basis-1/2 xl:basis-1/3">
          <a class="flex h-full flex-col">card</a>
        </div>
        <div class="flex shrink-0 grow-0 basis-full px-2 md:basis-1/2 xl:basis-1/3">
          <a class="flex h-full flex-col">card</a>
        </div>
      </div>
    `;
    const hints = extractMotionHintsFromCapture(html, '');
    assert.equal(hints.suggestsEqualHeightChildren, true);
    assert.ok(hints.evidence.includes('flex-basis-slides'));
  });

  it('layoutWantsEqualHeightChildren from carousel-card-list pattern', () => {
    assert.equal(
      layoutWantsEqualHeightChildren({
        layout: { pattern: 'carousel-card-list' },
      }),
      true,
    );
  });

  it('formatMotionBlockForPrompt emits HARD ContinuousMarquee line', () => {
    const block = formatMotionBlockForPrompt({
      layout: {
        motion: {
          kind: 'continuous-marquee',
          loop: true,
          clonesAreNotContent: true,
        },
        equalHeightChildren: true,
      },
    });
    assert.match(block, /ContinuousMarquee/);
    // continuous-marquee rails are exempt from equal-height card contract
    assert.doesNotMatch(block, /equalHeightChildren/);
  });

  it('formatMotionBlockForPrompt emits equalHeight HARD for card tracks', () => {
    const block = formatMotionBlockForPrompt({
      layout: {
        pattern: 'carousel-card-list',
        equalHeightChildren: true,
        equalHeightEvidence: 'peer cards share one row height',
        motion: { kind: 'none' },
      },
    });
    assert.match(block, /equalHeightChildren/);
  });

  it('detects band-ticker HTML cues and formats band-ticker HARD', () => {
    const hints = extractMotionHintsFromCapture(
      '<div class="w-full h-[34px] overflow-hidden whitespace-nowrap bg-[linear-gradient(90deg,#f00,#00f)]">Announce</div>',
      '',
    );
    assert.equal(hints.suggestsBandTicker, true);
    assert.ok(hints.evidence.includes('band-ticker-html'));

    const block = formatMotionBlockForPrompt({
      cmsName: 'AnnouncementBar',
      layout: {
        motion: {
          kind: 'continuous-marquee',
          surface: 'band-ticker',
          loop: true,
          clonesAreNotContent: true,
        },
      },
    });
    assert.equal(layoutMotionIsBandTicker({ layout: { motion: { surface: 'band-ticker', kind: 'continuous-marquee' } } }), true);
    assert.match(block, /band-ticker/);
    assert.match(block, /nowrap message/);
    assert.match(block, /center/i);
    assert.match(block, /overflow/i);
  });
});
