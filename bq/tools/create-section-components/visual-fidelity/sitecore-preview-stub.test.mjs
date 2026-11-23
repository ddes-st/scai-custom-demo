import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppPlaceholder,
  resolvePlaceholderWrapperClassName,
  __bqPlaceholderChildren,
} from './sitecore-preview-stub.mjs';

describe('resolvePlaceholderWrapperClassName', () => {
  it('defaults empty className to no wrapper class', () => {
    assert.equal(resolvePlaceholderWrapperClassName(''), '');
    assert.equal(resolvePlaceholderWrapperClassName(null), '');
    assert.equal(resolvePlaceholderWrapperClassName(undefined), '');
    assert.equal(resolvePlaceholderWrapperClassName('   '), '');
  });

  it('keeps explicit layout classes on AppPlaceholder', () => {
    assert.equal(
      resolvePlaceholderWrapperClassName('grid lg:grid-cols-2 gap-4'),
      'grid lg:grid-cols-2 gap-4',
    );
  });
});

describe('AppPlaceholder peer layout', () => {
  it('parent grid-cols-2 sees two peer card roots when PH className is empty', () => {
    __bqPlaceholderChildren.byBase = {
      'promo-cards': [
        React.createElement('article', {
          key: 'a',
          'data-card': 'apple',
          className: 'card-a',
        }, 'Apple Pay'),
        React.createElement('article', {
          key: 'b',
          'data-card': 'mint',
          className: 'card-b',
        }, 'Word klant'),
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(
        'div',
        { className: 'grid lg:grid-cols-2 gap-4', 'data-parent': '1' },
        React.createElement(AppPlaceholder, { name: 'promo-cards' }),
      ),
    );

    // No opaque wrapper (contents/div) between parent grid and card roots.
    assert.doesNotMatch(html, /data-bq-placeholder=/);
    assert.doesNotMatch(html, /class="contents"/);
    assert.match(html, /data-parent="1"/);
    assert.match(html, /data-card="apple"/);
    assert.match(html, /data-card="mint"/);
    // Peers are direct descendants of the parent grid (Fragment unwraps).
    assert.match(
      html,
      /data-parent="1"[^>]*>[\s\S]*data-card="apple"[\s\S]*data-card="mint"/,
    );
  });

  it('keeps an explicit layout wrapper when className is set', () => {
    __bqPlaceholderChildren.byBase = {
      steps: [
        React.createElement('div', { key: '1', 'data-step': '1' }, 'One'),
        React.createElement('div', { key: '2', 'data-step': '2' }, 'Two'),
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(AppPlaceholder, {
        name: 'steps',
        className: 'flex flex-col gap-2',
      }),
    );

    assert.match(html, /data-bq-placeholder="steps"/);
    assert.match(html, /class="flex flex-col gap-2"/);
    assert.match(html, /data-step="1"/);
    assert.match(html, /data-step="2"/);
  });
});
