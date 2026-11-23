/**
 * Brandkit must run once at host/site level, not inside per-page wire.
 * Run: node --import tsx --test tools/create-section-components/brandkit-host-once.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runSrc = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'run.mjs'),
  'utf8',
);

describe('brandkit host-once wiring', () => {
  it('runCreateSectionComponentsAll calls ensureBrandKitForHost before page wire', () => {
    const allFnStart = runSrc.indexOf(
      'export async function runCreateSectionComponentsAll',
    );
    const pageFnStart = runSrc.indexOf(
      'export async function runCreateSectionComponents(args)',
    );
    assert.ok(allFnStart >= 0, 'runCreateSectionComponentsAll present');
    assert.ok(pageFnStart > allFnStart, 'page runner follows host-all runner');

    const allBody = runSrc.slice(allFnStart, pageFnStart);
    assert.match(allBody, /ensureBrandKitForHost\s*\(/);
    assert.match(allBody, /Stream brand kit \(once per host\/site\)/);
    assert.match(allBody, /_skipInitialGenerate:\s*true/);
    assert.match(allBody, /_brandkitDone:\s*true/);

    const wireBanner = allBody.indexOf('Wire page presentation');
    const brandkitCall = allBody.indexOf('ensureBrandKitForHost');
    assert.ok(brandkitCall >= 0 && wireBanner >= 0);
    assert.ok(
      brandkitCall < wireBanner,
      'host brandkit ensure must appear before wire page loop',
    );
  });

  it('per-page runner skips brandkit when _hostPageLoop', () => {
    const pageFnStart = runSrc.indexOf(
      'export async function runCreateSectionComponents(args)',
    );
    const pageBody = runSrc.slice(pageFnStart);
    const brandkitGate = pageBody.indexOf('Stream brand kit');
    assert.ok(brandkitGate >= 0, 'standalone brandkit block present');
    const gateSlice = pageBody.slice(brandkitGate, brandkitGate + 400);
    assert.match(gateSlice, /!args\._hostPageLoop/);
    assert.match(gateSlice, /!args\.codegenOnly/);
  });
});
