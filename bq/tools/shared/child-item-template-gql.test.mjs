/**
 * Run: node --test --import tsx tools/shared/child-item-template-gql.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChildItemTemplateComponentQuery,
  collectTemplateFieldRefs,
} from './child-item-template-gql.ts';

describe('child-item-template-gql', () => {
  it('collectTemplateFieldRefs reads section fields', () => {
    const refs = collectTemplateFieldRefs({
      sections: [
        {
          name: 'Data',
          fields: [{ name: 'Heading' }, { name: 'Eyebrow' }, { name: '' }],
        },
      ],
    });
    assert.deepEqual(
      refs.map((r) => r.name),
      ['Heading', 'Eyebrow'],
    );
  });

  it('buildChildItemTemplateComponentQuery includes parent + children.results', () => {
    const gql = buildChildItemTemplateComponentQuery({
      parentFields: [{ name: 'Heading' }, { name: 'Description' }],
      childFields: [{ name: 'Logo' }, { name: 'Title' }],
      first: 40,
    });
    assert.match(gql, /ChildItemTemplateQuery/);
    assert.match(gql, /heading: field\(name: "Heading"\)/);
    assert.match(gql, /description: field\(name: "Description"\)/);
    assert.match(gql, /children\(first: 40\)/);
    assert.match(gql, /logo: field\(name: "Logo"\)/);
    assert.match(gql, /title: field\(name: "Title"\)/);
  });
});
