import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatUiIconLibraryForPrompt,
  resolveUiIconLibrary,
} from './ai-codegen.mjs';

describe('resolveUiIconLibrary', () => {
  it('defaults to fa when unset or empty', () => {
    assert.equal(resolveUiIconLibrary({}), 'fa');
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: '' }), 'fa');
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: '  ' }), 'fa');
  });

  it('accepts fa aliases', () => {
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'fa' }), 'fa');
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'FontAwesome' }), 'fa');
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'font-awesome' }), 'fa');
  });

  it('accepts lucide', () => {
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'lucide' }), 'lucide');
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'LUCIDE' }), 'lucide');
  });

  it('falls back to fa for unknown values', () => {
    assert.equal(resolveUiIconLibrary({ BQ_UI_ICON_LIBRARY: 'heroicons' }), 'fa');
  });
});

describe('formatUiIconLibraryForPrompt', () => {
  it('mentions FaIcon social HARD for both modes', () => {
    assert.match(formatUiIconLibraryForPrompt('fa'), /FaIcon/);
    assert.match(formatUiIconLibraryForPrompt('lucide'), /lucide-react/);
    assert.match(formatUiIconLibraryForPrompt('lucide'), /ALWAYS use/);
  });

  it('lucide mode HARD-forbids merging Lucide icons into the Content SDK import', () => {
    const block = formatUiIconLibraryForPrompt('lucide');
    assert.match(block, /HARD — generic UI chrome icons/);
    assert.match(block, /import ONLY from `lucide-react`/);
    assert.match(
      block,
      /NEVER put Lucide \/ UI glyph names on `@sitecore-content-sdk\/nextjs`/,
    );
    assert.match(
      block,
      /Forbidden: `import \{ ChevronDown, Text \} from '@sitecore-content-sdk\/nextjs'`/,
    );
    assert.match(
      block,
      /import \{ ChevronDown, Menu, Search, User, X \} from 'lucide-react'/,
    );
  });
});

describe('SDK vs Lucide import in project contract', () => {
  it('section-codegen PROJECT CONTRACT wires formatUiIconLibraryForPrompt', async () => {
    const src = await readFile(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'section-codegen.mjs'),
      'utf8',
    );
    assert.match(src, /=== PROJECT CONTRACT ===/);
    assert.match(src, /formatUiIconLibraryForPrompt\(\)/);
    assert.match(
      src,
      /Allowed SDK value imports: Text, RichText, Image, Link/,
    );
  });

  it('formatUiIconLibraryForPrompt(lucide) documents Lucide split', () => {
    const block = formatUiIconLibraryForPrompt('lucide');
    assert.match(block, /never Lucide for facebook/i);
    assert.match(
      block,
      /import \{ ChevronDown, Menu, Search, User, X \} from 'lucide-react'/,
    );
  });
});
