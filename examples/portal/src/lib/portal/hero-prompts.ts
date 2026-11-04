/** Suggestion chips under the brand-hub search. One non-empty line of the page Lead is one prompt. */
export function heroPrompts(lead: string): string[] {
  return lead
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}
