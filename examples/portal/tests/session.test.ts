import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSessionToken, sessionSubject, partnerUserOf, SESSION_TTL_S } from "../src/lib/portal/auth/session";

const SECRET = "test-secret-for-unit-tests-only";

describe("session tokens", () => {
  test("roundtrip staff and partner", async () => {
    assert.equal(await sessionSubject(await createSessionToken(SECRET, "staff"), SECRET), "staff");
    assert.equal(await sessionSubject(await createSessionToken(SECRET, "p:kansai"), SECRET), "p:kansai");
  });
  test("invalid subject cannot be signed", async () => {
    await assert.rejects(createSessionToken(SECRET, "admin"));
    await assert.rejects(createSessionToken(SECRET, "p:Bad.User"));
  });
  test("tampered token rejected", async () => {
    const t = await createSessionToken(SECRET, "p:kansai");
    const [exp, , sig] = t.split(".");
    assert.equal(await sessionSubject(`${exp}.staff.${sig}`, SECRET), null);
    assert.equal(await sessionSubject(`${Number(exp) + 1000}.p:kansai.${sig}`, SECRET), null);
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    assert.equal(await sessionSubject(`${exp}.p:kansai.${flipped}`, SECRET), null);
  });
  test("expired token rejected", async (t) => {
    const realNow = Date.now;
    const start = realNow();
    t.after(() => { Date.now = realNow; });
    Date.now = () => start;
    const token = await createSessionToken(SECRET, "staff");
    Date.now = () => start + SESSION_TTL_S * 1000 - 1;
    assert.equal(await sessionSubject(token, SECRET), "staff");
    Date.now = () => start + SESSION_TTL_S * 1000 + 1;
    assert.equal(await sessionSubject(token, SECRET), null);
  });
  test("wrong secret rejected", async () => {
    const t = await createSessionToken(SECRET, "staff");
    assert.equal(await sessionSubject(t, "another-secret"), null);
    assert.equal(await sessionSubject(t, ""), null);
  });
  test("missing or malformed token", async () => {
    assert.equal(await sessionSubject(undefined, SECRET), null);
    assert.equal(await sessionSubject("", SECRET), null);
    assert.equal(await sessionSubject("a.b", SECRET), null);
    assert.equal(await sessionSubject("x.staff.y", SECRET), null);
  });
  test("partnerUserOf", () => {
    assert.equal(partnerUserOf("p:kansai"), "kansai");
    assert.equal(partnerUserOf("staff"), "");
    assert.equal(partnerUserOf(null), "");
  });
});
