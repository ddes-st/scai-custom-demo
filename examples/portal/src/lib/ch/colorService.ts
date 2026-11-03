import { CihubColor, CmykValue, RgbValue } from "./types";

export function hexToRgb(hex: string): RgbValue | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { red: (n >> 16) & 255, green: (n >> 8) & 255, blue: n & 255 };
}

export function rgbToCmyk(rgb: RgbValue): CmykValue {
  const r = rgb.red / 255;
  const g = rgb.green / 255;
  const b = rgb.blue / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return { cyan: 0, magenta: 0, yellow: 0, black: 100 };
  return {
    cyan: Math.round(((1 - r - k) / (1 - k)) * 100),
    magenta: Math.round(((1 - g - k) / (1 - k)) * 100),
    yellow: Math.round(((1 - b - k) / (1 - k)) * 100),
    black: Math.round(k * 100),
  };
}

/** Pick black or white text for legibility on the given background. */
export function contrastColor(rgb: RgbValue): string {
  const lum = (0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** Some .cihubcolor files contain numbers with leading zeros (e.g. "green": 031), which strict JSON rejects. */
export function parseLenientJson(text: string): any {
  return JSON.parse(text.replace(/([:,[]\s*)0+(\d)/g, "$1$2"));
}

export function parseCihubColor(raw: any): CihubColor | null {
  if (!raw || typeof raw !== "object" || typeof raw.hexValue !== "string") return null;
  const rgb = raw.rgbValue && typeof raw.rgbValue === "object" ? raw.rgbValue : hexToRgb(raw.hexValue);
  if (!rgb) return null;
  const rgbValue: RgbValue = {
    red: Number(rgb.red) || 0,
    green: Number(rgb.green) || 0,
    blue: Number(rgb.blue) || 0,
  };
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    colorDescription: String(raw.colorDescription ?? ""),
    hexValue: String(raw.hexValue).toUpperCase(),
    rgbValue,
    pantone: String(raw.pantone ?? ""),
    cmyk:
      raw.cmyk && typeof raw.cmyk === "object"
        ? {
            cyan: Number(raw.cmyk.cyan) || 0,
            magenta: Number(raw.cmyk.magenta) || 0,
            yellow: Number(raw.cmyk.yellow) || 0,
            black: Number(raw.cmyk.black) || 0,
          }
        : rgbToCmyk(rgbValue),
  };
}
