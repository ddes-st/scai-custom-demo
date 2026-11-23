import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hoistStylesToEnd,
  wrapMiniDocument,
} from './save-section-styled-html.mjs';

describe('hoistStylesToEnd', () => {
  it('moves leading style blocks after structure', () => {
    const html =
      '<div data-x="1"><style>.a{color:red}</style><h1>Hi</h1><img src="https://x/logo.svg" alt="Logo"/></div>';
    const { structureHtml, hoistedStyles } = hoistStylesToEnd(html);
    assert.match(structureHtml, /<h1>Hi<\/h1>/);
    assert.match(structureHtml, /logo\.svg/);
    assert.doesNotMatch(structureHtml, /<style/);
    assert.match(hoistedStyles, /\.a\{color:red\}/);
    // Structure text should appear before styles when concatenated as wrap does
    const combined = `${structureHtml}\n${hoistedStyles}`;
    assert.ok(combined.indexOf('<h1>') < combined.indexOf('<style'));
  });
});

/**
 * Mirrors strip logic in filterAuthoredCssToSectionInBrowser (page.evaluate —
 * must stay self-contained there). Guard against regressing Tailwind variants.
 */
function stripPseudosForMatch(part) {
  return part
    .replace(/(?<!\\)::?[a-zA-Z-]+(\([^)]*\))?/g, '')
    .replace(/(?<!\\):host(?:\([^)]*\))?/g, '')
    .trim();
}

describe('authored CSS selector match: Tailwind escaped variants', () => {
  it('keeps .md\\:static (does not treat :static as a pseudo)', () => {
    assert.equal(stripPseudosForMatch('.md\\:static'), '.md\\:static');
  });

  it('keeps .hover\\:bg-white', () => {
    assert.equal(stripPseudosForMatch('.hover\\:bg-white'), '.hover\\:bg-white');
  });

  it('still strips real :hover / ::before', () => {
    assert.equal(stripPseudosForMatch('.btn:hover'), '.btn');
    assert.equal(stripPseudosForMatch('.icon::before'), '.icon');
  });
});

describe('wrapMiniDocument', () => {
  it('puts DOM before style payload (styles at end of body)', () => {
    const doc = wrapMiniDocument({
      title: 'test',
      styleCss: '.computed { display: grid; }',
      bodyHtml:
        '<section><style>.embed{color:blue}</style><p>Body</p><img src="https://cdn/logo.png" alt="L"/></section>',
      headerComment: 'snapshot',
    });
    const bodyIdx = doc.indexOf('<body>');
    const pIdx = doc.indexOf('<p>Body</p>');
    const styleIdx = doc.indexOf('<style type="text/css">');
    const headClose = doc.indexOf('</head>');
    assert.ok(bodyIdx > 0);
    assert.ok(pIdx > bodyIdx);
    assert.ok(styleIdx > pIdx, 'style block must follow DOM structure');
    assert.ok(headClose < bodyIdx);
    // No large CSS in head
    const head = doc.slice(0, headClose);
    assert.doesNotMatch(head, /\.computed/);
    assert.doesNotMatch(head, /\.embed/);
    assert.match(doc, /\.computed/);
    assert.match(doc, /\.embed/);
  });
});
