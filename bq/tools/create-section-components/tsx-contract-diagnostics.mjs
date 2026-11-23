/**
 * Detect-only codegen contract suite for the AI validate loop (no TSX rewrite).
 */
import {
  collectTsxEmitContractDiagnostics,
  detectDuplicateUseClient,
  detectOrphanChromeJsx,
  detectUnknownChromeProps,
} from './ai-source-fixup.mjs';
import { assertLogoRailChildHasImage } from './html-image-coverage.mjs';
import {
  collectBandScopedHeadingOwnershipDiagnostics,
  collectLinkSeedContractDiagnostics,
  collectTitleSeedContractDiagnostics,
  collectEnglishItemNameAndCultureDiagnostics,
} from './content-seed-contract.mjs';
import { collectComposedTreeDiagnostics } from './composed-tree-diagnostics.mjs';
import { collectHtmlMultiBandEmitDiagnostics } from './html-multi-band-contract.mjs';
import {
  collectPathLeafCollisionDiagnostics,
  collectPlaceholderContractDiagnostics,
} from './placeholder-contract.mjs';
import { listInteractiveStates } from './ai-codegen.mjs';
import { toDefinitionKey } from './naming.mjs';
import {
  layoutMotionIsBandTicker,
  layoutMotionIsContinuousMarquee,
  layoutMotionSurface,
  layoutWantsEqualHeightChildren,
} from './motion-hints.mjs';
import { isLinkListAsCompositeEnabled } from '../shared/bq-env.mjs';
import {
  hasDuplicateChildrenMount,
  hasMediaTabTitleOnItemRoot,
  hasResolvableMediaTabLogo,
  mediaTabsItemInAttrsRe,
} from './media-tabs-attrs.mjs';
import {
  collectJsonBagDirectMapContractDiagnostics,
  collectEmptyIconCircleContractDiagnostics,
} from './json-bag-field-map.mjs';

/**
 * Combined source for interaction wiring checks (server + companion).
 * @param {string} tsx
 * @param {string} clientTsx
 */
function interactionSourceBlob(tsx, clientTsx) {
  return `${String(tsx || '')}\n${String(clientTsx || '')}`;
}

/**
 * True when source looks like a client interactive module.
 * @param {string} blob
 */
export function hasClientInteractivitySignals(blob) {
  const s = String(blob || '');
  if (!s.trim()) return false;
  if (/['"]use client['"]/.test(s)) return true;
  if (/\buseState\b|\buseReducer\b|\bonClick\s*=/.test(s)) return true;
  return false;
}

/**
 * Menu: toggle control + revealable panel heuristics.
 * @param {string} blob
 */
export function hasMenuToggleAndPanelSignals(blob) {
  const s = String(blob || '');
  const hasToggle =
    /\bonClick\s*=/.test(s) ||
    /\baria-expanded\b/.test(s) ||
    /\bdata-[\w-]*toggle\b/.test(s) ||
    /\bdata-mobile-menu-toggle\b/.test(s);
  const hasPanel =
    /\bdata-mobile-menu\b/.test(s) ||
    /\bmenuOpen\b|\bisOpen\b|\bopen\s*\?/.test(s) ||
    /\{\s*\w*(open|Open|expanded|Expanded|menu)\w*\s*\?/.test(s) ||
    /\bhidden\b[\s\S]{0,80}\bblock\b|\bblock\b[\s\S]{0,80}\bhidden\b/.test(s);
  return hasToggle && hasPanel;
}

/**
 * Tab / accordion: selected or expanded state wiring.
 * @param {string} blob
 * @param {'tab'|'accordion'} kind
 */
export function hasTabOrAccordionSignals(blob, kind) {
  const s = String(blob || '');
  if (kind === 'accordion') {
    if (/<details\b/.test(s) && (/<summary\b/.test(s) || /\bonClick\s*=/.test(s))) {
      return true;
    }
  }
  const hasState =
    /\buseState\b/.test(s) ||
    /\baria-expanded\b/.test(s) ||
    /\baria-selected\b/.test(s) ||
    /\bonClick\s*=/.test(s);
  const hasReveal =
    /\bactive(Index|Tab|Id)?\b/i.test(s) ||
    /\bexpanded\b/i.test(s) ||
    /\bselected\b/i.test(s) ||
    /\{\s*\w+\s*\?/.test(s) ||
    /\bhidden\b[\s\S]{0,80}\bblock\b/.test(s);
  return hasState && hasReveal;
}

/**
 * CONTRACT diagnostics for multi-state interaction (menu/tab/accordion).
 * @param {{
 *   tsx?: string|null,
 *   clientTsx?: string|null,
 *   sectionInfo?: object|null,
 *   role?: string|null,
 * }} opts
 * @returns {string[]}
 */
export function collectInteractionStateContractDiagnostics(opts = {}) {
  const role = String(opts.role || '').toLowerCase();
  // Placeholder children are not the interaction chrome owner.
  if (role === 'child') return [];

  const states = listInteractiveStates(opts.sectionInfo);
  if (!states.length) return [];

  const tsx = String(opts.tsx || '');
  const clientTsx = String(opts.clientTsx || '');
  const blob = interactionSourceBlob(tsx, clientTsx);
  /** @type {string[]} */
  const out = [];

  const hasClientFile = Boolean(clientTsx.trim());
  const hasClientSignals = hasClientInteractivitySignals(blob);
  if (!hasClientFile && !hasClientSignals) {
    out.push(
      'CONTRACT: interactionStates (menu/tab/accordion) require client interactivity — emit non-null clientTsx (or hooks / onClick) so open states work',
    );
  }

  const kinds = new Set(
    states.map((st) => String(st.kind || '').toLowerCase()),
  );
  if (kinds.has('menu') && !hasMenuToggleAndPanelSignals(blob)) {
    out.push(
      'CONTRACT: menu interactionState requires a toggle control (onClick / aria-expanded / data-*-toggle) AND a revealable open panel (conditional UI or data-mobile-menu)',
    );
  }
  if (kinds.has('tab') && !hasTabOrAccordionSignals(blob, 'tab')) {
    out.push(
      'CONTRACT: tab interactionState requires selected-state wiring (useState / aria-selected / onClick) AND revealable tab panels',
    );
  }
  if (
    kinds.has('accordion') &&
    !hasTabOrAccordionSignals(blob, 'accordion')
  ) {
    out.push(
      'CONTRACT: accordion interactionState requires expand wiring (details/summary, useState, or aria-expanded) AND revealable panels',
    );
  }

  return out;
}

/**
 * @param {{
 *   tsx?: string|null,
 *   clientTsx?: string|null,
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
 *   childPackages?: object[]|null,
 * }} opts
 * @returns {string[]} Diagnostics prefixed CONTRACT:
 */
export function collectTsxContractDiagnostics(opts = {}) {
  const tsx = String(opts.tsx || '');
  const clientTsx = opts.clientTsx != null ? String(opts.clientTsx) : '';
  /** @type {string[]} */
  const out = [];
  const equalHeight = layoutWantsEqualHeightChildren(opts.sectionInfo);

  out.push(
    ...collectTsxEmitContractDiagnostics(tsx, {
      layoutMode: opts.layoutMode || undefined,
      clientTsx: clientTsx.trim() ? clientTsx : undefined,
      sectionInfo: opts.sectionInfo || undefined,
      definitionTs: opts.definitionTs || undefined,
      equalHeightChildren: equalHeight,
    }),
  );
  if (clientTsx.trim()) {
    out.push(
      ...collectTsxEmitContractDiagnostics(clientTsx, {
        layoutMode: opts.layoutMode || undefined,
        sectionInfo: opts.sectionInfo || undefined,
        equalHeightChildren: equalHeight,
      }),
    );
  }

  // Hard CONTRACT only for structured motion / explicit marquee patterns on the
  // section/parent chrome — never on placeholder children (logo item, badge, …).
  // Capture motion geometry often false-tags heroes/headers/footers as
  // continuous-marquee / band-ticker from overflow — never require ContinuousMarquee there.
  const role = String(opts.role || '').toLowerCase();
  const patternBlob = String(
    opts.sectionInfo?.layout?.pattern || opts.definitionKey || '',
  ).toLowerCase();
  const cmsBlob = String(opts.sectionInfo?.cmsName || '').toLowerCase();
  const staticLayoutChrome =
    String(opts.sectionInfo?.track || '').toLowerCase() === 'header' ||
    /header|nav|mega-?menu|sticky-header/i.test(
      String(opts.sectionInfo?.chromeKind || ''),
    ) ||
    /sticky-header|mega-?navigation|site-?header|global-?header|media-?hero|two-column|hero|banner|footer|cookie|modal|introduction|article|feature-split|card-grid/i.test(
      patternBlob,
    ) ||
    /header|nav|hero|banner|footer|cookie/i.test(cmsBlob);
  const patternSuggestsMarquee =
    /continuous-marquee|full-width-marquee|(^|-)marquee$|logo-carousel|award-badge-carousel|ticker|logo-rail|partner.?strip/.test(
      patternBlob,
    );
  const wantsMarquee =
    role !== 'child' &&
    !staticLayoutChrome &&
    (patternSuggestsMarquee || layoutMotionIsContinuousMarquee(opts.sectionInfo));
  if (wantsMarquee) {
    const blob = `${tsx}\n${clientTsx}`;
    if (!/ContinuousMarquee|continuous-marquee/.test(blob)) {
      out.push(
        'CONTRACT: layout.motion.kind=continuous-marquee (or *-marquee pattern) requires ContinuousMarquee from components/primitives/continuous-marquee',
      );
    }
  }

  // Band-ticker: ContinuousMarquee must not wrap the full-bleed bg root.
  const bandTicker =
    !staticLayoutChrome &&
    (layoutMotionIsBandTicker(opts.sectionInfo) ||
      layoutMotionSurface(opts.sectionInfo) === 'band-ticker' ||
      (/announcement|notification.?bar/i.test(
        String(opts.definitionKey || opts.sectionInfo?.cmsName || ''),
      ) &&
        wantsMarquee));
  if (bandTicker && role !== 'child') {
    const client = String(clientTsx || '');
    const main = String(tsx || '');
    const blob = `${main}\n${client}`;
    // Client wraps {children} in ContinuousMarquee while server root carries bg-* → wrong.
    const clientWrapsChildren =
      /<ContinuousMarquee[\s\S]{0,200}\{children\}/i.test(client);
    const serverRootHasFullBleedBg =
      /className=["'`][^"'`]*\bw-full\b[^"'`]*\bbg-/i.test(main) ||
      /className=["'`][^"'`]*\bbg-\[[^\]]+\][^"'`]*\bw-full\b/i.test(main) ||
      /bg-\[linear-gradient/i.test(main);
    if (clientWrapsChildren && serverRootHasFullBleedBg) {
      out.push(
        'CONTRACT: band-ticker — ContinuousMarquee must wrap only the nowrap text track; keep w-full/bg on an outer shell outside ContinuousMarquee (not around the whole colored section as chrome children)',
      );
    }
    if (
      /<ContinuousMarquee\b/i.test(blob) &&
      !/variant\s*=\s*\{?["']band["']/i.test(blob)
    ) {
      out.push(
        'CONTRACT: band-ticker — ContinuousMarquee must use variant="band" (center when fits; scroll only on overflow — not logo-rail pad defaults)',
      );
    }
    if (/\blg:min-w-0\b/.test(main)) {
      out.push(
        'CONTRACT: band-ticker — do not use lg:min-w-0 on the text track (it collapses overflow so the marquee never scrolls)',
      );
    }
  }

  if (String(opts.layoutMode || '').toLowerCase() === 'media-tabs') {
    if (clientTsx.trim() && hasDuplicateChildrenMount(clientTsx)) {
      out.push(
        'CONTRACT: media-tabs chrome must mount {children} exactly once — duplicate mobile+desktop mounts leave an empty rail (React last-wins)',
      );
    }
    if (
      String(opts.role || '').toLowerCase() === 'child' &&
      mediaTabsItemInAttrsRe().test(tsx)
    ) {
      if (!hasMediaTabTitleOnItemRoot(tsx)) {
        out.push(
          'CONTRACT: media-tabs child item root needs data-media-tab-title={string} (or legacy data-story-title) — chrome reads dataset / attr, not buried sr-only nodes alone',
        );
      }
      if (
        /data-media-tab-logo|data-story-logo/.test(tsx) &&
        !hasResolvableMediaTabLogo(tsx)
      ) {
        out.push(
          'CONTRACT: media-tabs logo must be an <img> under [data-media-tab-logo] (or data-media-tab-logo-src) — chrome treats logo as HTMLImageElement',
        );
      }
    }
  }

  // Image-row only: childItemTemplate with Image field(s) must seed N {url,alt}
  // rows. Skip text/toggle/action nested rows (consent categories, FAQ, CTAs) —
  // General Link `url:` must never count as an Image seed.
  if (
    opts.definitionTs &&
    /\bchildItemTemplate\s*:/.test(String(opts.definitionTs)) &&
    Array.isArray(opts.sectionInfo?.repeats) &&
    opts.sectionInfo.repeats.length > 0
  ) {
    const def = String(opts.definitionTs);
    const childTplHasImage =
      /\bchildItemTemplate\s*:[\s\S]{0,4000}\btype:\s*["']Image["']/.test(def);
    if (childTplHasImage) {
      const need = resolveImageRowSeedNeed(opts.sectionInfo.repeats);
      if (need > 1) {
        const urlCount = countImageUrlAltSeeds(def);
        if (urlCount > 0 && urlCount < need) {
          out.push(
            `CONTRACT: REQUIRED REPEAT / IMAGE ROW SEEDS (${need}) but definition has only ${urlCount} Image {url,alt} seed(s) — prefer HTML unique count over crop window`,
          );
        }
      }
    }
  }

  out.push(...detectOrphanChromeJsx(tsx));
  out.push(...detectDuplicateUseClient(tsx));
  out.push(...detectDuplicateUseClient(clientTsx));
  out.push(...detectUnknownChromeProps(tsx, clientTsx));

  const definitionKey =
    String(opts.definitionKey || '').trim() ||
    toDefinitionKey(opts.componentName || '') ||
    '';
  const trustTsxStructure =
    typeof opts.trustTsxStructure === 'boolean'
      ? opts.trustTsxStructure
      : true;
  out.push(
    ...collectPlaceholderContractDiagnostics({
      tsx,
      clientTsx,
      definitionTs: opts.definitionTs,
      plan: opts.plan,
      childPackages: opts.childPackages || [],
      definitionKey,
      role: opts.role,
      componentName: opts.componentName,
      trustTsxStructure,
      nodeMode:
        opts.nodeMode ||
        opts.planMode ||
        (String(opts.role || '').toLowerCase() === 'child'
          ? 'single'
          : opts.plan?.mode) ||
        null,
    }),
  );

  {
    /** @type {{ definitionKey: string, name?: string, componentName?: string, renderingPathLeaf?: string, codePrefix?: string }[]} */
    const pathLeafDefs = [];
    /** @type {Set<string>} */
    const seenKeys = new Set();
    const pushPathLeafDef = (d) => {
      const key = String(d?.definitionKey || '').trim();
      if (!key || seenKeys.has(key)) return;
      const componentName =
        String(d?.componentName || '').trim() ||
        String(d?.definitionTs || '').match(
          /\bcomponentName\s*:\s*["']([^"']+)["']/,
        )?.[1] ||
        '';
      if (!componentName && !d?.renderingPathLeaf) return;
      seenKeys.add(key);
      pathLeafDefs.push({
        definitionKey: key,
        name: String(d?.name || d?.definitionKey || '').trim(),
        componentName,
        renderingPathLeaf: d?.renderingPathLeaf,
        codePrefix: d?.codePrefix || opts.codePrefix,
      });
    };
    pushPathLeafDef({
      definitionKey,
      name: definitionKey,
      componentName: opts.componentName,
      codePrefix: opts.codePrefix,
    });
    for (const c of opts.childPackages || []) pushPathLeafDef(c);
    for (const s of opts.siblingPackages || opts.pathLeafSiblingDefs || []) {
      pushPathLeafDef(s);
    }
    out.push(
      ...collectPathLeafCollisionDiagnostics(pathLeafDefs, {
        codePrefix: opts.codePrefix,
      }),
    );
  }

  out.push(
    ...collectFieldUsageContractDiagnostics({
      tsx,
      clientTsx,
      definitionTs: opts.definitionTs,
    }),
  );
  out.push(
    ...collectMapEntryClientFieldsContractDiagnostics({
      tsx,
      clientTsx,
    }),
  );

  {
    const role = String(opts.role || '').toLowerCase();
    const childPkgs = opts.childPackages || [];
    const hasChildPkgs = childPkgs.some(
      (c) =>
        String(c?.role || '').toLowerCase() === 'child' ||
        Boolean(String(c?.parentPlaceholder || c?.placeholderKey || '').trim()),
    );
    const hasAppPh =
      /AppPlaceholder\b/.test(tsx) || /AppPlaceholder\b/.test(clientTsx);
    // Derive composite from emit/TSX — never planMode.
    if (role === 'section' && (hasChildPkgs || hasAppPh || opts.plan?.children?.length)) {
      out.push(
        ...collectComposedTreeDiagnostics({
          plan: opts.plan,
          parentTsx: tsx,
          parentClientTsx: clientTsx,
          parentDefinitionKey: definitionKey,
          parentDefinitionTs: opts.definitionTs,
          childPackages: childPkgs,
          sectionInfo: opts.sectionInfo,
          sectionHtml: opts.sectionHtml,
        }),
      );
    }
    if (role === 'section' || role === '') {
      out.push(
        ...collectHtmlMultiBandEmitDiagnostics({
          sectionHtml: opts.sectionHtml,
          packages: [
            {
              role: 'section',
              definitionKey,
              definitionTs: opts.definitionTs,
              tsx,
              clientTsx,
            },
            ...childPkgs,
          ],
          layoutSketch: opts.layoutSketch,
        }),
      );
    }
  }

  for (const hint of collectTitleSeedContractDiagnostics({
    definitionTs: opts.definitionTs,
    sectionInfo: opts.sectionInfo,
    role: opts.role,
  })) {
    const msg = String(hint || '').trim();
    if (!msg) continue;
    out.push(msg.startsWith('CONTRACT:') ? msg : `CONTRACT: ${msg}`);
  }

  for (const hint of collectEnglishItemNameAndCultureDiagnostics({
    definitionTs: opts.definitionTs,
  })) {
    const msg = String(hint || '').trim();
    if (!msg) continue;
    out.push(msg.startsWith('CONTRACT:') ? msg : `CONTRACT: ${msg}`);
  }

  for (const hint of collectBandScopedHeadingOwnershipDiagnostics({
    definitionTs: opts.definitionTs,
    sectionInfo: opts.sectionInfo,
    role: opts.role,
    plan: opts.plan,
  })) {
    const msg = String(hint || '').trim();
    if (!msg) continue;
    out.push(msg.startsWith('CONTRACT:') ? msg : `CONTRACT: ${msg}`);
  }

  // Nested feature-split: parent flex shell + Heading beside a feature PH.
  if (
    (role === 'parent' || role === 'section') &&
    /\bfields\.Heading\b/.test(tsx) &&
    /AppPlaceholder[\s\S]{0,400}name=\{[^}]*(?:proximity|feature)[^}]*\}/i.test(
      tsx,
    ) &&
    /flex(?:-col)?[\s\S]{0,200}(?:flex-row|min-\[?\d)/i.test(tsx)
  ) {
    out.push(
      'CONTRACT: nested feature-split — parent must not wrap a proximity/feature AppPlaceholder in a flex-row shell that also paints fields.Heading; give the feature child sole ownership (full-width PH) or make the child image-only',
    );
  }

  for (const hint of collectLinkSeedContractDiagnostics({
    definitionTs: opts.definitionTs,
  })) {
    const msg = String(hint || '').trim();
    if (!msg) continue;
    out.push(msg.startsWith('CONTRACT:') ? msg : `CONTRACT: ${msg}`);
  }

  const logo = assertLogoRailChildHasImage({
    role: opts.role,
    sectionInfo: opts.sectionInfo,
    parentComponentName: opts.parentComponentName,
    plan: opts.plan,
    tsx,
    definitionTs: opts.definitionTs,
    componentName: opts.componentName,
  });
  for (const hint of logo.revisionHints || []) {
    const msg = String(hint || '').trim();
    if (!msg) continue;
    out.push(msg.startsWith('CONTRACT:') ? msg : `CONTRACT: ${msg}`);
  }

  out.push(
    ...collectPlatformListFolderHygieneDiagnostics({
      definitionTs: opts.definitionTs,
      tsx,
      definitionKey,
      componentName: opts.componentName,
    }),
  );
  out.push(
    ...collectSocialLinkListFallbackDiagnostics({
      definitionTs: opts.definitionTs,
      tsx,
      definitionKey,
      componentName: opts.componentName,
      sectionInfo: opts.sectionInfo,
    }),
  );

  out.push(
    ...collectLinkListJsonBagContractDiagnostics({
      definitionTs: opts.definitionTs,
      tsx,
    }),
  );

  out.push(
    ...collectJsonBagDirectMapContractDiagnostics({
      definitionTs: opts.definitionTs,
      tsx,
    }),
  );

  out.push(
    ...collectEmptyIconCircleContractDiagnostics({
      definitionTs: opts.definitionTs,
      tsx,
      sectionHtml: opts.sectionHtml,
    }),
  );

  out.push(
    ...collectCompanionClientContractDiagnostics({
      tsx,
      clientTsx,
    }),
  );

  out.push(
    ...collectHardcodedCaptureImageUrlDiagnostics({
      tsx,
      clientTsx,
    }),
  );

  out.push(...collectSpacedFieldAccessContractDiagnostics(tsx));
  if (clientTsx.trim()) {
    out.push(...collectSpacedFieldAccessContractDiagnostics(clientTsx));
  }
  out.push(
    ...collectPeerGridContractDiagnostics({
      tsx,
      clientTsx,
      sectionInfo: opts.sectionInfo,
    }),
  );
  out.push(...collectImageInLinkContractDiagnostics(tsx));
  if (clientTsx.trim()) {
    out.push(...collectImageInLinkContractDiagnostics(clientTsx));
  }
  out.push(...collectPictureSrcSetContractDiagnostics(tsx));
  if (clientTsx.trim()) {
    out.push(...collectPictureSrcSetContractDiagnostics(clientTsx));
  }
  out.push(...collectCrossOriginMaskContractDiagnostics(tsx));
  if (clientTsx.trim()) {
    out.push(...collectCrossOriginMaskContractDiagnostics(clientTsx));
  }

  out.push(
    ...collectTsxImportChromePropsContractDiagnostics({
      tsx,
      clientTsx,
    }),
  );

  out.push(
    ...collectClassNameTemplateLiteralContractDiagnostics({
      tsx,
      clientTsx,
    }),
  );

  out.push(
    ...collectDefinitionApostropheContractDiagnostics({
      definitionTs: opts.definitionTs,
    }),
  );

  out.push(
    ...collectInteractionStateContractDiagnostics({
      tsx,
      clientTsx,
      sectionInfo: opts.sectionInfo,
      role: opts.role,
    }),
  );

  return out;
}

/**
 * Detect-only: single-quoted TS string that ends early because of an unescaped
 * apostrophe (Buyer's → `'Buyer'` + `s…`). Ignores apostrophes inside
 * double-quoted strings. Prompt-first — no rewrite.
 * @param {string|null|undefined} definitionTs
 * @returns {boolean}
 */
export function hasBrokenApostropheInSingleQuotedSeeds(definitionTs) {
  const text = String(definitionTs || '');
  if (!text.trim() || !text.includes("'")) return false;

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === '`') {
      const q = ch;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === "'") {
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === "'") {
          // Classic Buyer's break: string closed, next char resumes the word.
          if (i + 1 < text.length && /[A-Za-z]/.test(text[i + 1])) {
            return true;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return false;
}

/**
 * @param {{ definitionTs?: string|null }} opts
 * @returns {string[]}
 */
export function collectDefinitionApostropheContractDiagnostics(opts = {}) {
  if (!hasBrokenApostropheInSingleQuotedSeeds(opts.definitionTs)) return [];
  return [
    'CONTRACT: definitionTs has a single-quoted seed with an unescaped apostrophe (e.g. Title: \'Buyer\'s Choice\') — use double quotes (Title: "Buyer\'s Choice") or escape (\'Buyer\\\'s Choice\') so TypeScript parses',
  ];
}

/**
 * Detect-only: `className="…${…}…"` with nested quotes is invalid JSX.
 * Prompt-first — no rewrite; AI must emit className={`…`}.
 * @param {string} source
 * @returns {boolean}
 */
export function hasQuotedClassNameWithTemplateInterpolation(source) {
  const text = String(source || '');
  if (!text.trim() || !/\b(?:className|class)\s*=\s*"/.test(text)) {
    return false;
  }
  const attrStartRe = /\b(?:className|class)\s*=\s*"/g;
  let match;
  while ((match = attrStartRe.exec(text)) !== null) {
    let j = match.index + match[0].length;
    let hasTpl = false;
    while (j < text.length) {
      if (text[j] === '$' && text[j + 1] === '{') {
        hasTpl = true;
        j += 2;
        let depth = 1;
        while (j < text.length && depth > 0) {
          const ch = text[j];
          if (ch === '"' || ch === "'" || ch === '`') {
            const q = ch;
            j += 1;
            while (j < text.length && text[j] !== q) {
              if (text[j] === '\\') j += 1;
              j += 1;
            }
            j += 1;
            continue;
          }
          if (ch === '{') depth += 1;
          else if (ch === '}') depth -= 1;
          j += 1;
        }
        continue;
      }
      if (text[j] === '"') break;
      j += 1;
    }
    if (hasTpl && text[j] === '"') return true;
  }
  return false;
}

/**
 * @param {{ tsx?: string|null, clientTsx?: string|null }} opts
 * @returns {string[]}
 */
export function collectClassNameTemplateLiteralContractDiagnostics(opts = {}) {
  /** @type {string[]} */
  const out = [];
  const blobs = [
    ['tsx', opts.tsx],
    ['clientTsx', opts.clientTsx],
  ];
  for (const [label, src] of blobs) {
    if (hasQuotedClassNameWithTemplateInterpolation(src)) {
      out.push(
        `CONTRACT: ${label} has className="…\${…}…" with template interpolation inside a plain double-quoted attr — emit className={\`… \${cond ? "a" : "b"}\`} instead (inner quotes break JSX parse)`,
      );
    }
  }
  return out;
}

const SDK_FIELD_TYPE_NAMES = [
  'TextField',
  'RichTextField',
  'ImageField',
  'LinkField',
  'Field',
];

/**
 * Names imported from @sitecore-content-sdk/nextjs (value or type) plus
 * inline `import('…').Field` qualifiers.
 * @param {string} source
 * @returns {Set<string>}
 */
function collectSdkImportedNames(source) {
  const text = String(source || '');
  /** @type {Set<string>} */
  const names = new Set();
  const importRe =
    /^import\s+(?:type\s+)?(?:[\w*]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"];?\s*$/gm;
  let m;
  while ((m = importRe.exec(text))) {
    for (const part of m[1].split(',')) {
      const raw = part.trim();
      if (!raw) continue;
      // `type Field` / `Field as F` / `type Field as F`
      const cleaned = raw
        .replace(/^type\s+/, '')
        .replace(/\s+as\s+\w+$/, '')
        .trim();
      if (cleaned) names.add(cleaned);
    }
  }
  for (const name of SDK_FIELD_TYPE_NAMES) {
    if (
      new RegExp(
        `import\\s*\\(\\s*['"]@sitecore-content-sdk\\/nextjs['"]\\s*\\)\\s*\\.\\s*${name}\\b`,
      ).test(text)
    ) {
      names.add(name);
    }
  }
  return names;
}

/**
 * Field type names used in type-ish positions (after `:`, generics, etc.).
 * @param {string} source
 * @returns {Set<string>}
 */
function collectUsedSdkFieldTypes(source) {
  const text = String(source || '');
  /** @type {Set<string>} */
  const used = new Set();
  for (const name of SDK_FIELD_TYPE_NAMES) {
    const re = new RegExp(
      `(?:^|[\\s:,<>|&(\\[]|typeof\\s+)${name}\\b`,
      'm',
    );
    if (re.test(text)) used.add(name);
  }
  return used;
}

/**
 * Field / LinkField / ImageField / etc. incorrectly imported from lib/component-props
 * (module does not re-export them → TS2459).
 * @param {string} source
 * @returns {string[]}
 */
export function collectFieldTypesImportedFromLibComponentProps(source) {
  const text = String(source || '');
  /** @type {Set<string>} */
  const found = new Set();
  const re =
    /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]lib\/component-props['"]/g;
  let m;
  while ((m = re.exec(text))) {
    for (const part of String(m[1] || '').split(',')) {
      const cleaned = part
        .replace(/\btype\b/g, '')
        .trim()
        .split(/\s+as\s+/i)[0]
        .trim();
      if (SDK_FIELD_TYPE_NAMES.includes(cleaned)) found.add(cleaned);
    }
  }
  return [...found];
}

/**
 * True when source references JSX.Element / JSX.* without importing JSX from react.
 * @param {string} source
 * @returns {boolean}
 */
export function sourceMissingJsxImport(source) {
  const text = String(source || '');
  if (!/\bJSX\s*\./.test(text)) return false;
  // Value or type named import of JSX from 'react'
  const importRe =
    /^import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/gm;
  let m;
  while ((m = importRe.exec(text))) {
    const names = m[1]
      .split(',')
      .map((s) =>
        s
          .trim()
          .replace(/^type\s+/, '')
          .replace(/\s+as\s+\w+$/, '')
          .trim(),
      )
      .filter(Boolean);
    if (names.includes('JSX')) return false;
  }
  return true;
}

/**
 * True when clientTsx types chrome props as ComponentWithContextProps / ComponentProps
 * intersected with fields (map-entry only passes fields/children → TS2739).
 * @param {string} clientTsx
 * @returns {boolean}
 */
export function clientTsxHasFatChromeProps(clientTsx) {
  const text = String(clientTsx || '');
  if (!text.trim()) return false;
  if (
    !/\bComponentWithContextProps\b/.test(text) &&
    !/\bComponentProps\b/.test(text)
  ) {
    return false;
  }
  // type Props = ComponentWithContextProps & { fields… }
  // type Props = ComponentProps & { fields… }
  if (
    /type\s+\w+\s*=\s*Component(?:WithContext)?Props\s*&/.test(text) ||
    /:\s*Component(?:WithContext)?Props\s*&/.test(text)
  ) {
    return true;
  }
  // export default function Chrome({ fields }: Props) where Props = ComponentWithContextProps…
  if (
    /type\s+(\w+)\s*=\s*Component(?:WithContext)?Props\b/.test(text) &&
    /export\s+default\s+function\s+\w+\s*\(\s*\{\s*(?:fields|children)[\s},]/.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Collect field names typed as `LinkField` on local `Fields` (incl. spaced keys).
 * @param {string} source
 * @returns {Set<string>}
 */
export function collectLinkFieldNamesFromFields(source) {
  /** @type {Set<string>} */
  const names = new Set(['CTA', 'Link']);
  const text = String(source || '');
  const fieldsBlock = text.match(
    /\b(?:interface|type)\s+Fields\s*=?\s*\{([\s\S]*?)\}/,
  );
  if (fieldsBlock?.[1]) {
    for (const m of fieldsBlock[1].matchAll(
      /(?:(\w+)|["']([^"']+)["'])\s*:\s*LinkField\b/g,
    )) {
      names.add(m[1] || m[2]);
    }
  }
  return names;
}

/**
 * True when `<Text field={fields.X} />` binds a Fields key typed as LinkField.
 * @param {string} source
 * @returns {string[]} LinkField names that were painted with Text
 */
export function findTextOnLinkFieldNames(source) {
  const text = String(source || '');
  if (!text.trim() || !/<Text\b/.test(text)) return [];
  const linkNames = collectLinkFieldNamesFromFields(text);
  /** @type {string[]} */
  const hits = [];
  for (const name of linkNames) {
    if (!name) continue;
    const needsBracket = /[^A-Za-z0-9_$]/.test(name);
    const fieldAccess = needsBracket
      ? `fields\\[["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\]`
      : `fields\\.${name}`;
    const textTag = new RegExp(
      `<Text\\s+field=\\{${fieldAccess}\\}\\s*(?:\\/>|>\\s*<\\/Text>)`,
    );
    if (textTag.test(text)) hits.push(name);
  }
  return hits;
}

/**
 * Detect-only: missing JSX import, missing Field type imports, fat Chrome props,
 * Text-on-LinkField.
 * Prompt-first — no rewrite; validate/repair asks the model to fix.
 *
 * @param {{ tsx?: string|null, clientTsx?: string|null }} opts
 * @returns {string[]}
 */
export function collectTsxImportChromePropsContractDiagnostics(opts = {}) {
  /** @type {string[]} */
  const out = [];
  const blobs = [
    ['tsx', opts.tsx],
    ['clientTsx', opts.clientTsx],
  ];

  for (const [label, raw] of blobs) {
    const src = String(raw || '');
    if (!src.trim()) continue;

    if (sourceMissingJsxImport(src)) {
      out.push(
        `CONTRACT: ${label} uses JSX.Element (or JSX.*) without importing JSX from 'react' — emit import React, { JSX, … } from 'react' (TS2694)`,
      );
    }

    const badLibFieldTypes = collectFieldTypesImportedFromLibComponentProps(src);
    if (badLibFieldTypes.length) {
      out.push(
        `CONTRACT: ${label} imports ${badLibFieldTypes.join(', ')} from 'lib/component-props' — those are not re-exported (TS2459). Use import type { ${badLibFieldTypes.join(', ')} } from '@sitecore-content-sdk/nextjs' and keep only ComponentWithContextProps / ComponentProps / getDatasource / getFieldValue on lib/component-props`,
      );
    }

    const used = collectUsedSdkFieldTypes(src);
    if (used.size) {
      const imported = collectSdkImportedNames(src);
      const missing = [...used].filter((n) => !imported.has(n));
      // Field is a substring risk for TextField etc. — collectUsed already uses word boundaries;
      // if TextField is used, Field alone may also match via `(?:…)Field\b` after Text — wait:
      // `(?:^|[\s:,<>|&(\\[]|typeof\s+)Field\b` on `TextField` — the char before Field is `t` of Text,
      // which is NOT in the prefix class, so Field alone won't match inside TextField. Good.
      if (missing.length) {
        out.push(
          `CONTRACT: ${label} uses ${missing.join(', ')} without import type { ${missing.join(', ')} } from '@sitecore-content-sdk/nextjs' (TS2304)`,
        );
      }
    }

    for (const name of findTextOnLinkFieldNames(src)) {
      out.push(
        `CONTRACT: ${label} has <Text field={…}> on LinkField "${name}" — use childless <Link field={…} /> or a Separate Single-Line Text label (TS2322)`,
      );
    }

    // Bare AppPlaceholder name="base" does not match Edge base-N / base-{*} (empty PH).
    // Skip clientTsx — AppPlaceholder belongs on server map-entry only.
    if (label === 'tsx') {
      const bare = collectBareAppPlaceholderLiteralNames(src);
      for (const name of bare) {
        out.push(
          `CONTRACT: ${label} has bare <AppPlaceholder name="${name}" /> — use placeholderBase + DynamicPlaceholderId → phName (name={phName}); bare names render empty under layout base-N / base-{*}`,
        );
      }
    }
  }

  const client = String(opts.clientTsx || '');
  if (clientTsxHasFatChromeProps(client)) {
    out.push(
      'CONTRACT: clientTsx chrome props must be narrow Props = { fields; children? } bound as (props: Props) — never ComponentWithContextProps / ComponentProps & { fields } when map-entry passes flat fields={datasource} only (TS2739)',
    );
  }

  return out;
}

/**
 * Literal AppPlaceholder name="…" / name={'…'} values (dynId pattern missing).
 * @param {string} source
 * @returns {string[]}
 */
export function collectBareAppPlaceholderLiteralNames(source) {
  const text = String(source || '');
  /** @type {string[]} */
  const out = [];
  const re =
    /<AppPlaceholder\b[^>]*?\bname\s*=\s*(?:(["'])([^"']+)\1|\{\s*(["'])([^"']+)\3\s*\})/g;
  let m;
  while ((m = re.exec(text))) {
    const name = String(m[2] || m[4] || '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Detect React client hooks / DOM event handlers that require a Client Component.
 * Used to catch map-entries that keep interactivity without `'use client'` or
 * that duplicate hooks after emitting a `./….client` companion.
 *
 * @param {string} src
 * @returns {boolean}
 */
export function mapEntryHasClientHooksOrHandlers(src) {
  const s = String(src || '');
  if (!s.trim()) return false;
  return (
    /\buseState\b/.test(s) ||
    /\buseEffect\b/.test(s) ||
    /\buseReducer\b/.test(s) ||
    /\buseRef\b/.test(s) ||
    /\bonClick\s*=/.test(s) ||
    /\bonChange\s*=/.test(s) ||
    /\bonSubmit\s*=/.test(s)
  );
}

/**
 * True when the source has a leading `'use client'` / `"use client"` directive
 * (after optional BOM / shebang / block comments / blank lines).
 *
 * @param {string} src
 * @returns {boolean}
 */
export function sourceHasLeadingUseClient(src) {
  let s = String(src || '').replace(/^\uFEFF/, '');
  // Strip leading whitespace / block comments so `'use client'` after a
  // license header still counts (avoid empty-match loops in a single regex).
  for (;;) {
    const next = s.replace(/^\s+/, '').replace(/^\/\*[\s\S]*?\*\//, '');
    if (next === s) break;
    s = next;
  }
  return /^['"]use client['"]\s*;?/.test(s);
}

/**
 * Companion clientTsx contracts:
 * - Map-entry default-import of `./….client` requires non-empty clientTsx with export default.
 * - clientTsx must not own AppPlaceholder / componentMap (server owns PH; chrome takes children).
 * - Map-entry must not keep hooks/handlers when chrome exists (or without `'use client'`).
 *
 * @param {{ tsx?: string|null, clientTsx?: string|null }} opts
 * @returns {string[]}
 */
/**
 * Detect Field/LinkField misuse that causes next:build TS2322/TS2339.
 * @param {{ tsx?: string|null, clientTsx?: string|null, definitionTs?: string|null }} opts
 * @returns {string[]}
 */
export function collectFieldUsageContractDiagnostics(opts = {}) {
  const blob = `${String(opts.tsx || '')}\n${String(opts.clientTsx || '')}`;
  const definitionTs = String(opts.definitionTs || '');
  /** @type {string[]} */
  const out = [];

  if (
    /\b(?:aria-label|placeholder|title)=\{(?![^}]*\btypeof\b)[^}]*\.value(?:\s*\|\|\s*undefined)?\}/.test(
      blob,
    )
  ) {
    out.push(
      'CONTRACT: aria-label/placeholder/title must coerce Field.value with typeof === "string" (Field.value may be string|number — TS2322)',
    );
  }

  // LinkField.url is invalid — use value.href / getFieldValue(link)?.href
  if (
    /\bgetFieldValue\s*\([^)]*(?:Link|CTA|Href)[^)]*\)\s*\?\.\s*url\b/i.test(
      blob,
    ) ||
    /\bfields\s*(?:\[[^\]]*[Ll]ink[^\]]*\]|\.\w*[Ll]ink\w*)\s*\?\.\s*url\b/.test(
      blob,
    ) ||
    /\bfields\s*(?:\[[^\]]*[Ll]ink[^\]]*\]|\.\w*[Ll]ink\w*)\s*\.\s*url\b/.test(
      blob,
    )
  ) {
    out.push(
      'CONTRACT: LinkField has no .url — use field.value?.href or getFieldValue(link)?.href (TS2339)',
    );
  }

  if (/<Link\b[^>]*\bfield=\{[^}]*\.fields\?\.Link\}/s.test(blob)) {
    out.push(
      'CONTRACT: <Link field={item.fields?.Link}> is LinkField|undefined — guard or early-return before passing field (TS2322)',
    );
  }

  // Illegal itemTemplate.children (DataItemTemplateDef only allows name + sections)
  if (
    /\bitemTemplate\s*:\s*\{[\s\S]{0,4000}?\bchildren\s*:\s*\{[\s\S]{0,800}?itemTemplate\s*:/.test(
      definitionTs,
    )
  ) {
    out.push(
      'CONTRACT: definitionTs must not nest children under itemTemplate — use model.childItemTemplate as a sibling of itemTemplate (DataItemTemplateDef — TS2353)',
    );
  }

  return out;
}

/**
 * Map-entry spreads into client that requires `fields: Fields` → TS2741.
 * @param {{ tsx?: string|null, clientTsx?: string|null }} opts
 * @returns {string[]}
 */
export function collectMapEntryClientFieldsContractDiagnostics(opts = {}) {
  const tsx = String(opts.tsx || '');
  const clientTsx = String(opts.clientTsx || '');
  /** @type {string[]} */
  const out = [];
  if (!tsx.trim() || !clientTsx.trim()) return out;

  const clientRequiresFields =
    /&\s*\{\s*fields\s*:\s*Fields\s*\}/.test(clientTsx) ||
    /type\s+Props\s*=\s*[^=]*\{\s*fields\s*:\s*Fields\s*\}/.test(clientTsx);
  const mapEntryLacksFields =
    /type\s+Props\s*=\s*ComponentWithContextProps\s*;/.test(tsx) ||
    (/ComponentWithContextProps/.test(tsx) &&
      !/&\s*\{\s*fields\s*[?:]/.test(tsx) &&
      !/\{\s*fields\s*[?:]/.test(tsx));
  const spreadsToClient =
    /\{\.\.\.props\}/.test(tsx) &&
    /from\s+['"]\.\/[^'"]+\.client['"]/.test(tsx);

  if (clientRequiresFields && mapEntryLacksFields && spreadsToClient) {
    out.push(
      'CONTRACT: map-entry spreads {...props} into client that requires fields: Fields — declare the same fields on map-entry Props (or make client fields optional) (TS2741)',
    );
  }
  return out;
}

export function collectCompanionClientContractDiagnostics(opts = {}) {
  const tsx = String(opts.tsx || '');
  const clientRaw = opts.clientTsx;
  const clientTsx =
    clientRaw == null ? '' : String(clientRaw);
  const clientTrim = clientTsx.trim();
  /** @type {string[]} */
  const out = [];

  // Next Turbopack treats leading 'use server' as Server Actions module —
  // sync `export const Default` then fails: "Server Actions must be async functions".
  if (/^\s*['"]use server['"]/m.test(tsx) || /['"]use server['"]/.test(tsx)) {
    out.push(
      "CONTRACT: map-entry must NOT use 'use server' — Sitecore components are RSC (no directive) or 'use client' chrome; strip 'use server' (Turbopack: Server Actions must be async functions)",
    );
  }
  if (clientTrim && /['"]use server['"]/.test(clientTsx)) {
    out.push(
      "CONTRACT: clientTsx must NOT use 'use server' — companions start with 'use client' only",
    );
  }

  // Default-only OR default + named/type imports from ./….client
  const importsClient =
    /\bimport\s+[A-Za-z_$][\w$]*(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]\.\/[^'"]+\.client['"]/.test(
      tsx,
    );
  const usesChromeJsx = /<\/?[A-Za-z][\w]*Chrome\b/.test(tsx);
  const hasHooksOrHandlers = mapEntryHasClientHooksOrHandlers(tsx);
  const hasAppPlaceholder = /<AppPlaceholder\b|\bAppPlaceholder\b/.test(tsx);
  const hasUseClient = sourceHasLeadingUseClient(tsx);

  if (importsClient && !clientTrim) {
    out.push(
      "CONTRACT: map-entry imports './….client' but clientTsx is missing/empty — emit one complete companion ('use client' + export default function …Chrome). Never mash a second \"clientTsx\": \"\" that JSON last-wins wipes",
    );
  } else if (importsClient && clientTrim && !/\bexport\s+default\b/.test(clientTsx)) {
    out.push(
      'CONTRACT: companion clientTsx must include export default (map-entry uses default import from ./….client)',
    );
  }

  // FAQ crash pattern: clientTsx written / *Chrome JSX used, but map-entry forgot the import.
  if (!importsClient && (clientTrim || usesChromeJsx)) {
    out.push(
      "CONTRACT: map-entry must import the companion — `import XxxChrome from './{kebab}.client'` then render <XxxChrome …/>. Forbidden: bare <FaqChrome …/> (or any *Chrome) with no .client import when clientTsx is non-null (ReferenceError at runtime)",
    );
  }

  if (clientTrim) {
    if (!sourceHasLeadingUseClient(clientTsx)) {
      out.push(
        "CONTRACT: clientTsx (*.client.tsx) must start with 'use client' — required for Next.js Client Components",
      );
    }
    if (
      /<AppPlaceholder\b/.test(clientTsx) ||
      /\bAppPlaceholder\b/.test(clientTsx) ||
      /from\s+['"]\.sitecore\/component-map['"]/.test(clientTsx) ||
      /\bcomponentMap\b/.test(clientTsx)
    ) {
      out.push(
        'CONTRACT: clientTsx must not use AppPlaceholder or componentMap — mount AppPlaceholder + .sitecore/component-map on server map-entry only and pass already-rendered PH markup as children into chrome (<Chrome fields={props.fields}><AppPlaceholder name="…" rendering={props.rendering} page={props.page} componentMap={componentMap} /></Chrome>). React Server Components (RSC) crash otherwise: Functions cannot be passed / {Default: function Default}',
      );
    }
  }

  // Duplicate interactivity: chrome companion present (import or clientTsx) but
  // map-entry still owns hooks/handlers → RSC build break (FeatureCard failure).
  if (hasHooksOrHandlers && (importsClient || clientTrim)) {
    out.push(
      'CONTRACT: move hooks/handlers into clientTsx; map-entry must only render chrome',
    );
  }

  // Leaf map-entry with hooks/handlers but no companion and no AppPlaceholder
  // must start with 'use client' (otherwise Turbopack treats it as a Server Component).
  if (
    hasHooksOrHandlers &&
    !importsClient &&
    !clientTrim &&
    !hasAppPlaceholder &&
    !hasUseClient
  ) {
    out.push(
      "CONTRACT: map-entry uses client hooks/handlers without 'use client'",
    );
  }

  return out;
}

const PLATFORM_LIST_FOLDERS_RE =
  /folder\s*:\s*\[[^\]]*(?:Link Lists|Icon Link Lists|Image Link Lists)/i;

/**
 * Escape a field name for RegExp.
 * @param {string} name
 */
function escapeRegExp(name) {
  return String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when a string looks like a JSON array of link-shaped objects ({ text, url|href }).
 * @param {string} raw
 */
export function isLinkShapedJsonBagSeed(raw) {
  const t = String(raw || '').trim();
  if (!t || t[0] !== '[') return false;
  try {
    const parsed = JSON.parse(t);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.some(
      (row) =>
        row &&
        typeof row === 'object' &&
        (row.text != null || row.Text != null) &&
        (row.url != null ||
          row.href != null ||
          row.Url != null ||
          row.Href != null),
    );
  } catch {
    // Unparseable quoted seed — heuristic for [{ "text": …, "url": … }, …]
    return (
      /\{\s*["']?text["']?\s*:/i.test(t) &&
      /\b["']?(?:url|href)["']?\s*:/i.test(t)
    );
  }
}

/**
 * Multi-Line Text field names from a definition source string.
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function listMultiLineTextFieldNames(definitionTs) {
  const def = String(definitionTs || '');
  /** @type {Set<string>} */
  const names = new Set();
  for (const m of def.matchAll(
    /\{\s*name:\s*["']([^"']+)["']\s*,\s*type:\s*["']Multi-Line Text["']/gi,
  )) {
    names.add(m[1]);
  }
  for (const m of def.matchAll(
    /\{\s*type:\s*["']Multi-Line Text["']\s*,\s*name:\s*["']([^"']+)["']/gi,
  )) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * Find Multi-Line Text fields whose content seed is a link-shaped JSON bag.
 * @param {string} definitionTs
 * @returns {string[]} field names
 */
export function findLinkShapedJsonBagFields(definitionTs) {
  const def = String(definitionTs || '');
  if (!def.trim()) return [];
  /** @type {string[]} */
  const out = [];
  for (const name of listMultiLineTextFieldNames(def)) {
    const esc = escapeRegExp(name);
    // FieldName: '…' | "…" | `…`  OR  'Field Name': '…'
    const quotedRe = new RegExp(
      `(?:["']${esc}["']|\\b${esc}\\b)\\s*:\\s*(["'\`])([\\s\\S]*?)\\1`,
      'g',
    );
    let hit = false;
    for (const m of def.matchAll(quotedRe)) {
      if (isLinkShapedJsonBagSeed(m[2])) {
        hit = true;
        break;
      }
    }
    if (!hit) {
      // FieldName: JSON.stringify([ … { text, url } … ])
      const stringifyRe = new RegExp(
        `(?:["']${esc}["']|\\b${esc}\\b)\\s*:\\s*JSON\\.stringify\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
        'i',
      );
      const sm = stringifyRe.exec(def);
      if (
        sm &&
        /\btext\b/i.test(sm[1]) &&
        /\b(?:url|href)\b/i.test(sm[1])
      ) {
        hit = true;
      }
    }
    if (hit) out.push(name);
  }
  return out;
}

/**
 * True when TSX JSON.parse + maps a given Multi-Line bag field.
 * @param {string} tsx
 * @param {string} fieldName
 */
export function tsxPaintsJsonBagField(tsx, fieldName) {
  const src = String(tsx || '');
  if (!src.trim() || !fieldName) return false;
  const esc = escapeRegExp(fieldName);
  const fieldRef = new RegExp(
    `fields(?:\\.${esc}|\\[\\s*["']${esc}["']\\s*\\])`,
  );
  if (!fieldRef.test(src)) return false;
  if (!/JSON\.parse\s*\(/.test(src)) return false;
  // Require a map of the parsed rows (anchors / links)
  if (!/\.map\s*\(/.test(src)) return false;
  return true;
}

/**
 * Dual-mode link-list bag CONTRACT:
 * - Flag on: forbid Multi-LineText link-shaped JSON bags (require PH + link-item children).
 * - Flag off: bags allowed; require JSON.parse + map so seeded links still paint.
 *
 * @param {{
 *   definitionTs?: string|null,
 *   tsx?: string|null,
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined> | null,
 * }} opts
 * @returns {string[]}
 */
export function collectLinkListJsonBagContractDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  const tsx = String(opts.tsx || '');
  if (!def.trim()) return [];
  const bags = findLinkShapedJsonBagFields(def);
  if (!bags.length) return [];

  const composite = isLinkListAsCompositeEnabled(opts.env ?? process.env);
  /** @type {string[]} */
  const out = [];

  if (composite) {
    out.push(
      `CONTRACT: BQ_LINK_LIST_AS_COMPOSITE=1 forbids Multi-Line Text JSON { text, url }[] bags for repeating links (${bags.join(', ')}) — model parent Title/Heading + AppPlaceholder + …-link-item children with General Link fields instead`,
    );
    return out;
  }

  // Flag off: bag is the default model — require paint via JSON.parse + map.
  if (!tsx.trim()) return out;
  const unpainted = bags.filter((name) => !tsxPaintsJsonBagField(tsx, name));
  if (unpainted.length) {
    out.push(
      `CONTRACT: Multi-Line Text JSON link bag(s) (${unpainted.join(', ')}) must be JSON.parse'd and mapped in TSX so repeating links paint — do not leave Heading/Title-only shells when a link bag is seeded`,
    );
  }
  return out;
}

/**
 * Platform Link/Icon/Image Link Lists parents may only use Title (+ list children).
 * @param {{ definitionTs?: string|null, tsx?: string|null, definitionKey?: string, componentName?: string|null }} opts
 * @returns {string[]}
 */
export function collectPlatformListFolderHygieneDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  if (!def.trim() || !PLATFORM_LIST_FOLDERS_RE.test(def)) return [];
  // Composite link-list mode: parent may use placeholders + child packages even
  // if AI still mentioned a platform folder string — skip Title-only hygiene.
  if (
    isLinkListAsCompositeEnabled() &&
    /placeholders\s*:\s*\[[\s\S]*allowedControls\s*:/.test(def)
  ) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  // Collect itemTemplate field names only (objects with name + type — not section names).
  const itemTpl = /itemTemplate\s*:\s*\{([\s\S]*?)(?:childItemTemplate\s*:|$)/.exec(
    def,
  );
  const fieldBlock = itemTpl ? itemTpl[1] : def;
  const fieldNames = [
    ...fieldBlock.matchAll(
      /\{\s*name:\s*["']([^"']+)["']\s*,\s*type:\s*["'][^"']+["']/g,
    ),
  ].map((m) => m[1]);
  const extra = fieldNames.filter(
    (n) => !/^(title)$/i.test(String(n || '').trim()),
  );
  if (extra.length) {
    out.push(
      `CONTRACT: platform list folder (Link/Icon/Image Link Lists) parent may only declare Title — forbid extra parent fields (${extra.join(', ')}); put chrome (Logo/Heading/CTA) on a custom template or parent composite and keep the list package Title-only`,
    );
  }
  const tsx = String(opts.tsx || '');
  if (
    tsx &&
    /\b(fields\.(Logo|Heading|Description|Image|CTA)|fields\[["'](Logo|Heading|Description|Image|CTA))/i.test(
      tsx,
    )
  ) {
    out.push(
      'CONTRACT: platform list-folder TSX must not read parent Logo/Heading/Description/Image/CTA — those fields are not on the shared list template / ComponentQuery',
    );
  }
  return out;
}

/**
 * Image/Icon Link List social strips must stay visible when children.results is empty.
 * @param {{ definitionTs?: string|null, tsx?: string|null, definitionKey?: string, componentName?: string|null, sectionInfo?: object|null }} opts
 * @returns {string[]}
 */
export function collectSocialLinkListFallbackDiagnostics(opts = {}) {
  const def = String(opts.definitionTs || '');
  const key = String(
    opts.definitionKey || opts.componentName || opts.sectionInfo?.cmsName || '',
  );
  const isListFolder =
    /Icon Link Lists|Image Link Lists/i.test(def) ||
    /folder\s*:\s*\[[^\]]*(?:Icon Link Lists|Image Link Lists)/i.test(def);
  const isSocial =
    /branding-social|footer-social|social-links|sociallinks/i.test(key) ||
    (/social/i.test(key) && /footer|branding/i.test(key));
  if (!isListFolder || !isSocial) return [];
  const tsx = String(opts.tsx || '');
  if (!tsx.trim()) return [];
  const hasEmptyBranch =
    /!?(?:results|children)\.length|results\?\.length\s*===\s*0|!\s*results\.length|FooterSocialIconFallback|FooterSocialFallback|empty.?results/i.test(
      tsx,
    );
  if (!hasEmptyBranch) {
    return [
      'CONTRACT: Image/Icon Link List social TSX must render icons when children.results is empty (FooterSocialIconFallback / DomSecurity empty-results pattern) — never leave the social band blank when content seeds exist',
    ];
  }
  if (
    /if\s*\(\s*!linkField\s*\|\|\s*!imageField\s*\)\s*return\s+null/i.test(tsx)
  ) {
    return [
      'CONTRACT: social Image Link List rows must not require both link AND image to paint — if Image src is missing, still show FaIcon (or seed img URL)',
    ];
  }
  return [];
}

/**
 * True when a repeat row value carries a non-null Image-shaped URL.
 * @param {object|null|undefined} row
 */
function repeatRowHasImageUrl(row) {
  if (!row || typeof row !== 'object') return false;
  const img = row.image ?? row.Image;
  if (img == null) return false;
  if (typeof img === 'string') return /^https?:\/\//i.test(img.trim());
  if (typeof img === 'object') {
    const src = String(img.src || img.url || '').trim();
    return /^https?:\/\//i.test(src);
  }
  return (
    typeof row.url === 'string' &&
    /^https?:\/\//i.test(row.url) &&
    (row.alt != null || row.Alt != null)
  );
}

/**
 * True when a section-info repeat describes image/logo/badge rows (Sitecore Image
 * {url,alt} seeds) — not FaIcon / icon-font text rows, toggles, or CTAs.
 * @param {object|null|undefined} repeat
 */
export function isImageRowRepeat(repeat) {
  if (!repeat || typeof repeat !== 'object') return false;
  const name = String(repeat.name || repeat.itemName || repeat.whatRepeats || '');
  if (/\b(logo|badge|award|partner|image|thumbnail|mark|carousel|rail)\b/i.test(name)) {
    return true;
  }
  const fields = Array.isArray(repeat.fields) ? repeat.fields : [];
  // Field names/types: Image media only — bare `icon` is FaIcon, not {url,alt}.
  if (
    fields.some((f) => {
      const n = String(f?.name || '');
      const t = String(f?.type || '');
      return (
        /\b(image|logo|src|thumbnail)\b/i.test(n) ||
        /\bimage\b/i.test(t)
      );
    })
  ) {
    return true;
  }
  const values = Array.isArray(repeat.value) ? repeat.value : [];
  return values.some((v) => repeatRowHasImageUrl(v));
}

/**
 * Max Image-row seed count from section repeats.
 * Prefer repeats with type:image fields or real image URLs in value[] so
 * icon-only / empty-image bands cannot inflate CONTRACT need.
 * @param {unknown} repeats
 * @returns {number}
 */
export function resolveImageRowSeedNeed(repeats) {
  const list = Array.isArray(repeats) ? repeats : [];
  const imageRows = list.filter((r) => isImageRowRepeat(r));
  const evidenced = imageRows.filter((r) => {
    const fields = Array.isArray(r?.fields) ? r.fields : [];
    const hasImageType = fields.some((f) => /\bimage\b/i.test(String(f?.type || '')));
    const values = Array.isArray(r?.value) ? r.value : [];
    const hasImageUrl = values.some((v) => repeatRowHasImageUrl(v));
    return hasImageType || hasImageUrl;
  });
  const pool = evidenced.length ? evidenced : imageRows;
  const expected = Math.max(0, ...pool.map((r) => Number(r?.count) || 0));
  if (expected > 1) return expected;
  // Fall back to max repeat count only when no image-shaped repeat metadata
  return Math.max(0, ...list.map((r) => Number(r?.count) || 0));
}

/** Image-like path extensions for absolute URL detection. */
const IMAGE_URL_EXT_RE =
  /\.(?:svg|png|jpe?g|webp|gif|avif|bmp|ico)(?:\?|#|$)/i;

/**
 * Collect absolute http(s) image URLs hardcoded in runtime tsx/clientTsx.
 * Definition seeds are out of scope (they are ingest sources for apply).
 * Carve-out: sc-cta-after-arrow utility pattern.
 *
 * @param {{ tsx?: string, clientTsx?: string|null }} [opts]
 * @returns {string[]}
 */
export function collectHardcodedCaptureImageUrlDiagnostics(opts = {}) {
  const blobs = [
    { label: 'tsx', text: String(opts.tsx || '') },
    { label: 'clientTsx', text: String(opts.clientTsx || '') },
  ].filter((b) => b.text.trim());

  /** @type {string[]} */
  const offenders = [];
  const seen = new Set();

  /**
   * @param {string} raw
   * @param {string} label
   */
  const consider = (raw, label) => {
    const url = String(raw || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    // Shared CTA utility — not a capture asset.
    if (/sc-cta-after-arrow|cta-arrow\.svg/i.test(url)) return;
    // Non-image absolute links (pages, APIs) — only flag image-like URLs or CSS image contexts.
    const key = `${label}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    offenders.push(url);
  };

  for (const { label, text } of blobs) {
    if (/\bsc-cta-after-arrow\b/.test(text) && !/maskImage|mask-image|bg-\[url\(https/i.test(text)) {
      // Pure utility usage with no other absolute image URLs still scanned below.
    }

    // <img src="https://…"> / src={'https://…'} / src={"https://…"}
    for (const m of text.matchAll(
      /\bsrc\s*=\s*(?:\{\s*)?(['"`])(https?:\/\/[^'"`]+)\1/gi,
    )) {
      const url = m[2];
      if (IMAGE_URL_EXT_RE.test(url) || /\/media\/|\/images?\//i.test(url)) {
        consider(url, label);
      }
    }

    // CSS url(https://…) including mask-image / background-image / style objects
    for (const m of text.matchAll(
      /url\(\s*(['"`]?)(https?:\/\/[^)'"`\s]+)\1\s*\)/gi,
    )) {
      const url = m[2];
      if (
        IMAGE_URL_EXT_RE.test(url) ||
        /maskImage|WebkitMaskImage|mask-image|background-image|bg-\[url/i.test(
          text.slice(Math.max(0, m.index - 80), m.index + m[0].length),
        )
      ) {
        consider(url, label);
      }
    }

    // Tailwind arbitrary bg-[url(https://…)] / [mask-image:url(https://…)]
    for (const m of text.matchAll(
      /(?:bg-\[url\(|\[(?:-webkit-)?mask-image:url\()(['"`]?)(https?:\/\/[^)'"`\]]+)\1\)/gi,
    )) {
      consider(m[2], label);
    }

    // maskImage: 'url(https://…)' or "url(https://…)" already covered by url() scan;
    // also catch maskImage: `https://…` without url() wrapper
    for (const m of text.matchAll(
      /(?:maskImage|WebkitMaskImage)\s*:\s*(['"`])(https?:\/\/[^'"`]+)\1/gi,
    )) {
      consider(m[2], label);
    }
  }

  if (!offenders.length) return [];
  const listed = offenders.slice(0, 8).join(', ');
  const more =
    offenders.length > 8 ? ` (+${offenders.length - 8} more)` : '';
  return [
    `CONTRACT: hardcoded capture/CDN image URL(s) in tsx/clientTsx must be Sitecore Image fields — add Image field(s) + { url, alt } or { svgMarkup, alt } seeds and paint with <Image field={…} />; CSS mask-image with absolute/cross-origin urls CORS-blanks content — prefer svgMarkup data-URI or non-mask shapes. Remove absolute http(s) image URLs from runtime source. Offending: ${listed}${more}`,
  ];
}

/**
 * Spaced Fields keys still accessed as camelCase fields.FooBar.
 * @param {string} source
 * @returns {string[]}
 */
export function collectSpacedFieldAccessContractDiagnostics(source) {
  const text = String(source || '');
  if (!text.trim()) return [];
  const fieldsMatch = text.match(/\b(?:interface|type)\s+Fields\s*=?\s*\{([\s\S]*?)\n\}/);
  if (!fieldsMatch) return [];
  const body = fieldsMatch[1] || '';
  /** @type {string[]} */
  const spaced = [];
  const keyRe = /["']([^"']*\s[^"']*)["']\s*:/g;
  let km;
  while ((km = keyRe.exec(body))) spaced.push(km[1]);
  /** @type {string[]} */
  const offenders = [];
  for (const key of spaced) {
    const pascal = key.replace(/\s+/g, '');
    if (!pascal || pascal === key) continue;
    const re = new RegExp(`\\b(?:props\\.)?fields\\.${pascal}\\b`);
    if (re.test(text)) offenders.push(`${pascal}→["${key}"]`);
  }
  if (!offenders.length) return [];
  return [
    `CONTRACT: spaced Fields keys must use fields["…"] access — still camelCase: ${offenders.slice(0, 6).join(', ')}`,
  ];
}

/**
 * Peer columnsMax without lg:grid-cols-N on AppPlaceholder track.
 * @param {object} opts
 * @returns {string[]}
 */
export function collectPeerGridContractDiagnostics(opts = {}) {
  const text = `${opts.tsx || ''}\n${opts.clientTsx || ''}`;
  if (!/\bAppPlaceholder\b/.test(text)) return [];
  const n = resolvePeerColumnsMaxFromOpts(opts.sectionInfo);
  if (n < 2) return [];
  if (
    new RegExp(`\\blg:grid-cols-${n}\\b`).test(text) ||
    new RegExp(`\\bgrid-cols-${n}\\b`).test(text)
  ) {
    return [];
  }
  return [
    `CONTRACT: peer columnsMax/cardCount=${n} requires AppPlaceholder track with lg:grid-cols-${n} (grid grid-cols-1 gap-* lg:grid-cols-${n}) — not N stacked full-width sections`,
  ];
}

/**
 * @param {object|null|undefined} sectionInfo
 * @returns {number}
 */
function resolvePeerColumnsMaxFromOpts(sectionInfo) {
  const info = sectionInfo && typeof sectionInfo === 'object' ? sectionInfo : {};
  const layout = info.layout && typeof info.layout === 'object' ? info.layout : {};
  const analysis = info.htmlLayout || info.layoutAnalysis || {};
  const desktop = analysis.desktop || {};
  for (const c of [
    layout.columnsMax,
    desktop.columnsMax,
    analysis.columnsMax,
    info.columnsMax,
  ]) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 2 && n <= 6) return Math.trunc(n);
  }
  const cards = Number(layout.cardCount ?? analysis.cardCount ?? 0);
  if (Number.isFinite(cards) && cards >= 2 && cards <= 6) return Math.trunc(cards);
  return 0;
}

/**
 * Link wrapping Image without a LinkField (or still using CardLink camelCase).
 * @param {string} source
 * @returns {string[]}
 */
export function collectImageInLinkContractDiagnostics(source) {
  const text = String(source || '');
  if (!text.trim()) return [];
  /** @type {string[]} */
  const out = [];
  if (/\bfields\.CardLink\b/.test(text)) {
    out.push(
      'CONTRACT: use fields["Card Link"] (spaced Sitecore name) — not fields.CardLink',
    );
  }
  if (
    /<Link\s+field=\{(?:props\.)?fields(?:\[["'][^"']*Image[^"']*["']\]|\.Image)\s*\}[\s\S]{0,400}<Image\b/i.test(
      text,
    )
  ) {
    out.push(
      'CONTRACT: do not wrap <Image> in <Link field={ImageField}> — use a General Link field (Card Link / CTA) or unwrap',
    );
  }
  return out;
}

/**
 * <picture> + <source srcSet={raw ident/url}> without multi-<Image> salvage.
 * @param {string} source
 * @returns {string[]}
 */
export function collectPictureSrcSetContractDiagnostics(source) {
  const text = String(source || '');
  if (!text.trim() || !/<picture\b/i.test(text)) return [];
  if (!/<source\b[^>]*\bsrcSet=\{/i.test(text)) return [];
  // Multi-Image inside picture (Crelan-style) is OK even with a picture wrapper.
  const picBodies = [...text.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi)];
  for (const m of picBodies) {
    const body = m[1] || '';
    if (!/<source\b[^>]*\bsrcSet=\{/i.test(body)) continue;
    const imageCount = (body.match(/<Image\b/g) || []).length;
    if (imageCount >= 2) continue;
    return [
      'CONTRACT: prefer Content SDK <Image field={…}> over <picture><source srcSet={…}> — use multiple Image fields + CSS show/hide for art-direction; do not mount raw URL srcSet',
    ];
  }
  return [];
}

/**
 * CSS mask-image with absolute http(s) (CORS blanks masked content).
 * @param {string} source
 * @returns {string[]}
 */
export function collectCrossOriginMaskContractDiagnostics(source) {
  const text = String(source || '');
  if (!text.trim()) return [];
  if (
    /(?:maskImage|WebkitMaskImage)\s*:\s*[^,}\n]*url\(\s*(['"`]?)https?:\/\//i.test(
      text,
    ) ||
    /\[(?:-webkit-)?mask-image:url\(['"]?https?:\/\//i.test(text)
  ) {
    return [
      'CONTRACT: CSS mask-image with absolute http(s) CORS-blanks content — use definition svgMarkup data-URI, clip-path/radius, or background-image for decorative chrome (not cross-origin mask-image)',
    ];
  }
  return [];
}

/**
 * Count Image-shaped content seeds (`url` + `alt` in the same object).
 * Does not count General Link seeds (`text` + `url`).
 * @param {string} definitionTs
 */
export function countImageUrlAltSeeds(definitionTs) {
  const def = String(definitionTs || '');
  if (!def.trim()) return 0;
  let count = 0;
  // Balanced-enough object scan: { … url: "https…" … alt: "…" … } (either order)
  for (const m of def.matchAll(/\{[^{}]{0,800}\}/g)) {
    const block = m[0];
    const hasUrl = /\burl\s*:\s*["']https?:\/\//i.test(block);
    const hasAlt = /\balt\s*:\s*["']/i.test(block);
    // Image seeds are { url, alt }; General Link seeds are { text, url } without alt
    if (hasUrl && hasAlt) count += 1;
  }
  return count;
}
