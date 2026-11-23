/**
 * Prompt + CONTRACT + fixup for sitecoreize Field/Link/definition TS failures.
 * Run: node --import tsx --test tools/create-section-components/sitecoreize-tsx-field-usage.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD,
  SITECOREIZE_TSX_FIELD_USAGE_HARD,
} from './section-codegen.mjs';
import {
  coerceLooseFieldValueStringAttrs,
  rewriteItemTemplateChildrenToChildItemTemplate,
  hoistNestedChildItemTemplate,
  wrapOptionalSitecoreFieldComponents,
} from './ai-source-fixup.mjs';
import {
  collectFieldUsageContractDiagnostics,
  collectMapEntryClientFieldsContractDiagnostics,
} from './tsx-contract-diagnostics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('SITECOREIZE_TSX_FIELD_USAGE_HARD', () => {
  it('exports HARD covering Field-as-DOM, childItemTemplate, Link guard, map-entry fields', async () => {
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /^HARD —/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /aria-label/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /childItemTemplate/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /itemTemplate\.children/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /emptyLinkField|defined LinkField/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /Map-entry|map-entry/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /JSX\.Element \| null/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /return null/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /TS2322/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /\(props: Props\)/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /fields=\{datasource\}/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /never calls getDatasource|never calls getDatasource/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /data-\*/);
    const src = await readFile(path.join(__dirname, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /SITECOREIZE_TSX_FIELD_USAGE_HARD/);
    const system = await readFile(
      path.join(__dirname, 'prompts/system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(system, /childItemTemplate/);
    assert.match(system, /aria-label/);
    assert.match(system, /JSX\.Element \| null/);
    assert.match(system, /return null/);
    assert.match(system, /\(props: Props\)/);
    assert.match(system, /fields=\{datasource\}/);
    assert.match(system, /data-\*/);
  });
});

describe('SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD', () => {
  it('exports HARD covering self-nest ban and LinkList placeholders: []', async () => {
    assert.match(SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD, /^HARD —/);
    assert.match(SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD, /own definitionKey/);
    assert.match(SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD, /placeholders:\s*\[\]/);
    const src = await readFile(path.join(__dirname, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /SITECOREIZE_NO_SELF_ALLOWED_CONTROLS_HARD/);
    const system = await readFile(
      path.join(__dirname, 'prompts/system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(system, /own definitionKey/);
    assert.match(system, /LinkList \/ platform/);
  });
});

describe('rewriteItemTemplateChildrenToChildItemTemplate', () => {
  it('rewrites itemTemplate.children → childItemTemplate then hoist lifts to model', () => {
    const def = `
export const x = {
  model: {
    folderTemplate: { name: 'Link List Folder' },
    itemTemplate: {
      name: 'Link List',
      sections: [{ name: 'Content', fields: [] }],
      children: {
        itemTemplate: {
          name: 'Link',
          sections: [{ name: 'Content', fields: [{ name: 'Link', type: 'General Link' }] }],
        },
      },
    },
  },
  placeholders: [],
};
`;
    const rewritten = rewriteItemTemplateChildrenToChildItemTemplate(def);
    assert.match(rewritten, /childItemTemplate\s*:/);
    assert.doesNotMatch(rewritten, /itemTemplate\s*:\s*\{[\s\S]*\bchildren\s*:/);
    const hoisted = hoistNestedChildItemTemplate(rewritten);
    assert.match(hoisted, /itemTemplate\s*:\s*\{[\s\S]*?\},\s*\n\s*childItemTemplate\s*:/s);
  });
});

describe('coerceLooseFieldValueStringAttrs', () => {
  it('coerces aria-label={title?.value} to typeof string check', () => {
    const out = coerceLooseFieldValueStringAttrs(
      '<nav aria-label={title?.value || undefined}>',
    );
    assert.match(
      out,
      /aria-label=\{typeof title\?\.value === 'string' \? title\.value : undefined\}/,
    );
  });
});

describe('wrapOptionalSitecoreFieldComponents nested fields', () => {
  it('guards field={item.fields?.Link}', () => {
    const src = `
export const Default = ({ fields }) => (
  <ul>
    {(fields?.children?.results ?? []).map((item, index) => (
      <li key={index}>
        <Link field={item.fields?.Link} />
      </li>
    ))}
  </ul>
);
`;
    const out = wrapOptionalSitecoreFieldComponents(src);
    assert.match(out, /item\.fields\?\.Link \?/);
    assert.match(out, /field=\{item\.fields\.Link\}/);
  });
});

describe('collectFieldUsageContractDiagnostics', () => {
  it('flags loose Field.value aria-label', () => {
    const diags = collectFieldUsageContractDiagnostics({
      tsx: '<nav aria-label={title?.value}>',
    });
    assert.ok(diags.some((d) => /typeof === "string"/.test(d)));
  });

  it('flags LinkField.url', () => {
    const diags = collectFieldUsageContractDiagnostics({
      clientTsx: 'href={getFieldValue(fields["Home Link"])?.url || "/"}',
    });
    assert.ok(diags.some((d) => /no \.url/.test(d)));
  });

  it('flags itemTemplate.children in definitionTs', () => {
    const diags = collectFieldUsageContractDiagnostics({
      definitionTs: `
model: {
  itemTemplate: {
    name: 'Link List',
    children: { itemTemplate: { name: 'Link', sections: [] } },
  },
},
`,
    });
    assert.ok(diags.some((d) => /childItemTemplate/.test(d)));
  });

  it('flags optional Link field into required prop', () => {
    const diags = collectFieldUsageContractDiagnostics({
      tsx: '<Link field={item.fields?.Link} />',
    });
    assert.ok(diags.some((d) => /fields\?\.Link/.test(d)));
  });
});

describe('collectMapEntryClientFieldsContractDiagnostics', () => {
  it('flags map-entry without fields spreading into client that requires fields', () => {
    const diags = collectMapEntryClientFieldsContractDiagnostics({
      tsx: `
import Client from './x.client';
type Props = ComponentWithContextProps;
export const Default = (props: Props) => <Client {...props} />;
`,
      clientTsx: `
type Props = ComponentWithContextProps & { fields: Fields };
export default function Client(props: Props) { return null; }
`,
    });
    assert.ok(diags.some((d) => /TS2741|requires fields/.test(d)));
  });
});
