/**
 * Codegen v2 prompt-first: mutating TSX/definition fixups skipped unless BQ_CODEGEN_V2_FIXUPS=1.
 * Run: node --test tools/create-section-components/v2-prompt-first-fixups.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  BQ_CODEGEN_V2_FIXUPS,
  _resetFixupSkipLogsForTests,
  isCodegenV2FixupsForced,
  normalizeComponentTsx,
  normalizeDefinitionTs,
  PLACEHOLDER_NEUTRAL_LAYOUT_CLASS,
  setCodegenV2Fixups,
  rewriteCompanionClientImport,
  shouldSkipMutatingDefinitionFixups,
  shouldSkipMutatingTsxFixups,
} from './ai-source-fixup.mjs';
import { collectCreateRunConfig } from './log-run-config.mjs';
import { resetFixupCount, takeFixupCount } from './create-log.mjs';

const NESTED_CHILD_DEF = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";

export const MegaMenuDefinition = {
  kind: "component",
  definitionKey: "mega-menu",
  name: "mega-menu",
  displayName: "Mega Menu",
  componentName: "MegaMenu",
  icon: "Office/32x32/window_dialog.png",
  datasourceLocation: { root: "data", folder: ["Mega Menus"], scope: "site" },
  model: {
    folderTemplate: { name: "Mega Menus" },
    itemTemplate: {
      name: "Mega Menu",
      sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }],
      childItemTemplate: {
        name: "Mega Menu Section",
        sections: [{ name: "Data", fields: [{ name: "Heading", type: "Single-Line Text" }] }],
      },
    },
  },
  variants: [{ name: "Default" }],
  placeholders: [],
  content: {
    location: { root: "data", folder: ["Mega Menus"] },
    culture: "en",
    items: [{ name: "Item", fields: { Title: "Hi" } }],
  },
} satisfies ComponentTemplateDefinition;
`;

const TSX_WITH_BARE_PLACEHOLDER = `
import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';

export const Default = (props) => (
  <section className="w-full">
    <AppPlaceholder name="x" rendering={props.rendering} page={props.page} componentMap={props.componentMap} />
  </section>
);
`;

describe('v2 prompt-first fixups', () => {
  /** @type {string|undefined} */
  let prevV2Fixups;

  beforeEach(() => {
    prevV2Fixups = process.env[BQ_CODEGEN_V2_FIXUPS];
    delete process.env[BQ_CODEGEN_V2_FIXUPS];
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
  });

  afterEach(() => {
    if (prevV2Fixups === undefined) delete process.env[BQ_CODEGEN_V2_FIXUPS];
    else process.env[BQ_CODEGEN_V2_FIXUPS] = prevV2Fixups;
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
  });

  it('skips mutating definition fixups by default (no hoist)', () => {
    assert.equal(shouldSkipMutatingDefinitionFixups(), true);
    const out = normalizeDefinitionTs(NESTED_CHILD_DEF, {
      definitionKey: 'mega-menu',
    });
    // Nested childItemTemplate left as AI emitted — not hoisted to model sibling.
    assert.match(
      out,
      /itemTemplate:\s*\{[\s\S]*childItemTemplate:\s*\{[\s\S]*\}\s*,?\s*\n\s*\},/,
    );
  });

  it('prompt-first skip notice does not count as a fixup', () => {
    process.env.BQ_CREATE_SECTION = 'section-01';
    resetFixupCount('section-01');
    assert.equal(shouldSkipMutatingDefinitionFixups(), true);
    normalizeDefinitionTs(NESTED_CHILD_DEF, { definitionKey: 'mega-menu' });
    assert.equal(takeFixupCount('section-01'), 0);
    delete process.env.BQ_CREATE_SECTION;
  });

  it('still fails parse assert on invalid AI definition', () => {
    assert.throws(
      () =>
        normalizeDefinitionTs(
          'export const broken = { name: "a },\n} satisfies X;',
          { definitionKey: 'broken' },
        ),
      /parse|Expected|Unterminated|definition/i,
    );
  });

  it('skips mutating TSX placeholder layout by default', () => {
    assert.equal(shouldSkipMutatingTsxFixups(), true);
    const out = normalizeComponentTsx(TSX_WITH_BARE_PLACEHOLDER);
    assert.match(out, /<AppPlaceholder/);
    assert.doesNotMatch(
      out,
      new RegExp(
        PLACEHOLDER_NEUTRAL_LAYOUT_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    );
  });

  it('prompt-first skips bulk companion rewrite in normalizeComponentTsx; write-path helper still rewrites', () => {
    assert.equal(shouldSkipMutatingTsxFixups(), true);
    const bad = `import HeaderClient from './CrelanPrimaryNavigationHeader.client';
export const Default = (props) => <HeaderClient {...props} />;
`;
    const normalized = normalizeComponentTsx(bad, {
      kebab: 'crelan-responsive-navigation-header',
    });
    assert.match(normalized, /CrelanPrimaryNavigationHeader\.client/);
    const rewritten = rewriteCompanionClientImport(
      normalized,
      'crelan-responsive-navigation-header',
    );
    assert.match(
      rewritten,
      /from '\.\/crelan-responsive-navigation-header\.client'/,
    );
    assert.doesNotMatch(rewritten, /CrelanPrimaryNavigationHeader\.client/);
  });

  it('restores hoist when BQ_CODEGEN_V2_FIXUPS=1', () => {
    setCodegenV2Fixups(true);
    assert.equal(isCodegenV2FixupsForced(), true);
    assert.equal(shouldSkipMutatingDefinitionFixups(), false);
    const out = normalizeDefinitionTs(NESTED_CHILD_DEF, {
      definitionKey: 'mega-menu',
    });
    const itemIdx = out.indexOf('itemTemplate:');
    const childIdx = out.indexOf('childItemTemplate:');
    assert.ok(childIdx > itemIdx);
    const between = out.slice(itemIdx, childIdx);
    assert.match(between, /\}/);
    assert.doesNotMatch(between, /childItemTemplate/);
  });

  it('does not invent bare-PH layout wrap even when BQ_CODEGEN_V2_FIXUPS=1', () => {
    setCodegenV2Fixups(true);
    assert.equal(shouldSkipMutatingTsxFixups(), false);
    const out = normalizeComponentTsx(TSX_WITH_BARE_PLACEHOLDER, {
      layoutMode: 'auto',
    });
    assert.match(out, /<AppPlaceholder/);
    assert.doesNotMatch(
      out,
      new RegExp(
        PLACEHOLDER_NEUTRAL_LAYOUT_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    );
  });

  it('log-run-config shows prompt-first off by default', () => {
    const entries = collectCreateRunConfig({ env: {} });
    const row = entries.find((e) => e.key === BQ_CODEGEN_V2_FIXUPS);
    assert.ok(row);
    assert.match(row.value, /prompt-first|mutate skipped/i);
  });

  it('log-run-config shows fixups on when env forces', () => {
    const entries = collectCreateRunConfig({
      env: { [BQ_CODEGEN_V2_FIXUPS]: '1' },
    });
    const row = entries.find((e) => e.key === BQ_CODEGEN_V2_FIXUPS);
    assert.ok(row);
    assert.match(row.value, /^on/);
  });
});
