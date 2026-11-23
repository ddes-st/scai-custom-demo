/**
 * Run: node --import tsx --test tools/shared/project-collection-roots.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

describe('project collection roots (Authoring-first)', () => {
  it('exports ensureProjectCollectionRootId helper', async () => {
    const mod = await import('./project-collection-roots.ts');
    assert.equal(typeof mod.ensureProjectCollectionRootId, 'function');
    assert.equal(typeof mod.clearProjectCollectionRootCache, 'function');
  });

  it('rendering/parameters/data no longer resolve roots from YAML files', () => {
    const rendering = fs.readFileSync(
      path.join(dir, '../definitions/apply/rendering.ts'),
      'utf8',
    );
    const parameters = fs.readFileSync(
      path.join(dir, '../definitions/apply/parameters.ts'),
      'utf8',
    );
    const data = fs.readFileSync(
      path.join(dir, '../definitions/apply/data.ts'),
      'utf8',
    );
    const collection = fs.readFileSync(
      path.join(dir, '../definitions/apply/collection.ts'),
      'utf8',
    );
    const site = fs.readFileSync(
      path.join(dir, '../definitions/apply/site.ts'),
      'utf8',
    );

    assert.match(rendering, /ensureProjectCollectionRootId/);
    assert.doesNotMatch(rendering, /resolveProjectCollectionRootId/);
    assert.doesNotMatch(rendering, /getProjectRenderingsCollectionYamlPath/);

    assert.match(parameters, /ensureProjectCollectionRootId/);
    assert.doesNotMatch(parameters, /resolveProjectCollectionRootId/);

    assert.match(data, /ensureProjectCollectionRootId/);
    assert.doesNotMatch(data, /getProjectTemplatesCollectionYamlPath/);

    assert.doesNotMatch(collection, /stampBqProvenanceAndPush/);
    assert.doesNotMatch(site, /stampBqProvenanceAndPush/);
    assert.doesNotMatch(site, /local site YAML missing/);
  });
});
