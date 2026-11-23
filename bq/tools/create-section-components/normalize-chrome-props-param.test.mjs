/**
 * (props: Props) normalize, unwrap-at-map-entry, strip client getDatasource, capture data-*.
 * Run: node --import tsx --test tools/create-section-components/normalize-chrome-props-param.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyWritePathAlwaysOnTsxSanitizers,
  WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
  ensureMapEntryUnwrapsDatasourceForCompanion,
  isAllowedBqDataAttribute,
  normalizeChromeToPropsParam,
  stripCaptureDataAttributes,
  stripClientGetDatasource,
} from './ai-source-fixup.mjs';

const cookieClientBare = `'use client';
import { getDatasource } from 'lib/component-props';
import React, { JSX, useState } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface CookieOptionItem {
  id?: string;
  fields: { Value: Field<string>; Label: Field<string> };
}

export interface Fields {
  Title: Field<string>;
  children?: { results?: CookieOptionItem[] };
}

type Props = { fields: Fields };

const CookieConsentWallClient = ({ fields }: Props): JSX.Element | null => {
  const datasource = getDatasource(props.fields);
  const options = datasource?.children?.results ?? [];
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div>
      <Text field={fields.Title} />
      {options.map((option: CookieOptionItem) => (
        <Text key={option.id} field={option.fields.Label} />
      ))}
    </div>
  );
};

export default CookieConsentWallClient;
`;

describe('normalizeChromeToPropsParam', () => {
  it('rewrites ({ fields }) to (props: Props) and fields. to props.fields.', () => {
    const out = normalizeChromeToPropsParam(cookieClientBare);
    assert.match(out, /\(props:\s*Props\)/);
    assert.doesNotMatch(out, /\(\s*\{\s*fields\s*\}\s*:\s*Props\)/);
    assert.match(out, /props\.fields\.Title/);
    assert.match(out, /option\.fields\.Label/);
  });

  it('is a no-op when already (props: Props)', () => {
    const src = `export default function C(props: Props) {\n  return <Text field={props.fields.Title} />;\n}\n`;
    assert.equal(normalizeChromeToPropsParam(src), src);
  });
});

describe('stripClientGetDatasource', () => {
  it('removes getDatasource and uses props.fields', () => {
    const normalized = normalizeChromeToPropsParam(cookieClientBare);
    const out = stripClientGetDatasource(normalized);
    assert.doesNotMatch(out, /\bgetDatasource\b/);
    assert.match(out, /props\.fields\?\.children|\bprops\.fields\.children/);
    assert.match(out, /props\.fields\.Title/);
  });
});

describe('ensureMapEntryUnwrapsDatasourceForCompanion', () => {
  it('inserts getDatasource and rewrites fields={props.fields} to fields={datasource}', () => {
    const client = `type Props = { fields: Fields };
export default function Chrome(props: Props) {
  return <Text field={props.fields.Title} />;
}
`;
    const tsx = `import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { Field } from '@sitecore-content-sdk/nextjs';
import Chrome from './menzis-cookie-preference-modal.client';

interface Fields { Title: Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) return <div>Missing</div>;
  return <Chrome fields={props.fields} />;
};
`;
    const out = ensureMapEntryUnwrapsDatasourceForCompanion(tsx, client);
    assert.match(out, /getDatasource(?:<Fields>)?\(props\.fields\)/);
    assert.match(out, /fields=\{datasource\}/);
    assert.doesNotMatch(out, /fields=\{props\.fields\}/);
  });
});

describe('stripCaptureDataAttributes', () => {
  it('strips capture data-* and keeps BQ allowlist', () => {
    assert.equal(isAllowedBqDataAttribute('data-bq-glyph'), true);
    assert.equal(isAllowedBqDataAttribute('data-media-tab-item'), true);
    assert.equal(isAllowedBqDataAttribute('data-mobile-menu-toggle'), true);
    assert.equal(isAllowedBqDataAttribute('data-testid'), false);

    const src = `<div data-component-name="Cookie" data-testid="x" data-bq-glyph="ic-1" data-media-tab-item data-mobile-menu-toggle className="x">ok</div>`;
    const out = stripCaptureDataAttributes(src);
    assert.doesNotMatch(out, /data-component-name/);
    assert.doesNotMatch(out, /data-testid/);
    assert.match(out, /data-bq-glyph/);
    assert.match(out, /data-media-tab-item/);
    assert.match(out, /data-mobile-menu-toggle/);
  });
});

describe('write-path sanitize cookie + map-entry', {
  skip: !WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED,
}, () => {
  it('applyWritePathAlwaysOnTsxSanitizers applies full contract', () => {
    const mapEntry = `import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import type { Field } from '@sitecore-content-sdk/nextjs';
import CookieConsentWallClient from './menzis-cookie-preference-modal.client';

interface Fields { Title: Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) return <div>Missing</div>;
  return <CookieConsentWallClient fields={props.fields} />;
};
`;
    const { tsx, clientTsx } = applyWritePathAlwaysOnTsxSanitizers({
      tsx: mapEntry,
      clientTsx: cookieClientBare,
      kebab: 'menzis-cookie-preference-modal',
    });

    assert.match(tsx, /getDatasource/);
    assert.match(tsx, /fields=\{datasource\}/);

    assert.ok(clientTsx);
    assert.match(clientTsx, /\(props:\s*Props\)/);
    assert.doesNotMatch(clientTsx, /\bgetDatasource\b/);
    assert.match(clientTsx, /props\.fields\.Title/);
    assert.match(clientTsx, /option\.fields\.Label/);
  });
});
