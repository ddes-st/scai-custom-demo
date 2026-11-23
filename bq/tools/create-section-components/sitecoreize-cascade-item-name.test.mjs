/**
 * Cascade fixes: Path names after JSON-bag promote + CardItem rewrite + build-repair def.
 * Run: node --import tsx --test tools/create-section-components/sitecoreize-cascade-item-name.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
} from './ai-source-fixup.mjs';
import { sanitizeDefinitionContentItemPathNamesSync } from './definition-path-name-normalize.mjs';
import {
  pathSafeChildItemName,
  promoteJsonBagPackageAlwaysOn,
  rewriteTsxBagMapToChildResults,
} from './json-bag-field-map.mjs';
import { SITECOREIZE_TSX_FIELD_USAGE_HARD } from './section-codegen.mjs';
import {
  diagnosticsNeedDefinitionRepair,
} from './tsx-build-repair.mjs';
import { extractTsxPackageFromLlm } from './tsx-format-repair.mjs';
import { collectEnglishItemNameAndCultureDiagnostics } from './content-seed-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('pathSafeChildItemName', () => {
  it('strips ? from Path names while leaving readable words', () => {
    const name = pathSafeChildItemName(
      'Kan het lekkerder? Slapen...',
      'Card',
    );
    assert.doesNotMatch(name, /\?/);
    assert.match(name, /Kan het lekkerder/i);
  });
});

describe('promoteJsonBag Path sanitize', () => {
  it('promotes media bag titles with ? into Path-safe children[].name', () => {
    const def = `
export const band = {
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
    culture: 'nl-NL',
    items: [{
      name: 'More Health',
      fields: {
        Heading: 'Meer gezondheid',
        Cards: JSON.stringify([
          {
            title: 'Kan het lekkerder? Slapen...',
            text: 'Body one',
            image: 'https://example.com/a.jpg',
            href: 'https://example.com/a',
          },
          {
            title: 'Zit je niet lekker in je vel?',
            text: 'Body two',
            image: 'https://example.com/b.jpg',
            href: 'https://example.com/b',
          },
        ]),
      },
    }],
  },
};
`;
    const tsx = `
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface HealthCard { title: string; href: string; text: string; }
interface Fields { Heading: Field<string>; Cards: HealthCard[]; }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = ({ fields }: Props): JSX.Element => (
  <section>
    {fields.Cards.map((card: HealthCard, index: number) => (
      <a key={index} href={card.href}>{card.title}<span>{card.text}</span></a>
    ))}
  </section>
);
`;
    const out = promoteJsonBagPackageAlwaysOn({ definitionTs: def, tsx });
    assert.ok(out.promoted.includes('Cards'));
    assert.match(out.definitionTs, /childItemTemplate/);
    assert.doesNotMatch(out.definitionTs, /name:\s*['"][^'"]*\?/);
    assert.match(out.definitionTs, /Kan het lekkerder Slapen/);
    // Title field keeps punctuation
    assert.match(out.definitionTs, /Title:.*"Kan het lekkerder\? Slapen/);
    const diags = collectEnglishItemNameAndCultureDiagnostics({
      definitionTs: out.definitionTs,
      sourceCulture: 'nl-NL',
    });
    assert.ok(
      !diags.some((d) => /valid Sitecore item name/i.test(d)),
      diags.join('\n'),
    );
  });
});

describe('sanitizeDefinitionContentItemPathNamesSync', () => {
  it('sanitizes already-promoted children names with ?', () => {
    const src = `
export const x = {
  content: {
    items: [{
      name: 'Parent',
      fields: { Heading: 'H' },
      children: [
        { name: 'Wacht je op een behandeling?', fields: { Title: 'Wacht je op een behandeling?' } },
      ],
    }],
  },
};
`;
    const { text, changed } = sanitizeDefinitionContentItemPathNamesSync(src);
    assert.ok(changed >= 1);
    assert.doesNotMatch(text, /name:\s*"Wacht je op een behandeling\?"/);
    assert.match(text, /displayName:\s*"Wacht je op een behandeling\?"/);
  });
});

describe('applyWritePathAlwaysOnTsxSanitizers Path after promote', {
  skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
}, () => {
  it('Path-sanitizes promoted children before returning definitionTs', () => {
    const def = `
export const band = {
  model: {
    itemTemplate: {
      sections: [{
        fields: [
          { name: 'Cards', type: 'Multi-Line Text' },
        ],
      }],
    },
  },
  content: {
    items: [{
      name: 'Band',
      fields: {
        Cards: JSON.stringify([
          { title: 'Hello?', text: 't', image: '/a.jpg', href: '#' },
        ]),
      },
    }],
  },
};
`;
    const tsx = `
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields { Cards: Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = ({ fields }: Props): JSX.Element => <div />;
`;
    const out = applyWritePathAlwaysOnTsxSanitizers({
      tsx,
      definitionTs: def,
      kebab: 'menzis-health-card-band',
      role: 'child',
    });
    assert.doesNotMatch(out.definitionTs, /name:\s*['"]Hello\?['"]/);
  });
});

describe('rewriteTsxBagMapToChildResults cascade', () => {
  it('rewrites href, Field text children, and drops HealthCard mismatch', () => {
    const def = `
export const band = {
  model: { childItemTemplate: { name: 'Card' } },
  content: { items: [{ name: 'Band', fields: {}, children: [] }] },
};
`;
    const tsx = `
import { Link } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';
interface HealthCard {
  title: string;
  href: string;
  text: string;
}
interface CardItemFields {
  Title: Field<string>;
  Text?: Field<string>;
  Image: ImageField;
  Link: LinkField;
  Action: LinkField;
}
interface CardItem {
  fields: CardItemFields;
}
interface Fields {
  children?: { results?: CardItem[] };
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) return <div />;
  const fields = datasource;
  const cards = datasource.children?.results ?? [];
  return (
    <section>
      {cards.map((card: HealthCard, index: number) => (
        <a key={index} href={card.href}>
          {card.fields.Title}
          <span>{card.fields.Text}</span>
        </a>
      ))}
    </section>
  );
};
`;
    const out = rewriteTsxBagMapToChildResults(tsx, def, {
      bagName: 'Cards',
      kind: 'media',
    });
    assert.match(out, /card: CardItem/);
    assert.doesNotMatch(out, /interface HealthCard/);
    assert.match(out, /card\.fields\.Link\?\.value\?\.href/);
    assert.match(out, /<Text field=\{card\.fields\.Title\}/);
    assert.match(out, /<Text field=\{card\.fields\.Text\}/);
    assert.match(out, /\bText\b.*@sitecore-content-sdk\/nextjs/);
  });
});

describe('build repair definition attach', () => {
  it('diagnosticsNeedDefinitionRepair detects item-name CONTRACT', () => {
    assert.equal(
      diagnosticsNeedDefinitionRepair([
        'CONTRACT: HARD: content.items[].name must be a valid Sitecore item name (no / \\ ? % * : | " < > \') — invalid: "Hello?"',
      ]),
      true,
    );
    assert.equal(
      diagnosticsNeedDefinitionRepair(['TSC: Type Field is not assignable']),
      false,
    );
  });

  it('extractTsxPackageFromLlm parses definitionTs marker', () => {
    const parsed = extractTsxPackageFromLlm(
      [
        '=== tsx ===',
        'export const Default = () => null;',
        '=== definitionTs ===',
        'export const def = { content: { items: [{ name: "Safe", fields: {} }] } };',
      ].join('\n'),
      { expectDefinition: true },
    );
    assert.match(parsed.tsx, /export const Default/);
    assert.match(parsed.definitionTs || '', /name: "Safe"/);
  });
});

describe('prompt Path safety HARD', () => {
  it('DEFINITION SCHEMA bans ? in Path names and children[].name', async () => {
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /children\[\]\.name must be ItemNameValidation-safe/);
    assert.match(src, /Kan het lekkerder\?/);
    assert.match(src, /JSON-bag row title may keep punctuation/);
  });

  it('SITECOREIZE_TSX_FIELD_USAGE_HARD covers nested card.fields', () => {
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /card\.fields\.Title/);
  });

  it('system-codegen-sitecoreize.md includes Path name HARD', async () => {
    const text = await readFile(
      path.join(here, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /ItemNameValidation-safe/);
    assert.match(text, /children\[\]\.name/);
    assert.match(text, /card\.fields\.Title/);
  });
});
