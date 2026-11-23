/**
 * Prompt-source: sitecoreize must not invent empty visual Image/Text/Link seeds.
 * Run: node --test tools/create-section-components/sitecoreize-no-invent-seed-prompt.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(here, 'prompts');

describe('sitecoreize no-invent seed (compact prompt)', () => {
  it('system-codegen-sitecoreize.md forbids inventing missing content/assets', async () => {
    const text = await readFile(
      path.join(promptsDir, 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /Sitecoreize system prompt v3/);
    assert.match(text, /Do not invent missing content, assets or URLs/);
    assert.match(
      text,
      /Seed values only from visual TSX peer fields/,
    );
    assert.match(text, /empty visual string\/null → omit\/empty seed/);
  });

  it('section-codegen layers project contract without bridge or HARD flood', async () => {
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /=== PROJECT CONTRACT ===/);
    assert.match(src, /=== SECTION INPUT ===/);
    assert.match(src, /formatSitecoreizeValidationFeedbackMessage/);
    assert.match(src, /SITECOREIZE_OUTPUT_JSON_SCHEMA/);
    assert.doesNotMatch(src, /CONTENT SDK BRIDGE/);
    assert.doesNotMatch(
      src,
      /HARD — definitionTs content\.items\[\]\.fields string seeds: never emit non-printable C0/,
    );
    assert.doesNotMatch(
      src,
      /SITECOREIZE_NO_INVENT_SEED_HARD,\s*\r?\n\s*SITECOREIZE_CHILD_UNIQUE_NAME_HARD,/,
    );
  });
});
