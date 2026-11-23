/**
 * Warn-only contract checks for Fields / getDatasource typing (no TSX rewrites).
 * Run: node --test tools/create-section-components/ai-source-fixup.fields-access.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectTsxEmitContractDiagnostics,
  hasValidTsxPreamble,
  warnTsxEmitContract,
} from './ai-source-fixup.mjs';

describe('hasValidTsxPreamble', () => {
  it('accepts import and interface starts', () => {
    assert.equal(hasValidTsxPreamble("import x from 'y';\ninterface Fields {}"), true);
    assert.equal(hasValidTsxPreamble("'use client';\nexport const Default = () => null;"), true);
  });

  it('rejects stray prefix before interface', () => {
    assert.equal(hasValidTsxPreamble('a interface Fields {}'), false);
  });
});

describe('warnTsxEmitContract Fields / getDatasource', () => {
  it('warns on invalid TSX preamble', () => {
    const diags = collectTsxEmitContractDiagnostics(
      'a interface Fields { Title: TextField; }',
    );
    assert.ok(
      diags.some((w) => /invalid file preamble/.test(w)),
      `expected preamble warning, got: ${JSON.stringify(diags)}`,
    );
    // Still callable (quiet under default create log).
    warnTsxEmitContract('a interface Fields { Title: TextField; }');
  });

  it('warns when fields["Key"] is missing from Fields interface', () => {
    const diags = collectTsxEmitContractDiagnostics(`
interface Fields {
  Logo: ImageField;
}
export const Default = () => <Link field={fields["Logo Link"]} />;
`);
    assert.ok(
      diags.some((w) => /Logo Link/.test(w) && /Fields interface/.test(w)),
      `expected Fields warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('does not false-positive when Fields uses nested { value?: string }', () => {
    const diags = collectTsxEmitContractDiagnostics(`
export interface Fields {
  'Context Label': { value?: string };
  'Home Link': LinkField;
  'Logo Image': ImageField;
  'Search Label': { value?: string };
}
export const Default = (props: { fields: Fields }) => (
  <>
    <Link field={props.fields['Home Link']} />
    <Image field={props.fields['Logo Image']} />
    <span>{String(props.fields['Search Label']?.value || '')}</span>
  </>
);
`);
    assert.ok(
      !diags.some((w) => /not on Fields interface/.test(w)),
      `nested value?: string must not truncate Fields parse, got: ${JSON.stringify(diags)}`,
    );
  });

  it('warns when getDatasource fields union includes flat *Fields', () => {
    const diags = collectTsxEmitContractDiagnostics(`
interface SocialLinksFields { Title: TextField }
interface SocialLinksDatasource { field?: { title?: TextField } }
type Props = { fields: SocialLinksFields | SocialLinksDatasource };
const datasource = getDatasource<SocialLinksDatasource>(props.fields);
`);
    assert.ok(
      diags.some((w) => /getDatasource fields union/.test(w)),
      `expected getDatasource warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('does not CONTRACT-fail on fields.children (gate removed)', () => {
    const diags = collectTsxEmitContractDiagnostics(`
interface Fields {
  Message: TextField;
  children: { results: { fields: { Label: TextField } }[] };
}
export const Default = (props: { fields: Fields }) => {
  const { fields } = props;
  return fields.children.results.map((c) => <Text field={c.fields.Label} />);
};
`);
    assert.ok(
      !diags.some((w) => /Never read fields\.children|fields\.children/.test(w)),
      `fields.children must not be a CONTRACT: ${JSON.stringify(diags)}`,
    );
  });

  it('does not warn fields.children when using getDatasource + datasource.children', () => {
    const diags = collectTsxEmitContractDiagnostics(`
type Datasource = { children?: { results?: { link?: LinkField }[] } };
const datasource = getDatasource<Datasource>(props.fields);
const results = datasource?.children?.results ?? [];
`);
    assert.ok(
      !diags.some((w) => /fields\.children/.test(w)),
      `unexpected fields.children warning: ${JSON.stringify(diags)}`,
    );
  });
  it('warns when Link duplicates label via value?.text children', () => {
    const src = `
<Link field={fields.Link}>
  <span>{fields.Link.value?.text}</span>
  <span>→</span>
</Link>
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      diags.some((w) => /duplicates label/.test(w)),
      `expected duplicate-label warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('warns when fields.* is used without a fields binding', () => {
    const diags = collectTsxEmitContractDiagnostics(`
export const Default = (props: Props) => {
  const params = props.params ?? {};
  return <Text field={fields.Copyright} tag="p" />;
};
`);
    assert.ok(
      diags.some((w) => /without binding/.test(w)),
      `expected fields-binding warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('does not warn fields binding when const { fields } = props is present', () => {
    const diags = collectTsxEmitContractDiagnostics(`
export const Default = (props: Props) => {
  const { fields } = props;
  return <Text field={fields.Copyright} tag="p" />;
};
`);
    assert.ok(
      !diags.some((w) => /without binding/.test(w)),
      `unexpected fields-binding warning: ${JSON.stringify(diags)}`,
    );
  });

  it('warns on script / next/script / dangerouslySetInnerHTML', () => {
    const diags = collectTsxEmitContractDiagnostics(`
import Script from 'next/script';
export const Default = () => (
  <>
    <script dangerouslySetInnerHTML={{ __html: '1' }} />
    <Script src="/x.js" />
  </>
);
`);
    assert.ok(
      diags.some((w) => /<script>/.test(w)),
      `expected script warning, got: ${JSON.stringify(diags)}`,
    );
    assert.ok(
      diags.some((w) => /next\/script/.test(w)),
      `expected next/script warning, got: ${JSON.stringify(diags)}`,
    );
    assert.ok(
      diags.some((w) => /dangerouslySetInnerHTML/.test(w)),
      `expected dangerouslySetInnerHTML warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('warns on bare {fields.X} children and JSON.stringify(fields)', () => {
    const diags = collectTsxEmitContractDiagnostics(`
const { fields } = props;
return <div>{fields.Title}{JSON.stringify(fields)}</div>;
`);
    assert.ok(
      diags.some((w) => /bare \{fields/.test(w)),
      `expected bare fields warning, got: ${JSON.stringify(diags)}`,
    );
    assert.ok(
      diags.some((w) => /JSON\.stringify\(fields\)/.test(w)),
      `expected JSON.stringify warning, got: ${JSON.stringify(diags)}`,
    );
  });

  it('does not flag card={fields.CardOne} or field={fields.Heading} attribute binds', () => {
    const diags = collectTsxEmitContractDiagnostics(`
const { fields } = props;
return (
  <section>
    <Text field={fields.Heading} />
    <CardView card={fields.CardOne} />
    <CardView card={fields.CardTwo} />
  </section>
);
`);
    assert.ok(
      !diags.some((w) => /bare \{fields|interpolate Field objects/.test(w)),
      `expected no bare-fields false positive, got: ${JSON.stringify(diags)}`,
    );
  });
});
