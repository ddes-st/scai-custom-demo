/**
 * Structural safety nets for composites/carousels/headers.
 * Prompt-first: these only rewrite when the model still violates HARD contracts.
 */
import {
  distinctCompositeChildPascal,
  toDefinitionKey,
  toPascalCase,
} from './naming.mjs';
import { replacePlaceholdersArray } from './sync-definition-from-tsx.mjs';

import { noteFixup } from './create-log.mjs';

function fixupWarn(message) {
  noteFixup(process.env.BQ_CREATE_SECTION || '_run', String(message ?? ''));
}

const PLATFORM_LINK_LIST_FOLDER_RE =
  /folder\s*:\s*\[[^\]]*["'](?:Link Lists|Icon Link Lists|Image Link Lists)["']/;

/**
 * True when definition targets a platform Link/Icon/Image Link Lists folder.
 * @param {string} source
 */
export function isPlatformLinkListDefinition(source) {
  return PLATFORM_LINK_LIST_FOLDER_RE.test(String(source || ''));
}

/**
 * Platform LinkList packages are leaves (childItemTemplate rows, not nested
 * renderings). Force `placeholders: []` when AI copied parent slots.
 * @param {string} source
 */
export function forceEmptyPlaceholdersForPlatformLinkLists(source) {
  let text = String(source || '');
  if (!isPlatformLinkListDefinition(text)) return text;
  const phMatch = text.match(/\bplaceholders\s*:\s*/);
  if (!phMatch || phMatch.index == null) return text;
  const open = text.indexOf('[', phMatch.index + phMatch[0].length - 1);
  if (open < 0) return text;
  let depth = 0;
  let close = -1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return text;
  const body = text.slice(open + 1, close).trim();
  if (!body) return text;
  const next = replacePlaceholdersArray(text, '[]');
  if (next !== text) {
    fixupWarn(
      '  ⚠ Codegen fixup: platform Link/Icon/Image Link Lists — cleared placeholders[] (lists are leaves; links are childItemTemplate rows)',
    );
  }
  return next;
}

/**
 * Collapse duplicate <AppPlaceholder name={same} /> mounts — keep the first.
 * @param {string} source
 */
export function dedupeAppPlaceholderByName(source) {
  let text = String(source || '');
  if (!/<AppPlaceholder\b/.test(text)) return text;

  const re = /<AppPlaceholder\b[\s\S]*?\/>/g;
  /** @type {Array<{ start: number, end: number, nameKey: string }>} */
  const hits = [];
  let m;
  while ((m = re.exec(text))) {
    const attrs = m[0];
    const nameMatch =
      attrs.match(/\bname=\{([^}]+)\}/) || attrs.match(/\bname=(["'])([^"']+)\1/);
    const nameKey = nameMatch
      ? String(nameMatch[1] || nameMatch[2] || '')
          .trim()
          .replace(/\s+/g, ' ')
      : '';
    hits.push({ start: m.index, end: m.index + m[0].length, nameKey });
  }

  const seen = new Set();
  let removed = 0;
  for (let i = hits.length - 1; i >= 0; i--) {
    const hit = hits[i];
    if (!hit.nameKey) continue;
    if (seen.has(hit.nameKey)) {
      // Also drop a wrapping parent div that only contains this PH when obvious
      let start = hit.start;
      let end = hit.end;
      const before = text.slice(Math.max(0, start - 120), start);
      const after = text.slice(end, end + 80);
      const openDiv = before.match(/<div\b[^>]*>\s*$/);
      const closeDiv = after.match(/^\s*<\/div>/);
      if (openDiv && closeDiv) {
        start = start - openDiv[0].length;
        end = end + closeDiv[0].length;
      }
      text = text.slice(0, start) + text.slice(end);
      removed += 1;
      continue;
    }
    seen.add(hit.nameKey);
  }

  if (removed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: removed ${removed} duplicate AppPlaceholder mount(s) (same name)`,
    );
  }
  return text;
}

/**
 * Strip decorative indigo/blue outline debug boxes from className strings.
 * @param {string} source
 */
export function stripDebugOutlineClasses(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /\boutline-2\b\s+\boutline-offset-2\b\s+\boutline-indigo-\d+\b(\s+\bfocus-within:outline\b)?/g,
    '',
  );
  text = text.replace(/\boutline-indigo-\d+\b/g, '');
  text = text.replace(/\s{2,}/g, ' ');
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped decorative outline-indigo debug classes',
    );
  }
  return text;
}

/**
 * Unwrap snap-x / overflow-x wrapper around AppPlaceholder when already inside CarouselChrome.
 * @param {string} source
 */
export function unwrapNestedTrackInsideCarouselChrome(source) {
  let text = String(source || '');
  if (!/<AppPlaceholder\b/.test(text)) return text;
  if (!/CarouselChrome|Chrome\s*>/.test(text) && !/from\s+['\"]\.\/[^'\"]+\.client['\"]/.test(text)) {
    // Still unwrap double snap wrappers generally
  }

  let unwrapped = 0;
  // <CarouselChrome> ... <div className="…snap-x|overflow-x…"> <AppPlaceholder /> </div> </CarouselChrome>
  text = text.replace(
    /(<(?:CarouselChrome|[A-Za-z]+Chrome)\b[^>]*>)\s*<div\b[^>]*\bclassName=(["'`])([^"'`]*(?:\bsnap-x\b|\boverflow-x-auto\b)[^"'`]*)\2[^>]*>\s*(<AppPlaceholder\b[\s\S]*?\/>)\s*<\/div>/g,
    (full, open, _q, _cn, ph) => {
      unwrapped += 1;
      return `${open}\n          ${ph}`;
    },
  );

  if (unwrapped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: unwrapped ${unwrapped} nested carousel track(s) inside client chrome`,
    );
  }
  return text;
}

/**
 * Ensure overflow-x / snap-x track that hosts {children} is a horizontal row.
 * @param {string} source
 */
export function ensureClientTrackHorizontalRow(source) {
  let text = String(source || '');
  if (!/\{children\}/.test(text)) return text;
  if (!/\boverflow-x-auto\b|\bsnap-x\b/.test(text)) return text;

  // Already has grid-flow-col or flex wrapping children
  if (
    /grid-flow-col[\s\S]{0,200}\{children\}/.test(text) ||
    /className=["'`][^"'`]*\bflex\b[^"'`]*["'`][\s\S]{0,80}\{children\}/.test(text)
  ) {
    return text;
  }

  const before = text;
  // Wrap {children} inside overflow-x track with a flex row
  text = text.replace(
    /(<(div|section)\b[^>]*\bclassName=(["'`])([^"'`]*(?:\boverflow-x-auto\b|\bsnap-x\b)[^"'`]*)\3[^>]*>)\s*\{children\}\s*(<\/\2>)/g,
    (full, open, _tag, _q, cn, close) => {
      if (/\bflex\b/.test(cn) || /\bgrid-flow-col\b/.test(cn)) return full;
      return `${open}\n        <div className="flex snap-x snap-mandatory items-stretch [&>*]:shrink-0 [&>*]:snap-center">\n          {children}\n        </div>\n      ${close}`;
    },
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: wrapped {children} in horizontal flex track inside overflow-x container',
    );
  }
  return text;
}

/**
 * If hamburger-like button exists without data-mobile-menu-toggle, inject attrs.
 * @param {string} source
 */
export function ensureMobileNavToggleAttrs(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (/\bdata-mobile-menu-toggle\b/.test(text)) return text;

  const looksLikeHamburger =
    /lg:hidden[\s\S]{0,200}h-0\.5[\s\S]{0,80}h-0\.5[\s\S]{0,80}h-0\.5/.test(text) ||
    (/Mobile Menu Label/.test(text) && /lg:hidden/.test(text) && /<button\b/.test(text));

  if (!looksLikeHamburger) return text;

  // Add data-mobile-menu-toggle + aria-expanded to first lg:hidden button near hamburger bars
  const before = text;
  text = text.replace(
    /(<button\b)([^>]*\blg:hidden\b[^>]*)(>)/,
    (full, open, attrs, close) => {
      if (/\bdata-mobile-menu-toggle\b/.test(attrs)) return full;
      let next = attrs;
      if (!/\baria-expanded\b/.test(next)) next += ' aria-expanded="false"';
      next += ' data-mobile-menu-toggle';
      return `${open}${next}${close}`;
    },
  );

  // Ensure a nav/menu container has data-mobile-menu
  if (!/\bdata-mobile-menu\b/.test(text)) {
    text = text.replace(
      /(<nav\b)([^>]*)(>)/,
      (full, open, attrs, close) => {
        if (/\bdata-mobile-menu\b/.test(attrs)) return full;
        return `${open}${attrs} data-mobile-menu${close}`;
      },
    );
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: injected data-mobile-menu-toggle / data-mobile-menu for hamburger',
    );
  }
  return text;
}

/**
 * Forbid allowedControls including own definitionKey.
 * Prefer an explicit child key from the plan; else derive via distinctCompositeChildPascal.
 * Platform Link Lists → clear placeholders to []. Never invent `${self}-item`.
 *
 * @param {string} source
 * @param {{ preferredChildDefinitionKey?: string }} [options]
 */
export function forbidSelfNestedAllowedControls(source, options = {}) {
  let text = String(source || '');
  const keyMatch = text.match(/\bdefinitionKey:\s*["']([^"']+)["']/);
  if (!keyMatch) return text;
  const selfKey = keyMatch[1];
  const selfInAllowed = new RegExp(
    `allowedControls\\s*:\\s*\\[[^\\]]*["']${selfKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
  ).test(text);
  if (!selfInAllowed) return text;

  // LinkList / platform list folders are leaves — clear, never invent a child rendering.
  if (isPlatformLinkListDefinition(text)) {
    const next = replacePlaceholdersArray(text, '[]');
    if (next !== text) {
      fixupWarn(
        `  ⚠ Codegen fixup: allowedControls self-reference "${selfKey}" on platform Link List — cleared placeholders[]`,
      );
    }
    return next;
  }

  const preferred = String(options.preferredChildDefinitionKey || '').trim();
  let childKey =
    preferred && preferred !== selfKey ? preferred : '';
  if (!childKey) {
    childKey = toDefinitionKey(
      distinctCompositeChildPascal(toPascalCase(selfKey), selfKey),
    );
  }
  // Last resort used to invent `${selfKey}-item` — that is almost always a
  // parent-slot copy onto a leaf. Clear placeholders instead.
  if (!childKey || childKey === selfKey) {
    const next = replacePlaceholdersArray(text, '[]');
    if (next !== text) {
      fixupWarn(
        `  ⚠ Codegen fixup: allowedControls self-reference "${selfKey}" — cleared placeholders[] (no distinct child key)`,
      );
    }
    return next;
  }

  const re = new RegExp(
    `(allowedControls\\s*:\\s*\\[[^\\]]*["'])${selfKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`,
    'g',
  );
  const before = text;
  text = text.replace(re, `$1${childKey}$2`);
  if (text !== before) {
    fixupWarn(
      `  ⚠ Codegen fixup last-resort: allowedControls self-reference "${selfKey}" → "${childKey}"`,
    );
  }
  return text;
}

/**
 * Strengthen parent-copy seed rewrite: Title/displayName/Description matching parent phrase.
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} [info]
 */
export function rewriteParentCopiedChildSeeds(source, info) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const phrases = new Set();
  const fromInfo = String(/** @type {{ heading?: unknown }} */ (info || {}).heading || '').trim();
  if (fromInfo) phrases.add(fromInfo);

  for (const field of ['Heading', 'Headline', 'Eyebrow', 'Description']) {
    const m = text.match(
      new RegExp(`\\b${field}\\s*:\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`),
    );
    if (m?.[2]) phrases.add(m[2].replace(/<[^>]+>/g, '').trim());
  }

  // Also detect when ≥2 items share identical Title
  const titleCounts = new Map();
  for (const m of text.matchAll(/\bTitle\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const v = m[2];
    titleCounts.set(v, (titleCounts.get(v) || 0) + 1);
  }
  for (const [v, n] of titleCounts) {
    if (n >= 2 && v.length > 3) phrases.add(v);
  }

  let changed = 0;
  for (const phrase of phrases) {
    if (!phrase || phrase.length < 4) continue;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // name + displayName + Title all matching phrase → Title/displayName = name
    const re = new RegExp(
      `(name:\\s*)(["'])([^"']+)\\2(\\s*,\\s*displayName:\\s*)(["'])${escaped}\\5([\\s\\S]*?\\bTitle:\\s*)(["'])${escaped}\\7`,
      'g',
    );
    const next = text.replace(re, '$1$2$3$2$4$5$3$5$6$7$3$7');
    if (next !== text) {
      text = next;
      changed += 1;
    }

    // Title alone matching phrase when name exists nearby in item
    const reTitle = new RegExp(
      `(name:\\s*)(["'])([^"']+)\\2([\\s\\S]{0,400}?\\bTitle:\\s*)(["'])${escaped}\\5`,
      'g',
    );
    const next2 = text.replace(reTitle, '$1$2$3$2$4$5$3$5');
    if (next2 !== text) {
      text = next2;
      changed += 1;
    }
  }

  if (changed > 0) {
    fixupWarn(
      '  ⚠ Codegen fixup: rewrote child Title/displayName that matched parent/shared section copy → item name',
    );
  }
  return text;
}

/**
 * Ensure client chrome toggles `data-mobile-menu` when `data-mobile-menu-toggle` is present.
 * Injects a minimal useEffect click handler if missing.
 * @param {string} source
 */
export function ensureMobileNavToggleClickHandler(source) {
  let text = String(source || '');
  if (!/\bdata-mobile-menu-toggle\b/.test(text) && !/mobile-menu-toggle/.test(text)) {
    // May only appear in server TSX; client often queries by attribute string
  }
  const queriesToggle =
    /data-mobile-menu-toggle/.test(text) ||
    /\[data-mobile-menu-toggle\]/.test(text);
  const hasClickLogic =
    /aria-expanded/.test(text) &&
    (/addEventListener\(\s*['"]click['"]/.test(text) ||
      /onClick\s*=/.test(text) ||
      /\.classList\.(toggle|remove|add)/.test(text) ||
      /setAttribute\(\s*['"]aria-expanded['"]/.test(text));

  if (!queriesToggle) return text;
  if (hasClickLogic) return text;

  // Inject a small effect after the component function opens
  const inject = `
  React.useEffect(() => {
    const root = document;
    const toggle = root.querySelector('[data-mobile-menu-toggle]');
    const menu = root.querySelector('[data-mobile-menu]');
    if (!toggle || !menu) return;
    const onClick = () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      menu.classList.toggle('hidden', open);
      menu.classList.toggle('max-lg:hidden', open);
    };
    toggle.addEventListener('click', onClick);
    return () => toggle.removeEventListener('click', onClick);
  }, []);
`;

  if (/\buseEffect\s*\(/.test(text) && /data-mobile-menu/.test(text)) {
    // Has some effect already touching menu — leave it
    return text;
  }

  // Prefer named import useEffect
  if (!/\buseEffect\b/.test(text)) {
    if (/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/.test(text)) {
      text = text.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]react['"]/,
        (full, names) => {
          if (/\buseEffect\b/.test(names)) return full;
          return `import { ${names.trim().replace(/,$/, '')}, useEffect } from 'react'`;
        },
      );
    } else if (!/from\s*['"]react['"]/.test(text)) {
      text = text.replace(
        /^(['"]use client['"];?\s*\n)/,
        `$1import { useEffect } from 'react';\n`,
      );
    }
  }

  const effectBody = inject.replace(/React\.useEffect/g, 'useEffect');
  const fnMatch = text.match(
    /((?:export\s+default\s+)?function\s+\w+\s*\([^)]*\)\s*\{|(?:export\s+default\s+)?(?:const|function)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)/,
  );
  if (fnMatch && fnMatch.index != null) {
    const insertAt = fnMatch.index + fnMatch[0].length;
    text = text.slice(0, insertAt) + effectBody + text.slice(insertAt);
    fixupWarn(
      '  ⚠ Codegen fixup: injected mobile menu click toggle handler in client chrome',
    );
  }
  return text;
}

/**
 * Carousel client chrome when AI omitted clientTsx or emitted wrong control mode.
 * @param {string} componentName
 * @param {'arrows'|'dots'|'auto'} chromeMode
 * @param {{ continuousMarquee?: boolean, bandTicker?: boolean }} [options]
 */
export function buildCarouselChromeStub(componentName, chromeMode, options = {}) {
  const name =
    String(componentName || 'Component').replace(/[^A-Za-z0-9]/g, '') || 'Component';
  const mode = String(chromeMode || 'arrows').toLowerCase();
  if (mode === 'auto') {
    if (options.continuousMarquee) {
      const band = options.bandTicker === true;
      const variant = band ? 'band' : 'rail';
      const aria = band ? 'Announcements' : 'Logo carousel';
      return `'use client';

import type { ReactNode } from 'react';
import { ContinuousMarquee } from 'components/primitives/continuous-marquee';

type ${name}ChromeProps = { children?: ReactNode };

export default function ${name}Chrome({ children }: ${name}ChromeProps) {
  return (
    <ContinuousMarquee variant="${variant}" ariaLabel="${aria}">
      {children}
    </ContinuousMarquee>
  );
}
`;
    }
    return `'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type ${name}ChromeProps = { children?: ReactNode };

export default function ${name}Chrome({ children }: ${name}ChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;
    const track = trackRef.current;
    if (!track) return;
    const id = window.setInterval(() => {
      const first = track.firstElementChild as HTMLElement | null;
      const distance = first
        ? first.getBoundingClientRect().width + 16
        : track.clientWidth;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      track.scrollTo({
        left: atEnd ? 0 : track.scrollLeft + distance,
        behavior: 'smooth',
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      ref={trackRef}
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center"
    >
      {children}
    </div>
  );
}
`;
  }

  // arrows (default) and dots — scrollBy prev/next; dots mode still needs arrows for navigation
  return `'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';

type ${name}ChromeProps = {
  children?: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
};

export default function ${name}Chrome({
  children,
  previousLabel = 'Previous slide',
  nextLabel = 'Next slide',
}: ${name}ChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const distance = first
      ? first.getBoundingClientRect().width + 16
      : track.clientWidth;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={previousLabel}
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-xl leading-none shadow-md"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-xl leading-none shadow-md"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
`;
}

/**
 * Whether client chrome source matches the inferred carousel chrome mode.
 * @param {string} clientSource
 * @param {'arrows'|'dots'|'auto'|'none'} chromeMode
 */
export function clientMatchesCarouselChromeMode(clientSource, chromeMode) {
  const src = String(clientSource || '');
  if (!src.trim()) return false;
  const mode = String(chromeMode || '').toLowerCase();
  if (mode === 'none') return true;
  if (mode === 'auto') {
    return (
      (/ContinuousMarquee|continuous-marquee|requestAnimationFrame|setInterval|animate-\[|marquee|autoplay/i.test(
        src,
      ) ||
        /from ['"]components\/primitives\/continuous-marquee['"]/.test(src)) &&
      !/aria-label=["']Previous/i.test(src)
    );
  }
  // arrows / dots need scrollBy handlers (literal aria-label or previousLabel default)
  return (
    /scrollBy|scrollTo/.test(src) &&
    (/aria-label=["'][^"']*(Previous|Next)/i.test(src) ||
      /previousLabel\s*=\s*['"]Previous/i.test(src))
  );
}

/**
 * Minimal HeaderChrome stub when hamburger exists but clientTsx was omitted.
 * @param {string} componentName
 */
export function buildMobileNavChromeStub(componentName) {
  const name = String(componentName || 'Component').replace(/[^A-Za-z0-9]/g, '') || 'Component';
  return `'use client';

import { useEffect } from 'react';

type ${name}ChromeProps = {
  children?: React.ReactNode;
};

export default function ${name}Chrome({ children }: ${name}ChromeProps) {
  useEffect(() => {
    const root = document;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const toggle = target?.closest?.('[data-mobile-menu-toggle]') as HTMLElement | null;
      if (!toggle) return;
      const scope = toggle.closest('[data-component]') || toggle.parentElement || document;
      const menu = scope.querySelector('[data-mobile-menu]') as HTMLElement | null;
      if (!menu) return;
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      menu.classList.toggle('max-lg:hidden', open);
      menu.classList.toggle('hidden', open);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return <>{children}</>;
}
`;
}

/**
 * Spaced Title Case for PascalCase compound field names in definitions (IntroHeadline → Intro Headline).
 * @param {string} source
 */
export function ensureSpacedFieldNamesInDefinition(source) {
  let text = String(source || '');
  if (!/\bname:\s*"/.test(text)) return text;

  const before = text;
  // Model field names: { name: "IntroHeadline", type:
  text = text.replace(
    /(\{\s*name:\s*")([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]+)+)("\s*,\s*type:)/g,
    (full, a, name, c) => {
      const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
      if (spaced === name) return full;
      return `${a}${spaced}${c}`;
    },
  );
  // Content seed keys: IntroHeadline: " → "Intro Headline":
  text = text.replace(
    /(?<=\n\s*)([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]+)+)(\s*:)/g,
    (full, name, colon) => {
      // Skip known PascalCase identifiers that are not fields
      if (
        /^(ComponentTemplateDefinition|Single|RichText|General|Image|Checkbox)$/.test(
          name,
        )
      ) {
        return full;
      }
      const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
      if (spaced === name) return full;
      return `"${spaced}"${colon}`;
    },
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: normalized PascalCase field names to spaced Title Case',
    );
  }
  return text;
}
