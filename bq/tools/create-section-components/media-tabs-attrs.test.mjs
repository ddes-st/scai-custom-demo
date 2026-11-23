/**
 * Dual media-tabs attribute vocabulary helpers.
 * Run: node --test tools/create-section-components/media-tabs-attrs.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MEDIA_TABS_LEGACY,
  MEDIA_TABS_PREFERRED,
  countJsxChildrenMounts,
  hasBuriedMediaTabsTabChrome,
  hasDuplicateChildrenMount,
  hasMediaTabTitleOnItemRoot,
  hasResolvableMediaTabLogo,
  mediaTabsAttrRe,
  mediaTabsSelector,
  preferredTitleAttrForSource,
} from './media-tabs-attrs.mjs';

describe('mediaTabsSelector', () => {
  it('covers preferred and legacy item attrs', () => {
    const sel = mediaTabsSelector('item');
    assert.match(sel, /data-media-tab-item/);
    assert.match(sel, /data-story-item/);
  });
});

describe('mediaTabsAttrRe', () => {
  it('matches either tab vocabulary', () => {
    assert.equal(mediaTabsAttrRe('tab').test('data-story-tab'), true);
    assert.equal(mediaTabsAttrRe('tab').test('data-media-tab-tab'), true);
    assert.equal(mediaTabsAttrRe('tab').test('data-story-panel'), false);
  });
});

describe('preferredTitleAttrForSource', () => {
  it('preserves legacy title family when item is data-story-item', () => {
    assert.equal(
      preferredTitleAttrForSource('<article data-story-item>'),
      MEDIA_TABS_LEGACY.title,
    );
  });

  it('prefers data-media-tab-title for preferred item or unknown', () => {
    assert.equal(
      preferredTitleAttrForSource('<article data-media-tab-item>'),
      MEDIA_TABS_PREFERRED.title,
    );
    assert.equal(
      preferredTitleAttrForSource('<article className="x">'),
      MEDIA_TABS_PREFERRED.title,
    );
  });
});

describe('hasBuriedMediaTabsTabChrome', () => {
  it('detects either vocabulary with hidden desktop chrome', () => {
    assert.equal(
      hasBuriedMediaTabsTabChrome(
        '<div data-story-tab className="hidden lg:flex" />',
      ),
      true,
    );
    assert.equal(
      hasBuriedMediaTabsTabChrome(
        '<div data-media-tab-tab className="hidden md:flex" />',
      ),
      true,
    );
    assert.equal(
      hasBuriedMediaTabsTabChrome(
        '<div data-story-tab className="sr-only" />',
      ),
      false,
    );
  });
});

describe('media-tabs mount + title contracts', () => {
  it('detects duplicate {children} mounts', () => {
    assert.equal(countJsxChildrenMounts('{children}'), 1);
    assert.equal(hasDuplicateChildrenMount('{children}{children}'), true);
    assert.equal(
      hasDuplicateChildrenMount(
        '<div className="lg:hidden">{children}</div><div className="hidden lg:block">{children}</div>',
      ),
      true,
    );
  });

  it('requires title attr on item root', () => {
    assert.equal(
      hasMediaTabTitleOnItemRoot(
        '<article data-media-tab-item data-media-tab-title={title}>',
      ),
      true,
    );
    assert.equal(
      hasMediaTabTitleOnItemRoot('<article data-media-tab-item>'),
      false,
    );
    assert.equal(
      hasResolvableMediaTabLogo(
        '<div data-media-tab-logo><img src="/x.png" /></div>',
      ),
      true,
    );
    assert.equal(
      hasResolvableMediaTabLogo('<div data-media-tab-logo />'),
      false,
    );
  });
});
