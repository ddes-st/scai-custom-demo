/**
 * INLINE SVG INVENTORY extractor + prompt formatting.
 * Run: node --test tools/create-section-components/inline-svg-inventory.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  extractInlineSvgInventory,
  formatInlineSvgInventoryForPrompt,
} from './inline-svg-inventory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Energyprice-like multi-path wordmark (5 paths, viewBox 262×45). */
const ENERGYPRICE_LIKE_HTML = `
<header class="site-header">
  <a class="logo navbar-brand" href="/">
    <svg viewBox="0 0 262 45" xmlns="http://www.w3.org/2000/svg" width="262" height="45">
      <defs><clipPath id="a"><rect width="262" height="45"/></clipPath></defs>
      <g clip-path="url(#a)">
        <path d="M0 0h10v10H0z" fill="#0a0"/>
        <path d="M12 0h10v10H12z" fill="#0a0"/>
        <path d="M24 0h10v10H24z" fill="#0a0"/>
        <path d="M36 0h10v10H36z" fill="#0a0"/>
        <path d="M48 0h10v10H48z" fill="#0a0"/>
      </g>
    </svg>
  </a>
  <svg viewBox="0 0 32 28" aria-hidden="true"><path d="M0 0h32v28H0z"/></svg>
</header>
`;

describe('extractInlineSvgInventory', () => {
  it('Energyprice-like fixture → paths≥5 and viewBox includes 262 45', () => {
    const entries = extractInlineSvgInventory(ENERGYPRICE_LIKE_HTML);
    assert.ok(entries.length >= 1);
    const logo = entries.find((e) => String(e.viewBox).includes('262 45'));
    assert.ok(logo, 'expected viewBox containing 262 45');
    assert.ok(logo.paths >= 5, `expected paths≥5, got ${logo.paths}`);
    assert.equal(logo.logoContext, true);
  });

  it('returns empty for HTML without SVGs', () => {
    assert.deepEqual(extractInlineSvgInventory('<div>no svg</div>'), []);
  });
});

describe('formatInlineSvgInventoryForPrompt', () => {
  it('includes INLINE SVG INVENTORY and paths=5 when HTML has multi-path SVG', () => {
    const block = formatInlineSvgInventoryForPrompt(ENERGYPRICE_LIKE_HTML);
    assert.match(block, /INLINE SVG INVENTORY/);
    assert.match(block, /viewBox="0 0 262 45"/);
    assert.match(block, /paths=5/);
    assert.match(block, /logoContext=true/);
  });

  it('returns empty string when no SVGs', () => {
    assert.equal(formatInlineSvgInventoryForPrompt('<p>plain</p>'), '');
  });
});

describe('codegen wiring', () => {
  it('section-codegen injects inventory into visual + sitecoreize task assembly', async () => {
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /formatInlineSvgInventoryForPrompt/);
    assert.match(src, /svgInventoryBlock/);
    assert.match(src, /sitecoreSvgInventory/);
  });

});
