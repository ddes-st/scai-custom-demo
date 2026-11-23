/**
 * Write-path companion import contract (prompt-first safe).
 * Run: node --import tsx --test tools/create-section-components/write-component.client-import.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  _resetFixupSkipLogsForTests,
  setCodegenV2Fixups,
  shouldSkipMutatingTsxFixups,
} from './ai-source-fixup.mjs';
import { writeComponentPackage } from './write-component.mjs';

const HOST = '__test-client-import-host__';
const COMPONENT = 'CrelanResponsiveNavigationHeader';
const KEBAB = 'crelan-responsive-navigation-header';

const DEFINITION = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const crelanResponsiveNavigationHeaderDefinition = {
  kind: "component",
  collectionSystem: "crelan",
  siteSystem: "crelan-be",
  definitionKey: "crelan-responsive-navigation-header",
  name: "crelan-responsive-navigation-header",
  componentName: "CrelanResponsiveNavigationHeader",
  displayName: "Responsive Navigation Header",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Primary Navigation Headers'] },
  model: {
    folderTemplate: { name: 'Primary Navigation Header Folder' },
    itemTemplate: {
      name: 'Primary Navigation Header',
      sections: [{
        name: 'Content',
        fields: [{ name: 'Menu Label', type: 'Single-Line Text' }],
      }],
    },
  },
  placeholders: [],
  content: {
    location: { root: 'data', folder: ['Primary Navigation Headers'] },
    culture: "en",
    items: [{ name: 'Primary Navigation Header', fields: { 'Menu Label': 'Menu' } }],
  },
} satisfies ComponentTemplateDefinition;
`;

const BAD_TSX = `import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';
import HeaderClient from './CrelanPrimaryNavigationHeader.client';

type Props = ComponentWithContextProps & { fields: { 'Menu Label'?: { value?: string } } };

export const Default = (props: Props): JSX.Element => {
  if (!props.fields) return <div>Missing</div>;
  return <HeaderClient {...props} />;
};

export default Default;
`;

const CLIENT_TSX = `'use client';
import React, { JSX } from 'react';
import type { ComponentWithContextProps } from 'lib/component-props';

export default function Chrome(props: ComponentWithContextProps): JSX.Element {
  return <header>{props.children}</header>;
}
`;

describe('writeComponentPackage companion .client import', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  /** @type {string|undefined} */
  let prevV2Fixups;

  before(async () => {
    prevV2Fixups = process.env.BQ_CODEGEN_V2_FIXUPS;
    delete process.env.BQ_CODEGEN_V2_FIXUPS;
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
    await rm(hostDir, { recursive: true, force: true });
    await mkdir(hostDir, { recursive: true });
  });

  after(async () => {
    await rm(hostDir, { recursive: true, force: true });
    if (prevV2Fixups === undefined) delete process.env.BQ_CODEGEN_V2_FIXUPS;
    else process.env.BQ_CODEGEN_V2_FIXUPS = prevV2Fixups;
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
  });

  it('rewrites PascalCase .client import when clientTsx is present under prompt-first', async () => {
    assert.equal(shouldSkipMutatingTsxFixups(), true);

    await writeComponentPackage({
      hostSlug: HOST,
      componentName: COMPONENT,
      kebab: KEBAB,
      tsx: BAD_TSX,
      clientTsx: CLIENT_TSX,
      definitionTs: DEFINITION,
      definitionKey: KEBAB,
      planMode: 'single',
      role: 'section',
      captureMeta: {
        codegenVersion: 'section',
        role: 'section',
        mode: 'single',
      },
      dryRun: false,
      validateClean: false,
    });

    const written = await readFile(
      path.join(hostDir, COMPONENT, `${KEBAB}.tsx`),
      'utf8',
    );
    assert.match(written, /from ['"]\.\/crelan-responsive-navigation-header\.client['"]/);
    assert.doesNotMatch(written, /CrelanPrimaryNavigationHeader\.client/);

    const clientWritten = await readFile(
      path.join(hostDir, COMPONENT, `${KEBAB}.client.tsx`),
      'utf8',
    );
    assert.match(clientWritten, /'use client'/);
  });
});
