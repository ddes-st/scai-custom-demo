import type { Claim, Program } from "./university";

/** Pure matching helpers for the university components (no data loading — unit-tested). */

/** The verified claim behind a program's employment rate: one that mentions employment/jobs and the rate or the program. */
export function claimFor(program: Program, claims: Claim[]): Claim | null {
  const rate = program.employmentRate != null ? String(Math.round(program.employmentRate)) : "";
  const about = (c: Claim) => `${c.name} ${c.wording}`.toLowerCase();
  const jobs = claims.filter((c) => /employ|job|career|hired|placement|empleo/i.test(about(c)));
  return jobs.find((c) => about(c).includes(program.name.toLowerCase())) ?? (rate ? jobs.find((c) => about(c).includes(`${rate}%`) || about(c).includes(`${rate} %`)) : undefined) ?? null;
}
