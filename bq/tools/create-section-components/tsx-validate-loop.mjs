/**
 * AI validate loop: codegen → detect contracts + tsc → revisionBrief (max iters) → Prettier.
 * When BQ_TSX_VALIDATE_MAX_ITERS=0, callers use the legacy write path instead.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  hoistClientAppPlaceholderToServerChildren,
  rewriteCompanionClientImport,
} from './ai-source-fixup.mjs';
import { ensureNewline, normalizeAiSource } from './source-text.mjs';
import { collectTsxContractDiagnostics } from './tsx-contract-diagnostics.mjs';
import { inferPlaceholderLayoutMode } from './layout-hints.mjs';
import { typecheckGeneratedFiles } from './tsx-typecheck.mjs';
import { resolveTsxValidateMaxIters } from './tsx-validate-iters.mjs';
import {
  DEFINITION_PARSE_FIX_HEADER,
  DEFINITION_SEED_SHAPE_FIX_HEADER,
  DEFINITION_REPEAT_HINT_FIX_HEADER,
  isDefinitionValidateFailure,
  resolveDefinitionValidateMaxIters,
} from './definition-validate-iters.mjs';
import { componentDir, writeComponentPackage } from './write-component.mjs';
/** Exported for unit tests — revision brief lead-in on validate retries. */
export const VALIDATE_FIX_HEADER =
  'VALIDATE FIX (hard): Repair definitionTs AND tsx/clientTsx together so CONTRACT checks and tsc are clean. Do not leave issues for post-processors. Image/logo CONTRACTs require: (1) Image-type field(s) in the model, (2) content seeds with { url, alt } for each missing URL, (3) <Image field={fields.…}> in tsx — never Text-only or hardcoded src. Field names on Fields, model, and seeds must stay in sync.';

/**
 * When platform list Title-only / paint-owner hygiene conflicts with Image/logo
 * CONTRACTs, do not tell the model to add Logo/Image on the list parent.
 */
export const VALIDATE_FIX_HEADER_LIST_PAINT_OWNER =
  'VALIDATE FIX (hard): Repair definitionTs AND tsx/clientTsx together so CONTRACT checks and tsc are clean. Platform Link/Icon/Image Link Lists parents stay Title-only — do NOT add Logo/Heading/Description/Image/CTA on that parent. Put corporate Logo on SiteFooter (or branding chrome); social glyphs on the footer-social Image/Icon Link List children only. Fix by removing illegal parent chrome fields and seeding images on the correct paint owner — never oscillate between adding Logo and Title-only.';

/**
 * Pick validate-fix lead-in from current diagnostics.
 * @param {string[]} diagnostics
 * @returns {string}
 */
export function resolveValidateFixHeader(diagnostics = []) {
  const blob = (diagnostics || []).map((d) => String(d || '')).join('\n');
  const listHygiene =
    /platform list folder|Title-only|forbid extra parent fields|put chrome \(Logo/i.test(
      blob,
    );
  const logoImageContract =
    /Mount these HTML (?:logo\/wordmark )?images as Sitecore <Image>/i.test(
      blob,
    );
  // Catch-22: list Title-only hygiene and/or logo demand on a list/nav leaf.
  if (listHygiene) return VALIDATE_FIX_HEADER_LIST_PAINT_OWNER;
  if (
    logoImageContract &&
    /FooterNavigation|footer-navigation|Link Lists|NavigationGroup/i.test(blob)
  ) {
    return VALIDATE_FIX_HEADER_LIST_PAINT_OWNER;
  }
  return VALIDATE_FIX_HEADER;
}

/** Appended when tsc reports Property 'page' does not exist on props. */
export const PAGE_PROPS_TSC_FIX =
  "Fix: import type { ComponentWithContextProps } from 'lib/component-props' and type props as ComponentWithContextProps & { fields: Fields }.";

/** Appended when tsc reports no exported member CheckboxField. */
export const CHECKBOX_FIELD_TSC_FIX =
  "Fix: use Field<boolean> and import type { Field } from '@sitecore-content-sdk/nextjs' — never CheckboxField.";

/** Appended when tsc reports LinkField|undefined / ImageField|undefined on field=. */
export const OPTIONAL_LINK_IMAGE_FIELD_TSC_FIX =
  'Fix: getFieldValue Link/Image locals must be definite before <Link>/<Image> — use `?? emptyLinkField` / `?? emptyImageField`, or `if (!x) return null`, or `x && (x.value?.href || isEditing) && <Link field={x}>`. Never `(x?.value?.href || isEditing) && <Link field={x}>` when x is `LinkField | undefined` (isEditing does not narrow).';

/** Appended when tsc reports wrong useStickyChromeInset / Layer call shape. */
export const STICKY_CHROME_API_TSC_FIX =
  "Fix: useStickyChromeInset(edge: 'top'|'bottom', fallbackInsetPx?: number) — second arg is a number; useStickyChromeLayer({ edge, hidden?, fallbackInsetPx? }). Never {fallbackPx} or options object as inset's 2nd arg.";

/** Appended when CONTRACT flags AppPlaceholder/componentMap inside clientTsx. */
export const CLIENT_APPPLACEHOLDER_RSC_FIX =
  'Fix: remove AppPlaceholder and .sitecore/component-map from clientTsx; mount <AppPlaceholder> on server map-entry and pass as children into chrome — never import server component-map in a Client Component (React Server Components (RSC) {Default: function Default}).';

/** Appended when CONTRACT flags hardcoded capture/CDN image URLs in tsx. */
export const HARDCODED_CAPTURE_IMAGE_URL_FIX =
  "Fix: move each absolute image URL into a Sitecore Image field + { url, alt } seed; render with <Image field={…} /> or url(${fields['…']?.value?.src}) — never hardcode capture/CDN image URLs in runtime tsx/clientTsx (apply uploads seeds to the media library).";

const MAX_DIAGNOSTICS_IN_BRIEF = 40;
/** How many diagnostics to print under the attempt warn (full list still goes to revisionBrief). */
const MAX_DIAGNOSTICS_IN_ATTEMPT_LOG = 5;
const MAX_DIAGNOSTIC_LOG_CHARS = 220;

/**
 * Annotate known TSC/CONTRACT patterns with explicit Fix lines for AI retries.
 * @param {string[]} diagnostics
 * @returns {string[]}
 */
export function annotateValidateDiagnostics(diagnostics) {
  return (diagnostics || []).map((d) => {
    let s = String(d || '').trim();
    if (!s) return s;
    if (
      /Property ['"]page['"] does not exist/i.test(s) &&
      !s.includes(PAGE_PROPS_TSC_FIX) &&
      !/ComponentWithContextProps/.test(s)
    ) {
      s = `${s} — ${PAGE_PROPS_TSC_FIX}`;
    }
    if (
      (/no exported member ['"]CheckboxField['"]/i.test(s) ||
        /\bCheckboxField\b/.test(s)) &&
      /TSC:|TS2305/.test(s) &&
      !s.includes(CHECKBOX_FIELD_TSC_FIX) &&
      !/Field<boolean>/.test(s)
    ) {
      s = `${s} — ${CHECKBOX_FIELD_TSC_FIX}`;
    }
    if (
      /TS2322/.test(s) &&
      /(?:LinkField|ImageField)\s*\|\s*undefined/i.test(s) &&
      !s.includes(OPTIONAL_LINK_IMAGE_FIELD_TSC_FIX)
    ) {
      s = `${s} — ${OPTIONAL_LINK_IMAGE_FIELD_TSC_FIX}`;
    }
    if (
      /useStickyChrome|StickyChromeEdge|fallbackPx|fallbackInsetPx/i.test(s) &&
      /TS2345|not assignable to parameter/i.test(s) &&
      !s.includes(STICKY_CHROME_API_TSC_FIX)
    ) {
      s = `${s} — ${STICKY_CHROME_API_TSC_FIX}`;
    }
    if (
      /clientTsx must not use AppPlaceholder or componentMap/i.test(s) &&
      !s.includes(CLIENT_APPPLACEHOLDER_RSC_FIX)
    ) {
      s = `${s} — ${CLIENT_APPPLACEHOLDER_RSC_FIX}`;
    }
    if (
      /hardcoded capture\/CDN image URL/i.test(s) &&
      !s.includes(HARDCODED_CAPTURE_IMAGE_URL_FIX)
    ) {
      s = `${s} — ${HARDCODED_CAPTURE_IMAGE_URL_FIX}`;
    }
    return s;
  });
}

/** @deprecated Use {@link annotateValidateDiagnostics} */
export function annotatePagePropsTscDiagnostics(diagnostics) {
  return annotateValidateDiagnostics(diagnostics);
}

/**
 * @param {string[]} diagnostics
 * @returns {string[]}
 */
function capDiagnostics(diagnostics) {
  const list = annotateValidateDiagnostics(
    (diagnostics || []).map((d) => String(d || '').trim()).filter(Boolean),
  );
  if (list.length <= MAX_DIAGNOSTICS_IN_BRIEF) return list;
  return [
    ...list.slice(0, MAX_DIAGNOSTICS_IN_BRIEF),
    `…and ${list.length - MAX_DIAGNOSTICS_IN_BRIEF} more diagnostic(s)`,
  ];
}

/**
 * Compact multi-line summary for the attempt warn — why AI is retrying.
 * @param {string[]} diagnostics
 * @param {{ maxItems?: number, maxChars?: number }} [opts]
 * @returns {string}
 */
export function formatValidateAttemptLog(diagnostics, opts = {}) {
  const maxItems =
    opts.maxItems != null && Number.isFinite(Number(opts.maxItems))
      ? Math.max(1, Math.trunc(Number(opts.maxItems)))
      : MAX_DIAGNOSTICS_IN_ATTEMPT_LOG;
  const maxChars =
    opts.maxChars != null && Number.isFinite(Number(opts.maxChars))
      ? Math.max(40, Math.trunc(Number(opts.maxChars)))
      : MAX_DIAGNOSTIC_LOG_CHARS;
  const list = annotateValidateDiagnostics(
    (diagnostics || [])
      .map((d) => String(d || '').trim().replace(/\s+/g, ' '))
      .filter(Boolean),
  );
  if (!list.length) return '';
  const shown = list.slice(0, maxItems).map((d) => {
    const one = d.length > maxChars ? `${d.slice(0, maxChars - 1)}…` : d;
    return `      • ${one}`;
  });
  if (list.length > maxItems) {
    shown.push(`      • …and ${list.length - maxItems} more`);
  }
  return [
    `    AI rewrite will fix:`,
    ...shown,
  ].join('\n');
}

/**
 * Stage un-prettied sources so tsc can resolve the package.
 * @param {{
 *   hostSlug: string,
 *   componentName: string,
 *   kebab: string,
 *   tsx: string,
 *   clientTsx?: string|null,
 * }} opts
 * @returns {Promise<{ tsxPath: string, clientTsxPath: string|null, dir: string }>}
 */
export async function stageGeneratedSources(opts) {
  const dir = componentDir(opts.hostSlug, opts.componentName);
  await mkdir(dir, { recursive: true });
  const tsxPath = path.join(dir, `${opts.kebab}.tsx`);
  const clientTsxPath = path.join(dir, `${opts.kebab}.client.tsx`);
  let tsx = normalizeAiSource(opts.tsx);
  tsx = rewriteCompanionClientImport(tsx, opts.kebab);
  await writeFile(tsxPath, ensureNewline(tsx), 'utf8');
  let clientPath = null;
  if (opts.clientTsx && String(opts.clientTsx).trim()) {
    let client = normalizeAiSource(opts.clientTsx);
    await writeFile(clientTsxPath, ensureNewline(client), 'utf8');
    clientPath = clientTsxPath;
  }
  return { tsxPath, clientTsxPath: clientPath, dir };
}

/**
 * Collect CONTRACT + TSC diagnostics for staged sources.
 * @param {{
 *   tsx: string,
 *   clientTsx?: string|null,
 *   tsxPath: string,
 *   clientTsxPath?: string|null,
 *   layoutMode?: string|null,
 *   role?: string|null,
 *   sectionInfo?: object|null,
 *   sectionHtml?: string|null,
 *   imageInventory?: object|null,
 *   parentComponentName?: string|null,
 *   parentDefinitionTs?: string|null,
 *   plan?: object|null,
 *   planMode?: string|null,
 *   definitionTs?: string|null,
 *   componentName?: string|null,
 *   definitionKey?: string|null,
 * }} opts
 * @returns {string[]}
 */
export function collectValidateDiagnostics(opts) {
  const layoutMode =
    opts.layoutMode ||
    inferPlaceholderLayoutMode(opts.sectionInfo, opts.sectionHtml) ||
    undefined;
  const contract = collectTsxContractDiagnostics({
    tsx: opts.tsx,
    clientTsx: opts.clientTsx,
    layoutMode,
    role: opts.role,
    sectionInfo: opts.sectionInfo,
    sectionHtml: opts.sectionHtml,
    imageInventory: opts.imageInventory,
    parentComponentName: opts.parentComponentName,
    parentDefinitionTs: opts.parentDefinitionTs || null,
    plan: opts.plan,
    planMode: opts.planMode || opts.plan?.mode,
    definitionTs: opts.definitionTs,
    componentName: opts.componentName,
    definitionKey: opts.definitionKey,
    codePrefix: opts.codePrefix,
    childPackages: opts.childPackages,
    siblingPackages: opts.siblingPackages || opts.pathLeafSiblingDefs,
    pathLeafSiblingDefs: opts.pathLeafSiblingDefs,
    placeholder: opts.placeholder || opts.childPlaceholder || null,
    childPlaceholder: opts.childPlaceholder || opts.placeholder || null,
    layoutSketch: opts.layoutSketch || null,
  });
  const paths = [opts.tsxPath, opts.clientTsxPath].filter(Boolean);
  const tsc = typecheckGeneratedFiles(/** @type {string[]} */ (paths));
  return [...contract, ...tsc];
}

/**
 * Codegen + finalizeDefinitionTs with dedicated definition-parse retries
 * (`BQ_DEFINITION_VALIDATE_MAX_ITERS` = retry count after parse fail).
 *
 * @param {{
 *   codegenArgs: object,
 *   finalizeDefinitionTs: (definitionTs: string, generated: object) => Promise<string>,
 *   revisionBrief?: object|null,
 *   definitionMaxRetries?: number|null,
 *   componentName?: string,
 *   codegenFn: (args: object) => Promise<object>,
 * }} opts
 * @returns {Promise<{ generated: object, definitionTs: string, definitionAttempts: number }>}
 */
export async function codegenWithDefinitionParseRetries(opts) {
  const maxRetries =
    opts.definitionMaxRetries != null &&
    Number.isFinite(Number(opts.definitionMaxRetries))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.definitionMaxRetries))))
      : resolveDefinitionValidateMaxIters();
  const name = opts.componentName || opts.codegenArgs?.componentName || 'component';
  if (typeof opts.codegenFn !== 'function') {
    throw new Error(
      'codegenWithDefinitionParseRetries requires opts.codegenFn (v1/v2 codegenComponent was removed; pass a section codegen function)',
    );
  }
  const runCodegen = opts.codegenFn;

  /** @type {object|null} */
  let generated = null;
  /** @type {string} */
  let previousDefinitionTs = '';
  let retriesUsed = 0;
  /** @type {object|null|undefined} */
  let revisionBrief = opts.revisionBrief;

  for (;;) {
    generated = await runCodegen({
      ...opts.codegenArgs,
      revisionBrief: revisionBrief || undefined,
    });
    try {
      const definitionTs = await opts.finalizeDefinitionTs(
        generated.definitionTs,
        generated,
      );
      return {
        generated,
        definitionTs,
        definitionAttempts: 1 + retriesUsed,
      };
    } catch (err) {
      if (!isDefinitionValidateFailure(err) || retriesUsed >= maxRetries) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      previousDefinitionTs = String(generated?.definitionTs || '');
      retriesUsed += 1;
      console.warn(
        `  ⚠ Definition parse retry ${retriesUsed}/${maxRetries} for ${name}: ${msg.split('\n')[0]}`,
      );
      const seedShapeFail =
        /DEFINITION SEED SHAPE|GraphQL-shaped content seed/i.test(msg);
      const repeatHintFail = /DEFINITION REPEAT HINT|repeatHint/i.test(msg);
      const integrityFail = /DEFINITION SEED INTEGRITY/i.test(msg);
      revisionBrief = {
        iteration: retriesUsed + 1,
        changes: [
          repeatHintFail
            ? DEFINITION_REPEAT_HINT_FIX_HEADER
            : seedShapeFail
              ? DEFINITION_SEED_SHAPE_FIX_HEADER
              : DEFINITION_PARSE_FIX_HEADER,
          ...(integrityFail
            ? [
                'INTEGRITY: remove C0/non-printable controls from seeds (do not \\u-escape); re-emit Rich Text with JSON.stringify.',
              ]
            : []),
          msg.slice(0, 2000),
          ...(Array.isArray(opts.revisionBrief?.changes)
            ? opts.revisionBrief.changes
            : []),
        ],
        previousTsx: opts.revisionBrief?.previousTsx,
        previousClientTsx: opts.revisionBrief?.previousClientTsx,
        previousDefinitionTs:
          previousDefinitionTs || opts.revisionBrief?.previousDefinitionTs,
      };
    }
  }
}

/**
 * Codegen + validate loop, then writeComponentPackage (validate-clean or legacy).
 *
 * @param {{
 *   codegenArgs: object,
 *   writeArgs: object,
 *   finalizeDefinitionTs: (definitionTs: string, generated: object) => Promise<string>,
 *   codegenFn: (args: object) => Promise<object>,
 *   maxIters?: number|null,
 *   definitionMaxRetries?: number|null,
 *   dryRun?: boolean,
 * }} opts
 * @returns {Promise<{ generated: object, paths: object, attempts: number, skippedValidate: boolean }>}
 */
export async function codegenAndValidateWrite(opts) {
  const maxIters =
    opts.maxIters != null && Number.isFinite(Number(opts.maxIters))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.maxIters))))
      : resolveTsxValidateMaxIters();
  const dryRun = Boolean(opts.dryRun);
  const definitionMaxRetries =
    opts.definitionMaxRetries != null &&
    Number.isFinite(Number(opts.definitionMaxRetries))
      ? Math.max(0, Math.min(3, Math.trunc(Number(opts.definitionMaxRetries))))
      : resolveDefinitionValidateMaxIters();

  if (maxIters <= 0) {
    const { generated, definitionTs } = await codegenWithDefinitionParseRetries({
      codegenArgs: opts.codegenArgs,
      finalizeDefinitionTs: opts.finalizeDefinitionTs,
      definitionMaxRetries,
      componentName: opts.writeArgs.componentName,
      codegenFn: opts.codegenFn,
    });
    let tsx = String(opts.writeArgs.tsx ?? generated.tsx);
    if (typeof opts.writeArgs.mapTsx === 'function') {
      tsx = opts.writeArgs.mapTsx(tsx, generated);
    }
    const { mapTsx: _mapTsx, tsxOverride: _ov, ...writeRest } = opts.writeArgs;
    const paths = await writeComponentPackage({
      ...writeRest,
      tsx,
      clientTsx:
        opts.writeArgs.clientTsx !== undefined
          ? opts.writeArgs.clientTsx
          : generated.clientTsx || null,
      definitionTs,
      kebab: generated.kebab,
      imageInventory:
        opts.writeArgs.imageInventory ?? generated.imageInventory,
      dryRun,
      validateClean: false,
    });
    return {
      generated: { ...generated, tsx, definitionTs },
      paths,
      attempts: 1,
      skippedValidate: true,
    };
  }

  /** @type {object|null} */
  let generated = null;
  /** @type {string[]} */
  let lastDiagnostics = [];
  let previousTsx = '';
  let previousClientTsx = '';
  let previousDefinitionTs = '';

  for (let attempt = 1; attempt <= maxIters; attempt++) {
    const revisionBrief =
      attempt === 1
        ? null
        : {
            iteration: attempt,
            changes: [
              resolveValidateFixHeader(lastDiagnostics),
              ...capDiagnostics(lastDiagnostics),
            ],
            previousTsx,
            previousClientTsx: previousClientTsx || undefined,
            previousDefinitionTs: previousDefinitionTs || undefined,
          };

    const defResult = await codegenWithDefinitionParseRetries({
      codegenArgs: opts.codegenArgs,
      finalizeDefinitionTs: opts.finalizeDefinitionTs,
      revisionBrief,
      definitionMaxRetries,
      componentName: opts.writeArgs.componentName,
      codegenFn: opts.codegenFn,
    });
    generated = defResult.generated;
    const definitionTs = defResult.definitionTs;

    let tsx = String(
      opts.writeArgs.tsxOverride != null
        ? opts.writeArgs.tsxOverride
        : generated.tsx,
    );
    // After definition finalize (family owner fields available for align).
    if (typeof opts.writeArgs.mapTsx === 'function') {
      tsx = opts.writeArgs.mapTsx(tsx, generated);
    }
    let clientTsx = generated.clientTsx || null;
    // Always-on RSC fixup before CONTRACT — hoist client AppPlaceholder → server children.
    {
      const hoisted = hoistClientAppPlaceholderToServerChildren({
        tsx,
        clientTsx,
      });
      tsx = hoisted.tsx;
      clientTsx = hoisted.clientTsx;
    }
    previousTsx = tsx;
    previousClientTsx = clientTsx ? String(clientTsx) : '';
    previousDefinitionTs = String(definitionTs || '');

    if (dryRun) {
      const childPh =
        opts.writeArgs.captureMeta?.placeholder ||
        opts.writeArgs.placeholder ||
        opts.codegenArgs?.nodePlaceholderKey ||
        opts.codegenArgs?.parent?.placeholderKey ||
        null;
      const contractOnly = collectTsxContractDiagnostics({
        tsx,
        clientTsx,
        layoutMode: opts.writeArgs.layoutMode,
        role: opts.writeArgs.role,
        sectionInfo: opts.writeArgs.sectionInfo,
        sectionHtml: opts.writeArgs.sectionHtml,
        imageInventory:
          opts.writeArgs.imageInventory ?? generated.imageInventory,
        parentComponentName: opts.writeArgs.captureMeta?.parentComponentName,
        parentDefinitionTs: opts.writeArgs.parentDefinitionTs || null,
        plan: opts.writeArgs.plan,
        planMode: opts.writeArgs.planMode || opts.writeArgs.plan?.mode,
        definitionTs,
        componentName: opts.writeArgs.componentName,
        definitionKey: opts.writeArgs.definitionKey,
        codePrefix: opts.writeArgs.codePrefix,
        childPackages: opts.writeArgs.childPackages,
        siblingPackages: opts.writeArgs.siblingPackages,
        pathLeafSiblingDefs: opts.writeArgs.pathLeafSiblingDefs,
        placeholder: childPh,
        childPlaceholder: childPh,
      });
      if (!contractOnly.length) {
        return {
          generated: { ...generated, tsx, definitionTs },
          paths: {
            tsx: '(dry-run)',
            clientTsx: clientTsx ? '(dry-run)' : null,
            definition: '(dry-run)',
            captureMeta: '(dry-run)',
          },
          attempts: attempt,
          skippedValidate: false,
        };
      }
      lastDiagnostics = contractOnly;
      if (attempt >= maxIters) break;
      continue;
    }

    const staged = await stageGeneratedSources({
      hostSlug: opts.writeArgs.hostSlug,
      componentName: opts.writeArgs.componentName,
      kebab: generated.kebab,
      tsx,
      clientTsx,
    });

    const childPh =
      opts.writeArgs.captureMeta?.placeholder ||
      opts.writeArgs.placeholder ||
      opts.codegenArgs?.nodePlaceholderKey ||
      opts.codegenArgs?.parent?.placeholderKey ||
      null;
    lastDiagnostics = collectValidateDiagnostics({
      tsx,
      clientTsx,
      tsxPath: staged.tsxPath,
      clientTsxPath: staged.clientTsxPath,
      layoutMode: opts.writeArgs.layoutMode,
      sectionHtml: opts.writeArgs.sectionHtml,
      imageInventory:
        opts.writeArgs.imageInventory ?? generated.imageInventory,
      role: opts.writeArgs.role,
      sectionInfo: opts.writeArgs.sectionInfo,
      parentComponentName: opts.writeArgs.captureMeta?.parentComponentName,
      parentDefinitionTs: opts.writeArgs.parentDefinitionTs || null,
      plan: opts.writeArgs.plan,
      planMode: opts.writeArgs.planMode || opts.writeArgs.plan?.mode,
      definitionTs,
      componentName: opts.writeArgs.componentName,
      definitionKey: opts.writeArgs.definitionKey,
      codePrefix: opts.writeArgs.codePrefix,
      childPackages: opts.writeArgs.childPackages,
      siblingPackages: opts.writeArgs.siblingPackages,
      pathLeafSiblingDefs: opts.writeArgs.pathLeafSiblingDefs,
      placeholder: childPh,
      childPlaceholder: childPh,
    });

    if (!lastDiagnostics.length) {
      // Prettier after clean — validate-clean write (no mechanical TSX rewrite).
      try {
        const { mapTsx: _mapTsx, tsxOverride: _ov, ...writeRest } =
          opts.writeArgs;
        const paths = await writeComponentPackage({
          ...writeRest,
          tsx,
          clientTsx,
          definitionTs,
          kebab: generated.kebab,
          imageInventory:
            opts.writeArgs.imageInventory ?? generated.imageInventory,
          dryRun: false,
          validateClean: true,
        });
        return {
          generated: { ...generated, tsx, definitionTs },
          paths,
          attempts: attempt,
          skippedValidate: false,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastDiagnostics = [`PRETTIER: ${msg}`];
        if (attempt >= maxIters) break;
        continue;
      }
    }

    // Always show why (not only --verbose) so retries are diagnosable in default logs.
    const detail = formatValidateAttemptLog(lastDiagnostics);
    console.warn(
      `  ⚠ TSX validate attempt ${attempt}/${maxIters} for ${opts.writeArgs.componentName}: ${lastDiagnostics.length} diagnostic(s) — retrying codegen` +
        (detail ? `\n${detail}` : ''),
    );
  }

  const name = opts.writeArgs.componentName || 'component';
  throw new Error(
    `TSX validate failed for ${name} after ${maxIters} attempts:\n${lastDiagnostics.join('\n')}`,
  );
}
