/**
 * Per-field soft-fail: one bad seed omits that field; item YAML still writes.
 * Soft-fail detail is verbose-only (BQ_CREATE_LOG=verbose).
 *
 * Run: node --import tsx --test tools/shared/site-content-items.soft-fail-field.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { applySiteContentItemTree } from './site-content-items.ts';
import {
  beginApplyInventorySession,
  clearApplyInventorySession,
  endApplyInventorySession,
} from './apply-inventory.ts';
import { setActiveApplyDefinitionKey } from './apply-context.ts';

const TITLE_ID = '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}';
const BG_ID = '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}';
const DESC_ID = '{cccccccc-cccc-cccc-cccc-cccccccccccc}';
const TPL = '{dddddddd-dddd-dddd-dddd-dddddddddddd}';
const FOLDER = '{eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee}';

describe('applySiteContentItemTree per-field soft-fail', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-soft-fail-'));
  const defKey = `soft-fail-field-${Date.now()}`;
  /** @type {string | undefined} */
  let prevCreateLog;

  before(() => {
    prevCreateLog = process.env.BQ_CREATE_LOG;
    setActiveApplyDefinitionKey(defKey);
    beginApplyInventorySession(defKey);
  });

  after(() => {
    endApplyInventorySession('test-hash');
    clearApplyInventorySession();
    setActiveApplyDefinitionKey(null);
    if (prevCreateLog === undefined) delete process.env.BQ_CREATE_LOG;
    else process.env.BQ_CREATE_LOG = prevCreateLog;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function emitSparseCard() {
    await applySiteContentItemTree({
      items: [
        {
          name: 'Sparse Card',
          fields: {
            Title: 'Kept title',
            // Image field with non-image object → resolve throws (no network).
            'Background Image': /** @type {any} */ ({ unexpected: true }),
            // Text field with non-coercible object → resolve throws.
            Description: /** @type {any} */ ({ bad: true }),
          },
        },
      ],
      handle: 'test-handle',
      label: 'test-soft-fail',
      parentId: FOLDER,
      parentSitecorePath: '/sitecore/content/demo/Data/Cards',
      diskDir: tmp,
      itemTemplateId: TPL,
      fields: [
        {
          name: 'Title',
          type: 'Single-Line Text',
          id: TITLE_ID,
          sectionName: 'Data',
        },
        {
          name: 'Background Image',
          type: 'Image',
          id: BG_ID,
          sectionName: 'Data',
        },
        {
          name: 'Description',
          type: 'Multi-Line Text',
          id: DESC_ID,
          sectionName: 'Data',
        },
      ],
      cultures: ['en'],
      media: {
        handle: 'test-handle',
        folder: ['Cards'],
        collectionSystem: 'crelan',
        label: 'test',
        culture: 'en',
        sourceLanguage: 'en',
      },
    });
  }

  it('writes item YAML with good fields when Image and Text resolve fail', async () => {
    delete process.env.BQ_CREATE_LOG;
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.map(String).join(' '));
    };
    try {
      await emitSparseCard();
    } finally {
      console.warn = origWarn;
    }

    const yml = path.join(tmp, 'Sparse Card.yml');
    assert.ok(fs.existsSync(yml), 'item YAML must still be written');
    const body = fs.readFileSync(yml, 'utf8');
    assert.match(body, /Hint: Title/);
    assert.match(body, /Value: Kept title/);
    assert.match(body, /aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/);
    assert.doesNotMatch(body, /bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/);
    assert.doesNotMatch(body, /cccccccc-cccc-cccc-cccc-cccccccccccc/);
    assert.doesNotMatch(body, /Hint: Background Image/);
    assert.doesNotMatch(body, /Hint: Description/);
    assert.equal(
      warns.filter((w) => /omitted field/.test(w)).length,
      0,
      'default create log must stay silent for per-field soft-fail',
    );
  });

  it('logs omitted fields only when BQ_CREATE_LOG=verbose', async () => {
    // Fresh leaf so inventory skip does not short-circuit.
    const verboseTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-soft-fail-v-'));
    process.env.BQ_CREATE_LOG = 'verbose';
    const warns = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warns.push(args.map(String).join(' '));
    };
    try {
      await applySiteContentItemTree({
        items: [
          {
            name: 'Verbose Card',
            fields: {
              Title: 'Verbose kept',
              'Background Image': /** @type {any} */ ({ unexpected: true }),
              Description: /** @type {any} */ ({ bad: true }),
            },
          },
        ],
        handle: 'test-handle',
        label: 'test-soft-fail-verbose',
        parentId: FOLDER,
        parentSitecorePath: '/sitecore/content/demo/Data/Cards',
        diskDir: verboseTmp,
        itemTemplateId: TPL,
        fields: [
          {
            name: 'Title',
            type: 'Single-Line Text',
            id: TITLE_ID,
            sectionName: 'Data',
          },
          {
            name: 'Background Image',
            type: 'Image',
            id: BG_ID,
            sectionName: 'Data',
          },
          {
            name: 'Description',
            type: 'Multi-Line Text',
            id: DESC_ID,
            sectionName: 'Data',
          },
        ],
        cultures: ['en'],
        media: {
          handle: 'test-handle',
          folder: ['Cards'],
          collectionSystem: 'crelan',
          label: 'test',
          culture: 'en',
          sourceLanguage: 'en',
        },
      });
    } finally {
      console.warn = origWarn;
      fs.rmSync(verboseTmp, { recursive: true, force: true });
    }

    const omitted = warns.filter((w) => /omitted field/.test(w));
    assert.ok(
      omitted.length >= 2,
      `expected verbose omit warns, got: ${JSON.stringify(warns)}`,
    );
    assert.ok(omitted.some((w) => /Background Image/.test(w)));
    assert.ok(omitted.some((w) => /Description/.test(w)));
  });
});
