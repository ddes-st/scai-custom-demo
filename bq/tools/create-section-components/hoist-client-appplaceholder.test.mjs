/**
 * Run: node --test tools/create-section-components/hoist-client-appplaceholder.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractClientAppPlaceholderBases,
  hoistClientAppPlaceholderToServerChildren,
} from './ai-source-fixup.mjs';

const THIN_MAP_ENTRY = `
import React, { JSX } from 'react';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import MenzisSiteHeaderClient from './menzis-site-header.client';

interface Fields { 'Context Label': Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) return <div>Missing Component Datasource.</div>;
  return <MenzisSiteHeaderClient {...props} />;
};
`;

const BAD_CLIENT = `'use client';

import React, { JSX, useState } from 'react';
import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields { 'Context Label': Field<string>; }
type Props = ComponentWithContextProps & { fields: Fields };

export default function MenzisSiteHeaderClient({ fields, rendering, page }: Props): JSX.Element {
  const [contextOpen, setContextOpen] = useState(false);
  const contextPlaceholder = 'context-links';
  return (
    <header>
      <button type="button" onClick={() => setContextOpen(!contextOpen)}>
        <Text field={fields['Context Label']} />
      </button>
      {contextOpen ? (
        <nav>
          <AppPlaceholder
            name={contextPlaceholder}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </nav>
      ) : null}
    </header>
  );
}
`;

describe('extractClientAppPlaceholderBases', () => {
  it('resolves const ident name={contextPlaceholder}', () => {
    assert.deepEqual(extractClientAppPlaceholderBases(BAD_CLIENT), [
      'context-links',
    ]);
  });

  it('reads literal name=', () => {
    assert.deepEqual(
      extractClientAppPlaceholderBases(
        `<AppPlaceholder name="cookie-categories" rendering={r} page={p} componentMap={m} />`,
      ),
      ['cookie-categories'],
    );
  });
});

describe('hoistClientAppPlaceholderToServerChildren', () => {
  it('hoists thin map-entry + client AppPlaceholder into server children', () => {
    const { tsx, clientTsx, changed } =
      hoistClientAppPlaceholderToServerChildren({
        tsx: THIN_MAP_ENTRY,
        clientTsx: BAD_CLIENT,
      });
    assert.equal(changed, true);
    assert.match(tsx, /<AppPlaceholder\b/);
    assert.match(tsx, /name="context-links"/);
    assert.match(tsx, /componentMap=\{componentMap\}/);
    assert.match(
      tsx,
      /<MenzisSiteHeaderClient\b[\s\S]*fields=\{props\.fields\}[\s\S]*<AppPlaceholder/,
    );
    assert.doesNotMatch(clientTsx, /<AppPlaceholder\b/);
    assert.doesNotMatch(clientTsx, /\.sitecore\/component-map/);
    assert.match(clientTsx, /\{children\}/);
    assert.match(clientTsx, /children/);
  });

  it('no-ops when client is already clean', () => {
    const cleanClient = `'use client';
import type { ReactNode } from 'react';
export default function Chrome({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
`;
    const { changed } = hoistClientAppPlaceholderToServerChildren({
      tsx: THIN_MAP_ENTRY,
      clientTsx: cleanClient,
    });
    assert.equal(changed, false);
  });

  it('strips client when server already mounts PH as children', () => {
    const server = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import Chrome from './x.client';
export const Default = (props) => (
  <Chrome fields={props.fields}>
    <AppPlaceholder name="context-links" rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </Chrome>
);
`;
    const { tsx, clientTsx, changed } =
      hoistClientAppPlaceholderToServerChildren({
        tsx: server,
        clientTsx: BAD_CLIENT,
      });
    assert.equal(changed, true);
    assert.match(tsx, /<AppPlaceholder\b/);
    assert.doesNotMatch(clientTsx, /<AppPlaceholder\b/);
    assert.match(clientTsx, /\{children\}/);
  });

  it('skips tangled map-entry (not a thin wrapper)', () => {
    const tangled = `
import Chrome from './x.client';
import { Text } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => (
  <section>
    <Text field={props.fields.Title} />
    <Chrome fields={props.fields} />
  </section>
);
`;
    const { changed } = hoistClientAppPlaceholderToServerChildren({
      tsx: tangled,
      clientTsx: BAD_CLIENT,
    });
    assert.equal(changed, false);
  });
});
