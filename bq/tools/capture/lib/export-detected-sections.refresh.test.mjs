/**
 * Run: node --test tools/capture/lib/export-detected-sections.refresh.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { priorNeedsScreenshotRefresh } from './export-detected-sections.mjs';

describe('priorNeedsScreenshotRefresh', () => {
  const trio = (method) => ({
    mobile: { path: 'sections/section-01/section-01-mobile.png', method },
    tablet: { path: 'sections/section-01/section-01-tablet.png', method },
    desktop: { path: 'sections/section-01/section-01-desktop.png', method },
    desktopRegular: {
      path: 'sections/section-01/section-01-desktop-regular.png',
      method,
    },
    desktopLarge: {
      path: 'sections/section-01/section-01-desktop-large.png',
      method,
    },
  });

  it('refreshes all-png-crop priors', () => {
    assert.equal(
      priorNeedsScreenshotRefresh({ outputs: trio('png-crop') }),
      true,
    );
  });

  it('refreshes non-interactive live viewport-clip priors', () => {
    assert.equal(
      priorNeedsScreenshotRefresh({ outputs: trio('viewport-clip') }),
      true,
    );
  });

  it('keeps interactive live priors (states path)', () => {
    assert.equal(
      priorNeedsScreenshotRefresh({
        outputs: trio('viewport-clip'),
        interactionSummary: { hasMenu: true, menuStateCount: 1 },
      }),
      false,
    );
  });

  it('keeps section-html priors', () => {
    assert.equal(
      priorNeedsScreenshotRefresh({ outputs: trio('section-html') }),
      false,
    );
  });
});
