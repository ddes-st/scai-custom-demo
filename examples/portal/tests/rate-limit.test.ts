import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Limiter, clientIp } from "../src/lib/portal/auth/rate-limit";

describe("Limiter", () => {
  test("blocks after max hits within the window", () => {
    const l = new Limiter(3, 1000);
    assert.equal(l.blocked("a", 0), false);
    assert.equal(l.hit("a", 0), false);
    assert.equal(l.hit("a", 10), false);
    assert.equal(l.blocked("a", 20), false);
    assert.equal(l.hit("a", 20), false);
    assert.equal(l.blocked("a", 30), true);
    assert.equal(l.hit("a", 30), true);
    assert.equal(l.blocked("b", 30), false, "keys are independent");
  });
  test("window expiry", () => {
    const l = new Limiter(1, 1000);
    l.hit("a", 0);
    assert.equal(l.blocked("a", 999), true);
    assert.equal(l.blocked("a", 1000), false);
    assert.equal(l.hit("a", 1000), false, "a new window starts");
    assert.equal(l.hit("a", 1001), true);
  });
  test("reset", () => {
    const l = new Limiter(1, 1000);
    l.hit("a", 0);
    assert.equal(l.blocked("a", 1), true);
    l.reset("a");
    assert.equal(l.blocked("a", 1), false);
  });
  test("max 0 blocks the first hit", () => {
    assert.equal(new Limiter(0, 1000).hit("a", 0), true);
  });
  test("map stays bounded at the cap", () => {
    const l = new Limiter(5, 1_000_000, 4);
    for (let i = 0; i < 20; i++) l.hit(`k${i}`, i);
    assert.ok((l as any).hits.size <= 4);
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  test("x-vercel-forwarded-for wins", () => {
    assert.equal(clientIp(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" })), "1.1.1.1");
  });
  test("then x-real-ip", () => {
    assert.equal(clientIp(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" })), "2.2.2.2");
  });
  test("then the first x-forwarded-for entry", () => {
    assert.equal(clientIp(h({ "x-forwarded-for": " 3.3.3.3 , 4.4.4.4" })), "3.3.3.3");
  });
  test("unknown when absent; long values capped", () => {
    assert.equal(clientIp(h({})), "unknown");
    assert.equal(clientIp(h({ "x-real-ip": "a".repeat(200) })).length, 64);
  });
});
