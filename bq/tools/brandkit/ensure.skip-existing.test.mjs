/**
 * Run: node --test tools/brandkit/ensure.skip-existing.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureBrandKitForHost,
  shouldSkipExistingBrandkit,
} from './ensure.mjs';

describe('shouldSkipExistingBrandkit', () => {
  it('skips when id present and force is false', () => {
    assert.equal(
      shouldSkipExistingBrandkit({ brandkitId: 'kit-1', force: false }),
      true,
    );
  });

  it('does not skip when force is true', () => {
    assert.equal(
      shouldSkipExistingBrandkit({ brandkitId: 'kit-1', force: true }),
      false,
    );
  });

  it('does not skip when no id', () => {
    assert.equal(shouldSkipExistingBrandkit({ brandkitId: null }), false);
    assert.equal(shouldSkipExistingBrandkit({ brandkitId: '' }), false);
    assert.equal(shouldSkipExistingBrandkit({}), false);
  });
});

describe('ensureBrandKitForHost skip-existing', () => {
  const baseOpts = {
    enabled: true,
    url: 'https://example.com/',
    hostProjectRoot: '/tmp/bq-brandkit-host',
    siteSystem: 'example-nl',
    siteDisplayName: 'Example',
  };

  it('returns skipped-existing and does not call logo/draft when kit exists without force', async () => {
    let logoCalls = 0;
    let draftCalls = 0;
    let resolveCalls = 0;

    const result = await ensureBrandKitForHost({
      ...baseOpts,
      force: false,
      deps: {
        createBrandkitApiContext: async () => ({
          ok: true,
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-brands-api',
          token: 'tok',
        }),
        resolveExistingBrandkitId: async () => {
          resolveCalls += 1;
          return {
            brandkitId: 'existing-kit',
            source: 'state',
            kit: { id: 'existing-kit', name: 'Example Brand Kit' },
          };
        },
        resolveBrandkitLogo: async () => {
          logoCalls += 1;
          return { logoUrl: 'https://example.com/logo.png' };
        },
        generateBrandkitDraft: async () => {
          draftCalls += 1;
          return { ok: true, draft: { sections: {} }, reused: false };
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'existing');
    assert.equal(result.action, 'skipped-existing');
    assert.equal(result.brandkitId, 'existing-kit');
    assert.equal(result.source, 'state');
    assert.equal(resolveCalls, 1);
    assert.equal(logoCalls, 0);
    assert.equal(draftCalls, 0);
  });

  it('does not take skip path when force is true', async () => {
    let draftCalls = 0;
    let logoCalls = 0;

    const result = await ensureBrandKitForHost({
      ...baseOpts,
      force: true,
      dryRun: true,
      pageDir: '/tmp/bq-brandkit-page',
      deps: {
        createBrandkitApiContext: async () => ({
          ok: true,
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-brands-api',
          token: 'tok',
        }),
        resolveExistingBrandkitId: async () => ({
          brandkitId: 'existing-kit',
          source: 'list-name',
          kit: { id: 'existing-kit', name: 'Example Brand Kit' },
        }),
        resolveBrandkitLogo: async () => {
          logoCalls += 1;
          return { logoUrl: null };
        },
        generateBrandkitDraft: async () => {
          draftCalls += 1;
          return {
            ok: true,
            draft: { sections: {} },
            reused: true,
            dryRun: true,
          };
        },
      },
    });

    assert.notEqual(result.action, 'skipped-existing');
    assert.equal(result.skipped, undefined);
    assert.equal(logoCalls, 1);
    assert.equal(draftCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.brandkitId, 'existing-kit');
  });

  it('dry-run with existing kit and no force still skips', async () => {
    let draftCalls = 0;
    const result = await ensureBrandKitForHost({
      ...baseOpts,
      force: false,
      dryRun: true,
      deps: {
        createBrandkitApiContext: async () => ({
          ok: true,
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-brands-api',
          token: 'tok',
        }),
        resolveExistingBrandkitId: async () => ({
          brandkitId: 'existing-kit',
          source: 'state',
          kit: { id: 'existing-kit' },
        }),
        generateBrandkitDraft: async () => {
          draftCalls += 1;
          return { ok: true, draft: {}, dryRun: true };
        },
      },
    });
    assert.equal(result.action, 'skipped-existing');
    assert.equal(draftCalls, 0);
  });
});
