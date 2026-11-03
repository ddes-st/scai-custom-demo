import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { idParam, routeId, productHref } from "../src/lib/portal/sections";

describe("idParam / routeId (Content Hub identifiers in one URL segment)", () => {
  // ids where no "." touches another "." or a "~" (see the todo below for the rest)
  const ids = ["db.demo.product.x", "plain", "with~tilde", "a~~b.c", "~x.y~", "ü ber/slash?", "50%", "trailing.", ".lead", "M.Asset.x~1"];
  test("no dots in the encoded segment", () => {
    for (const id of ids) assert.ok(!idParam(id).includes("."), idParam(id));
  });
  test("roundtrip through Next's param decoding", () => {
    for (const id of ids) assert.equal(routeId(decodeURIComponent(idParam(id))), id, id);
  });
  test("roundtrip on the still-encoded segment", () => {
    for (const id of ids) assert.equal(routeId(idParam(id)), id, id);
  });
  test("examples", () => {
    assert.equal(idParam("db.demo.product.x"), "db~demo~product~x");
    assert.equal(idParam("a~b"), "a~~b");
    assert.equal(routeId("a~~b~c"), "a~b.c");
    assert.equal(productHref("db.x"), "/products/db~x");
  });
  // Known bug (not fixed here): "~" → "~~" then "." → "~" is not injective — ".." and "~" both
  // encode to "~~", "~." and ".~" both to "~~~" — so different ids share one URL and routeId
  // returns the wrong one for any id where a "." touches another "." or a "~".
  test("encoding is unambiguous when dots touch dots or tildes", { todo: "idParam: a..b and a~b both give a~~b" }, () => {
    assert.notEqual(idParam("a..b"), idParam("a~b"));
    assert.notEqual(idParam("a~.b"), idParam("a.~b"));
    for (const id of ["a..b", "a.~b", "~~.~", "x.~~y"]) assert.equal(routeId(idParam(id)), id, id);
  });
  test("a stray % does not throw", () => {
    assert.equal(routeId("100%"), "100%");
    assert.equal(routeId("%zz~a"), "%zz.a");
  });
});
