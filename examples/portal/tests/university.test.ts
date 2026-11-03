import { test } from "node:test";
import assert from "node:assert/strict";
import { claimFor } from "../src/lib/ch/university-match";
import type { Claim, Program } from "../src/lib/ch/university";
import { shortDate, usd, yearsFor } from "../src/components/ui/portal/university/format";
import { verticalOf } from "../src/lib/portal/setup/core.mjs";

const program = (o: Partial<Program>): Program => ({
  id: "p", name: "Coastal Engineering", number: "", summary: "", image: "", brands: [], college: null, code: "CE", level: "Bachelor", cip: "", creditHours: 120, delivery: "On campus",
  tuitionInState: 10000, tuitionOutOfState: 30000, deadline: "", employmentRate: 94, entryTerm: "", applicationsVsLastYear: null, admitRate: null, yield: null, requestInfoUrl: "", ...o,
});
const claim = (o: Partial<Claim>): Claim => ({ id: "c", name: "", wording: "", source: "", dataYear: "", verifiedBy: "", verified: "", expiry: "", status: "Verified", image: null, contentIds: [], ...o });

test("claimFor: the employment claim naming the program, else the one with the same rate", () => {
  const claims = [claim({ id: "a", name: "#12 Top Public Universities in the South", wording: "Ranked #12" }), claim({ id: "b", name: "94% employed", wording: "94% of Coastal Engineering graduates are employed within six months" })];
  assert.equal(claimFor(program({}), claims)?.id, "b");
  assert.equal(claimFor(program({ name: "Marine Biology", employmentRate: 94 }), claims)?.id, "b");
  assert.equal(claimFor(program({ name: "Marine Biology", employmentRate: 81 }), claims), null);
});

test("estimator defaults: years from credit hours, else by level", () => {
  assert.equal(yearsFor("Bachelor", 120), 4);
  assert.equal(yearsFor("Master", null), 2);
  assert.equal(yearsFor("Doctoral", null), 5);
  assert.equal(yearsFor("Certificate", null), 1);
  assert.match(usd(12480, "en"), /\$12,480/);
});

test("verticalOf: higher-ed when the model has events and experts", () => {
  assert.equal(verticalOf(JSON.stringify([{ definition: "BWU.FacultyExpert" }, { definition: "BWU.CampusEvent" }, { definition: "BWU.PublishedClaim" }])), "higher-ed");
  assert.equal(verticalOf(JSON.stringify([{ definition: "BWU.CampusEvent" }])), "");
});

test("event dates: no time for date-only values (00:00 UTC)", () => {
  assert.doesNotMatch(shortDate("2026-11-12T00:00:00Z", "en", true), /12:00|AM/);
  assert.match(shortDate("2026-11-12T18:30:00Z", "en", true), /6:30/);
});
