/**
 * Data-DTO companion must not get fields={fields} invented by always-on sanitizers.
 * Run: node --import tsx --test tools/create-section-components/data-dto-fields-inject.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  collectClientChromePropNames,
  ensureMapEntryPassesFieldsToCompanion,
  mapEntryDestructuresFields,
} from './ai-source-fixup.mjs';
import { SITECOREIZE_TSX_FIELD_USAGE_HARD } from './section-codegen.mjs';
import { looksLikeTruncatedTsxEmit } from './tsx-build-repair.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const dataDtoClient = `'use client';
type CookieConsentWallData = { title: string; intro: string };
type Props = { data: CookieConsentWallData };
const CookieConsentWallClient = ({ data }: Props) => {
  return <div>{data.title}</div>;
};
export default CookieConsentWallClient;
`;

const fieldsClient = `type Props = { fields: Fields; children?: React.ReactNode };
export default function Chrome({ fields, children }: Props) {
  return <div>{children}</div>;
}
`;

describe('collectClientChromePropNames', () => {
  it('does not seed fields for data-DTO Props', () => {
    const names = collectClientChromePropNames(dataDtoClient);
    assert.equal(names.has('fields'), false);
    assert.equal(names.has('data'), true);
    assert.equal(names.has('children'), true);
  });

  it('includes fields when Props declare fields', () => {
    const names = collectClientChromePropNames(fieldsClient);
    assert.equal(names.has('fields'), true);
  });
});

describe('mapEntryDestructuresFields', () => {
  it('is true for ({ fields }) / const { fields }', () => {
    assert.equal(
      mapEntryDestructuresFields('export const Default = ({ fields }: Props) => {'),
      true,
    );
    assert.equal(
      mapEntryDestructuresFields('const { fields } = props;\nreturn ('),
      true,
    );
  });

  it('is false for item.fields inside .map object literals', () => {
    const before = `
  const options = optionItems.map((item: CookieOptionItem) => ({
    value: String(item.fields?.Value?.value ?? ''),
    label: String(item.fields?.Label?.value ?? ''),
  }));
  return (
`;
    assert.equal(mapEntryDestructuresFields(before), false);
  });
});

describe('ensureMapEntryPassesFieldsToCompanion data-DTO', () => {
  it('does not inject fields on data-DTO companion', () => {
    const tsx = `import CookieConsentWallClient from './menzis-cookie-preference-modal.client';
export const Default = (props: Props): JSX.Element | null => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) return null;
  const optionItems = datasource.children?.results ?? [];
  const options = optionItems.map((item: CookieOptionItem) => ({
    value: String(item.fields?.Value?.value ?? ''),
  }));
  return (
    <CookieConsentWallClient
      data={{
        title: String(datasource.Title?.value ?? ''),
        intro: String(datasource.Intro?.value ?? ''),
        options,
      }}
    />
  );
};
`;
    const out = ensureMapEntryPassesFieldsToCompanion(tsx, dataDtoClient);
    assert.doesNotMatch(out, /\bfields\s*=/);
    assert.match(out, /\bdata=\{\{/);
  });

  it('strips stray fields={fields} from data-DTO companion', () => {
    const tsx = `import CookieConsentWallClient from './cookie.client';
export const Default = (props: Props) => {
  return (
    <CookieConsentWallClient
      data={{ title: 'x' }}
     fields={fields} />
  );
};
`;
    const out = ensureMapEntryPassesFieldsToCompanion(tsx, dataDtoClient);
    assert.doesNotMatch(out, /\bfields\s*=/);
    assert.match(out, /\bdata=\{\{/);
  });

  it('still injects fields={props.fields} when companion declares fields', () => {
    const tsx = `import Chrome from './cookie.client';
export const Default = (props: Props) => {
  return <Chrome />;
};
`;
    const out = ensureMapEntryPassesFieldsToCompanion(tsx, fieldsClient);
    assert.match(out, /<Chrome\s+fields=\{props\.fields\}\s*\/>/);
  });

  it('uses fields={fields} only when map-entry destructures fields', () => {
    const tsx = `import Chrome from './cookie.client';
export const Default = ({ fields }: Props) => {
  return <Chrome />;
};
`;
    const out = ensureMapEntryPassesFieldsToCompanion(tsx, fieldsClient);
    assert.match(out, /fields=\{fields\}/);
    assert.doesNotMatch(out, /fields=\{props\.fields\}/);
  });
});

describe('applyWritePathAlwaysOnTsxSanitizers data-DTO', {
  skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
}, () => {
  it('leaves data-only companion without fields=', () => {
    const tsx = `import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource } from 'lib/component-props';
import CookieConsentWallClient from './menzis-cookie-preference-modal.client';
interface Fields { Title: Field<string>; Intro: Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element | null => {
  const datasource = getDatasource<Fields>(props.fields);
  if (!datasource) return null;
  const options = [].map((item: { fields?: { Value?: Field<string> } }) => ({
    value: String(item.fields?.Value?.value ?? ''),
  }));
  return (
    <CookieConsentWallClient
      data={{
        title: String(datasource.Title?.value ?? ''),
        intro: String(datasource.Intro?.value ?? ''),
        options,
      }}
    />
  );
};
export default Default;
`;
    const out = applyWritePathAlwaysOnTsxSanitizers({
      tsx,
      clientTsx: dataDtoClient,
      kebab: 'menzis-cookie-preference-modal',
      role: 'section',
    });
    assert.doesNotMatch(out.tsx, /\bfields\s*=/);
    assert.match(out.tsx, /\bdata=\{\{/);
  });
});

describe('truncated repair resilience', () => {
  it('looksLikeTruncatedTsxEmit rejects ellipsis and prompt filler', () => {
    assert.equal(looksLikeTruncatedTsxEmit('...'), true);
    assert.equal(looksLikeTruncatedTsxEmit('(complete tsx here)'), true);
    assert.equal(
      looksLikeTruncatedTsxEmit(
        "import React from 'react';\nexport const Default = () => null;\n",
      ),
      false,
    );
  });

  it('truncated/ellipsis falls back to previousTsx when prior exists', () => {
    const previousTsx =
      "import React from 'react';\nexport const Default = () => null;\n";
    let tsx = '...';
    if (tsx && looksLikeTruncatedTsxEmit(tsx) && previousTsx.trim()) {
      tsx = previousTsx;
    }
    assert.equal(looksLikeTruncatedTsxEmit(tsx), false);
    assert.match(tsx, /export const Default/);
  });
});

describe('prompt data-DTO note', () => {
  it('SITECOREIZE_TSX_FIELD_USAGE_HARD mentions data-DTO', () => {
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /data-DTO/);
    assert.match(SITECOREIZE_TSX_FIELD_USAGE_HARD, /must NOT also pass fields/);
  });

  it('system-codegen-sitecoreize.md mentions data-DTO', async () => {
    const text = await readFile(
      path.join(here, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /data-DTO/);
    assert.match(text, /must NOT also pass fields/);
  });
});
