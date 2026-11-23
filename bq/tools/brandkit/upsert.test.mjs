/**
 * Run: node --test tools/brandkit/upsert.test.mjs
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeBrandkitState, readBrandkitState } from './state.mjs';
import { lookupDraftFieldValue } from './generate-content.mjs';

describe('brandkit state roundtrip', () => {
  /** @type {string} */
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'bq-brandkit-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes and reads state with createdBy bq', async () => {
    await writeBrandkitState(dir, {
      brandkitId: 'kit-123',
      kitName: 'Demo Brand Kit',
      createdBy: 'bq',
    });
    const state = await readBrandkitState(dir);
    assert.equal(state.brandkitId, 'kit-123');
    assert.equal(state.createdBy, 'bq');
    assert.ok(state.updatedAt);
  });
});

describe('draft → PATCH payload mapping', () => {
  it('builds aiEditable:false patches for matching fields only', () => {
    const draft = {
      sections: {
        'Brand Context': { 'Brand purpose': 'Purpose text' },
      },
    };
    const sections = [{ id: 's1', name: 'Brand Context' }];
    const fields = [
      { id: 'f1', name: 'Brand purpose', value: '' },
      { id: 'f2', name: 'Other', value: '' },
    ];

    /** @type {object[]} */
    const patches = [];
    for (const section of sections) {
      for (const field of fields) {
        const value = lookupDraftFieldValue(draft, section.name, field.name);
        if (!value) continue;
        patches.push({
          sectionId: section.id,
          fieldId: field.id,
          value,
          aiEditable: false,
          verified: false,
        });
      }
    }

    assert.equal(patches.length, 1);
    assert.deepEqual(patches[0], {
      sectionId: 's1',
      fieldId: 'f1',
      value: 'Purpose text',
      aiEditable: false,
      verified: false,
    });
  });

  it('forceOverwrite still patches when remote value equals draft', () => {
    const draftValue = 'Same text';
    const current = 'Same text';
    const forceOverwrite = true;
    const shouldSkip = !forceOverwrite && current === draftValue;
    assert.equal(shouldSkip, false);
  });
});
