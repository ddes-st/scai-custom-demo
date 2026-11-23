/**
 * Run: node --import tsx --test tools/shared/site-content-items.parent-yml.test.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  applySiteContentItemTree,
  isStaleContentCloneLeafName,
  pruneStaleContentCloneLeaves,
} from './site-content-items.ts';
import {
  beginApplyInventorySession,
  clearApplyInventorySession,
  endApplyInventorySession,
  saveApplyInventory,
} from './apply-inventory.ts';
import { setActiveApplyDefinitionKey } from './apply-context.ts';

describe('isStaleContentCloneLeafName / pruneStaleContentCloneLeaves', () => {
  it('detects Copy/Duplicate/Repeat/herhalen suffixes', () => {
    assert.equal(isStaleContentCloneLeafName('Offer Copy.yml'), true);
    assert.equal(isStaleContentCloneLeafName('Contact Us Duplicate'), true);
    assert.equal(isStaleContentCloneLeafName('Themes Repeat'), true);
    assert.equal(isStaleContentCloneLeafName('Tarieven herhalen.yml'), true);
    assert.equal(isStaleContentCloneLeafName('Copy direct links.yml'), true);
    assert.equal(isStaleContentCloneLeafName('Duplicate themes'), true);
    assert.equal(isStaleContentCloneLeafName('Contact.yml'), false);
    assert.equal(isStaleContentCloneLeafName('Contact Us.yml'), false);
    assert.equal(isStaleContentCloneLeafName('Offer'), false);
  });

  it('prunes stale leaves and keeps canonical columns', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-prune-'));
    fs.writeFileSync(path.join(dir, 'Offer.yml'), 'ID: "1"\n');
    fs.writeFileSync(path.join(dir, 'Offer Copy.yml'), 'ID: "2"\n');
    fs.mkdirSync(path.join(dir, 'Themes Repeat'));
    fs.writeFileSync(
      path.join(dir, 'Themes Repeat', 'Family Repeat.yml'),
      'ID: "3"\n',
    );
    fs.writeFileSync(path.join(dir, 'Contact Us.yml'), 'ID: "4"\n');
    const removed = pruneStaleContentCloneLeaves(dir);
    assert.ok(removed.some((p) => /Offer Copy\.yml$/i.test(p)));
    assert.ok(removed.some((p) => /Themes Repeat$/i.test(p)));
    assert.ok(fs.existsSync(path.join(dir, 'Offer.yml')));
    assert.ok(fs.existsSync(path.join(dir, 'Contact Us.yml')));
    assert.ok(!fs.existsSync(path.join(dir, 'Offer Copy.yml')));
    assert.ok(!fs.existsSync(path.join(dir, 'Themes Repeat')));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('applySiteContentItemTree parent.yml before children', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-parent-yml-'));
  const defKey = `parent-yml-test-${Date.now()}`;
  const fieldId = '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}';
  const parentTpl = '{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}';
  const childTpl = '{cccccccc-cccc-cccc-cccc-cccccccccccc}';
  const folderId = '{dddddddd-dddd-dddd-dddd-dddddddddddd}';

  before(() => {
    setActiveApplyDefinitionKey(defKey);
    beginApplyInventorySession(defKey);
  });

  after(() => {
    endApplyInventorySession('test-hash');
    clearApplyInventorySession();
    setActiveApplyDefinitionKey(null);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes Contact.yml parent even when child Contact/Contact.yml is inventoried', async () => {
    const childDir = path.join(tmp, 'Contact');
    fs.mkdirSync(childDir, { recursive: true });
    const childYml = path.join(childDir, 'Contact.yml');
    fs.writeFileSync(
      childYml,
      `---
ID: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
Parent: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
Path: "/sitecore/content/demo/Data/Cols/Contact/Contact"
`,
    );
    // Poison inventory: same leafName as parent, pointing at child YAML.
    saveApplyInventory({
      definitionKey: defKey,
      sourceContentHash: 'poison',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          path: '/sitecore/content/demo/Data/Cols/Contact/Contact',
          diskPath: childYml,
          kind: 'content',
          leafName: 'Contact',
          // Hash will not match real payload — emit must still write parent.
          payloadHash: 'not-the-real-hash',
        },
      ],
    });

    // Also drop a stale clone that prune should remove.
    fs.writeFileSync(path.join(tmp, 'Contact Us Duplicate.yml'), 'ID: "f"\n');

    await applySiteContentItemTree({
      items: [
        {
          name: 'Contact',
          fields: { Title: 'Contacteer ons' },
          children: [
            {
              name: 'Nearest Office',
              fields: { Text: 'Office' },
            },
          ],
        },
      ],
      handle: 'test-handle',
      label: 'test-parent-yml',
      parentId: folderId,
      parentSitecorePath: '/sitecore/content/demo/Data/Cols',
      diskDir: tmp,
      itemTemplateId: parentTpl,
      fields: [
        {
          name: 'Title',
          type: 'Single-Line Text',
          id: fieldId,
          sectionName: 'Data',
        },
      ],
      childItemTemplateId: childTpl,
      childFields: [
        {
          name: 'Text',
          type: 'Single-Line Text',
          id: '{ffffffff-ffff-ffff-ffff-ffffffffffff}',
          sectionName: 'Data',
        },
      ],
      cultures: ['en'],
      media: {
        handle: 'test-handle',
        folder: ['Cols'],
        collectionSystem: 'crelan',
        label: 'test',
        culture: 'en',
        sourceLanguage: 'en',
      },
    });

    const parentYml = path.join(tmp, 'Contact.yml');
    assert.ok(
      fs.existsSync(parentYml),
      'definition item Contact must write sibling Contact.yml beside Contact/',
    );
    assert.ok(!fs.existsSync(path.join(tmp, 'Contact Us Duplicate.yml')));
    assert.ok(fs.existsSync(path.join(tmp, 'Contact', 'Nearest Office.yml')));
    const parentBody = fs.readFileSync(parentYml, 'utf8');
    assert.match(parentBody, /Path: "\/sitecore\/content\/demo\/Data\/Cols\/Contact"/);
    assert.doesNotMatch(parentBody, /\/Contact\/Contact"/);
  });
});
