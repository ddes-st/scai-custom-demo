import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { listHostCapturePages } from './resolve-capture.mjs';

describe('listHostCapturePages', () => {
  it('puts the seed URL page first, then remaining slugs sorted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-host-pages-'));
    const host = 'www-example-com';
    const project = path.join(root, host);
    const makePage = async (slug, url) => {
      const dir = path.join(project, slug);
      await mkdir(path.join(dir, 'sections', 'section-01'), { recursive: true });
      await writeFile(path.join(dir, 'source-url.txt'), url, 'utf8');
    };
    await makePage('www-example-com--about', 'https://www.example.com/about');
    await makePage('www-example-com--home', 'https://www.example.com/');
    await makePage('www-example-com--news', 'https://www.example.com/news');

    const pages = await listHostCapturePages('https://www.example.com/', root);
    assert.equal(pages[0].pageSlug, 'www-example-com--home');
    assert.deepEqual(
      pages.slice(1).map((p) => p.pageSlug),
      ['www-example-com--about', 'www-example-com--news'],
    );
  });
});
