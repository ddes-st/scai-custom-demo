/**
 * Partial Design thumbnail path + SharedFields upsert helpers.
 * Run: node --import tsx --test tools/shared/site-thumbnail-from-capture.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  normalizeDefinitionThumbnail,
  resolveDefinitionThumbnailBytes,
  resolveDefinitionThumbnailPath,
  resolvePartialThumbnailPngPath,
  upsertSharedFieldInYaml,
} from './site-thumbnail-from-capture.ts';
import { STANDARD_FIELDS } from './standard-fields.ts';

describe('normalizeDefinitionThumbnail', () => {
  it('prefers thumbnail object over deprecated capture rel', () => {
    assert.deepEqual(
      normalizeDefinitionThumbnail(
        { path: 'sections/a.png', alt: 'A' },
        'sections/old.png',
      ),
      { path: 'sections/a.png', alt: 'A' },
    );
  });

  it('migrates deprecated thumbnailCaptureRel to { path }', () => {
    assert.deepEqual(
      normalizeDefinitionThumbnail(undefined, 'sections/section-02/x.png'),
      { path: 'sections/section-02/x.png' },
    );
  });
});

describe('resolveDefinitionThumbnailBytes', () => {
  it('resolves base64 first', async () => {
    const raw = Buffer.from('png-bytes').toString('base64');
    const out = await resolveDefinitionThumbnailBytes({ base64: raw });
    assert.ok(!('skipped' in out));
    assert.equal(out.buffer.toString(), 'png-bytes');
  });

  it('resolves data-URL base64', async () => {
    const raw = Buffer.from('hello').toString('base64');
    const out = await resolveDefinitionThumbnailBytes({
      base64: `data:image/png;base64,${raw}`,
    });
    assert.ok(!('skipped' in out));
    assert.equal(out.buffer.toString(), 'hello');
  });

  it('resolves relative path under capture page dir', async () => {
    const pageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-thumb-path-'));
    const rel = 'sections/section-02/section-02-desktop.png';
    const abs = resolveDefinitionThumbnailPath(pageDir, rel);
    assert.ok(abs);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'from-path');
    const out = await resolveDefinitionThumbnailBytes(
      { path: rel },
      { capturePageDir: pageDir },
    );
    assert.ok(!('skipped' in out));
    assert.equal(out.buffer.toString(), 'from-path');
    fs.rmSync(pageDir, { recursive: true, force: true });
  });

  it('skips relative path when capturePageDir missing', async () => {
    const out = await resolveDefinitionThumbnailBytes({
      path: 'sections/x.png',
    });
    assert.ok('skipped' in out);
    assert.match(out.skipped, /capturePageDir/);
  });
});

describe('resolvePartialThumbnailPngPath', () => {
  it('joins capture page dir with a relative section desktop path', () => {
    const pageDir = path.join(os.tmpdir(), 'bq-capture-page');
    const out = resolvePartialThumbnailPngPath(
      pageDir,
      'sections/section-01/section-01-desktop.png',
    );
    assert.equal(
      out,
      path.join(pageDir, 'sections', 'section-01', 'section-01-desktop.png'),
    );
  });

  it('rejects absolute paths and parent traversal', () => {
    const pageDir = path.join(os.tmpdir(), 'bq-capture-page');
    assert.equal(
      resolvePartialThumbnailPngPath(pageDir, 'C:\\\\Windows\\\\x.png'),
      null,
    );
    assert.equal(
      resolvePartialThumbnailPngPath(pageDir, '../outside.png'),
      null,
    );
    assert.equal(resolvePartialThumbnailPngPath(pageDir, ''), null);
  });
});

describe('upsertSharedFieldInYaml single-line Name', () => {
  it('collapses newlines in non-multiline Value (never bare LF continuation)', () => {
    const yaml = `---
ID: "d57666ae-82d5-4006-a8ff-824943e1de61"
Path: /sitecore/content/menzis/menzis-nl
SharedFields:
- ID: "85a7501a-86d9-4243-9075-0b727c3a6db4"
  Hint: Name
  Value: placeholder
Languages:
- Language: en
`;
    const { yaml: next, changed } = upsertSharedFieldInYaml(
      yaml,
      { id: '85a7501a-86d9-4243-9075-0b727c3a6db4', hint: 'Name' },
      'Men\nzis Netherlands',
    );
    assert.equal(changed, true);
    assert.match(next, /Hint: Name\n  Value: Men zis Netherlands\n/);
    assert.doesNotMatch(next, /Value: Men\nzis/);
  });
});

describe('upsertSharedFieldInYaml thumbnail field', () => {
  it('inserts __Thumbnail SharedField when missing', () => {

    const yaml = `---
ID: "{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}"
Path: /sitecore/content/demo/site/Presentation/Partial Designs/Header
SharedFields:
- ID: "some-other-field"
  Hint: Other
  Value: x
Languages:
- Language: en
`;
    const mediaRef = '<image mediaid="{11111111-2222-3333-4444-555555555555}" />';
    const { yaml: next, changed } = upsertSharedFieldInYaml(
      yaml,
      { id: STANDARD_FIELDS.thumbnail.id, hint: STANDARD_FIELDS.thumbnail.hint },
      mediaRef,
      { multiline: true },
    );
    assert.equal(changed, true);
    assert.match(next, /Hint: __Thumbnail/);
    assert.match(next, /mediaid="\{11111111-2222-3333-4444-555555555555\}"/);
  });
});

describe('resolvePartialThumbnailPngPath exists check shape', () => {
  it('points at a file that can exist under a temp capture tree', () => {
    const pageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-partial-thumb-'));
    const rel = 'sections/section-01/section-01-desktop.png';
    const abs = resolvePartialThumbnailPngPath(pageDir, rel);
    assert.ok(abs);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'png-bytes');
    assert.equal(fs.existsSync(abs), true);
    fs.rmSync(pageDir, { recursive: true, force: true });
  });
});
