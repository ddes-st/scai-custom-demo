import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtmlServer } from "../src/lib/ch/sanitize.server";

const clean = sanitizeHtmlServer;

describe("sanitizeHtmlServer (allowlist via cleanHtml)", () => {
  test("empty input", () => {
    assert.equal(clean(""), "");
  });
  test("basic formatting survives", () => {
    const html = '<p>Hello <strong>bold</strong> <em>it</em> <a href="https://example.com" title="t">link</a></p><ul><li>one</li></ul><h2>Head</h2>';
    const out = clean(html);
    for (const s of ["<p>", "<strong>bold</strong>", "<em>it</em>", 'href="https://example.com"', "<li>one</li>", "<h2>Head</h2>"]) assert.ok(out.includes(s), `${s} in ${out}`);
  });
  test("<script> and active content removed with their children", () => {
    const out = clean('<p>a</p><script>alert(1)</script><svg><animate attributeName="href" to="javascript:alert(1)"/></svg><iframe src="https://x"></iframe><style>p{}</style>');
    assert.equal(out, "<p>a</p>");
  });
  test("on* handlers removed", () => {
    const out = clean('<p onclick="alert(1)">x</p><img src="https://e.com/a.png" onerror="alert(1)" alt="a">');
    assert.ok(!/onclick|onerror|alert/i.test(out), out);
    assert.ok(out.includes('src="https://e.com/a.png"'), out);
    assert.ok(out.includes('alt="a"'), out);
  });
  test("javascript: URLs removed, including obfuscated ones", () => {
    for (const href of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", " java\tscript:alert(1)", "vbscript:x", "data:text/html,<script>alert(1)</script>"]) {
      const out = clean(`<a href="${href.replace(/"/g, "&quot;")}">x</a>`);
      assert.ok(!/href/i.test(out), `${href} → ${out}`);
      assert.ok(out.includes(">x</a>"), out);
    }
  });
  test("safe schemes kept", () => {
    assert.ok(clean('<a href="mailto:a@b.c">m</a>').includes('href="mailto:a@b.c"'));
    assert.ok(clean('<a href="/rel">r</a>').includes('href="/rel"'));
    assert.ok(clean('<img src="data:image/png;base64,AAAA">').includes("data:image/png"));
  });
  test("unknown tags are unwrapped, text kept", () => {
    assert.equal(clean("<custom-tag><b>t</b></custom-tag>"), "<b>t</b>");
  });
  test("target=_blank gets rel=noopener noreferrer", () => {
    const out = clean('<a href="https://e.com" target="_blank" rel="opener">x</a>');
    assert.ok(out.includes('rel="noopener noreferrer"'), out);
  });
  test("style attributes dropped", () => {
    assert.ok(!clean('<p style="background:url(javascript:alert(1))">x</p>').includes("style"));
  });
});
