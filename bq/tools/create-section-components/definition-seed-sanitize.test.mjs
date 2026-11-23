/**
 * Run: node --test tools/create-section-components/definition-seed-sanitize.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  assertDefinitionSeedIntegrity,
  cleanDefinitionSeedText,
  sanitizeDefinitionStringSeeds,
  sanitizeDefinitionStringSeedsDetailed,
  seedTextHasForbiddenControls,
  tryParseDefinitionTs,
} from './definition-seed-sanitize.mjs';
import { normalizeDefinitionTs } from './ai-source-fixup.mjs';
import {
  DEFINITION_PARSE_FIX_HEADER,
  isDefinitionParseFailure,
  isDefinitionValidateFailure,
} from './definition-validate-iters.mjs';
import {
  extractDefinitionTsFromLlm,
  finalizeDefinitionWithParseRetries,
} from './definition-parse-repair.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


function extractCeilingBody(src) {
  const c = src.indexOf('content:');
  const k = src.indexOf('Ceiling Body', c);
  assert.ok(k >= 0, 'Ceiling Body key missing');
  const colon = src.indexOf(':', k);
  const after = src.slice(colon + 1).trimStart();
  assert.equal(after[0], '"');
  let i = 1;
  let out = '';
  while (i < after.length) {
    if (after[i] === '\\') {
      const n = after[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'u' && /^[0-9a-fA-F]{4}/.test(after.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(after.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else out += n;
      i += 2;
      continue;
    }
    if (after[i] === '"') return out;
    out += after[i];
    i += 1;
  }
  throw new Error('unterminated Ceiling Body');
}

describe('cleanDefinitionSeedText', () => {
  it('strips form-feed + ont-family CSS bleed', () => {
    const raw = `aanbieders (‘systeemaanbieders\font-family') in de`;
    const cleaned = cleanDefinitionSeedText(raw);
    assert.equal(cleaned.includes('\f'), false);
    assert.match(cleaned, /systeemaanbieders’/);
    assert.equal(/font-family|ont-family/i.test(cleaned), false);
  });
});

const CLEAN_DEF = `import type { ComponentDefinition } from './types';
export const clean = {
  name: 'clean',
  templateName: 'Clean',
  model: {
    folderTemplate: { name: 'Clean Folder' },
    itemTemplate: { name: 'Clean Item' },
    fields: [{ name: 'Body', type: 'Multi-Line Text' }],
  },
  content: {
    location: { root: 'data', folder: ['Clean'] },
    items: [{ name: 'Item', fields: { Body: "Hello world" } }],
  },
} satisfies ComponentDefinition;
`;

const DIRTY_DEF = `import type { ComponentDefinition } from './types';
export const dirty = {
  name: 'dirty',
  templateName: 'Dirty',
  model: {
    folderTemplate: { name: 'Dirty Folder' },
    itemTemplate: { name: 'Dirty Item' },
    fields: [{ name: 'Ceiling Body', type: 'Multi-Line Text' }],
  },
  content: {
    location: { root: 'data', folder: ['Dirty'] },
    items: [{
      name: 'Item',
      fields: {
        'Ceiling Body': 'aanbieders (\u2018systeemaanbieders\font-family\u2019) in de',
      },
    }],
  },
} satisfies ComponentDefinition;
`;

describe('sanitizeDefinitionStringSeedsDetailed', () => {
  it('returns empty changes on clean gold', () => {
    const detail = sanitizeDefinitionStringSeedsDetailed(CLEAN_DEF);
    assert.equal(detail.changed, 0);
    assert.equal(detail.changes.length, 0);
    assert.equal(detail.text, CLEAN_DEF);
  });

  it('returns before/after when C0 / CSS bleed seeds are rewritten', () => {
    const detail = sanitizeDefinitionStringSeedsDetailed(DIRTY_DEF);
    assert.ok(detail.changed > 0);
    assert.ok(detail.changes.length > 0);
    assert.equal(tryParseDefinitionTs(detail.text).ok, true);
    const ceiling = detail.changes.find(
      (c) => c.keyHint === 'Ceiling Body' || c.kind === 'field-seed',
    );
    assert.ok(ceiling);
    assert.match(String(ceiling.before), /font-family|ont-family|\f/i);
    assert.equal(/font-family|ont-family|\f/i.test(ceiling.after), false);
    for (const ch of detail.changes) {
      assert.ok(typeof ch.before === 'string');
      assert.ok(typeof ch.after === 'string');
      assert.ok(ch.before.length <= 501);
      assert.ok(ch.after.length <= 501);
    }
  });
});

describe('sanitizeDefinitionStringSeeds', () => {
  it('repairs Ceiling Body seed with form-feed / CSS bleed', () => {
    const sanitized = sanitizeDefinitionStringSeeds(DIRTY_DEF);
    assert.equal(tryParseDefinitionTs(sanitized).ok, true);
    assertDefinitionSeedIntegrity(sanitized);

    const body = extractCeilingBody(sanitized);
    assert.equal(/font-family|ont-family|\f/i.test(body), false);
    assert.match(body, /systeemaanbieders/);
  });

  it('integrity fails on LLM-escape style \\u000c residue', () => {
    const llm = CLEAN_DEF.replace(
      '"Hello world"',
      '"bad\\u000ctext"',
    );
    assert.equal(tryParseDefinitionTs(llm).ok, true);
    assert.throws(
      () => assertDefinitionSeedIntegrity(llm, 'llm.definition.ts'),
      /DEFINITION SEED INTEGRITY/,
    );
    assert.equal(
      isDefinitionParseFailure(
        new Error(
          '[codegen] x.definition.ts DEFINITION SEED INTEGRITY: forbidden C0',
        ),
      ),
      true,
    );
  });
});

describe('seedTextHasForbiddenControls', () => {
  it('flags form-feed and \\u000c escapes', () => {
    assert.equal(seedTextHasForbiddenControls('ok\n\ttext'), false);
    assert.equal(seedTextHasForbiddenControls('bad\ftext'), true);
    assert.equal(seedTextHasForbiddenControls('bad\\u000ctext'), true);
  });
});

describe('normalizeDefinitionTs parse-preserving', () => {
  it('sanitizes dirty seeds and stays parseable', () => {
    const out = normalizeDefinitionTs(DIRTY_DEF, {
      definitionKey: 'dirty',
      componentName: 'Dirty',
      skipParseAssert: false,
    });
    assert.equal(tryParseDefinitionTs(out).ok, true);
    assertDefinitionSeedIntegrity(out);
    const body = extractCeilingBody(out);
    assert.equal(/font-family|ont-family|\f/i.test(body), false);
    assert.match(body, /systeemaanbieders/);
  });

  it('does not throw when input was parseable and stays parseable', () => {
    const out = normalizeDefinitionTs(CLEAN_DEF, {
      definitionKey: 'clean',
      componentName: 'Clean',
    });
    assert.equal(tryParseDefinitionTs(out).ok, true);
  });
});

describe('extractDefinitionTsFromLlm', () => {
  it('strips markdown fences', () => {
    const raw = '```ts\nexport const x = {};\n```\n';
    assert.match(extractDefinitionTsFromLlm(raw), /^export const x/);
  });
});

describe('DEFINITION_PARSE_FIX_HEADER', () => {
  it('asks for JSON.stringify seeds and C0 deletion', () => {
    assert.match(DEFINITION_PARSE_FIX_HEADER, /JSON\.stringify/);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /C0|non-printable/i);
  });

  it('includes apostrophe Bad/Good Body examples', () => {
    assert.match(DEFINITION_PARSE_FIX_HEADER, /programma's/);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /Bad:.*programma's/);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /Good:.*JSON\.stringify.*"…programma's…"/);
  });

  it('includes content.items item-close Bad/Good CTA examples', () => {
    assert.match(DEFINITION_PARSE_FIX_HEADER, /CTA:\s*\{\s*text:/);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /fields then item/i);
    assert.match(DEFINITION_PARSE_FIX_HEADER, /JSON\.stringify\(JSON\.stringify/);
  });
});

describe('sitecoreize seed policy (project contract)', () => {
  it('DEFINITION_SCHEMA_SNIPPET keeps C0 / CSS-bleed / JSON.stringify seed rules', () => {
    const src = readFileSync(path.join(__dirname, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /DEFINITION SCHEMA \(working example/);
    assert.match(src, /HARD — seed string quoting/);
    assert.match(src, /HARD — content\.items element close/);
    assert.match(src, /programma's/);
    assert.match(src, /Bad: Body:.*programma's/);
    assert.match(src, /Good: Body: JSON\.stringify\(".*programma's.*"\)/);
    assert.match(src, /no C0\/non-printable controls/i);
    assert.match(src, /no CSS\/<style> bleed/i);
    assert.match(src, /LANGUAGE: AI-invented identities/);
    assert.match(src, /EN-normalizes Path names/);
    const system = readFileSync(
      path.join(__dirname, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(system, /Do not invent missing content/);
    assert.match(system, /AI-invented names/);
    assert.match(system, /normalize those Paths to English/);
    assert.match(system, /Always JSON\.stringify/);
    assert.match(system, /never single-quote natural language/);
    assert.match(system, /programma's/);
  });
});

describe('isDefinitionValidateFailure (integrity)', () => {
  it('treats DEFINITION SEED INTEGRITY as retryable', () => {
    const err = new Error(
      '[codegen] x.definition.ts DEFINITION SEED INTEGRITY: forbidden C0',
    );
    assert.equal(isDefinitionParseFailure(err), true);
    assert.equal(isDefinitionValidateFailure(err), true);
  });
});

describe('finalizeDefinitionWithParseRetries', () => {
  it('returns on first successful finalize without LLM', async () => {
    let calls = 0;
    const out = await finalizeDefinitionWithParseRetries(
      'export const ok = { name: "x" };',
      async (def) => {
        calls += 1;
        // Minimal parseable stub that passes integrity (no C0 in long strings)
        return `export const demo = {\n  kind: "component",\n  content: { items: [{ name: "A", fields: { Title: "Hi" } }] }\n};\n`;
      },
      { maxRetries: 1, componentName: 'Demo' },
    );
    assert.equal(calls, 1);
    assert.equal(out.definitionAttempts, 1);
    assert.match(out.definitionTs, /Title: "Hi"/);
  });
});
