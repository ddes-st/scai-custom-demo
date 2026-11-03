/**
 * Copies the pdf.js browser build + worker (matching the installed pdfjs-dist version) into
 * /public. The library is imported NATIVELY at runtime (never bundled): pdf.mjs breaks under
 * Next's dev/prod webpack processing, and native ESM is exactly how pdf.js ships for browsers.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const build = join(dirname(require.resolve("pdfjs-dist/package.json")), "build");
mkdirSync(join(root, "public"), { recursive: true });
for (const file of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
  copyFileSync(join(build, file), join(root, "public", file));
}
console.log("copied pdf.min.mjs + pdf.worker.min.mjs -> public/");
