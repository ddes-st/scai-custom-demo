/**
 * FaIcon prop alias fixup + CONTRACT gate.
 * Run: node --test tools/create-section-components/ai-source-fixup.faicon.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectTsxEmitContractDiagnostics,
  normalizeComponentTsx,
  rewriteFaIconPropAliases,
} from './ai-source-fixup.mjs';

describe('rewriteFaIconPropAliases', () => {
  it('rewrites faIcon= to name=', () => {
    const out = rewriteFaIconPropAliases(
      `<FaIcon faIcon={row.icon} faStyle="brands" />`,
    );
    assert.match(out, /<FaIcon\s+name=\{row\.icon\}/);
    assert.doesNotMatch(out, /\bfaIcon=/);
  });

  it('rewrites iconName= to name=', () => {
    const out = rewriteFaIconPropAliases(
      `<FaIcon iconName="facebook" faStyle="brands" />`,
    );
    assert.match(out, /name="facebook"/);
    assert.doesNotMatch(out, /\biconName=/);
  });

  it('rewrites icon= to name= when name missing', () => {
    const out = rewriteFaIconPropAliases(`<FaIcon icon={icon} className="h-4" />`);
    assert.match(out, /name=\{icon\}/);
    assert.doesNotMatch(out, /\bicon=/);
  });

  it('drops forbidden aliases when name already present', () => {
    const out = rewriteFaIconPropAliases(
      `<FaIcon name="instagram" faIcon="x" iconName="y" />`,
    );
    assert.match(out, /name="instagram"/);
    assert.doesNotMatch(out, /\bfaIcon=/);
    assert.doesNotMatch(out, /\biconName=/);
  });

  it('normalizeComponentTsx applies the fixup', () => {
    const out = normalizeComponentTsx(
      `import React from 'react';\nexport const Default = () => <FaIcon faIcon="linkedin-in" faStyle="brands" />;\n`,
    );
    assert.match(out, /name="linkedin-in"/);
    assert.doesNotMatch(out, /\bfaIcon=/);
  });
});

describe('collectTsxEmitContractDiagnostics FaIcon', () => {
  it('flags faIcon prop', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `<FaIcon faIcon={row.icon} faStyle="brands" />`,
    );
    assert.ok(diags.some((d) => /FaIcon must use name=/.test(d)));
  });

  it('flags missing name', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `<FaIcon faStyle="brands" className="h-4" />`,
    );
    assert.ok(diags.some((d) => /FaIcon requires name=/.test(d)));
  });

  it('accepts name=', () => {
    const diags = collectTsxEmitContractDiagnostics(
      `import React from 'react';\nexport const Default = () => <FaIcon name={row.icon} faStyle="brands" />;\n`,
    );
    assert.ok(!diags.some((d) => /FaIcon (must|requires)/.test(d)));
  });
});
