/**
 * Leaf map-entry with hooks must get leading 'use client' at write time.
 * Run: node --import tsx --test tools/create-section-components/ensure-use-client-leaf.test.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ensureUseClientDirective } from './ai-source-fixup.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('ensureUseClientDirective', () => {
  it('prepends use client for leaf useState without AppPlaceholder', () => {
    const src = `import React, { JSX, useState } from 'react';
export const Default = () => {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
};
`;
    const out = ensureUseClientDirective(src);
    assert.match(out, /^'use client';\s*\n/);
    assert.match(out, /useState/);
  });

  it('no-ops when AppPlaceholder is present (server host)', () => {
    const src = `import React, { JSX, useState } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
export const Default = (props) => {
  const [n] = useState(0);
  return <AppPlaceholder name="items" rendering={props.rendering} page={props.page} componentMap={{}} />;
};
`;
    const out = ensureUseClientDirective(src);
    assert.doesNotMatch(out, /^['"]use client['"]/);
  });

  it('no-ops when use client already present', () => {
    const src = `'use client';
import React, { useState } from 'react';
const [x] = useState(0);
`;
    assert.equal(ensureUseClientDirective(src), src);
  });
});

describe('write-path + sitecoreize HARD leaf use client', () => {
  it('write-component.mjs applies write-path always-on sanitizers (includes ensureUseClientDirective)', async () => {
    const src = await readFile(path.join(here, 'write-component.mjs'), 'utf8');
    assert.match(src, /applyWritePathAlwaysOnTsxSanitizers/);
    const fixupSrc = await readFile(path.join(here, 'ai-source-fixup.mjs'), 'utf8');
    assert.match(fixupSrc, /function ensureUseClientDirective/);
    assert.match(
      fixupSrc,
      /applyWritePathAlwaysOnTsxSanitizers[\s\S]*?ensureUseClientDirective/,
    );
  });

  it('exports SITECOREIZE_LEAF_USE_CLIENT_HARD and wires project contract', async () => {
    const { SITECOREIZE_LEAF_USE_CLIENT_HARD } = await import(
      './section-codegen.mjs'
    );
    assert.match(SITECOREIZE_LEAF_USE_CLIENT_HARD, /^HARD —/);
    assert.match(SITECOREIZE_LEAF_USE_CLIENT_HARD, /'use client'/);
    assert.match(SITECOREIZE_LEAF_USE_CLIENT_HARD, /AppPlaceholder/);
    assert.match(SITECOREIZE_LEAF_USE_CLIENT_HARD, /Turbopack|RSC/i);
    const src = await readFile(path.join(here, 'section-codegen.mjs'), 'utf8');
    assert.match(src, /SITECOREIZE_LEAF_USE_CLIENT_HARD/);
  });

  it('system-codegen-sitecoreize.md documents leaf use client HARD', async () => {
    const text = await readFile(
      path.join(here, 'prompts', 'system-codegen-sitecoreize.md'),
      'utf8',
    );
    assert.match(text, /Leaf map-entry/);
    assert.match(text, /'use client'/);
    assert.match(text, /no AppPlaceholder/);
  });
});
