/**
 * --all --force: reuse registry folder after sharedBuiltThisRun; force only
 * bypasses disk/prior change detection on first encounter.
 * Run: node --test tools/create-section-components/shared-section-bridge.force-reuse.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeEnrichStructureFingerprint } from './enrich-structure-fingerprint.mjs';
import {
  canSkipViaSharedSection,
  isChromeRegistryFolder,
  pickCanonicalInstance,
  shouldPreserveChromeLocksUnderForce,
} from './shared-section-bridge.mjs';

function infoWithMatchingRegistryFingerprint(folder = 'consent-banner') {
  const info = {
    cmsName: 'CookieConsentBanner',
    track: 'overlay',
    layout: { pattern: 'overlay' },
    registrySection: {
      componentFolder: folder,
      componentName: 'SitecoreConsentBanner',
      definitionKey: 'sitecore-consent-banner',
    },
  };
  const { fingerprint, payload } = computeEnrichStructureFingerprint(info);
  info.registrySection.enrichStructureFingerprint = fingerprint;
  info.registrySection.enrichStructurePayload = payload;
  return info;
}

describe('canSkipViaSharedSection force + built-this-run', () => {
  it('force + sharedBuiltThisRun skips AI (once per registry key)', async () => {
    const folder = 'consent-banner';
    const info = infoWithMatchingRegistryFingerprint(folder);
    const built = {
      componentFolder: folder,
      componentName: 'SitecoreConsentBanner',
      definitionKey: 'sitecore-consent-banner',
      components: [],
    };
    const sharedBuiltThisRun = new Map([[folder, built]]);
    const result = await canSkipViaSharedSection({
      force: true,
      info,
      hostSlug: 'test-host-force-reuse',
      sharedBuiltThisRun,
    });
    assert.equal(result.skip, true);
    assert.match(result.reason, /built this run/);
    assert.equal(result.reuse, built);
  });

  it('force without sharedBuiltThisRun does not skip (ignores disk package path)', async () => {
    const info = infoWithMatchingRegistryFingerprint('consent-banner');
    const result = await canSkipViaSharedSection({
      force: true,
      info,
      hostSlug: 'test-host-force-reuse-missing',
      sharedBuiltThisRun: new Map(),
    });
    assert.equal(result.skip, false);
    assert.equal(result.reason, 'force');
  });

  it('without force + sharedBuiltThisRun still skips', async () => {
    const folder = 'consent-banner';
    const info = infoWithMatchingRegistryFingerprint(folder);
    const built = {
      componentFolder: folder,
      componentName: 'SitecoreConsentBanner',
      definitionKey: 'sitecore-consent-banner',
    };
    const result = await canSkipViaSharedSection({
      force: false,
      info,
      hostSlug: 'test-host-noforce-reuse',
      sharedBuiltThisRun: new Map([[folder, built]]),
    });
    assert.equal(result.skip, true);
    assert.match(result.reason, /built this run/);
  });
});

describe('chrome canonical + force reuse helpers', () => {
  it('isChromeRegistryFolder detects header/footer; force does not preserve locks', () => {
    assert.equal(isChromeRegistryFolder('header'), true);
    assert.equal(isChromeRegistryFolder('footer'), true);
    assert.equal(isChromeRegistryFolder('consent-banner'), false);
    assert.equal(
      shouldPreserveChromeLocksUnderForce({
        track: 'header',
        registrySection: { componentFolder: 'header' },
      }),
      false,
    );
  });

  it('force regenerates chrome when disk package exists (no sharedBuiltThisRun)', async () => {
    const info = infoWithMatchingRegistryFingerprint('header');
    info.track = 'header';
    info.registrySection.componentFolder = 'header';
    info.registrySection.componentName = 'MenzisNavigationHeader';
    info.registrySection.definitionKey = 'menzis-navigation-header';
    const { fingerprint, payload } = computeEnrichStructureFingerprint(info);
    info.registrySection.enrichStructureFingerprint = fingerprint;
    info.registrySection.enrichStructurePayload = payload;
    const result = await canSkipViaSharedSection({
      force: true,
      info,
      hostSlug: 'menzis-nl',
      sharedBuiltThisRun: new Map(),
    });
    assert.equal(result.skip, false);
    assert.equal(result.reason, 'force');
  });

  it('pickCanonicalInstance prefers home for chrome even when secondary has higher score', () => {
    const entry = {
      folderName: 'header',
      canonicalPageSlug: 'www-menzis-nl--zorgverzekering',
      canonicalRef: {
        pageSlug: 'www-menzis-nl--zorgverzekering',
        sectionFolder: 'section-02',
      },
    };
    const picked = pickCanonicalInstance(entry, [
      {
        pageSlug: 'www-menzis-nl--home',
        sectionFolder: 'section-02',
        extensionScore: 100,
      },
      {
        pageSlug: 'www-menzis-nl--zorgverzekering',
        sectionFolder: 'section-02',
        extensionScore: 9999,
      },
    ]);
    assert.equal(picked?.pageSlug, 'www-menzis-nl--home');
  });
});
