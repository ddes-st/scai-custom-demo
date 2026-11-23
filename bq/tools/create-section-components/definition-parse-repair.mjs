/**
 * LLM re-emit of definitionTs when deterministic sanitize cannot recover.
 */
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import {
  DEFINITION_PARSE_FIX_HEADER,
  resolveDefinitionValidateMaxIters,
  isDefinitionValidateFailure,
} from './definition-validate-iters.mjs';
import {
  sanitizeDefinitionStringSeeds,
  assertDefinitionSeedIntegrity,
  tryParseDefinitionTs,
} from './definition-seed-sanitize.mjs';

/**
 * Strip markdown fences from an LLM definitionTs response.
 * @param {string} raw
 */
export function extractDefinitionTsFromLlm(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';
  const fence = text.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Drop leading prose before first import/export
  const start = text.search(/^(?:import\s|export\s)/m);
  if (start > 0) text = text.slice(start);
  return text.trim();
}

/**
 * One LLM call: re-emit full definitionTs with JSON.stringify seeds.
 * @param {{
 *   previousDefinitionTs: string,
 *   errorMessage: string,
 *   componentName?: string,
 *   ledger?: { record?: Function }|null,
 * }} opts
 * @returns {Promise<{ ok: boolean, definitionTs?: string, skipReason?: string, usage?: object, costEstimate?: object }>}
 */
export async function llmReemitDefinitionTs(opts) {
  const previous = String(opts.previousDefinitionTs || '');
  const errMsg = String(opts.errorMessage || '').slice(0, 2000);
  const name = opts.componentName || 'component';

  const messages = [
    {
      role: 'system',
      content:
        'You repair Sitecore ComponentTemplateDefinition TypeScript. Return only complete definitionTs source — no markdown fences, no commentary.',
    },
    {
      role: 'user',
      content: [
        DEFINITION_PARSE_FIX_HEADER,
        '',
        `Component: ${name}`,
        '',
        '=== PARSE / INTEGRITY ERROR ===',
        errMsg || '(unknown)',
        '',
        '=== PREVIOUS DEFINITION TS ===',
        previous.slice(0, 50000),
      ].join('\n'),
    },
  ];

  const result = await azureChatCompletion({
    messages,
  });

  if (opts.ledger?.record) {
    opts.ledger.record({
      purpose: 'definition-parse-fix',
      componentName: name,
      ok: result.ok,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
      skipReason: result.skipReason,
    });
  }

  if (!result.ok) {
    return {
      ok: false,
      skipReason: result.skipReason || 'azure chat failed',
      usage: result.usage,
      costEstimate: result.costEstimate,
    };
  }

  const definitionTs = extractDefinitionTsFromLlm(result.content || '');
  if (!definitionTs) {
    return { ok: false, skipReason: 'empty LLM definitionTs' };
  }

  // Deterministic sanitize after LLM (strips any leftover C0 / CSS bleed)
  const sanitized = sanitizeDefinitionStringSeeds(definitionTs);
  return {
    ok: true,
    definitionTs: sanitized,
    usage: result.usage,
    costEstimate: result.costEstimate,
  };
}

/**
 * Finalize with sanitize/integrity already inside finalizeFn; on validate
 * failure, LLM re-emit and retry up to BQ_DEFINITION_VALIDATE_MAX_ITERS.
 *
 * @param {string} definitionTs
 * @param {(definitionTs: string) => Promise<string>} finalizeFn
 * @param {{
 *   componentName?: string,
 *   maxRetries?: number|null,
 *   ledger?: object|null,
 * }} [opts]
 */
export async function finalizeDefinitionWithParseRetries(
  definitionTs,
  finalizeFn,
  opts = {},
) {
  const maxRetries =
    opts.maxRetries != null && Number.isFinite(Number(opts.maxRetries))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.maxRetries))))
      : resolveDefinitionValidateMaxIters();

  let current = String(definitionTs || '');
  let retriesUsed = 0;
  const name = opts.componentName || 'component';

  for (;;) {
    try {
      const out = await finalizeFn(current);
      // Final integrity gate when finalize did not already throw
      assertDefinitionSeedIntegrity(
        out,
        `${name}.definition.ts`,
      );
      return {
        definitionTs: out,
        definitionAttempts: 1 + retriesUsed,
      };
    } catch (err) {
      if (!isDefinitionValidateFailure(err) || retriesUsed >= maxRetries) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      retriesUsed += 1;
      console.warn(
        `  ⚠ Definition parse/integrity LLM re-emit ${retriesUsed}/${maxRetries} for ${name}: ${msg.split('\n')[0]}`,
      );
      const repaired = await llmReemitDefinitionTs({
        previousDefinitionTs: current,
        errorMessage: msg,
        componentName: name,
        ledger: opts.ledger || null,
      });
      if (!repaired.ok || !repaired.definitionTs) {
        throw new Error(
          `[codegen] ${name}.definition.ts DEFINITION PARSE FIX LLM re-emit failed: ${repaired.skipReason || 'unknown'}`,
          { cause: err },
        );
      }
      current = repaired.definitionTs;
      if (!tryParseDefinitionTs(current).ok) {
        // Still unparseable — continue loop if retries remain, else throw next finalize
        console.warn(
          `  ⚠ Definition LLM re-emit still unparseable for ${name} (will finalize/retry)`,
        );
      }
    }
  }
}
