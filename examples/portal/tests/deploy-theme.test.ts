import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deployTheme } from "../src/lib/portal/deploy-theme";

describe("deployTheme", () => {
  test("PORTAL_THEME → accent, fonts and palette tokens", () => {
    const t = deployTheme(JSON.stringify({ b: "Brightwater University", c: ["#0B3D5C", "#f2b705"], h: "Lora", t: "Inter" }));
    assert.equal(t?.brand, "Brightwater University");
    assert.equal(t?.accent, "#0B3D5C");
    assert.equal(t?.fontSerif, "Lora");
    assert.equal(t?.fontSans, "Inter");
    assert.ok(Object.keys(t?.vars ?? {}).length > 0);
  });
  test("bad fonts are dropped, no colours or bad JSON give none", () => {
    assert.equal(deployTheme(JSON.stringify({ c: ["#112233"], h: "x;}body{", t: "" }))?.fontSerif, "");
    assert.equal(deployTheme(JSON.stringify({ c: ["red"] })), null);
    assert.equal(deployTheme("{nope"), null);
    assert.equal(deployTheme(""), null);
  });
});
