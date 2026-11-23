/**
 * Run: node --import tsx --test tools/create-section-components/child-item-template-map.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alignChildItemTemplateMapsAlwaysOn,
  findDirectMappedChildCollectionNames,
} from './child-item-template-map.mjs';

describe('child-item-template-map', () => {
  it('finds Reasons/Cards direct maps', () => {
    assert.deepEqual(
      findDirectMappedChildCollectionNames(
        'fields.Reasons.map((r) => r); fields.Cards.map((c) => c);',
      ),
      ['Reasons', 'Cards'],
    );
  });

  it('rewrites fields.Reasons.map when childItemTemplate exists', () => {
    const def = `
export const d = {
  model: {
    itemTemplate: { sections: [{ fields: [{ name: 'Heading', type: 'Single-Line Text' }] }] },
    childItemTemplate: {
      name: 'Reason',
      sections: [{ fields: [
        { name: 'Title', type: 'Single-Line Text' },
        { name: 'Body', type: 'Single-Line Text' },
        { name: 'Icon', type: 'Image' },
      ] }],
    },
  },
  content: { items: [{ name: 'X', fields: { Heading: 'Daarom kies je Menzis:' } }] },
};
`;
    const tsx = `
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Reason { Title: Field<string>; Body: Field<string>; }
interface Fields { Heading: Field<string>; Reasons: Reason[]; }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  return <div>{fields.Reasons.map((reason: Reason, index: number) => <span key={index}>{reason.Title?.value}</span>)}</div>;
};
`;
    const out = alignChildItemTemplateMapsAlwaysOn({ definitionTs: def, tsx });
    assert.ok(out.rewritten.includes('Reasons'));
    assert.match(out.tsx, /getDatasource/);
    assert.match(out.tsx, /cards\.map/);
    assert.doesNotMatch(out.tsx, /fields\.Reasons\.map/);
  });
});
