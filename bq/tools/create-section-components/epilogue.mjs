/**
 * End-of-run operator guidance (FE / Pages).
 */
export function printNextStepsEpilogue() {
  console.log(`
── Next steps ─────────────────────────────────────────────
authoring:generate already applied definitions to SitecoreAI (Authoring + Sites API).

To test renderings in Pages (editing host):
  • Local: cd bq && npm run dev  → use the localhost rendering host URL in Pages, or
  • Deployed: commit & push this code so the connected rendering host builds the new TSX.

Definitions alone are not enough in the browser until the FE host serving Pages
includes the new components (dev server or committed deploy).
───────────────────────────────────────────────────────────
`);
}
