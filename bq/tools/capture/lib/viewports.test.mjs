/**
 * Run: node --test tools/capture/lib/viewports.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SCREENSHOT_DEVICES,
  SCREENSHOT_DEVICES,
  normalizeDeviceKey,
  parseScreenshotViewportEnv,
  resolveEvidenceViewportOrder,
  resolveScreenshotDevices,
} from './viewports.mjs';

describe('normalizeDeviceKey', () => {
  it('accepts canonical keys and kebab aliases', () => {
    assert.equal(normalizeDeviceKey('mobile'), 'mobile');
    assert.equal(normalizeDeviceKey('desktopRegular'), 'desktopRegular');
    assert.equal(normalizeDeviceKey('desktop-regular'), 'desktopRegular');
    assert.equal(normalizeDeviceKey('desktop_large'), 'desktopLarge');
    assert.equal(normalizeDeviceKey('DESKTOPLARGE'), 'desktopLarge');
    assert.equal(normalizeDeviceKey('nope'), null);
  });
});

describe('parseScreenshotViewportEnv', () => {
  it('returns empty for unset/blank', () => {
    assert.deepEqual(parseScreenshotViewportEnv(undefined), []);
    assert.deepEqual(parseScreenshotViewportEnv(''), []);
    assert.deepEqual(parseScreenshotViewportEnv('  '), []);
  });

  it('splits on comma/whitespace, normalizes, dedupes', () => {
    assert.deepEqual(
      parseScreenshotViewportEnv('mobile, tablet desktop-regular,mobile'),
      ['mobile', 'tablet', 'desktopRegular'],
    );
  });

  it('drops unknown tokens', () => {
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      assert.deepEqual(parseScreenshotViewportEnv('mobile,foo,tablet'), [
        'mobile',
        'tablet',
      ]);
      assert.ok(warns.some((w) => /unknown viewport "foo"/.test(w)));
    } finally {
      console.warn = orig;
    }
  });
});

describe('resolveScreenshotDevices', () => {
  it('falls back to mobile/tablet/desktop when unset or empty', () => {
    assert.deepEqual(
      resolveScreenshotDevices({ env: {} }),
      DEFAULT_SCREENSHOT_DEVICES,
    );
    assert.deepEqual(
      resolveScreenshotDevices({ env: { BQ_SCREENSHOT_VIEWPORTS: '' } }),
      DEFAULT_SCREENSHOT_DEVICES,
    );
    assert.deepEqual(
      resolveScreenshotDevices({ env: { BQ_SCREENSHOT_VIEWPORTS: '  ' } }),
      DEFAULT_SCREENSHOT_DEVICES,
    );
  });

  it('falls back when all tokens invalid', () => {
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      assert.deepEqual(
        resolveScreenshotDevices({ env: { BQ_SCREENSHOT_VIEWPORTS: 'nope,nah' } }),
        DEFAULT_SCREENSHOT_DEVICES,
      );
      assert.ok(warns.some((w) => /unknown viewport/.test(w)));
    } finally {
      console.warn = orig;
    }
  });

  it('returns catalog order for explicit allowlist', () => {
    assert.deepEqual(
      resolveScreenshotDevices({
        env: {
          BQ_SCREENSHOT_VIEWPORTS:
            'desktopLarge,mobile,tablet,desktop,desktopRegular',
        },
      }),
      SCREENSHOT_DEVICES,
    );
  });

  it('filters to subset in catalog order', () => {
    assert.deepEqual(
      resolveScreenshotDevices({
        env: { BQ_SCREENSHOT_VIEWPORTS: 'desktop-large, mobile' },
      }),
      ['mobile', 'desktopLarge'],
    );
  });
});

describe('resolveEvidenceViewportOrder', () => {
  it('desktop-first among default three', () => {
    assert.deepEqual(resolveEvidenceViewportOrder({ env: {} }), [
      'desktop',
      'tablet',
      'mobile',
    ]);
  });

  it('desktop-first among all five when listed', () => {
    assert.deepEqual(
      resolveEvidenceViewportOrder({
        env: {
          BQ_SCREENSHOT_VIEWPORTS:
            'mobile,tablet,desktop,desktopRegular,desktopLarge',
        },
      }),
      [
        'desktop',
        'desktopRegular',
        'desktopLarge',
        'tablet',
        'mobile',
      ],
    );
  });
});
