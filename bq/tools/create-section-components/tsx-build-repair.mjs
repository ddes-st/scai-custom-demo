/**
 * Write-path build gate: stage → contracts + tsc → AI re-emit on failure → format write.
 * Always-on (like Prettier format repair). Catches Next breakers tsc alone may miss
 * ('use server') and missing ./….client companions.
 */
import {
  stripForbiddenUseServerDirective,
  mapEntryImportsCompanionClient,
  fixGluedJsxTagAttributes,
  hasValidTsxPreamble,
  applyWritePathAlwaysOnTsxSanitizers,
  ensureListNoneOnLists,
  normalizeDesktopLayoutToLg,
  fillLinkUrlsFromSectionHtml,
} from './ai-source-fixup.mjs';
import { syncDefinitionFromTsx } from './sync-definition-from-tsx.mjs';
import {
  SURGICAL_PRESERVE_SYSTEM,
  selectRepairFiles,
  parseSurgicalRepairJson,
  buildSurgicalPreserveUserMessage,
  applySurgicalPreserveResult,
  diagnosticsImproved,
} from './surgical-preserve-repair.mjs';

const LIST_NONE_CONTRACT_RE =
  /<li>\s*without list-none|list-none — screenshots without bullets/i;

const DESKTOP_LAYOUT_LG_CONTRACT_RE =
  /multi-column grid at md:\s*without lg:|carousel wraps to grid at md:/i;

const JSX_NAMESPACE_IMPORT_CONTRACT_RE =
  /uses JSX\.Element \(or JSX\.\*\) without importing JSX/i;

const FIELD_TYPES_IMPORT_CONTRACT_RE =
  /without import type \{[^}]*\} from '@sitecore-content-sdk\/nextjs'/i;

/**
 * True when every diagnostic is the list-none CONTRACT (mechanical-only).
 * @param {string[]} diagnostics
 * @returns {boolean}
 */
export function diagnosticsAreListNoneOnly(diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  if (!list.length) return false;
  return list.every((d) => LIST_NONE_CONTRACT_RE.test(String(d || '')));
}

/**
 * True when every diagnostic is a mechanical-only CONTRACT (list-none,
 * md→lg desktop layout, JSX namespace import, and/or Field-type imports).
 * @param {string[]} diagnostics
 * @returns {boolean}
 */
export function diagnosticsAreMechanicalOnly(diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  if (!list.length) return false;
  return list.every((d) => {
    const s = String(d || '');
    return (
      LIST_NONE_CONTRACT_RE.test(s) ||
      DESKTOP_LAYOUT_LG_CONTRACT_RE.test(s) ||
      JSX_NAMESPACE_IMPORT_CONTRACT_RE.test(s) ||
      FIELD_TYPES_IMPORT_CONTRACT_RE.test(s)
    );
  });
}

/**
 * Reject truncated / corrupt LLM repair payloads.
 * Keep this narrow — trailing `.` / `,` false-positive on real sources and
 * cut off valid repairs. Only clear corruption signals.
 * @param {string} source
 * @returns {boolean}
 */
export function looksLikeTruncatedTsxEmit(source) {
  const t = String(source || '').trimEnd();
  if (!t) return true;
  // LLM sometimes returns literal "..." for an unchanged file section.
  if (/^\.{3,}$/.test(t)) return true;
  // Prompt filler echoed back (must not parse as a real package).
  if (/^\(complete (?:tsx|corrected definition) here\)$/i.test(t)) return true;
  if (!hasValidTsxPreamble(t)) return true;
  const lastLine = (
    t.split(/\r?\n/).filter((ln) => ln.trim()).at(-1) || ''
  ).trim();
  // Trailing lone `=` line (Azure cutoff on MenzisHeaderUtilityBand).
  if (lastLine === '=') return true;
  if (/\b(export|const|let|var|function|return|import|from|type|interface)\s*$/.test(t)) {
    return true;
  }
  // No export at all → incomplete for map-entry / client packages.
  if (!/\bexport\b/.test(t)) return true;
  return false;
}
import { azureChatCompletion } from '../capture/lib/design-system/ai/azure-chat.mjs';
import {
  extractTsxPackageFromLlm,
  writeComponentPackageWithFormatRetries,
} from './tsx-format-repair.mjs';
import {
  stageGeneratedSources,
  collectValidateDiagnostics,
  annotateValidateDiagnostics,
  resolveValidateFixHeader,
  formatValidateAttemptLog,
} from './tsx-validate-loop.mjs';
import {
  TSX_BUILD_FIX_HEADER,
  resolveTsxBuildMaxRetries,
  isTsxBuildFailure,
} from './tsx-build-iters.mjs';

/** Lightweight kebab fallback — avoid importing naming.mjs (heavy shared graph). */
function kebabFallback(name) {
  return String(name || 'component')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * @param {string[]} diagnostics
 * @returns {string}
 */
function formatBuildDiagBlock(diagnostics) {
  return annotateValidateDiagnostics(diagnostics || [])
    .map((d) => String(d || '').trim())
    .filter(Boolean)
    .slice(0, 40)
    .join('\n');
}

/**
 * True when build diagnostics require definitionTs repair (not TSX-only).
 * @param {string[]|null|undefined} diagnostics
 * @returns {boolean}
 */
export function diagnosticsNeedDefinitionRepair(diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  return list.some((d) => {
    const s = String(d || '');
    return (
      /valid Sitecore item name/i.test(s) ||
      /content\.items\[\]\.name/i.test(s) ||
      /children\[\]\.name/i.test(s) ||
      /ItemNameValidation/i.test(s) ||
      /definitionTs/i.test(s) ||
      /HARD:\s*content\.items/i.test(s)
    );
  });
}

/**
 * Surgical LLM repair after contracts/tsc build gate failure.
 * Previous package is authoritative; only requested files may change.
 * @param {{
 *   previousTsx: string,
 *   previousClientTsx?: string|null,
 *   previousDefinitionTs?: string|null,
 *   diagnostics: string[],
 *   componentName?: string,
 *   requireClient?: boolean,
 *   ledger?: { record?: Function }|null,
 * }} opts
 */
export async function llmReemitTsxPackageForBuild(opts) {
  const previousTsx = String(opts.previousTsx || '');
  const previousClient = opts.previousClientTsx
    ? String(opts.previousClientTsx)
    : '';
  const previousDefinition = opts.previousDefinitionTs
    ? String(opts.previousDefinitionTs)
    : '';
  const diagnostics = Array.isArray(opts.diagnostics) ? opts.diagnostics : [];
  const name = opts.componentName || 'component';
  const requireClientHint =
    Boolean(opts.requireClient) ||
    mapEntryImportsCompanionClient(previousTsx);

  const select = selectRepairFiles(diagnostics, {
    previousTsx,
    previousClientTsx: previousClient,
    previousDefinitionTs: previousDefinition,
    requireClient: requireClientHint && !previousClient.trim(),
  });

  // Missing companion still requires client even if select missed it
  if (requireClientHint && !previousClient.trim()) {
    select.client = true;
  }

  const diagLines = annotateValidateDiagnostics(
    diagnostics.map((d) => String(d || '').trim()).filter(Boolean),
  );

  const userContent = buildSurgicalPreserveUserMessage({
    componentName: name,
    diagnostics: diagLines,
    previousTsx,
    previousClientTsx: previousClient,
    previousDefinitionTs: previousDefinition,
    select,
    header: `${TSX_BUILD_FIX_HEADER}\n\nSURGICAL BUILD FIX (hard):\nSmallest possible edit. Do not rewrite files you were not asked to change.`,
    extraDiagLabel: '=== BUILD / CONTRACT / TSC DIAGNOSTICS ===',
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
      purpose: 'codegen-tsx-build-repair',
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
  // Fallback: marker extract if model ignored JSON shape
  if (
    parsed.tsx == null &&
    parsed.clientTsx == null &&
    parsed.definitionTs == null
  ) {
    const marker = extractTsxPackageFromLlm(result.content || '', {
      expectClient: select.client,
      expectDefinition: select.definition,
    });
    parsed = {
      tsx: marker.tsx || undefined,
      clientTsx: marker.clientTsx || undefined,
      definitionTs: marker.definitionTs || undefined,
    };
  }

  if (parsed.tsx != null) {
    parsed.tsx = fixGluedJsxTagAttributes(
      stripForbiddenUseServerDirective(String(parsed.tsx)),
    );
  }
  if (parsed.clientTsx != null) {
    parsed.clientTsx = fixGluedJsxTagAttributes(
      stripForbiddenUseServerDirective(String(parsed.clientTsx)),
    );
  }

  if (parsed.tsx && looksLikeTruncatedTsxEmit(parsed.tsx) && previousTsx.trim()) {
    parsed.tsx = previousTsx;
  }
  if (
    parsed.clientTsx &&
    looksLikeTruncatedTsxEmit(parsed.clientTsx) &&
    previousClient.trim()
  ) {
    parsed.clientTsx = previousClient;
  }

  const applied = applySurgicalPreserveResult({
    parsed,
    previousTsx,
    previousClientTsx: previousClient,
    previousDefinitionTs: previousDefinition,
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

  if (looksLikeTruncatedTsxEmit(applied.tsx)) {
    return { ok: false, skipReason: 'truncated LLM tsx emit' };
  }
  if (
    select.client &&
    applied.clientTsx &&
    looksLikeTruncatedTsxEmit(applied.clientTsx)
  ) {
    return { ok: false, skipReason: 'truncated LLM clientTsx emit' };
  }

  // When companion is required for map-entry but still empty after repair
  if (
    (requireClientHint || select.client) &&
    mapEntryImportsCompanionClient(applied.tsx) &&
    !(applied.clientTsx && String(applied.clientTsx).trim())
  ) {
    return {
      ok: false,
      skipReason: 'empty LLM clientTsx (required for .client import)',
    };
  }

  return {
    ok: true,
    tsx: applied.tsx,
    ...(applied.clientTsx != null && String(applied.clientTsx).trim()
      ? { clientTsx: applied.clientTsx }
      : {}),
    ...(applied.definitionTs != null && String(applied.definitionTs).trim()
      ? { definitionTs: applied.definitionTs }
      : {}),
    usage: result.usage,
    costEstimate: result.costEstimate,
  };
}

/**
 * Stage + collect contracts/tsc diagnostics for a package draft.
 * @param {object} writeOpts
 * @param {{ tsx: string, clientTsx?: string|null, kebab: string }} draft
 * @returns {Promise<string[]>}
 */
export async function collectBuildDiagnosticsForDraft(writeOpts, draft) {
  const tsx = stripForbiddenUseServerDirective(String(draft.tsx || ''));
  let clientTsx =
    draft.clientTsx != null && String(draft.clientTsx).trim()
      ? stripForbiddenUseServerDirective(String(draft.clientTsx))
      : null;

  const staged = await stageGeneratedSources({
    hostSlug: writeOpts.hostSlug,
    componentName: writeOpts.componentName,
    kebab: draft.kebab,
    tsx,
    clientTsx,
  });

  const childPh =
    writeOpts.captureMeta?.placeholder ||
    writeOpts.placeholder ||
    writeOpts.captureMeta?.placeholderKey ||
    null;

  return collectValidateDiagnostics({
    tsx,
    clientTsx,
    tsxPath: staged.tsxPath,
    clientTsxPath: staged.clientTsxPath,
    layoutMode: writeOpts.layoutMode,
    sectionHtml: writeOpts.sectionHtml,
    imageInventory: writeOpts.imageInventory,
    role: writeOpts.role,
    sectionInfo: writeOpts.sectionInfo,
    parentComponentName: writeOpts.captureMeta?.parentComponentName,
    parentDefinitionTs: writeOpts.parentDefinitionTs || null,
    plan: writeOpts.plan,
    planMode: writeOpts.planMode || writeOpts.plan?.mode,
    definitionTs: writeOpts.definitionTs,
    componentName: writeOpts.componentName,
    definitionKey: writeOpts.definitionKey,
    codePrefix: writeOpts.codePrefix,
    childPackages: writeOpts.childPackages,
    siblingPackages: writeOpts.siblingPackages,
    pathLeafSiblingDefs: writeOpts.pathLeafSiblingDefs,
    placeholder: childPh,
    childPlaceholder: childPh,
    layoutSketch: writeOpts.layoutSketch || null,
  });
}

/**
 * Write a component package with build gate + AI repair, then Prettier format retries.
 *
 * @param {object} writeOpts — same as writeComponentPackage
 * @param {{
 *   maxRetries?: number|null,
 *   ledger?: object|null,
 *   repairFn?: typeof llmReemitTsxPackageForBuild,
 *   formatWriteFn?: typeof writeComponentPackageWithFormatRetries,
 *   collectFn?: typeof collectBuildDiagnosticsForDraft,
 * }} [opts]
 */
export async function writeComponentPackageWithBuildRetries(
  writeOpts,
  opts = {},
) {
  const maxRetries =
    opts.maxRetries != null && Number.isFinite(Number(opts.maxRetries))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.maxRetries))))
      : resolveTsxBuildMaxRetries();
  const repairFn = opts.repairFn || llmReemitTsxPackageForBuild;
  const formatWriteFn =
    opts.formatWriteFn || writeComponentPackageWithFormatRetries;
  const collectFn = opts.collectFn || collectBuildDiagnosticsForDraft;
  const name = writeOpts.componentName || writeOpts.kebab || 'component';
  const kebab =
    writeOpts.kebab || kebabFallback(writeOpts.componentName || 'component');

  let currentTsx = String(writeOpts.tsx || '');
  let currentClient =
    writeOpts.clientTsx != null && String(writeOpts.clientTsx).trim()
      ? String(writeOpts.clientTsx)
      : null;
  let currentDefinition =
    writeOpts.definitionTs != null && String(writeOpts.definitionTs).trim()
      ? String(writeOpts.definitionTs)
      : writeOpts.definitionTs;
  if (currentDefinition && writeOpts.sectionHtml) {
    currentDefinition = fillLinkUrlsFromSectionHtml(
      currentDefinition,
      writeOpts.sectionHtml,
    );
  }
  let fontSvg = '';
  try {
    const sectionDir =
      writeOpts.captureMeta?.sectionDir ||
      writeOpts.sectionInfo?.sectionDir ||
      null;
    if (sectionDir && writeOpts.sectionHtml) {
      const { loadIconFontSvgForSection } = await import(
        './icon-font-svg-markup.mjs'
      );
      const { defaultCapturesDir } = await import('../capture/paths.mjs');
      const pathMod = await import('node:path');
      const htmlPathGuess = pathMod.join(
        defaultCapturesDir,
        String(sectionDir).replace(/\\/g, '/'),
        'section.html',
      );
      fontSvg = await loadIconFontSvgForSection(htmlPathGuess);
    }
  } catch {
    fontSvg = '';
  }
  const sanitizerOpts = {
    kebab,
    sectionInfo: writeOpts.sectionInfo || null,
    role: writeOpts.role || null,
    definitionTs: currentDefinition || null,
    sectionHtml: writeOpts.sectionHtml || null,
    fontSvg,
  };
  {
    const sanitized = applyWritePathAlwaysOnTsxSanitizers({
      tsx: currentTsx,
      clientTsx: currentClient,
      ...sanitizerOpts,
    });
    currentTsx = sanitized.tsx;
    currentClient = sanitized.clientTsx;
    if (sanitized.definitionTs) {
      currentDefinition = sanitized.definitionTs;
    }
  }
  let retriesUsed = 0;
  /** @type {object} */
  const gateWriteOpts = {
    ...writeOpts,
    ...(currentDefinition != null ? { definitionTs: currentDefinition } : {}),
  };

  /**
   * Sync definition.placeholders from current TSX before CONTRACT/collect.
   * write-component also syncs later; gate must see keys while AppPlaceholder is present.
   */
  function syncDefinitionIntoGate() {
    if (currentDefinition == null || !String(currentDefinition).trim()) return;
    const metaChildren = Array.isArray(writeOpts.captureMeta?.children)
      ? writeOpts.captureMeta.children
      : [];
    const childPackages = [
      ...(Array.isArray(writeOpts.childPackages) ? writeOpts.childPackages : []),
      ...metaChildren,
    ];
    const synced = syncDefinitionFromTsx(currentDefinition, {
      tsxSource: currentTsx,
      clientTsxSource: currentClient,
      plan: writeOpts.plan,
      role: writeOpts.role,
      childPackages,
      trustTsxStructure: true,
      definitionKey: writeOpts.definitionKey,
      allowPlanFill: false,
    });
    currentDefinition = synced.definitionTs;
    gateWriteOpts.definitionTs = currentDefinition;
  }

  // maxRetries === 0 → skip gate (legacy write + format only).
  if (maxRetries <= 0) {
    syncDefinitionIntoGate();
    return formatWriteFn(
      {
        ...gateWriteOpts,
        kebab,
        tsx: currentTsx,
        ...(currentClient != null ? { clientTsx: currentClient } : {}),
      },
      { ledger: opts.ledger || null },
    );
  }

  for (;;) {
    // Always-on write-path sanitizers before CONTRACT/tsc (and before AI).
    {
      sanitizerOpts.definitionTs = currentDefinition || null;
      const sanitized = applyWritePathAlwaysOnTsxSanitizers({
        tsx: currentTsx,
        clientTsx: currentClient,
        ...sanitizerOpts,
      });
      currentTsx = sanitized.tsx;
      currentClient = sanitized.clientTsx;
      if (sanitized.definitionTs) {
        currentDefinition = sanitized.definitionTs;
      }
    }
    syncDefinitionIntoGate();

    /** @type {string[]} */
    let diagnostics = [];
    try {
      diagnostics = await collectFn(gateWriteOpts, {
        tsx: currentTsx,
        clientTsx: currentClient,
        kebab,
      });
    } catch (err) {
      diagnostics = [
        `TSC: ${err instanceof Error ? err.message : String(err)}`,
      ];
    }

    if (!diagnostics.length) {
      try {
        return await formatWriteFn(
          {
            ...gateWriteOpts,
            kebab,
            tsx: currentTsx,
            ...(currentClient != null ? { clientTsx: currentClient } : {}),
          },
          { ledger: opts.ledger || null },
        );
      } catch (err) {
        // Missing-client refuse from write-component — treat as build repair.
        if (!isTsxBuildFailure(err) || retriesUsed >= maxRetries) {
          throw err;
        }
        diagnostics = [err instanceof Error ? err.message : String(err)];
      }
    }

    if (!diagnostics.length) {
      // Unreachable when formatWrite returns; keeps TS happy for the loop.
      return formatWriteFn(
        {
          ...gateWriteOpts,
          kebab,
          tsx: currentTsx,
          ...(currentClient != null ? { clientTsx: currentClient } : {}),
        },
        { ledger: opts.ledger || null },
      );
    }

    if (retriesUsed >= maxRetries) {
      throw new Error(
        `TSX build validate failed for ${name} after ${maxRetries} repair attempt(s):\n${diagnostics.join('\n')}`,
      );
    }

    // list-none + md→lg + JSX/Field-type import CONTRACTs: mechanical only — never AI.
    if (diagnosticsAreMechanicalOnly(diagnostics)) {
      currentTsx = normalizeDesktopLayoutToLg(currentTsx);
      currentTsx = ensureListNoneOnLists(currentTsx);
      if (currentClient) {
        currentClient = normalizeDesktopLayoutToLg(currentClient);
        currentClient = ensureListNoneOnLists(currentClient);
      }
      let afterMechanical = [];
      try {
        afterMechanical = await collectFn(gateWriteOpts, {
          tsx: currentTsx,
          clientTsx: currentClient,
          kebab,
        });
      } catch (err) {
        afterMechanical = [
          `TSC: ${err instanceof Error ? err.message : String(err)}`,
        ];
      }
      if (!afterMechanical.length) {
        return await formatWriteFn(
          {
            ...gateWriteOpts,
            kebab,
            tsx: currentTsx,
            ...(currentClient != null ? { clientTsx: currentClient } : {}),
          },
          { ledger: opts.ledger || null },
        );
      }
      throw new Error(
        `TSX build validate failed for ${name} (mechanical fix only; no AI repair):\n${afterMechanical.join('\n')}`,
      );
    }

    retriesUsed += 1;
    const detail = formatValidateAttemptLog(diagnostics);
    console.warn(
      `  ⚠ TSX build repair ${retriesUsed}/${maxRetries} for ${name}: ${diagnostics.length} diagnostic(s)` +
        (detail ? `\n${detail}` : ''),
    );

    const priorTsx = currentTsx;
    const priorClient = currentClient;
    const priorDefinition = currentDefinition;
    const priorDiagCount = diagnostics.length;

    const repaired = await repairFn({
      previousTsx: currentTsx,
      previousClientTsx: currentClient,
      previousDefinitionTs: currentDefinition,
      diagnostics: [resolveValidateFixHeader(diagnostics), ...diagnostics],
      componentName: name,
      requireClient:
        mapEntryImportsCompanionClient(currentTsx) ||
        Boolean(currentClient && String(currentClient).trim()),
      ledger: opts.ledger || null,
    });

    if (!repaired.ok || !repaired.tsx) {
      // Truncated / empty / oversized: keep prior sources and retry while budget remains.
      if (retriesUsed >= maxRetries) {
        throw new Error(
          `[codegen] ${name} TSX BUILD FIX LLM re-emit failed: ${repaired.skipReason || 'unknown'}`,
        );
      }
      console.warn(
        `  ⚠ TSX build repair ${retriesUsed}/${maxRetries} for ${name}: skipped (${repaired.skipReason || 'unknown'}) — retrying with prior sources`,
      );
      continue;
    }

    let candidateDefinition = priorDefinition;
    if (
      repaired.definitionTs != null &&
      String(repaired.definitionTs).trim()
    ) {
      candidateDefinition = String(repaired.definitionTs);
    }

    sanitizerOpts.definitionTs = candidateDefinition || null;
    const sanitized = applyWritePathAlwaysOnTsxSanitizers({
      tsx: repaired.tsx,
      clientTsx:
        repaired.clientTsx != null && String(repaired.clientTsx).trim()
          ? repaired.clientTsx
          : priorClient,
      ...sanitizerOpts,
    });
    let candidateTsx = sanitized.tsx;
    let candidateClient = priorClient;
    if (sanitized.definitionTs) {
      candidateDefinition = sanitized.definitionTs;
    }
    if (repaired.clientTsx != null && String(repaired.clientTsx).trim()) {
      candidateClient = sanitized.clientTsx;
    } else if (
      mapEntryImportsCompanionClient(candidateTsx) &&
      !(priorClient && String(priorClient).trim())
    ) {
      candidateClient = null;
    } else if (sanitized.clientTsx != null) {
      candidateClient = sanitized.clientTsx;
    }

    // Discard-if-worse: re-collect; revert if diagnostics did not improve.
    gateWriteOpts.definitionTs = candidateDefinition;
    /** @type {string[]} */
    let afterDiag = [];
    try {
      afterDiag = await collectFn(gateWriteOpts, {
        tsx: candidateTsx,
        clientTsx: candidateClient,
        kebab,
      });
    } catch (err) {
      afterDiag = [
        `TSC: ${err instanceof Error ? err.message : String(err)}`,
      ];
    }

    if (!diagnosticsImproved(diagnostics, afterDiag)) {
      currentTsx = priorTsx;
      currentClient = priorClient;
      currentDefinition = priorDefinition;
      gateWriteOpts.definitionTs = priorDefinition;
      console.warn(
        `  ⚠ TSX build repair ${retriesUsed}/${maxRetries} for ${name}: discarded (diagnostics not improved: ${priorDiagCount} → ${afterDiag.length})`,
      );
      continue;
    }

    currentTsx = candidateTsx;
    currentClient = candidateClient;
    currentDefinition = candidateDefinition;
    gateWriteOpts.definitionTs = currentDefinition;

    // Clean after surgical repair — write without another loop iteration.
    if (!afterDiag.length) {
      return await formatWriteFn(
        {
          ...gateWriteOpts,
          kebab,
          tsx: currentTsx,
          ...(currentClient != null ? { clientTsx: currentClient } : {}),
        },
        { ledger: opts.ledger || null },
      );
    }
  }
}
