/**
 * HybridSections hybrid CMS-section discovery:
 *  1) Semantic / structural landmarks (section, header, footer, layout children)
 *  2) OpenCV visual bands as a second opinion
 *  3) Reconcile into the best keep-set for any site shape
 *
 * Host selection order (generic, site-agnostic):
 *  - Classic CMS: #content → #main-content → <main>
 *  - Landmark sibling stack (body > section* etc., e.g. Dom Security)
 *  - SPA deepen: tallest app root → deepest dense chapter parent
 */

/**
 * Discover CMS-like page chapters from the live DOM.
 * Prefers landmark tags under layout hosts (#content / main / #Page / footer),
 * and falls back to substantial layout children when sites use div-based slices (Renault).
 *
 * @param {import('playwright').Page} page
 */
export async function discoverSemanticCmsSectionsInPage(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth || 1440;
    const pageH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);

    const buildSelector = (root) => {
      if (root.id && !/^[0-9]/.test(root.id)) return `#${CSS.escape(root.id)}`;
      const parts = [];
      let n = root;
      while (n && n.nodeType === 1 && parts.length < 8) {
        if (n.id && !/^[0-9]/.test(n.id) && n !== root) {
          parts.unshift(`#${CSS.escape(n.id)}`);
          break;
        }
        let part = n.tagName.toLowerCase();
        const parent = n.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((c) => c.tagName === n.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(n) + 1})`;
        }
        parts.unshift(part);
        n = n.parentElement;
        if (n === document.body) {
          parts.unshift('body');
          break;
        }
      }
      return parts.join(' > ');
    };

    const isShell = (node) => {
      if (!node || !(node instanceof Element)) return true;
      const id = (node.id || '').toLowerCase();
      const tag = node.tagName;
      if (tag === 'HTML' || tag === 'BODY' || tag === 'MAIN') return true;
      if (id === 'app' || id === 'page' || id === 'content' || id === '__next' || id === 'root') return true;
      const rect = node.getBoundingClientRect();
      if (tag === 'DIV' && !id && rect.height >= pageH * 0.82 && rect.width >= vw * 0.85) {
        let substantial = 0;
        for (const child of node.children || []) {
          if (child instanceof Element && child.getBoundingClientRect().height >= 64) substantial += 1;
          if (substantial >= 2) return true;
        }
      }
      return false;
    };

    const isLandmark = (el) => {
      const tag = el.tagName;
      if (tag === 'SECTION' || tag === 'HEADER' || tag === 'FOOTER') return true;
      const role = (el.getAttribute('role') || '').toLowerCase();
      return role === 'region' || role === 'banner' || role === 'contentinfo';
    };

    const describe = (el, kind) => {
      const rect = el.getBoundingClientRect();
      const top = Math.round(rect.top + window.scrollY);
      const height = Math.round(rect.height);
      const cls = String(el.className || '');
      const heading =
        el.querySelector?.('h1, h2, h3, [class*="eyebrow" i], small')?.textContent
          ?.trim()
          ?.replace(/\s+/g, ' ')
          .slice(0, 80) || '';
      const html = (el.innerHTML || '').slice(0, 1200).toLowerCase();
      const hints = [];
      if (el.tagName === 'HEADER' || /header|mainheader|menu/i.test(cls)) hints.push('header');
      if (el.tagName === 'FOOTER' || /footer/i.test(cls) || kind === 'footer-child') hints.push('footer');
      if (/carousel|slider|swiper/i.test(cls + html)) hints.push('carousel');
      if (/hero/i.test(cls)) hints.push('hero');
      if (/newsletter|subscribe/i.test(cls + html)) hints.push('newsletter');
      if (/accordion|accordeon/i.test(cls + html)) hints.push('accordion');
      if (/promo|offer|actionbanner/i.test(cls)) hints.push('promo');
      if (/cta|quicklink|shortcut/i.test(cls)) hints.push('cta');
      if (el.querySelectorAll?.('img, picture').length >= 3 || /cards|grid|teaser/i.test(cls)) hints.push('cards');
      if (el.querySelector?.('video')) hints.push('media');
      if (el.querySelector?.('nav') || el.tagName === 'NAV') hints.push('nav');
      if (isLandmark(el)) hints.push('landmark');

      const landmark = isLandmark(el);
      let score = 20;
      if (landmark) score += 35;
      if (heading) score += 15;
      if (kind === 'layout-child' || kind === 'footer-child') score += 25;
      if (rect.width >= vw * 0.85) score += 8;
      if (height >= 120) score += 8;
      if (height >= 280) score += 6;
      // Prefer real content chapters over tiny chrome strips.
      if (height < 72) score -= 20;

      return {
        selector: buildSelector(el),
        tag: el.tagName.toLowerCase(),
        className: cls.split(/\s+/).filter(Boolean).slice(0, 4).join(' '),
        id: el.id || '',
        heading: heading || null,
        hints,
        top,
        height,
        bottom: top + height,
        width: Math.round(rect.width),
        landmark,
        kind,
        score,
        track: 'semantic',
      };
    };

    const substantialChildren = (host) => {
      const out = [];
      for (const child of host.children || []) {
        if (!(child instanceof Element) || isShell(child)) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width < vw * 0.55) continue;
        if (rect.height < 56) continue;
        const style = getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        out.push(child);
      }
      return out;
    };

    const isChromeChild = (el) => {
      const tag = el.tagName;
      if (tag === 'HEADER' || tag === 'FOOTER' || tag === 'NAV') return true;
      if (/^APP-HEADER/i.test(tag) || /^APP-FOOTER/i.test(tag) || /^APP-NAV/i.test(tag)) return true;
      const cls = String(el.className || '');
      const h = el.getBoundingClientRect().height;
      if (/header|mainheader|topbar|navbar/i.test(cls) && h < pageH * 0.22) return true;
      if (/footer|site-footer/i.test(cls) && h < pageH * 0.35) return true;
      return false;
    };

    /**
     * Walk through single-child / dominant-child SPA wrappers until we find a
     * dense chapter parent (multiple substantial siblings). Generic — works for
     * Angular app-root → router → page → content wrappers without hardcoding.
     */
    const findDeepestDenseHost = (start) => {
      let el = start;
      for (let depth = 0; depth < 10 && el; depth++) {
        const kids = substantialChildren(el);
        if (kids.length >= 3) return el;
        if (kids.length === 1) {
          el = kids[0];
          continue;
        }
        if (kids.length === 2) {
          const sorted = [...kids].sort(
            (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
          );
          const dominant = sorted[0];
          const hostH = Math.max(1, el.getBoundingClientRect().height);
          if (dominant.getBoundingClientRect().height / hostH >= 0.55) {
            el = dominant;
            continue;
          }
          return el;
        }
        return el;
      }
      return el;
    };

    /**
     * Sites like Dom Security author many full-bleed <section> siblings directly
     * under body (or a thin wrapper) with no #content / <main>. Prefer that
     * landmark stack over SPA "tallest child" deepening, which otherwise locks
     * onto one section and drops siblings ("We believe…", product bands, etc.).
     * Same pattern as discover-sections landmark-stack — site-agnostic.
     *
     * Intentionally ignores opacity / visibility:hidden: entrance animations
     * (fade-in, init-pageload) often hide sections while they still occupy a
     * full layout box. display:none is still excluded.
     */
    const findBestLandmarkStackHost = () => {
      /** @type {Map<Element, Element[]>} */
      const byParent = new Map();
      for (const el of document.querySelectorAll(
        'section, article, header, footer, [role="region"]',
      )) {
        if (!(el instanceof Element)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < vw * 0.55 || rect.height < 72) continue;
        // Skip near-full-page shells disguised as a single landmark.
        if (rect.height >= pageH * 0.75) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none') continue;
        const parent = el.parentElement;
        if (!parent || parent === document.documentElement) continue;
        if (!byParent.has(parent)) byParent.set(parent, []);
        byParent.get(parent).push(el);
      }

      let best = null;
      let bestScore = 0;
      for (const [parent, kids] of byParent) {
        const unique = [...new Set(kids)];
        if (unique.length < 3) continue;
        // Carousel / slide stacks: many identical sibling landmarks.
        const firstCls = unique[0].classList?.[0] || '';
        const sameClass =
          Boolean(firstCls) && unique.every((el) => el.classList?.[0] === firstCls);
        if (sameClass && unique.length >= 6) continue;

        const coverage =
          unique.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0) /
          Math.max(1, pageH);
        let score = unique.length * 10 + coverage * 40;
        if (parent === document.body) score += 15;
        if (
          parent.id === 'content' ||
          parent.id === 'main-content' ||
          parent.id === 'Page' ||
          parent.tagName === 'MAIN' ||
          parent.getAttribute('role') === 'main'
        ) {
          score += 12;
        }
        if (score > bestScore) {
          bestScore = score;
          best = parent;
        }
      }
      return best;
    };

    /** Layout children for a landmark-stack host (visibility/opacity-tolerant). */
    const landmarkStackChildren = (host) => {
      const out = [];
      for (const child of host.children || []) {
        if (!(child instanceof Element) || isShell(child)) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width < vw * 0.55 || rect.height < 56) continue;
        const style = getComputedStyle(child);
        if (style.display === 'none') continue;
        out.push(child);
      }
      return out;
    };

    /** @type {Element[]} */
    const hosts = [];
    /** @type {Element[]} */
    const chromeExtras = [];
    const content = document.querySelector('#content');
    const mainContent = document.querySelector('#main-content');
    const mains = [...document.querySelectorAll('main, [role="main"]')].sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    );
    const main = mains[0] || null;
    const page = document.querySelector('#Page');
    let contentHostLabel = null;
    let spaRoot = null;
    let usedLandmarkStack = false;

    // Prefer classic CMS hosts (#content / #main-content on Sitecore, main on Renault).
    if (content && substantialChildren(content).length >= 2) {
      hosts.push(content);
      contentHostLabel = '#content';
    } else if (mainContent && substantialChildren(mainContent).length >= 2) {
      hosts.push(mainContent);
      contentHostLabel = '#main-content';
    } else if (main && substantialChildren(main).length >= 2) {
      hosts.push(main);
      contentHostLabel = 'main';
    } else {
      // Landmark sibling stack before SPA deepen (body > section* sites).
      const landmarkHost = findBestLandmarkStackHost();
      const stackKids = landmarkHost ? landmarkStackChildren(landmarkHost) : [];
      if (landmarkHost && stackKids.length >= 2) {
        hosts.push(landmarkHost);
        usedLandmarkStack = true;
        contentHostLabel =
          (landmarkHost === document.body ? 'body' : buildSelector(landmarkHost)) +
          '(landmark-stack)';
        // Keep body-level chrome (header/footer) when the stack host is nested.
        if (landmarkHost !== document.body) {
          for (const child of substantialChildren(document.body)) {
            if (isChromeChild(child)) chromeExtras.push(child);
          }
        }
      } else {
        // SPA / custom-element fallback: body → app root → deepen to dense chapter parent.
        spaRoot =
          [...document.body.children].find((c) => {
            if (!(c instanceof Element)) return false;
            const r = c.getBoundingClientRect();
            return (c.tagName.includes('-') || c.id === 'root' || c.id === 'app' || c.id === '__next') &&
              r.height >= pageH * 0.45 &&
              r.width >= vw * 0.7;
          }) ||
          [...document.body.children]
            .filter((c) => c instanceof Element)
            .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0] ||
          null;

        if (spaRoot) {
          for (const child of substantialChildren(spaRoot)) {
            if (isChromeChild(child)) chromeExtras.push(child);
          }
          const contentCandidates = substantialChildren(spaRoot).filter((c) => !isChromeChild(c));
          let seed =
            contentCandidates.sort(
              (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
            )[0] || spaRoot;
          const dense = findDeepestDenseHost(seed);
          if (dense && substantialChildren(dense).length >= 2) {
            hosts.push(dense);
            contentHostLabel = buildSelector(dense);
          } else if (spaRoot) {
            hosts.push(spaRoot);
            contentHostLabel = buildSelector(spaRoot);
          }
        }
      }
    }

    const footerHosts = [
      document.querySelector('#footer-wrapper'),
      document.querySelector('footer'),
    ].filter(Boolean);

    /** @type {Map<string, object>} */
    const bySel = new Map();
    const add = (el, kind) => {
      if (!el || isShell(el)) return;
      // Allow custom-element chapters (app-home-news, etc.) — only skip true page shells.
      const item = describe(el, kind);
      // Boost web-component chapters (hyphenated tags) as structural sections.
      if (el.tagName.includes('-') && kind === 'layout-child') {
        item.score += 18;
        if (!item.hints.includes('web-component')) item.hints.push('web-component');
      }
      const prev = bySel.get(item.selector);
      if (!prev || item.score > prev.score) bySel.set(item.selector, item);
    };

    for (const host of hosts) {
      const kids = usedLandmarkStack ? landmarkStackChildren(host) : substantialChildren(host);
      for (const child of kids) add(child, 'layout-child');
    }
    for (const el of chromeExtras) {
      add(el, el.tagName === 'FOOTER' || /footer/i.test(el.tagName) ? 'footer-child' : 'layout-child');
    }

    // Page-level siblings (header / footer chrome) next to main.
    if (page && (content || main)) {
      for (const child of substantialChildren(page)) {
        if (child === main || child.contains?.(main) || child.contains?.(content)) continue;
        add(child, child.tagName === 'HEADER' ? 'layout-child' : 'footer-child');
      }
    }

    // SPA root chrome already added; also pick footer under spa root if not in chromeExtras.
    if (spaRoot) {
      for (const child of substantialChildren(spaRoot)) {
        if (isChromeChild(child)) add(child, /footer/i.test(child.tagName + child.className) ? 'footer-child' : 'layout-child');
      }
    }

    for (const host of footerHosts) {
      if (host && substantialChildren(host).length >= 1) {
        for (const child of substantialChildren(host)) add(child, 'footer-child');
      } else if (host && !isShell(host)) {
        add(host, 'footer-child');
      }
    }

    // Landmark pass: promote standalone section/header/footer that are chapter-sized
    // and not already nested deep inside a kept layout child.
    // Also accept landmarks whose parent is a dense landmark sibling stack even when
    // that parent was not selected as the primary host (safety net for body > section*).
    for (const el of document.querySelectorAll('section, header, footer, [role="region"]')) {
      if (!(el instanceof Element) || isShell(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < vw * 0.55 || rect.height < 72) continue;
      if (rect.height >= pageH * 0.75) continue;
      const parent = el.parentElement;
      const parentIsHost =
        parent &&
        (hosts.includes(parent) ||
          parent === content ||
          parent === mainContent ||
          parent === main ||
          parent === page ||
          parent === spaRoot ||
          parent?.id === 'footer-wrapper' ||
          parent?.id === 'main-content' ||
          parent?.tagName === 'FOOTER');
      let parentIsLandmarkStack = false;
      if (parent && !parentIsHost) {
        let landmarkSiblings = 0;
        for (const sib of parent.children || []) {
          if (!(sib instanceof Element)) continue;
          if (!isLandmark(sib)) continue;
          const sr = sib.getBoundingClientRect();
          if (sr.width < vw * 0.55 || sr.height < 72 || sr.height >= pageH * 0.75) continue;
          landmarkSiblings += 1;
          if (landmarkSiblings >= 3) {
            parentIsLandmarkStack = true;
            break;
          }
        }
      }
      if (parentIsHost || parentIsLandmarkStack) {
        add(el, parent?.id === 'footer-wrapper' || parent?.tagName === 'FOOTER' ? 'footer-child' : 'layout-child');
      }
    }

    let items = [...bySel.values()].sort((a, b) => a.top - b.top || b.height - a.height);

    // Drop candidates nested inside a higher-scoring (or earlier layout) candidate.
    const kept = [];
    for (const c of items) {
      const outer = kept.find(
        (k) => k.top <= c.top + 4 && k.bottom >= c.bottom - 4 && k.selector !== c.selector && k.height >= c.height,
      );
      if (outer) {
        // Replace a weak non-landmark wrapper with a landmark child of similar size.
        if (
          !outer.landmark &&
          c.landmark &&
          c.height >= outer.height * 0.55 &&
          Math.abs(c.top - outer.top) < 48
        ) {
          kept[kept.indexOf(outer)] = c;
        }
        continue;
      }
      // Drop outer weak wrappers that only barely contain this stronger landmark — handled above.
      kept.push(c);
    }

    // Remove near-duplicates (same vertical span).
    const deduped = [];
    for (const c of kept.sort((a, b) => a.top - b.top || b.score - a.score)) {
      const clash = deduped.find((k) => {
        const overlap = Math.max(0, Math.min(k.bottom, c.bottom) - Math.max(k.top, c.top));
        const iou = overlap / Math.max(1, Math.min(k.height, c.height));
        return iou >= 0.72;
      });
      if (clash) {
        if (c.score > clash.score) {
          deduped[deduped.indexOf(clash)] = c;
        }
        continue;
      }
      deduped.push(c);
    }

    // Fixed/absolute media often paints well above its chapter's in-flow box
    // (parallax heroes nested inside a later content block). Promote those as
    // their own chapters so visual gaps between header and the content card are covered.
    const overflowExtras = [];
    for (const chapter of deduped) {
      let el = null;
      try {
        el = document.querySelector(chapter.selector);
      } catch {
        el = null;
      }
      if (!el) continue;

      /** @type {Element[]} */
      const mediaNodes = [];
      for (const node of el.querySelectorAll('*')) {
        if (!(node instanceof Element)) continue;
        const style = getComputedStyle(node);
        const pos = style.position;
        if (pos !== 'fixed' && pos !== 'absolute') continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (Number.parseFloat(style.opacity || '1') < 0.05) continue;

        const r = node.getBoundingClientRect();
        if (r.width < vw * 0.65 || r.height < 180) continue;

        const top = Math.round(r.top + window.scrollY);
        const above = chapter.top - top;
        // Only split when media paints substantially *above* the chapter layout box.
        if (above < 160) continue;

        const hasMedia =
          /^(IMG|VIDEO|PICTURE|CANVAS|IFRAME)$/i.test(node.tagName) ||
          Boolean(node.querySelector?.('img, video, picture, source')) ||
          (style.backgroundImage && style.backgroundImage !== 'none');
        if (!hasMedia) continue;

        mediaNodes.push(node);
      }

      const roots = mediaNodes.filter((n) => !mediaNodes.some((o) => o !== n && o.contains(n)));
      for (const media of roots) {
        const item = describe(media, 'overflow-media');
        if (!item.hints.includes('overflow-media')) item.hints.push('overflow-media');
        if (!item.hints.includes('media')) item.hints.push('media');
        if (!item.hints.includes('hero')) item.hints.push('hero');
        item.score += 28;
        overflowExtras.push(item);
      }
    }

    for (const extra of overflowExtras) {
      const clash = deduped.find((k) => {
        const overlap = Math.max(0, Math.min(k.bottom, extra.bottom) - Math.max(k.top, extra.top));
        const iou = overlap / Math.max(1, Math.min(k.height, extra.height));
        return iou >= 0.72 || k.selector === extra.selector;
      });
      if (clash) {
        if (extra.score > clash.score) deduped[deduped.indexOf(clash)] = extra;
        continue;
      }
      deduped.push(extra);
    }

    // Merge thin footer children (< 80px) into adjacent footer sibling (AXA brocom strip).
    const FOOTER_MIN_H = 80;
    deduped.sort((a, b) => a.top - b.top);
    for (let i = 0; i < deduped.length; i++) {
      const c = deduped[i];
      if (c.kind !== 'footer-child' || c.height >= FOOTER_MIN_H) continue;
      const next = deduped[i + 1];
      const prev = deduped[i - 1];
      const absorb =
        next && next.kind === 'footer-child'
          ? next
          : prev && prev.kind === 'footer-child'
            ? prev
            : null;
      if (!absorb) continue;
      absorb.top = Math.min(absorb.top, c.top);
      absorb.bottom = Math.max(absorb.bottom, c.bottom);
      absorb.height = absorb.bottom - absorb.top;
      deduped.splice(i, 1);
      i -= 1;
    }

    const landmarkCount = deduped.filter((c) => c.landmark).length;
    const coverage = deduped.reduce((sum, c) => sum + c.height, 0);
    return {
      sections: deduped.sort((a, b) => a.top - b.top),
      meta: {
        landmarkCount,
        chapterCount: deduped.length,
        coverageRatio: pageH > 0 ? coverage / pageH : 0,
        pageHeight: pageH,
        viewportWidth: vw,
        contentHost: contentHostLabel,
        spaRoot: spaRoot ? buildSelector(spaRoot) : null,
        overflowMediaCount: overflowExtras.length,
      },
    };
  });
}

function iouY(a, b) {
  const overlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const union = Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top);
  return union > 0 ? overlap / union : 0;
}

function overlapRatio(a, b) {
  const overlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const smaller = Math.max(1, Math.min(a.height, b.height));
  return overlap / smaller;
}

/**
 * Reconcile semantic chapters with OpenCV→DOM visual sections.
 * @param {object[]} semantic
 * @param {object[]} visual
 * @param {{ pageHeightCss: number, imageHeight: number, semanticMeta?: object }} ctx
 */
export function reconcileHybridSections(semantic, visual, ctx) {
  const yScale = ctx.pageHeightCss > 0 ? ctx.pageHeightCss / ctx.imageHeight : 1;
  const cssToImg = (y) => Math.round(y / yScale);
  const imgToCss = (y) => y * yScale;

  const landmarkCount = ctx.semanticMeta?.landmarkCount ?? semantic.filter((s) => s.landmark).length;
  const chapterCount = semantic.length;
  const coverageRatio = ctx.semanticMeta?.coverageRatio ?? 0;

  // Sitecore-like: many landmarks / dense chapters → semantic primary.
  // Renault-like: few landmarks, div slices → still use structural chapters if dense enough.
  // SPA web-component pages (few HTML landmarks, several custom-element chapters) → semantic primary too.
  const semanticPrimary =
    landmarkCount >= 5 ||
    (chapterCount >= 6 && coverageRatio >= 0.45) ||
    (chapterCount >= 4 && landmarkCount >= 2 && coverageRatio >= 0.4) ||
    (chapterCount >= 4 && coverageRatio >= 0.5);

  const mode = semanticPrimary ? 'semantic-primary' : 'visual-primary';

  /** @type {object[]} */
  const pool = [];

  for (const s of semantic) {
    const visualHit = visual.find((v) => {
      const vt = v.cssTop ?? imgToCss(v.opencv?.y0 ?? 0);
      const vb = v.cssBottom ?? imgToCss(v.opencv?.y1 ?? 0);
      return overlapRatio({ top: s.top, bottom: s.bottom, height: s.height }, { top: vt, bottom: vb, height: vb - vt }) >= 0.45;
    });
    pool.push({
      ...s,
      track: visualHit ? 'both' : 'semantic',
      score: (s.score || 0) + (visualHit ? 30 : 0) + (semanticPrimary ? 15 : 0),
      opencv: visualHit?.opencv || {
        y0: cssToImg(s.top),
        y1: cssToImg(s.bottom),
        height: cssToImg(s.bottom) - cssToImg(s.top),
        score: 0,
        bands: [{ y0: cssToImg(s.top), y1: cssToImg(s.bottom), score: 0 }],
      },
      visualSelector: visualHit?.selector || null,
    });
  }

  for (const v of visual) {
    const vt = v.cssTop ?? imgToCss(v.opencv?.y0 ?? 0);
    const vb = v.cssBottom ?? imgToCss(v.opencv?.y1 ?? 0);
    const vh = Math.max(1, vb - vt);
    const covered = semantic.some(
      (s) => overlapRatio({ top: s.top, bottom: s.bottom, height: s.height }, { top: vt, bottom: vb, height: vh }) >= 0.5,
    );
    if (covered && semanticPrimary) continue;
    if (covered && !semanticPrimary) {
      // visual-primary: skip if semantic already represents this span with decent score
      const sem = semantic.find(
        (s) => overlapRatio({ top: s.top, bottom: s.bottom, height: s.height }, { top: vt, bottom: vb, height: vh }) >= 0.5,
      );
      if (sem && (sem.score || 0) >= 40) continue;
    }
    // Gap fill / visual candidate
    const overlapsPool = pool.some((p) => {
      const pb = p.bottom ?? p.top + p.height;
      return overlapRatio({ top: p.top, bottom: pb, height: p.height }, { top: vt, bottom: vb, height: vh }) >= 0.55;
    });
    if (overlapsPool) continue;

    pool.push({
      selector: v.selector,
      tag: v.tag,
      className: v.className,
      heading: v.heading,
      hints: [...(v.hints || []), 'visual'],
      top: Math.round(vt),
      height: Math.round(vh),
      bottom: Math.round(vb),
      landmark: false,
      kind: 'visual',
      score: (semanticPrimary ? 35 : 55) + Math.min(20, vh / 80),
      track: 'visual',
      opencv: v.opencv,
      roots: v.roots,
    });
  }

  // Greedy keep by score, suppress heavy overlaps.
  const ranked = [...pool].sort((a, b) => (b.score || 0) - (a.score || 0) || a.top - b.top);
  const kept = [];
  for (const c of ranked) {
    const cBottom = c.bottom ?? c.top + c.height;
    const clash = kept.find((k) => {
      const kBottom = k.bottom ?? k.top + k.height;
      return (
        overlapRatio(
          { top: c.top, bottom: cBottom, height: c.height },
          { top: k.top, bottom: kBottom, height: k.height },
        ) >= 0.55 ||
        iouY(
          { top: c.top, bottom: cBottom, height: c.height },
          { top: k.top, bottom: kBottom, height: k.height },
        ) >= 0.45
      );
    });
    if (clash) continue;
    kept.push(c);
  }

  kept.sort((a, b) => a.top - b.top);

  // Ensure OpenCV image coords exist for annotation.
  for (const s of kept) {
    if (!s.opencv) {
      s.opencv = {
        y0: cssToImg(s.top),
        y1: cssToImg(s.bottom ?? s.top + s.height),
        height: cssToImg(s.height),
        score: 0,
        bands: [],
      };
    } else {
      // Prefer DOM box for annotation when semantic/structural.
      if (s.track === 'semantic' || s.track === 'both') {
        s.opencv = {
          ...s.opencv,
          y0: cssToImg(s.top),
          y1: cssToImg(s.bottom ?? s.top + s.height),
          height: cssToImg(s.height),
        };
      }
    }
  }

  return {
    mode,
    sections: kept,
    meta: {
      mode,
      landmarkCount,
      chapterCount,
      coverageRatio,
      semanticCount: semantic.length,
      visualCount: visual.length,
      keptCount: kept.length,
      semanticPrimary,
    },
  };
}
