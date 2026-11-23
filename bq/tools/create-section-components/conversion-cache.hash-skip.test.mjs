/**
 * conversionSourceHash skip must not rewrite package sources.
 * Run: node --test tools/create-section-components/conversion-cache.hash-skip.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { canSkipSectionConversion } from './conversion-cache.mjs';
import { writeFileIfChanged } from '../shared/write-file-if-changed.mjs';

describe('conversionSourceHash skip + writeFileIfChanged', () => {
  it('canSkipSectionConversion skips when hash matches and outputs exist', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-hash-skip-'));
    const tsx = path.join(dir, 'Foo.tsx');
    const def = path.join(dir, 'Foo.definition.ts');
    const meta = path.join(dir, 'Foo.capture-meta.json');
    await writeFile(tsx, 'export const Default = () => null;\n', 'utf8');
    await writeFile(def, 'export const foo = {};\n', 'utf8');
    await writeFile(meta, '{}\n', 'utf8');
    const result = await canSkipSectionConversion({
      force: false,
      prior: {
        conversionSourceHash: 'abc123',
        components: [
          {
            sources: {
              tsx,
              definition: def,
              captureMeta: meta,
            },
          },
        ],
      },
      conversionSourceHash: 'abc123',
    });
    assert.equal(result.skip, true);
    assert.equal(result.reason, 'conversionSourceHash match');
  });

  it('identical regenerate via writeFileIfChanged preserves mtime', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-hash-wifc-'));
    await mkdir(dir, { recursive: true });
    const def = path.join(dir, 'comp.definition.ts');
    const body = 'export const d = { kind: "component" };\n';
    await writeFile(def, body, 'utf8');
    const past = new Date('2019-05-05T00:00:00.000Z');
    await utimes(def, past, past);
    const before = await stat(def);
    const r = await writeFileIfChanged(def, body);
    assert.equal(r.wrote, false);
    assert.equal((await stat(def)).mtimeMs, before.mtimeMs);
  });

  it('force bypasses conversionSourceHash match (change detection)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'bq-hash-force-'));
    const tsx = path.join(dir, 'Foo.tsx');
    const def = path.join(dir, 'Foo.definition.ts');
    const meta = path.join(dir, 'Foo.capture-meta.json');
    await writeFile(tsx, 'export const Default = () => null;\n', 'utf8');
    await writeFile(def, 'export const foo = {};\n', 'utf8');
    await writeFile(meta, '{}\n', 'utf8');
    const result = await canSkipSectionConversion({
      force: true,
      prior: {
        conversionSourceHash: 'abc123',
        components: [{ sources: { tsx, definition: def, captureMeta: meta } }],
      },
      conversionSourceHash: 'abc123',
    });
    assert.equal(result.skip, false);
    assert.equal(result.reason, 'force');
  });

  it('force still honors sharedSkip reuse (built this run)', async () => {
    const reuse = {
      componentFolder: 'consent-banner',
      componentName: 'SitecoreConsentBanner',
      definitionKey: 'sitecore-consent-banner',
    };
    const result = await canSkipSectionConversion({
      force: true,
      prior: null,
      conversionSourceHash: 'anything',
      sharedSkip: {
        skip: true,
        reason: 'registrySection reused (built this run: consent-banner)',
        reuse,
      },
    });
    assert.equal(result.skip, true);
    assert.match(result.reason, /built this run/);
    assert.equal(result.sharedReuse, reuse);
  });
});
