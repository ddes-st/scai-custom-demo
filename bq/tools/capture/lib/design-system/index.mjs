/**
 * Legacy design-system sampling API.
 * Deterministic derived-design-guide.json extraction is removed;
 * use generateAiDesignGuide / extractPageDesign for ai-derived-design.md.
 */
export {
  DESIGN_GUIDE_FILENAME,
  LEGACY_DESIGN_FILENAMES,
} from './constants.mjs';
export {
  AI_DERIVED_DESIGN_MD,
  AI_DERIVED_DESIGN_META,
  generateAiDesignGuide,
} from './ai/generate-ai-design-guide.mjs';

/** @deprecated */
export const DESIGN_INFO_FILENAME = 'derived-design-guide.json';

/**
 * @deprecated Deterministic guide removed — calls Azure ai-derived-design.md via extract path.
 */
export async function runDesignSystemExtraction(_page, pageDir, ctx = {}) {
  const { generateAiDesignGuide: gen } = await import('./ai/generate-ai-design-guide.mjs');
  const aiResult = await gen(pageDir, {
    url: ctx.url,
    force: ctx.force,
  });
  return {
    design: {
      meta: {
        aiUsed: Boolean(aiResult.ok),
        aiReused: Boolean(aiResult.reused),
        aiOutputs: aiResult.ok ? { designMd: 'ai-derived-design.md' } : null,
        aiSkipReason: aiResult.skipReason || null,
      },
    },
    path: null,
    aiUsed: Boolean(aiResult.ok),
  };
}
