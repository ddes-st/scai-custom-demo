/**
 * Run: node --test tools/create-section-components/ai-codegen.sdk-version.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyContentSdkVersionToPrompt,
  CONTENT_SDK_VERSION_PLACEHOLDER,
  resolveContentSdkNextjsVersion,
} from './ai-codegen.mjs';
import { bqRoot } from '../capture/paths.mjs';

describe('resolveContentSdkNextjsVersion', () => {
  it('resolves a version from bq package / node_modules', async () => {
    const v = await resolveContentSdkNextjsVersion(bqRoot);
    assert.match(v, /^\d+\.\d+/);
    assert.notEqual(v, 'unknown');
  });
});

describe('applyContentSdkVersionToPrompt', () => {
  it('replaces the placeholder', () => {
    const src = `using (@sitecore-content-sdk/nextjs@${CONTENT_SDK_VERSION_PLACEHOLDER}).`;
    assert.equal(
      applyContentSdkVersionToPrompt(src, '2.4.0'),
      'using (@sitecore-content-sdk/nextjs@2.4.0).',
    );
  });
});
