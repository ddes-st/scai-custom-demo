/**
 * Run: node --import tsx --test tools/create-section-components/resolve-only-targets.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  classifyOnlyToken,
  extractDefinitionKeyFromSource,
  normalizeSectionFolder,
  parseOnlyTokens,
  resolveOnlyTargets,
} from './resolve-only-targets.mjs';

describe('parseOnlyTokens / classifyOnlyToken', () => {
  it('splits commas and whitespace', () => {
    assert.deepEqual(parseOnlyTokens('section-04, SitecoreSiteFooter  sitecore-x'), [
      'section-04',
      'SitecoreSiteFooter',
      'sitecore-x',
    ]);
  });

  it('classifies section / package / definitionKey', () => {
    assert.equal(classifyOnlyToken('section-04'), 'section');
    assert.equal(classifyOnlyToken('4'), 'section');
    assert.equal(classifyOnlyToken('SitecoreSiteFooter'), 'package');
    assert.equal(classifyOnlyToken('sitecore-site-footer'), 'definitionKey');
    assert.equal(classifyOnlyToken('stub-home'), 'definitionKey');
  });

  it('normalizeSectionFolder pads numeric ids', () => {
    assert.equal(normalizeSectionFolder('4'), 'section-04');
    assert.equal(normalizeSectionFolder('section-13'), 'section-13');
  });
});

describe('extractDefinitionKeyFromSource', () => {
  it('reads definitionKey string', () => {
    assert.equal(
      extractDefinitionKeyFromSource(
        `export default { kind: 'component', definitionKey: 'sitecore-site-footer' }`,
      ),
      'sitecore-site-footer',
    );
  });
});

describe('resolveOnlyTargets', () => {
  it('resolves section + package + key into folders and keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-only-'));
    const sectionsDir = path.join(root, 'sections');
    const hostDir = path.join(root, 'components');
    await mkdir(path.join(sectionsDir, 'section-04'), { recursive: true });
    await mkdir(path.join(sectionsDir, 'section-05'), { recursive: true });
    await mkdir(path.join(hostDir, 'SitecoreSiteFooter'), { recursive: true });
    await writeFile(
      path.join(hostDir, 'SitecoreSiteFooter', 'sitecore-site-footer.definition.ts'),
      `export default { definitionKey: 'sitecore-site-footer', kind: 'component' };\n`,
    );
    await writeFile(
      path.join(sectionsDir, 'section-05', 'section-conversion.json'),
      JSON.stringify({
        components: [{ definitionKey: 'sitecore-site-footer' }],
      }),
    );

    const resolved = await resolveOnlyTargets({
      only: 'section-04,SitecoreSiteFooter',
      sectionsDir,
      hostComponentsDir: hostDir,
    });

    assert.ok(resolved.sectionFolders.includes('section-04'));
    assert.ok(resolved.sectionFolders.includes('section-05')); // via key backlink
    assert.ok(resolved.definitionKeys.includes('sitecore-site-footer'));
    assert.equal(resolved.unresolved.length, 0);
  });

  it('accepts definitionKey without package (emit-only)', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-only-key-'));
    const sectionsDir = path.join(root, 'sections');
    await mkdir(sectionsDir, { recursive: true });
    const resolved = await resolveOnlyTargets({
      only: 'sitecore-customer-story-slider',
      sectionsDir,
      hostComponentsDir: path.join(root, 'missing-host'),
    });
    assert.deepEqual(resolved.definitionKeys, ['sitecore-customer-story-slider']);
    assert.equal(resolved.sectionFolders.length, 0);
  });
});
