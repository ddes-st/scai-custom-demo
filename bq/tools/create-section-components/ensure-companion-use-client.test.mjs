/**
 * Prompt-first must still force 'use client' on companion clientTsx.
 * Run: node --import tsx --test tools/create-section-components/ensure-companion-use-client.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureCompanionClientUseClient,
  normalizeClientTsx,
  setCodegenV2Fixups,
} from './ai-source-fixup.mjs';

describe('ensureCompanionClientUseClient / prompt-first', () => {
  it('prepends under prompt-first (mutating fixups off)', () => {
    setCodegenV2Fixups(false);
    const src = `export default function Chrome() {
  return null;
}
`;
    const out = normalizeClientTsx(src);
    assert.match(out, /^'use client';\s*\n/);
    assert.equal((out.match(/['"]use client['"]/g) || []).length, 1);
  });

  it('is idempotent when directive already present', () => {
    const src = `'use client';
export default function Chrome() { return null; }
`;
    assert.equal(
      (ensureCompanionClientUseClient(src).match(/['"]use client['"]/g) || [])
        .length,
      1,
    );
  });
});
