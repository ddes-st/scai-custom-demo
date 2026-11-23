import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  NAVIGATION_REFERENCE_SOURCE,
  collectNavigationReferenceImportPaths,
  ensureNavigationReferenceForTsxFile,
  ensureNavigationReferenceImports,
  resolveNavigationReferenceTargetPath,
} from './ensure-navigation-reference.mjs';

describe('collectNavigationReferenceImportPaths', () => {
  it('collects relative Navigation.reference imports', () => {
    const src = `
import { prepareFields } from './Navigation.reference';
import { getLinkField } from "../CrelanNavigation/Navigation.reference";
import type { NavItemFields } from '../Navigation.reference.tsx';
import { Text } from '@sitecore-content-sdk/nextjs';
`;
    assert.deepEqual(collectNavigationReferenceImportPaths(src).sort(), [
      '../CrelanNavigation/Navigation.reference',
      '../Navigation.reference.tsx',
      './Navigation.reference',
    ].sort());
  });
});

describe('resolveNavigationReferenceTargetPath', () => {
  it('prefers .tsx even when import omits extension', () => {
    const dir = path.join('C:', 'pkg');
    assert.equal(
      resolveNavigationReferenceTargetPath(dir, './Navigation.reference'),
      path.resolve(dir, 'Navigation.reference.tsx'),
    );
    assert.equal(
      resolveNavigationReferenceTargetPath(
        dir,
        '../Sibling/Navigation.reference',
      ),
      path.resolve(dir, '../Sibling/Navigation.reference.tsx'),
    );
  });
});

describe('ensureNavigationReferenceImports', () => {
  /** @type {string} */
  let tmp;

  before(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'bq-nav-ref-'));
  });

  after(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('creates ./Navigation.reference.tsx under package dir', async () => {
    const pkg = path.join(tmp, 'CrelanHeaderNavigation');
    await mkdir(pkg, { recursive: true });
    const written = await ensureNavigationReferenceImports(
      `import { prepareFields } from './Navigation.reference';\n`,
      pkg,
    );
    const target = path.join(pkg, 'Navigation.reference.tsx');
    assert.deepEqual(written, [target]);
    const body = await readFile(target, 'utf8');
    const primer = await readFile(NAVIGATION_REFERENCE_SOURCE, 'utf8');
    assert.equal(body, primer);
  });

  it('creates ../SiblingPkg/Navigation.reference.tsx for cross-package import', async () => {
    const pkg = path.join(tmp, 'CrelanMegaMenuColumn');
    await mkdir(pkg, { recursive: true });
    const written = await ensureNavigationReferenceImports(
      `import { getLinkField } from '../CrelanNavigation/Navigation.reference';\n`,
      pkg,
    );
    const target = path.join(
      tmp,
      'CrelanNavigation',
      'Navigation.reference.tsx',
    );
    assert.deepEqual(written, [target]);
    assert.ok((await stat(target)).isFile());
  });

  it('is idempotent — does not overwrite an existing file', async () => {
    const pkg = path.join(tmp, 'AlreadyHas');
    await mkdir(pkg, { recursive: true });
    const target = path.join(pkg, 'Navigation.reference.tsx');
    await writeFile(target, '// custom local copy\n', 'utf8');
    const written = await ensureNavigationReferenceImports(
      `import { prepareFields } from './Navigation.reference';\n`,
      pkg,
    );
    assert.deepEqual(written, []);
    assert.equal(await readFile(target, 'utf8'), '// custom local copy\n');
  });

  it('ensureNavigationReferenceForTsxFile reads disk and ensures', async () => {
    const pkg = path.join(tmp, 'FromFile');
    await mkdir(pkg, { recursive: true });
    const tsxPath = path.join(pkg, 'from-file.tsx');
    await writeFile(
      tsxPath,
      `import { prepareFields } from './Navigation.reference';\nexport const Default = () => null;\n`,
      'utf8',
    );
    const written = await ensureNavigationReferenceForTsxFile(tsxPath);
    assert.equal(written.length, 1);
    assert.ok(
      (await stat(path.join(pkg, 'Navigation.reference.tsx'))).isFile(),
    );
  });
});
