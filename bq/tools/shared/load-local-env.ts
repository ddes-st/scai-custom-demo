import fs from "node:fs";
import path from "node:path";
import { FRAMEWORK_ROOT } from "./paths";

/**
 * Load `bq/.env` then `bq/.env.local` into `process.env`.
 * - Non-empty values already in the process environment win (CI / shell).
 * - Empty process values are treated as unset.
 * - `.env.local` overrides `.env`.
 *
 * Used by CLI tools (`definitions:generate`, etc.) because Next.js env loading
 * does not apply to plain `tsx` scripts.
 *
 * Never commit `.env.local`. Do not log values from these files.
 */
export function loadLocalEnvFiles(options?: { root?: string }): void {
  const root = options?.root ?? FRAMEWORK_ROOT;
  const lockedKeys = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") lockedKeys.add(key);
  }

  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(root, fileName);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (lockedKeys.has(key)) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
