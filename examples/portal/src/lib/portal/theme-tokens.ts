/**
 * The portal's themable CSS custom properties — shared by the server (theme.ts writes them on
 * :root), the Page builder theme editor (/theme-editor) and the live bridge in the editing host.
 * No "server-only": this file ships to the browser. Defaults are the values the stylesheets used
 * as var() fallbacks before the tokens existed, so an untouched theme looks exactly as before.
 */
export type TokenType = "color" | "length";
export interface ThemeToken { key: string; label: string; group: string; type: TokenType; default: string; hint?: string }

export const THEME_TOKENS: ThemeToken[] = [
  { key: "--site-canvas", label: "Page background", group: "Surfaces", type: "color", default: "#e7e3da" },
  { key: "--site-surface", label: "Card surface", group: "Surfaces", type: "color", default: "#ffffff" },
  { key: "--site-soft", label: "Soft panel", group: "Surfaces", type: "color", default: "#f5f2ec", hint: "tags, notices, hover fills" },
  { key: "--site-ink", label: "Headings", group: "Text", type: "color", default: "#12171a" },
  { key: "--site-ink-hover", label: "Headings (hover)", group: "Text", type: "color", default: "#2a3238" },
  { key: "--site-text", label: "Body text", group: "Text", type: "color", default: "#4a5a63" },
  { key: "--site-muted", label: "Muted text", group: "Text", type: "color", default: "#8c8578", hint: "eyebrows, meta lines" },
  { key: "--site-line", label: "Border", group: "Lines", type: "color", default: "#e2ddd3" },
  { key: "--site-line-strong", label: "Strong border", group: "Lines", type: "color", default: "#c4bdae" },
  { key: "--site-accent-fill", label: "Button fill", group: "Buttons", type: "color", default: "#12171a" },
  { key: "--site-on-accent", label: "Button text", group: "Buttons", type: "color", default: "#ffffff" },
  { key: "--site-radius", label: "Corner radius", group: "Shape", type: "length", default: "6px", hint: "cards, inputs, thumbnails" },
];

export const TOKEN_KEYS = new Set(THEME_TOKENS.map((t) => t.key));
export const TOKEN_DEFAULTS: Record<string, string> = Object.fromEntries(THEME_TOKENS.map((t) => [t.key, t.default]));

export const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LENGTH = /^(?:0|\d*\.?\d+(?:px|rem|em|%))$/;
/** A Google Fonts family name: letters, digits, spaces — nothing that could close a CSS string. */
export const FONT_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 .+-]{0,60}$/;

export function isTokenValue(type: TokenType, value: string): boolean {
  return type === "color" ? HEX_COLOR.test(value) : LENGTH.test(value);
}

/** Keeps only known tokens with well-formed values; keys not listed are dropped. */
export function sanitizeVars(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const t of THEME_TOKENS) {
    const v = (input as Record<string, unknown>)[t.key];
    if (typeof v === "string" && isTokenValue(t.type, v.trim())) out[t.key] = v.trim().toLowerCase();
  }
  return out;
}

/** The `ThemeVars` field (JSON object of token → value) → sanitized map; "" or junk → {}. */
export function parseThemeVars(json: string): Record<string, string> {
  if (!json || !json.trim()) return {};
  try { return sanitizeVars(JSON.parse(json)); } catch { return {}; }
}

/** Preset = partial token map plus optional accent and fonts; "Default" clears everything. */
export interface ThemePreset { name: string; vars: Record<string, string>; accent?: string; fonts?: { serif?: string; sans?: string; mono?: string } }
export const THEME_PRESETS: ThemePreset[] = [
  { name: "Default", vars: {} },
  {
    name: "Warm", accent: "#b5472a", fonts: { serif: "Fraunces", sans: "Nunito Sans" },
    vars: { "--site-canvas": "#efe6d8", "--site-surface": "#fffaf3", "--site-soft": "#f6eee2", "--site-ink": "#2b1d12", "--site-ink-hover": "#4a3426", "--site-text": "#5a4a3c", "--site-muted": "#9a8a76", "--site-line": "#e6d9c6", "--site-line-strong": "#c9b69c", "--site-accent-fill": "#b5472a", "--site-on-accent": "#ffffff", "--site-radius": "10px" },
  },
  {
    name: "Cool", accent: "#1b4fd8", fonts: { serif: "Lora", sans: "Inter" },
    vars: { "--site-canvas": "#e4e9ee", "--site-surface": "#ffffff", "--site-soft": "#eef2f6", "--site-ink": "#0f1c2e", "--site-ink-hover": "#243a5c", "--site-text": "#3f4f63", "--site-muted": "#7b8794", "--site-line": "#d6dee6", "--site-line-strong": "#aebbc8", "--site-accent-fill": "#1b4fd8", "--site-on-accent": "#ffffff", "--site-radius": "4px" },
  },
  {
    name: "Dark", accent: "#c9a84c", fonts: { serif: "Playfair Display", sans: "Manrope" },
    vars: { "--site-canvas": "#14181b", "--site-surface": "#1d2328", "--site-soft": "#232a30", "--site-ink": "#f3efe6", "--site-ink-hover": "#ffffff", "--site-text": "#c7ccd1", "--site-muted": "#8d969c", "--site-line": "#2d353b", "--site-line-strong": "#4a545b", "--site-accent-fill": "#f3efe6", "--site-on-accent": "#14181b", "--site-radius": "8px" },
  },
];

/** The message both ends of the live preview exchange (editor ⇄ editing host), tagged by `source`. */
export const THEME_BUS = "portal-theme";
export interface ThemePreviewMessage {
  source: typeof THEME_BUS;
  type: "preview" | "reset" | "hello";
  vars?: Record<string, string>;
  accent?: string;
  fonts?: { serif?: string; sans?: string; mono?: string };
}
