/**
 * ContinuousMarquee DOM clone helpers (no jsdom).
 * Run: node --test tools/create-section-components/continuous-marquee.clone.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureMarqueeOverflow,
  stripCloneIds,
  syncBandTickerOverflow,
  syncMarqueeClone,
} from '../../src/components/primitives/continuous-marquee-dom.ts';

/** Minimal Element stub for clone helpers. */
function el(tag = 'div', opts = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    id: opts.id || '',
    children: [],
    scrollWidth: opts.scrollWidth ?? 0,
    offsetWidth: opts.offsetWidth ?? opts.scrollWidth ?? 0,
    hidden: false,
    style: {},
    _attrs: new Map(Object.entries(opts.attrs || {})),
    hasAttribute(name) {
      if (name === 'id') return Boolean(this.id);
      return this._attrs.has(name);
    },
    getAttribute(name) {
      if (name === 'id') return this.id || null;
      return this._attrs.has(name) ? this._attrs.get(name) : null;
    },
    setAttribute(name, value) {
      if (name === 'id') this.id = String(value);
      else this._attrs.set(name, String(value));
    },
    removeAttribute(name) {
      if (name === 'id') this.id = '';
      else this._attrs.delete(name);
    },
    getBoundingClientRect() {
      return { width: this.scrollWidth, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    },
    querySelectorAll(sel) {
      if (sel !== '[id]') return [];
      const out = [];
      const walk = (n) => {
        for (const c of n.children) {
          if (c.id) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    },
    cloneNode() {
      const copy = el(tag, {
        id: this.id,
        attrs: Object.fromEntries(this._attrs),
        scrollWidth: this.scrollWidth,
      });
      copy.children = this.children.map((c) => c.cloneNode(true));
      return copy;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren() {
      this.children.length = 0;
    },
  };
  return node;
}

describe('continuous-marquee-dom', () => {
  it('syncMarqueeClone copies children and strips ids', () => {
    const source = el('div');
    const article = el('article', { id: 'badge-1' });
    const img = el('img', { id: 'img-1' });
    article.appendChild(img);
    source.appendChild(article);
    const clone = el('div');
    syncMarqueeClone(source, clone);
    assert.equal(clone.children.length, 1);
    assert.equal(clone.children[0].getAttribute('id'), null);
    assert.equal(clone.querySelectorAll('[id]').length, 0);
  });

  it('stripCloneIds clears nested ids', () => {
    const root = el('div', { id: 'root' });
    root.appendChild(el('span', { id: 'nested' }));
    stripCloneIds(root);
    assert.equal(root.getAttribute('id'), null);
    assert.equal(root.querySelectorAll('[id]').length, 0);
  });

  it('ensureMarqueeOverflow pads until scrollWidth exceeds clientWidth', () => {
    const viewport = el('div');
    let scrollW = 100;
    const clientW = 200;
    Object.defineProperty(viewport, 'scrollWidth', {
      get() {
        return scrollW;
      },
    });
    Object.defineProperty(viewport, 'clientWidth', {
      get() {
        return clientW;
      },
    });
    const source = el('div');
    source.appendChild(el('span'));
    const origAppend = source.appendChild.bind(source);
    source.appendChild = (node) => {
      scrollW += 80;
      return origAppend(node);
    };
    const clone = el('div');
    const rounds = ensureMarqueeOverflow(viewport, source, clone, 8);
    assert.ok(rounds >= 1);
    assert.ok(scrollW > clientW);
  });

  it('ensureMarqueeOverflow is a no-op when viewport clientWidth is 0', () => {
    const viewport = el('div');
    Object.defineProperty(viewport, 'scrollWidth', { get: () => 0 });
    Object.defineProperty(viewport, 'clientWidth', { get: () => 0 });
    const source = el('div');
    source.appendChild(el('span'));
    const clone = el('div');
    clone.hidden = false;
    clone.appendChild(el('span'));
    const rounds = ensureMarqueeOverflow(viewport, source, clone, 8);
    assert.equal(rounds, 0);
    assert.equal(source.children.length, 1);
    assert.equal(clone.children.length, 0);
    assert.equal(clone.hidden, true);
  });

  it('syncBandTickerOverflow centers short copy (no pads, empty clone)', () => {
    const viewport = el('div');
    Object.defineProperty(viewport, 'clientWidth', { get: () => 800 });
    const source = el('div', { scrollWidth: 320 });
    source.offsetWidth = 320;
    source.appendChild(el('span'));
    const clone = el('div');
    clone.style = {};
    clone.hidden = false;
    clone.appendChild(el('span')); // stale clone
    const overflowing = syncBandTickerOverflow(viewport, source, clone);
    assert.equal(overflowing, false);
    assert.equal(clone.children.length, 0);
    assert.equal(clone.hidden, true);
    assert.equal(source.children.length, 1);
  });

  it('syncBandTickerOverflow builds two equal halves when text overflows', () => {
    const viewport = el('div');
    Object.defineProperty(viewport, 'clientWidth', { get: () => 400 });
    const source = el('div', { scrollWidth: 720 });
    source.offsetWidth = 720;
    source.appendChild(el('span', { id: 'label' }));
    const clone = el('div');
    clone.style = {};
    clone.hidden = true;
    // document.createElement stub for spacer
    const realCreate = globalThis.document?.createElement;
    globalThis.document = {
      createElement(tag) {
        return el(tag);
      },
    };
    try {
      const overflowing = syncBandTickerOverflow(viewport, source, clone);
      assert.equal(overflowing, true);
      assert.equal(clone.hidden, false);
      // source: label + gap spacer; clone mirrors both
      assert.equal(source.children.length, 2);
      assert.equal(clone.children.length, 2);
      assert.ok(source.children[1].hasAttribute('data-marquee-gap'));
      assert.equal(clone.children[0].getAttribute('id'), null);
    } finally {
      if (realCreate) {
        globalThis.document.createElement = realCreate;
      }
    }
  });
});
