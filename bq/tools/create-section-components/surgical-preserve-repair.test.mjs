/**
 * Run: node --test tools/create-section-components/surgical-preserve-repair.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  selectRepairFiles,
  isOversizedEdit,
  diagnosticsAreSyntaxOnly,
  diagnosticsImproved,
  parseSurgicalRepairJson,
  applySurgicalPreserveResult,
  buildSurgicalPreserveUserMessage,
  SURGICAL_SYNTAX_MAX_LEN_DELTA,
  resolveSurgicalEditCaps,
} from './surgical-preserve-repair.mjs';

describe('selectRepairFiles', () => {
  it('selects tsx only for TS1005', () => {
    const sel = selectRepairFiles([
      "TSC: src/components/x.tsx:33:1 — TS1005: '}' expected.",
    ]);
    assert.deepEqual(sel, { tsx: true, client: false, definition: false });
  });

  it('selects definition only for item-name CONTRACT', () => {
    const sel = selectRepairFiles(
      ['CONTRACT: content.items[].name is not a valid Sitecore item name'],
      { previousDefinitionTs: 'export const X = {} satisfies ComponentTemplateDefinition;' },
    );
    assert.equal(sel.definition, true);
    assert.equal(sel.tsx, false);
    assert.equal(sel.client, false);
  });

  it('selects client when companion missing', () => {
    const sel = selectRepairFiles(
      ["CONTRACT: map-entry imports './….client' but clientTsx is missing/empty"],
      { previousTsx: "import X from './x.client';\nexport const Default = () => null;\n" },
    );
    assert.equal(sel.client, true);
  });

  it('honors failedFile for format repair', () => {
    const sel = selectRepairFiles(['prettier failed'], {
      failedFile: 'clientTsx',
      previousClientTsx: "'use client';\nexport default function X() { return null; }\n",
    });
    assert.deepEqual(sel, { tsx: false, client: true, definition: false });
  });
});

describe('diagnosticsAreSyntaxOnly', () => {
  it('true for TS1005 only', () => {
    assert.equal(
      diagnosticsAreSyntaxOnly(["TSC: file.tsx:1:1 — TS1005: '}' expected."]),
      true,
    );
  });

  it('false when CONTRACT mixed in', () => {
    assert.equal(
      diagnosticsAreSyntaxOnly([
        "TSC: TS1005: '}' expected.",
        'CONTRACT: list-none missing',
      ]),
      false,
    );
  });
});

describe('isOversizedEdit / caps', () => {
  it('rejects large syntax-cap edits', () => {
    const prev = 'export const Default = () => null;\n';
    const next = prev + 'x'.repeat(SURGICAL_SYNTAX_MAX_LEN_DELTA + 10);
    const caps = resolveSurgicalEditCaps(["TS1005: '}' expected."]);
    const gate = isOversizedEdit(prev, next, caps);
    assert.equal(gate.oversized, true);
  });

  it('allows create-from-empty client', () => {
    const gate = isOversizedEdit('', "'use client';\nexport default function X(){return null}\n", {
      allowCreateFromEmpty: true,
    });
    assert.equal(gate.oversized, false);
  });

  it('allows tiny brace insert', () => {
    const prev = 'return <header/>;\n\nexport default Default;';
    const next = 'return <header/>;\n};\n\nexport default Default;';
    const caps = resolveSurgicalEditCaps(["TS1005: '}' expected."]);
    const gate = isOversizedEdit(prev, next, caps);
    assert.equal(gate.oversized, false);
  });
});

describe('diagnosticsImproved', () => {
  it('true when after is empty', () => {
    assert.equal(diagnosticsImproved(['a', 'b'], []), true);
  });

  it('true when fewer diagnostics', () => {
    assert.equal(diagnosticsImproved(['a', 'b'], ['a']), true);
  });

  it('false when same or worse', () => {
    assert.equal(diagnosticsImproved(['a'], ['a']), false);
    assert.equal(diagnosticsImproved(['a'], ['a', 'b']), false);
  });
});

describe('parseSurgicalRepairJson', () => {
  it('parses flat tsx JSON', () => {
    const out = parseSurgicalRepairJson(
      JSON.stringify({ tsx: 'export const Default = () => null;\n', reason: 'ok' }),
    );
    assert.match(out.tsx || '', /export const Default/);
    assert.equal(out.reason, 'ok');
  });

  it('parses packages[0] shape', () => {
    const out = parseSurgicalRepairJson(
      JSON.stringify({
        packages: [{ tsx: 'export const Default = () => null;\n', clientTsx: null }],
      }),
    );
    assert.match(out.tsx || '', /Default/);
  });
});

describe('applySurgicalPreserveResult', () => {
  it('pins definitionTs when not selected', () => {
    const prevDef = 'export const Def = {} satisfies X;';
    const applied = applySurgicalPreserveResult({
      parsed: {
        tsx: "export const Default = () => null;\n",
        definitionTs: 'DRIFTED',
      },
      previousTsx: "export const Default = () => {\n",
      previousDefinitionTs: prevDef,
      select: { tsx: true, client: false, definition: false },
      diagnostics: ["TS1005: '}' expected."],
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.definitionTs, prevDef);
  });

  it('rejects oversized tsx rewrite', () => {
    const prev = 'export const Default = () => null;\n';
    const applied = applySurgicalPreserveResult({
      parsed: { tsx: prev + '/* ' + 'x'.repeat(200) + ' */\n' },
      previousTsx: prev,
      select: { tsx: true, client: false, definition: false },
      diagnostics: ["TS1005: '}' expected."],
    });
    assert.equal(applied.ok, false);
    assert.match(applied.skipReason || '', /oversized/);
  });
});

describe('buildSurgicalPreserveUserMessage', () => {
  it('includes previous package and requests tsx only', () => {
    const msg = buildSurgicalPreserveUserMessage({
      componentName: 'MenzisHeaderNavigation',
      diagnostics: ["TS1005: '}' expected."],
      previousTsx: "export const Default = () => {\nreturn null;\n",
      select: { tsx: true, client: false, definition: false },
    });
    assert.match(msg, /PREVIOUS PACKAGE/);
    assert.match(msg, /MenzisHeaderNavigation/);
    assert.match(msg, /Return JSON only with these fields: \{ "tsx", "reason" \}/);
  });
});
