/**
 * LLM re-emit of tsx/clientTsx when Prettier refuses invalid AI output.
 * Salvage (fixGluedJsxTagAttributes) runs inside writeComponentPackage first;
 * this module only retries when format still fails.
 */
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import { fixGluedJsxTagAttributes } from './ai-source-fixup.mjs';
import {
  TSX_FORMAT_FIX_HEADER,
  isTsxFormatFailure,
  TSX_FORMAT_AI_RETRIES_DEFAULT,
} from './tsx-format-iters.mjs';
import { writeComponentPackage } from './write-component.mjs';
import {
  SURGICAL_PRESERVE_SYSTEM,
  selectRepairFiles,
  parseSurgicalRepairJson,
  buildSurgicalPreserveUserMessage,
  applySurgicalPreserveResult,
} from './surgical-preserve-repair.mjs';

/**
 * Strip markdown fences / leading prose from an LLM TSX response.
 * @param {string} raw
 * @returns {string}
 */
export function extractTsxFromLlm(raw) {
  let text = String(raw || '').trim();
  if (!text) return '';
  const fence = text.match(
    /```(?:tsx|typescript|ts|jsx|javascript|js)?\s*([\s\S]*?)```/i,
  );
  if (fence) text = fence[1].trim();
  const start = text.search(
    /^(?:['"]use client['"];?\s*\n+)?(?:import\s|export\s|'use client')/m,
  );
  if (start > 0) text = text.slice(start);
  return text.trim();
}

/**
 * Parse LLM package response: optional === tsx === / === clientTsx === /
 * === definitionTs === markers.
 * @param {string} raw
 * @param {{ expectClient?: boolean, expectDefinition?: boolean }} [opts]
 * @returns {{ tsx: string, clientTsx?: string, definitionTs?: string }}
 */
export function extractTsxPackageFromLlm(raw, opts = {}) {
  const text = String(raw || '');
  const defMark = text.match(
    /===\s*definitionTs\s*===\s*([\s\S]*?)(?===\s*(?:tsx|clientTsx)\s*===|$)/i,
  );
  const tsxMark = text.match(
    /===\s*tsx\s*===\s*([\s\S]*?)(?===\s*(?:clientTsx|definitionTs)\s*===|$)/i,
  );
  const clientMark = text.match(
    /===\s*clientTsx\s*===\s*([\s\S]*?)(?===\s*(?:tsx|definitionTs)\s*===|$)/i,
  );
  if (tsxMark || defMark || clientMark) {
    /** @type {{ tsx: string, clientTsx?: string, definitionTs?: string }} */
    const out = {
      tsx: extractTsxFromLlm(tsxMark?.[1] || ''),
    };
    if (clientMark || opts.expectClient) {
      out.clientTsx = extractTsxFromLlm(clientMark?.[1] || '');
    }
    if (defMark || opts.expectDefinition) {
      const defRaw = String(defMark?.[1] || '').trim();
      if (defRaw) out.definitionTs = extractTsxFromLlm(defRaw);
    }
    return out;
  }
  // Single-file repair (no markers)
  const extracted = extractTsxFromLlm(text);
  if (opts.expectClient && extracted) {
    // Heuristic: prefer returning as client when previous write failed on client only
    // is handled by caller; default whole payload to tsx.
  }
  return { tsx: extracted };
}

/**
 * Build a short snippet around a Prettier "(line:col)" loc if present.
 * @param {string} source
 * @param {string} errorMessage
 * @param {number} [radius]
 * @returns {string}
 */
export function snippetAroundPrettierError(source, errorMessage, radius = 15) {
  const src = String(source || '');
  const msg = String(errorMessage || '');
  const loc = msg.match(/\((\d+):(\d+)\)/);
  if (!loc || !src) return src.slice(0, 2000);
  const lineNo = Math.max(1, Number(loc[1]) || 1);
  const lines = src.split(/\r?\n/);
  const start = Math.max(0, lineNo - 1 - radius);
  const end = Math.min(lines.length, lineNo + radius);
  return lines
    .slice(start, end)
    .map((ln, i) => `${start + i + 1}| ${ln}`)
    .join('\n')
    .slice(0, 4000);
}

/**
 * One LLM call: re-emit tsx (+ optional clientTsx) after Prettier failure.
 * @param {{
 *   previousTsx: string,
 *   previousClientTsx?: string|null,
 *   errorMessage: string,
 *   componentName?: string,
 *   failedFile?: 'tsx'|'clientTsx'|string,
 *   ledger?: { record?: Function }|null,
 * }} opts
 */
export async function llmReemitTsxPackage(opts) {
  const previousTsx = String(opts.previousTsx || '');
  const previousClient = opts.previousClientTsx
    ? String(opts.previousClientTsx)
    : '';
  const errMsg = String(opts.errorMessage || '').slice(0, 2000);
  const name = opts.componentName || 'component';
  const failedFile = opts.failedFile || 'tsx';
  const snippetSource =
    failedFile === 'clientTsx' && previousClient ? previousClient : previousTsx;
  const snippet = snippetAroundPrettierError(snippetSource, errMsg);

  const select = selectRepairFiles([`FORMAT: ${errMsg}`], {
    previousTsx,
    previousClientTsx: previousClient,
    failedFile,
  });
  // Ensure at least the failed file is selected
  if (failedFile === 'clientTsx') {
    select.client = true;
    select.tsx = false;
  } else {
    select.tsx = true;
    if (!previousClient.trim()) select.client = false;
  }

  const diagLines = [
    `Failed file: ${failedFile}`,
    errMsg || '(unknown prettier error)',
    snippet ? `Snippet:\n${snippet}` : '',
  ].filter(Boolean);

  const userContent = buildSurgicalPreserveUserMessage({
    componentName: name,
    diagnostics: diagLines,
    previousTsx,
    previousClientTsx: previousClient,
    select,
    header: `${TSX_FORMAT_FIX_HEADER}\n\nSURGICAL FORMAT FIX (hard):\nSmallest possible edit so Prettier accepts the file. Do not rewrite files you were not asked to change.`,
    extraDiagLabel: '=== PRETTIER / FORMAT DIAGNOSTICS ===',
  });

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: SURGICAL_PRESERVE_SYSTEM },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
  });

  if (opts.ledger?.record) {
    opts.ledger.record({
      purpose: 'codegen-tsx-format-repair',
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

  let parsed = parseSurgicalRepairJson(result.content || '');
  if (
    parsed.tsx == null &&
    parsed.clientTsx == null &&
    parsed.definitionTs == null
  ) {
    const marker = extractTsxPackageFromLlm(result.content || '', {
      expectClient: select.client,
    });
    parsed = {
      tsx: marker.tsx || undefined,
      clientTsx: marker.clientTsx || undefined,
    };
    // Client-only failure: whole payload may be the client file
    if (
      failedFile === 'clientTsx' &&
      parsed.tsx &&
      !parsed.clientTsx &&
      previousTsx &&
      !previousTsx.includes(String(parsed.tsx).slice(0, 40))
    ) {
      parsed.clientTsx = parsed.tsx;
      parsed.tsx = undefined;
    }
  }

  if (parsed.tsx != null) {
    parsed.tsx = fixGluedJsxTagAttributes(String(parsed.tsx));
  }
  if (parsed.clientTsx != null) {
    parsed.clientTsx = fixGluedJsxTagAttributes(String(parsed.clientTsx));
  }

  const applied = applySurgicalPreserveResult({
    parsed,
    previousTsx,
    previousClientTsx: previousClient,
    select,
    diagnostics: diagLines,
  });

  if (!applied.ok) {
    return {
      ok: false,
      skipReason: applied.skipReason || 'surgical preserve rejected',
      usage: result.usage,
      costEstimate: result.costEstimate,
    };
  }

  return {
    ok: true,
    tsx: applied.tsx,
    ...(previousClient.trim() || select.client
      ? { clientTsx: applied.clientTsx || previousClient }
      : {}),
    usage: result.usage,
    costEstimate: result.costEstimate,
  };
}

/**
 * Write a component package; on Prettier/format failure, AI-reemit and retry.
 *
 * @param {object} writeOpts — same as writeComponentPackage
 * @param {{
 *   maxRetries?: number|null,
 *   ledger?: object|null,
 *   writeFn?: typeof writeComponentPackage,
 *   repairFn?: typeof llmReemitTsxPackage,
 * }} [opts]
 */
export async function writeComponentPackageWithFormatRetries(
  writeOpts,
  opts = {},
) {
  // Always one AI retry unless a caller (tests) overrides — not env-gated.
  const maxRetries =
    opts.maxRetries != null && Number.isFinite(Number(opts.maxRetries))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.maxRetries))))
      : TSX_FORMAT_AI_RETRIES_DEFAULT;
  const writeFn = opts.writeFn || writeComponentPackage;
  const repairFn = opts.repairFn || llmReemitTsxPackage;
  const name = writeOpts.componentName || writeOpts.kebab || 'component';

  let currentTsx = String(writeOpts.tsx || '');
  let currentClient =
    writeOpts.clientTsx != null ? String(writeOpts.clientTsx) : null;
  let retriesUsed = 0;

  for (;;) {
    try {
      return await writeFn({
        ...writeOpts,
        tsx: currentTsx,
        ...(currentClient != null ? { clientTsx: currentClient } : {}),
      });
    } catch (err) {
      if (!isTsxFormatFailure(err) || retriesUsed >= maxRetries) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      retriesUsed += 1;
      const failedFile = /\.client\.tsx/i.test(msg) ? 'clientTsx' : 'tsx';
      console.warn(
        `  ⚠ TSX format LLM re-emit ${retriesUsed}/${maxRetries} for ${name}: ${msg.split('\n')[0]}`,
      );
      const repaired = await repairFn({
        previousTsx: currentTsx,
        previousClientTsx: currentClient,
        errorMessage: msg,
        componentName: name,
        failedFile,
        ledger: opts.ledger || null,
      });
      if (!repaired.ok || !repaired.tsx) {
        throw new Error(
          `[codegen] ${name} TSX FORMAT FIX LLM re-emit failed: ${repaired.skipReason || 'unknown'}`,
          { cause: err },
        );
      }
      currentTsx = repaired.tsx;
      if (currentClient != null) {
        currentClient =
          repaired.clientTsx != null ? repaired.clientTsx : currentClient;
      }
    }
  }
}
