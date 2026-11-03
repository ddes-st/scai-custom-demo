import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import "./helpers/credentials-env";
import { hashPassword, verifyPassword, verifyLogin, partnerLogins, partnerUsers } from "../src/lib/portal/auth/credentials";

describe("hashPassword / verifyPassword", () => {
  test("roundtrip", () => {
    const h = hashPassword("correct horse battery");
    assert.match(h, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.equal(verifyPassword("correct horse battery", { hash: h }), true);
  });
  test("random salt per hash", () => {
    assert.notEqual(hashPassword("same-password"), hashPassword("same-password"));
  });
  test("wrong password", () => {
    const h = hashPassword("correct horse battery");
    assert.equal(verifyPassword("wrong horse battery", { hash: h }), false);
    assert.equal(verifyPassword("", { hash: h }), false);
  });
  test("malformed hash", () => {
    assert.equal(verifyPassword("whatever1", { hash: "md5$abc$def" }), false);
  });
  test("hash wins over plain", () => {
    const h = hashPassword("hashed-secret");
    assert.equal(verifyPassword("plain-secret", { hash: h, plain: "plain-secret" }), false);
  });
  test("plain password of 8+ characters", () => {
    assert.equal(verifyPassword("12345678", { plain: "12345678" }), true);
    assert.equal(verifyPassword("12345679", { plain: "12345678" }), false);
  });
  test("plain password shorter than 8 is rejected", () => {
    assert.equal(verifyPassword("1234567", { plain: "1234567" }), false);
  });
  test("no secret at all", () => {
    assert.equal(verifyPassword("anything", {}), false);
  });
});

describe("verifyLogin", () => {
  const kansaiHash = hashPassword("kansai-secret");
  beforeEach(() => {
    process.env.PORTAL_USER = "Admin";
    process.env.PORTAL_PASSWORD_HASH = hashPassword("staff-secret");
    process.env.PORTAL_PASSWORD = "";
    process.env.PORTAL_PARTNERS = JSON.stringify([
      { u: "kansai", h: kansaiHash, l: "matthias-rothenbacher" },
      { u: "meridian", p: "meridian-pass", l: "kansai" },
      { u: "alpenmed", p: "alpenmed-pass", l: "Not Valid!" },
      { u: "nosecret" },
    ]);
  });

  test("staff login (case-insensitive user, trimmed)", () => {
    assert.deepEqual(verifyLogin("  ADMIN ", "staff-secret"), { user: "admin", subject: "staff" });
  });
  test("staff with wrong password", () => {
    assert.equal(verifyLogin("admin", "nope-nope"), null);
  });
  test("staff via plain PORTAL_PASSWORD", () => {
    process.env.PORTAL_PASSWORD_HASH = "";
    process.env.PORTAL_PASSWORD = "plain-staff-pw";
    assert.deepEqual(verifyLogin("admin", "plain-staff-pw"), { user: "admin", subject: "staff" });
  });
  test("partner by key u", () => {
    assert.deepEqual(verifyLogin("kansai", "kansai-secret"), { user: "kansai", subject: "p:kansai" });
  });
  test("partner by contact login l keeps subject p:<u>", () => {
    assert.deepEqual(verifyLogin("matthias-rothenbacher", "kansai-secret"), { user: "kansai", subject: "p:kansai" });
  });
  test("u wins over another partner's l", () => {
    // meridian's l is "kansai": signing in as "kansai" must reach the kansai partner
    assert.equal(verifyLogin("kansai", "meridian-pass"), null);
    assert.deepEqual(verifyLogin("kansai", "kansai-secret"), { user: "kansai", subject: "p:kansai" });
  });
  test("invalid l is ignored", () => {
    const a = partnerLogins().find((p) => p.user === "alpenmed");
    assert.equal(a?.login, "");
    assert.equal(verifyLogin("not valid!", "alpenmed-pass"), null);
    assert.deepEqual(verifyLogin("alpenmed", "alpenmed-pass"), { user: "alpenmed", subject: "p:alpenmed" });
  });
  test("partner without secret is dropped", () => {
    assert.equal(partnerUsers().has("nosecret"), false);
    assert.deepEqual([...partnerUsers()].sort(), ["alpenmed", "kansai", "meridian"]);
  });
  test("wrong partner password", () => {
    assert.equal(verifyLogin("kansai", "kansai-wrong"), null);
  });
  test("unknown user returns null", () => {
    assert.equal(verifyLogin("nobody", "whatever-password"), null);
  });
  test("invalid user name or empty password", () => {
    assert.equal(verifyLogin("bad name", "kansai-secret"), null);
    assert.equal(verifyLogin("kansai", ""), null);
  });
  test("broken PORTAL_PARTNERS JSON yields no partners", () => {
    process.env.PORTAL_PARTNERS = "{not json";
    assert.deepEqual(partnerLogins(), []);
    assert.equal(verifyLogin("kansai", "kansai-secret"), null);
  });
});
