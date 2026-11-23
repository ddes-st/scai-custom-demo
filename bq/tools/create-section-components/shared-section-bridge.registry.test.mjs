import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  listRegistryComponentFolders,
  pickCanonicalInstance,
  resolveCanonicalInstance,
} from './shared-section-bridge.mjs';

describe('listRegistryComponentFolders + resolveCanonicalInstance', () => {
  it('pickCanonicalInstance prefers canonicalPageSlug then home then score', () => {
    const instances = [
      {
        pageSlug: 'host--platform',
        sectionFolder: 'section-01',
        extensionScore: 100,
      },
      {
        pageSlug: 'host--home',
        sectionFolder: 'section-02',
        extensionScore: 50,
      },
    ];
    assert.equal(
      pickCanonicalInstance({ canonicalPageSlug: 'host--platform' }, instances)
        .pageSlug,
      'host--platform',
    );
    assert.equal(pickCanonicalInstance({}, instances).pageSlug, 'host--home');
    assert.equal(
      pickCanonicalInstance(
        {},
        [
          { pageSlug: 'host--a', sectionFolder: 'section-01', extensionScore: 10 },
          { pageSlug: 'host--b', sectionFolder: 'section-01', extensionScore: 99 },
        ],
      ).pageSlug,
      'host--b',
    );
  });

  it('lists folders from manifest and resolves canonical evidence dir', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-reg-list-'));
    const reg = path.join(root, 'section-registry');
    const pageSlug = 'host--home';
    const sectionFolder = 'section-03';
    await mkdir(path.join(root, pageSlug, 'sections', sectionFolder), {
      recursive: true,
    });
    await mkdir(path.join(reg, 'consent-banner'), { recursive: true });
    await writeFile(
      path.join(reg, 'manifest.json'),
      JSON.stringify({
        components: {
          ConsentBanner: {
            folderName: 'consent-banner',
            cmsName: 'ConsentBanner',
            canonicalPageSlug: pageSlug,
            canonicalRef: {
              pageSlug,
              sectionFolder,
              sourcePath: `${pageSlug}/sections/${sectionFolder}`,
            },
            instances: [
              {
                pageSlug,
                sectionFolder,
                sourcePath: `${pageSlug}/sections/${sectionFolder}`,
                extensionScore: 10,
              },
            ],
          },
        },
      }),
      'utf8',
    );
    await writeFile(
      path.join(reg, 'consent-banner', 'instances.json'),
      JSON.stringify({
        instances: [
          {
            pageSlug,
            sectionFolder,
            sourcePath: `${pageSlug}/sections/${sectionFolder}`,
            extensionScore: 10,
          },
        ],
      }),
      'utf8',
    );

    const folders = await listRegistryComponentFolders(root);
    assert.deepEqual(folders, ['consent-banner']);

    const canon = await resolveCanonicalInstance(root, 'consent-banner');
    assert.ok(canon);
    assert.equal(canon.pageSlug, pageSlug);
    assert.equal(canon.sectionFolder, sectionFolder);
    assert.equal(
      canon.evidenceDir,
      path.join(root, pageSlug, 'sections', sectionFolder),
    );
  });
});
