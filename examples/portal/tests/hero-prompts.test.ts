import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { heroPrompts } from "../src/lib/portal/hero-prompts";

describe("heroPrompts", () => {
  test("one chip per non-empty line, capped at six", () => {
    assert.deepEqual(heroPrompts("Hero image for a corporate services pitch\n\nCan partners use our logo?\n  One-pager I can personalise  "), [
      "Hero image for a corporate services pitch",
      "Can partners use our logo?",
      "One-pager I can personalise",
    ]);
    assert.equal(heroPrompts(["a", "b", "c", "d", "e", "f", "g"].join("\n")).length, 6);
  });

  test("empty lead", () => {
    assert.deepEqual(heroPrompts(""), []);
    assert.deepEqual(heroPrompts("\n  \n"), []);
  });
});
