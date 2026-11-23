/**
 * Run: node --import tsx --test tools/shared/authoring-apply-item.base-templates.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBaseTemplateIds } from './authoring-apply-item.ts';
import {
  BASE_PAGE_CONTENT,
  BASE_STANDARD_TEMPLATE,
} from './system-ids.ts';

describe('parseBaseTemplateIds', () => {
  it('parses newline-separated braced GUIDs', () => {
    assert.deepEqual(
      parseBaseTemplateIds(`${BASE_STANDARD_TEMPLATE}\n${BASE_PAGE_CONTENT}`),
      [BASE_STANDARD_TEMPLATE, BASE_PAGE_CONTENT],
    );
  });

  it('parses pipe-separated and bare GUIDs', () => {
    assert.deepEqual(
      parseBaseTemplateIds(
        '1930bbeb-7805-471a-a3be-4858ac7cf696|44a022db-56d3-419a-b43b-e27e4d8e9c41',
      ),
      [
        '1930bbeb-7805-471a-a3be-4858ac7cf696',
        '44a022db-56d3-419a-b43b-e27e4d8e9c41',
      ],
    );
  });

  it('returns empty for blank', () => {
    assert.deepEqual(parseBaseTemplateIds(''), []);
    assert.deepEqual(parseBaseTemplateIds(undefined), []);
  });
});
