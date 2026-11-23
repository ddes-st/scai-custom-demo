/**
 * @deprecated Variant rename via Cursor Agent removed (token cost).
 * `--ai` removed: extract always writes ai-derived-design.md via Azure Foundry (hash-gated).
 * Kept as a no-op for any lingering imports.
 */
export async function maybeRenameVariantsWithAi(guide) {
  return {
    guide,
    aiUsed: false,
    aiUsage: null,
    skipReason: 'variant-rename-removed-use-azure-ai-design-guide',
  };
}
