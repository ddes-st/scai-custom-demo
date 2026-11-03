/**
 * Derives the brand-book palette from the brand's Entity.Visualization colour.
 *
 * Content Hub stores that colour as a NAME ("yellow", "blue", …) — the hex values live in the
 * portal's own CSS, not in the API (M.Setting.EntityVisualization only lists names). We map the
 * names to hex here; the map is config-overridable per tenant.
 *
 * From one base colour we derive a small scale — a readable accent plus tinted surfaces and
 * hairlines — so every brand reads differently while text contrast stays intact.
 */

export const DEFAULT_VISUALIZATION_COLORS: Record<string, string> = {
  gray: "#6E7A80",
  grey: "#6E7A80",
  red: "#D64545",
  pink: "#D6467F",
  purple: "#7B4BD8",
  blue: "#2F6BE0",
  cyan: "#1BA3C6",
  teal: "#0F8F8B",
  green: "#3F9142",
  yellow: "#E0A100",
  orange: "#E4762E",
};

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Accepts "#rgb", "#rrggbb", "rgb(...)" and "rgba(...)". */
export function parseColor(value: string): Rgb | null {
  const v = (value || "").trim();
  if (!v) return null;
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (hex3) {
    return {
      r: parseInt(hex3[1] + hex3[1], 16),
      g: parseInt(hex3[2] + hex3[2], 16),
      b: parseInt(hex3[3] + hex3[3], 16),
    };
  }
  const hex6 = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  return null;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hh + 1 / 3) * 255),
    g: Math.round(channel(hh) * 255),
    b: Math.round(channel(hh - 1 / 3) * 255),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Darken a hue until it is legible on the given surface. Yellow and cyan are far too light at
 * full saturation to carry link/label text, so they resolve to deep gold / deep teal instead.
 */
function readableOn(base: Hsl, surface: Rgb, target = 4.5): string {
  for (let l = base.l; l >= 0.12; l -= 0.02) {
    const candidate = hslToRgb({ ...base, l });
    if (contrastRatio(candidate, surface) >= target) return toHex(candidate);
  }
  return toHex(hslToRgb({ ...base, l: 0.12 }));
}

export interface BrandPaletteResult {
  /** The base colour the palette was derived from. */
  baseHex: string;
  /** True when the CH theme colour was used because the brand had no colour of its own. */
  usedThemeFallback: boolean;
}

/**
 * Pure derivation — usable server-side, so the palette is part of the SSR output and there is
 * no colour flash before hydration.
 *
 * @param colorName  Entity.Visualization colour name ("yellow", "theme-color", "" ...)
 * @param themeAccent  the CH theme accent, used when the brand has no colour of its own
 * @param overrides  optional per-tenant name -> hex map
 */
export function computeBrandPaletteVars(
  colorName: string,
  themeAccent: string,
  overrides?: Record<string, string>
): Record<string, string> {
  const map = { ...DEFAULT_VISUALIZATION_COLORS, ...(overrides || {}) };
  const named = map[String(colorName || "").trim().toLowerCase()];
  const base = parseColor(named || themeAccent) || parseColor("#E4572E")!;
  const hsl = rgbToHsl(base);

  // A hue with no saturation (gray) must stay neutral rather than pick up a random tint.
  const tintSat = hsl.s < 0.05 ? 0 : Math.min(hsl.s, 0.55);

  const surfacePage = hslToRgb({ h: hsl.h, s: tintSat * 0.45, l: 0.965 });
  return {
    "--bgd-accent": readableOn(hsl, surfacePage),
    "--bgd-accent-vivid": toHex(hslToRgb({ ...hsl, l: Math.min(0.55, Math.max(hsl.l, 0.42)) })),
    "--bgd-surface-page": toHex(surfacePage),
    "--bgd-border": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.35, l: 0.88 })),
    "--bgd-border-subtle": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.3, l: 0.945 })),
    "--bgd-border-strong": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.28, l: 0.78 })),
    "--bgd-border-outer": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.3, l: 0.85 })),
    "--bgd-surface-inverse": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.45, l: 0.085 })),
    "--bgd-surface-inverse-hover": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.45, l: 0.14 })),
    "--bgd-border-inverse": toHex(hslToRgb({ h: hsl.h, s: tintSat * 0.35, l: 0.2 })),
  };
}

/**
 * The portal's chrome (canvas, ink, lines, accent) styled after ONE brand's palette —
 * PORTAL_THEME, set by the demo builder. `colors[0]` is the primary; a very dark palette colour
 * becomes the ink. Every value keeps text readable: accents are darkened until they reach 4.5:1
 * on the surface they sit on, so white text on an accent fill reads too. Returns {} when there's
 * no usable colour — the CSS falls back to the built-in look.
 */
export function computePortalThemeVars(colors: string[]): Record<string, string> {
  const parsed = colors.map((c) => parseColor(c)).filter((c): c is Rgb => !!c);
  if (!parsed.length) return {};
  const base = rgbToHsl(parsed[0]);
  const tintSat = base.s < 0.05 ? 0 : Math.min(base.s, 0.5);
  const white: Rgb = { r: 255, g: 255, b: 255 };
  const canvas = hslToRgb({ h: base.h, s: tintSat * 0.35, l: 0.925 });
  const darkest = parsed.slice(1).find((c) => relativeLuminance(c) < 0.03);
  const ink = darkest ? rgbToHsl(darkest) : { h: base.h, s: Math.min(base.s, 0.4), l: 0.11 };
  const fill = readableOn(base, white);
  const fillHsl = rgbToHsl(parseColor(fill)!);
  const vivid = toHex(hslToRgb({ ...base, l: Math.min(0.55, Math.max(base.l, 0.42)) }));
  const onCanvas = readableOn(base, canvas);
  return {
    "--site-canvas": toHex(canvas),
    "--site-soft": toHex(hslToRgb({ h: base.h, s: tintSat * 0.3, l: 0.965 })),
    "--site-surface": "#FFFFFF",
    "--site-line": toHex(hslToRgb({ h: base.h, s: tintSat * 0.25, l: 0.875 })),
    "--site-line-strong": toHex(hslToRgb({ h: base.h, s: tintSat * 0.22, l: 0.77 })),
    "--site-ink": toHex(hslToRgb(ink)),
    "--site-ink-hover": toHex(hslToRgb({ ...ink, l: Math.min(0.3, ink.l + 0.08) })),
    "--site-text": readableOn({ h: base.h, s: tintSat * 0.25, l: 0.32 }, canvas, 7),
    "--site-muted": readableOn({ h: base.h, s: tintSat * 0.15, l: 0.5 }, canvas),
    "--site-accent-fill": fill,
    "--site-accent-fill-hover": toHex(hslToRgb({ ...fillHsl, l: Math.max(0.1, fillHsl.l - 0.07) })),
    "--site-on-accent": "#FFFFFF",
    "--site-accent-vivid": vivid,
    "--site-accent-line": vivid,
    "--site-topline": vivid,
    "--site-eyebrow": onCanvas,
    "--site-wordmark": onCanvas,
    "--site-link": onCanvas,
    "--portal-accent": vivid,
  };
}
