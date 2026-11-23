/**
 * Prompt-source regressions: multi-word Fields keys must be shown quoted
 * (bare `Close Icon: ImageField` / `Card Link: LinkField` is invalid TS / Prettier fails).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(here, 'prompts');

describe('quote multi-word Fields keys in prompt sources', () => {
  it('section-codegen PROJECT CONTRACT shows forbidden bare and quoted correct forms', async () => {
    const text = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(text, /Close Icon: ImageField/);
    assert.match(text, /"Close Icon": ImageField/);
    assert.match(text, /Privacy Link: LinkField/);
    assert.match(text, /"Privacy Link": LinkField/);
    assert.match(text, /Card Link: LinkField/);
    assert.match(text, /"Card Link": LinkField/);
    assert.match(text, /Quote multi-word Fields keys/);
  });

  it('content-sdk-conversion-bridge.md mentions Card Link quote HARD', async () => {
    const text = await readFile(
      path.join(promptsDir, 'content-sdk-conversion-bridge.md'),
      'utf8',
    );
    assert.match(text, /"Card Link": LinkField/);
    assert.match(text, /never bare.*Card Link: LinkField/i);
  });
});
