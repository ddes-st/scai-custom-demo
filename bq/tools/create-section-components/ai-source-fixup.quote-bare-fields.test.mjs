/**
 * Last-resort salvage: bare multi-word Fields keys + field access.
 * Must work under prompt-first (no force-mutating-fixups import).
 * Run: node --test tools/create-section-components/ai-source-fixup.quote-bare-fields.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { quoteBareMultiWordFieldsKeys } from './ai-source-fixup.mjs';

describe('quoteBareMultiWordFieldsKeys (prompt-first safe)', () => {
  it('quotes bare Card Link declaration', () => {
    const src = `
interface Fields { Image: ImageField; Card Link: LinkField; Title: Field<string>; Body: Field<string>; CTA: LinkField }
type Props = { fields: Fields };
export const Default = ({ fields }: Props) => (
  <article><Link field={fields['Card Link']} /></article>
);
`;
    const out = quoteBareMultiWordFieldsKeys(src);
    assert.match(out, /"Card Link":\s*LinkField/);
    assert.doesNotMatch(out, /(?<!["'])Card Link:\s*LinkField/);
    assert.match(out, /fields\['Card Link'\]|fields\["Card Link"\]/);
  });

  it('rewrites unquoted bracket and PascalCase access', () => {
    const src = `
interface Fields {
  Card Link: LinkField;
  Close Icon: ImageField;
}
export const Default = (props: { fields: Fields }) => (
  <>
    <Link field={props.fields[Card Link]} />
    <Image field={fields.CloseIcon} />
  </>
);
`;
    const out = quoteBareMultiWordFieldsKeys(src);
    assert.match(out, /"Card Link":\s*LinkField/);
    assert.match(out, /"Close Icon":\s*ImageField/);
    assert.match(out, /props\.fields\["Card Link"\]/);
    assert.match(out, /fields\["Close Icon"\]/);
    assert.doesNotMatch(out, /fields\[Card Link\]/);
    assert.doesNotMatch(out, /fields\.CloseIcon/);
  });

  it('leaves already-quoted keys and access unchanged', () => {
    const src = `
interface Fields {
  "Card Link": LinkField;
}
export const Default = ({ fields }: { fields: Fields }) => (
  <Link field={fields["Card Link"]} />
);
`;
    const out = quoteBareMultiWordFieldsKeys(src);
    assert.match(out, /"Card Link":\s*LinkField/);
    assert.match(out, /fields\["Card Link"\]/);
    assert.equal((out.match(/"Card Link"/g) || []).length >= 2, true);
  });

  it('does not quote single-word Fields keys', () => {
    const src = `
interface Fields {
  Title: Field<string>;
  CTA: LinkField;
}
`;
    const out = quoteBareMultiWordFieldsKeys(src);
    assert.match(out, /Title:\s*Field/);
    assert.match(out, /CTA:\s*LinkField/);
    assert.doesNotMatch(out, /"Title"/);
    assert.doesNotMatch(out, /"CTA"/);
  });
});
