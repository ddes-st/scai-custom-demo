/**
 * Run: node --import tsx --test tools/create-section-components/json-bag-field-map.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectJsonBagDirectMapContractDiagnostics,
  hydrateDirectMappedJsonBagFields,
  promoteJsonBagPackageAlwaysOn,
  tsxDirectMapsFieldAsArray,
} from './json-bag-field-map.mjs';

const def = `
export const menzisHelpCardGridDefinition = {
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Cards', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: 'Help Cards',
      fields: {
        Heading: 'We helpen je graag verder',
        Cards: JSON.stringify([
          {
            title: 'Wel verzekerd bij Menzis.',
            links: [{ label: 'Declaratie indienen', href: 'https://example.com/a' }],
          },
        ]),
      },
    }],
  },
};
`;

const badTsx = `
import { Text, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Card {
  title: Field<string>;
  'Link 1': LinkField;
}
interface Fields {
  Heading: Field<string>;
  Cards: Card[];
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = ({ fields }: Props): JSX.Element => (
  <section>
    {fields.Cards.map((card: Card, index: number) => (
      <div key={index}>
        <Text field={card.title} />
        <Link field={card['Link 1']} />
      </div>
    ))}
  </section>
);
`;

describe('json-bag-field-map', () => {
  it('flags fields.Cards.map on Multi-LineText JSON bag', () => {
    assert.equal(tsxDirectMapsFieldAsArray(badTsx, 'Cards'), true);
    const diags = collectJsonBagDirectMapContractDiagnostics({
      definitionTs: def,
      tsx: badTsx,
    });
    assert.ok(diags.length >= 1);
    assert.ok(diags.some((d) => /childItemTemplate/.test(d)));
  });

  it('promotes bag to childItemTemplate + getDatasource children.results', () => {
    const out = promoteJsonBagPackageAlwaysOn({
      definitionTs: def,
      tsx: badTsx,
    });
    assert.deepEqual(out.promoted, ['Cards']);
    assert.match(out.definitionTs, /childItemTemplate/);
    assert.match(out.definitionTs, /children:\s*\[/);
    assert.doesNotMatch(out.definitionTs, /Cards:\s*JSON\.stringify/);
    assert.match(out.tsx, /getDatasource/);
    assert.match(out.tsx, /children\?\.results/);
    assert.match(out.tsx, /card\.fields\.Title/);
    assert.deepEqual(
      collectJsonBagDirectMapContractDiagnostics({
        definitionTs: out.definitionTs,
        tsx: out.tsx,
      }),
      [],
    );
  });

  it('promotes title/body feature bags with Icon svgMarkup from icon-font HTML', () => {
    const featureDef = `
export const menzisSupportFeatureCardDefinition = {
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: 'Heading', type: 'Single-Line Text' },
          { name: 'Cards', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: 'Why Choose Menzis',
      fields: {
        Heading: 'Daarom kies je Menzis:',
        Cards: JSON.stringify([
          { title: 'Iedereen is welkom', body: 'We selecteren niet' },
        ]),
      },
    }],
  },
};
`;
    const featureTsx = `
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Card { title: Field<string>; body: Field<string>; }
interface Fields { Heading: Field<string>; Cards: Card[]; }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = ({ fields }: Props): JSX.Element => (
  <section>
    {fields.Cards.map((card: Card, index: number) => (
      <button key={index}>
        <span aria-hidden="true" className="mx-auto mb-6 h-12 w-12 rounded-full border-4 border-[#fcb53c] bg-[#043572]" />
        <span>{card.title?.value}</span>
        <span>{card.body?.value}</span>
      </button>
    ))}
  </section>
);
`;
    const sectionHtml = `
<div class="card image--top"><span class="icon"><i class="ic-mnz-people"><span data-bq-glyph="A"></span><span data-bq-glyph="B"></span></i></span><h3>Iedereen is welkom</h3></div>
.ic-mnz-people::before { content: "A"; }
.ic-mnz-people::after { content: "B"; }
`;
    // Minimal font with glyphs A/B (codepoints) — skip real paths; enrichment no-ops without d=
    const out = promoteJsonBagPackageAlwaysOn({
      definitionTs: featureDef,
      tsx: featureTsx,
      sectionHtml,
      fontSvg: '',
    });
    assert.deepEqual(out.promoted, ['Cards']);
    assert.match(out.definitionTs, /childItemTemplate/);
    assert.match(out.definitionTs, /name: "Icon"/);
    assert.match(out.tsx, /card\.fields\.Title/);
    assert.match(out.tsx, /card\.fields\.Body/);
    assert.match(out.tsx, /card\.fields\.Icon/);
    assert.match(out.tsx, /<Image field=\{card\.fields\.Icon\}/);
  });

  it('hydrates preview Field bag into array for direct map TSX', () => {
    const fields = {
      Cards: {
        value: JSON.stringify([
          {
            title: 'Wel verzekerd bij Menzis.',
            links: [{ label: 'A', href: 'https://example.com/a' }],
          },
        ]),
      },
    };
    const hydrated = hydrateDirectMappedJsonBagFields(fields, badTsx);
    assert.ok(Array.isArray(hydrated.Cards));
    assert.equal(
      /** @type {any} */ (hydrated.Cards)[0].title.value,
      'Wel verzekerd bij Menzis.',
    );
    assert.equal(
      /** @type {any} */ (hydrated.Cards)[0]['Link 1'].value.href,
      'https://example.com/a',
    );
  });
});
