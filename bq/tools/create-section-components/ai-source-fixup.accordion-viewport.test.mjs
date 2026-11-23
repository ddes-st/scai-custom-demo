/**
 * Unit tests: accordion / footer social viewport breakpoints (md → lg).
 * Run: node --test tools/create-section-components/ai-source-fixup.accordion-viewport.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeAccordionViewportBreakpoints,
  normalizeClientTsx,
  normalizeComponentTsx,
} from './ai-source-fixup.mjs';

describe('normalizeAccordionViewportBreakpoints', () => {
  it('remaps accordion chrome md: → lg: so tablet stays collapsed', () => {
    const src = `
'use client';
export default function Chrome({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <button aria-expanded={open} className="md:hidden" onClick={() => setOpen(!open)}>
      {title}
      <span className={open ? 'rotate-180' : ''}>⌄</span>
    </button>
    <div className="hidden md:block">{children}</div>
    <div className={open ? 'block' : 'hidden'}>{children}</div>
  );
}
`;
    const out = normalizeAccordionViewportBreakpoints(src);
    assert.match(out, /lg:hidden/);
    assert.match(out, /hidden lg:block/);
    assert.doesNotMatch(out, /\bmd:hidden\b/);
    assert.doesNotMatch(out, /\bmd:block\b/);
  });

  it('remaps footer social max-md → max-lg', () => {
    const src = `
export const Default = () => (
  <div className="footer-social max-md:border-t max-md:px-0">
    <div className="max-md:hidden">Volg ons</div>
    <ul className="max-md:flex max-md:justify-center">
      <SocialFaGlyph name="facebook" />
    </ul>
  </div>
);
`;
    const out = normalizeAccordionViewportBreakpoints(src);
    assert.match(out, /max-lg:border-t/);
    assert.match(out, /max-lg:hidden/);
    assert.match(out, /max-lg:flex/);
    assert.doesNotMatch(out, /max-md:/);
  });

  it('does not touch unrelated md: layouts', () => {
    const src = `<div className="flex flex-col md:flex-row md:[&>*]:w-1/3" />`;
    const out = normalizeAccordionViewportBreakpoints(src);
    assert.equal(out, src);
  });
});

describe('normalizeClientTsx does not rewrite accordion breakpoints', () => {
  it('leaves md accordion chrome unchanged (AI must emit lg:)', () => {
    const src = `
import { useState } from 'react';
export default function FooterColumnChrome({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="flex w-full md:hidden" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {title}
        <span className={open ? 'rotate-180' : 'rotate-0'}>⌄</span>
      </button>
      <div className="hidden md:block">{children}</div>
    </>
  );
}
`;
    const out = normalizeClientTsx(src);
    assert.match(out, /md:hidden/);
    assert.match(out, /hidden md:block/);
  });
});

describe('normalizeComponentTsx does not rewrite accordion breakpoints', () => {
  it('leaves footer nav column md classes unchanged', () => {
    const src = `
export const Default = (props) => (
  <section>
    <button type="button" className="flex md:pointer-events-none md:block" aria-expanded="false">
      Title
      <span className="rotate-45 md:hidden" />
    </button>
    <div className="hidden md:block">links</div>
  </section>
);
`;
    const out = normalizeComponentTsx(src);
    assert.match(out, /md:pointer-events-none/);
    assert.match(out, /md:hidden/);
    assert.match(out, /hidden md:block/);
  });
});
