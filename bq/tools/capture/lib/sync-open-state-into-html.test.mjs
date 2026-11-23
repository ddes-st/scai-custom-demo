/**
 * Run: node --test tools/capture/lib/sync-open-state-into-html.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeOpenStateFingerprints,
  rewriteInteractionClasses,
  normalizeLabel,
} from './sync-open-state-into-html.mjs';

describe('normalizeLabel', () => {
  it('collapses whitespace and lowercases', () => {
    assert.equal(normalizeLabel('  Hexagon’s  digital  '), 'hexagon’s digital');
  });
});

describe('mergeOpenStateFingerprints', () => {
  const desktopSnap = {
    openLabels: ['hexagon’s digital transformation'],
    controls: [
      {
        id: null,
        label: 'hexagon’s digital transformation',
        open: true,
        interactionClasses: ['NavButtonActive'],
      },
      {
        id: 'media-slider-accordion-0',
        idUnique: true,
        label: 'how enmax transformed their digital experience',
        open: true,
        interactionClasses: ['AccordionItemActive'],
      },
      {
        id: 'media-slider-accordion-5',
        idUnique: true,
        label: 'hexagon’s digital transformation',
        open: false,
        interactionClasses: ['AccordionItemInactive', 'max-h-0'],
      },
    ],
    panels: [],
  };

  const tabletSnap = {
    openLabels: ['hexagon’s digital transformation'],
    controls: [
      {
        id: 'accordion-header-5',
        idUnique: true,
        label: 'hexagon’s digital transformation',
        open: true,
        ariaExpanded: 'true',
        interactionClasses: [],
      },
      {
        id: 'media-slider-accordion-5',
        idUnique: true,
        label: 'hexagon’s digital transformation',
        open: true,
        interactionClasses: ['AccordionItemActive'],
      },
      {
        id: 'media-slider-accordion-0',
        idUnique: true,
        label: 'how enmax transformed their digital experience',
        open: false,
        interactionClasses: ['AccordionItemInactive'],
      },
    ],
    panels: [],
  };

  it('with preferredOpenLabel keeps only that label open', () => {
    const merged = mergeOpenStateFingerprints(
      [desktopSnap, tabletSnap],
      "Hexagon’s digital transformation",
    );
    assert.deepEqual(merged.openLabels, ['hexagon’s digital transformation']);
    assert.ok(merged.openControlByLabel['hexagon’s digital transformation']);
  });

  it('without preferred unions visible open labels', () => {
    const merged = mergeOpenStateFingerprints([desktopSnap, tabletSnap]);
    assert.ok(merged.openLabels.includes('hexagon’s digital transformation'));
  });
});

describe('rewriteInteractionClasses', () => {
  const merged = {
    openLabels: ['hexagon’s digital transformation'],
    openControlByLabel: {
      'hexagon’s digital transformation': {
        interactionClasses: ['AccordionItemActive'],
      },
    },
    closedControlByLabel: {
      'how enmax transformed their digital experience': {
        interactionClasses: ['AccordionItemInactive'],
      },
    },
    openPanelByLabel: {},
    closedPanelByLabel: {},
  };

  it('applies Active class when opening', () => {
    const next = rewriteInteractionClasses(
      'AccordionItem AccordionItemInactive border-sc-neutral-200',
      true,
      merged,
      'hexagon’s digital transformation',
    );
    assert.match(next, /AccordionItemActive/);
    assert.doesNotMatch(next, /AccordionItemInactive/);
  });

  it('applies Inactive when closing', () => {
    const next = rewriteInteractionClasses(
      'AccordionItem AccordionItemActive border-sc-neutral-300',
      false,
      merged,
      'how enmax transformed their digital experience',
    );
    assert.match(next, /AccordionItemInactive/);
  });
});

describe('applyOpenStateFingerprintsToRoot', () => {
  it('opens matching accordion and closes siblings in a dual-chrome fixture', async () => {
    // Minimal DOM via dynamic import of linkedom is unavailable — use undici?
    // Skip if no document: use a tiny happy path with jsdom from playwright chromium evaluate.
    const { chromium } = await import('playwright').catch(() => ({ chromium: null }));
    if (!chromium) {
      return;
    }
    // Prefer system chrome channel if browsers not installed
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        channel: process.env.CAPTURE_CHANNEL || 'chrome',
      });
    } catch {
      return;
    }
    const page = await browser.newPage();
    const fixture = `
<section>
  <div class="lg:hidden">
    <div id="media-slider-accordion-0" class="AccordionItem AccordionItemActive">
      <button id="accordion-header-0" aria-expanded="true">How ENMAX transformed their digital experience</button>
      <div id="accordion-content-0" role="region" class="max-h-[500px] opacity-100" aria-hidden="false">
        <img alt="enmax" src="about:blank"/>
      </div>
    </div>
    <div id="media-slider-accordion-5" class="AccordionItem AccordionItemInactive">
      <button id="accordion-header-5" aria-expanded="false">Hexagon’s digital transformation</button>
      <div id="accordion-content-5" role="region" class="max-h-0 opacity-0" aria-hidden="true">
        <img alt="hexagon" src="about:blank"/>
      </div>
    </div>
  </div>
  <div class="hidden lg:flex">
    <button role="tab" aria-selected="true" aria-label="Hexagon’s digital transformation">Hexagon’s digital transformation</button>
  </div>
</section>`;

    const merged = mergeOpenStateFingerprints(
      [
        {
          openLabels: ['hexagon’s digital transformation'],
          controls: [
            {
              id: 'accordion-header-5',
              idUnique: true,
              label: 'hexagon’s digital transformation',
              open: true,
              interactionClasses: [],
            },
            {
              id: 'media-slider-accordion-5',
              idUnique: true,
              label: 'hexagon’s digital transformation',
              open: true,
              interactionClasses: ['AccordionItemActive'],
            },
            {
              id: 'media-slider-accordion-0',
              idUnique: true,
              label: 'how enmax transformed their digital experience',
              open: false,
              interactionClasses: ['AccordionItemInactive'],
            },
          ],
          panels: [],
        },
      ],
      "Hexagon’s digital transformation",
    );

    const { applyOpenStateFingerprintsWithPage } = await import(
      './sync-open-state-into-html.mjs'
    );
    const out = await applyOpenStateFingerprintsWithPage(page, fixture, merged);
    await browser.close();

    assert.match(out, /accordion-header-5[^>]*aria-expanded="true"/);
    assert.match(out, /accordion-header-0[^>]*aria-expanded="false"/);
    assert.match(out, /media-slider-accordion-5[^>]*AccordionItemActive/);
    assert.match(out, /accordion-content-5[^>]*max-h-\[500px\]/);
    assert.match(out, /accordion-content-0[^>]*max-h-0/);
  });
});
