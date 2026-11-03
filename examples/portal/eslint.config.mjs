import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs (the FlatCompat wrapper of older templates
// fails on them with "Converting circular structure to JSON").
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Content Hub, Edge and Marketplace payloads are untyped JSON, read defensively with `any`.
      "@typescript-eslint/no-explicit-any": "off",
      // Images are Content Hub public links already picked to fit their box (ChImage); next/image
      // would re-proxy them through the image optimizer.
      "@next/next/no-img-element": "off",
      // Pages Router rule; fonts load in the App Router root layout.
      "@next/next/no-page-custom-font": "off",
      // React Compiler rules (eslint-plugin-react-hooks 7). The app doesn't use the compiler; the
      // flagged patterns — state set from effects that load data, latest-value refs — are deliberate.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // plain <img> must carry alt; the Content SDK's <Image field> renders the media item's own alt
      "jsx-a11y/alt-text": ["warn", { elements: ["img", "object", "area", 'input[type="image"]'], img: [] }],
      // `_name` marks a value that is destructured away on purpose.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  globalIgnores(["node_modules/**", ".next/**", ".next*/**", "out/**", "build/**", "next-env.d.ts", ".sitecore/**",
    // pdf.js browser builds copied by scripts/copy-pdf-worker.mjs
    "public/pdf.min.mjs", "public/pdf.worker.min.mjs", "public/pdf.sandbox.min.mjs"]),
]);
