import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// the element tree a component returns, flattened (props of every element, nested components called)
function tree(node: any, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) { for (const n of node) tree(n, out); return out; }
  out.push(node);
  if (typeof node.type === "function" && !/^(Image|RichText|Text|Link|CompatibleLink)$/.test(node.type.displayName || node.type.name || "")) {
    try { tree(node.type(node.props), out); } catch { /* a client component with hooks: its props are enough */ }
  }
  tree(node.props?.children, out);
  return out;
}
const srcs = (node: any) => tree(node).map((n) => n.props?.field?.value?.src).filter(Boolean);
const classes = (node: any) => tree(node).map((n) => n.props?.className).filter(Boolean).join(" | ");

// the SXA starter renderings every portal site offers (Feature/JSS Experience Accelerator, componentName)
const RENDERINGS = ["Image", "Navigation", "LinkList", "PageContent", "Promo", "RichText", "Title", "Container", "ColumnSplitter", "RowSplitter"];

/** Recursive readdir on Windows uses "\"; the checks below are written with "/". */
const posix = (f: string) => f.split(path.sep).join("/");
const sxaFiles = () => fs.readdirSync("src/components/sxa", { recursive: true }).map((f) => posix(String(f)));

describe("the SXA starter components (components/sxa, from Sitecore's xmcloud-starter-js)", () => {
  test("one component file per rendering, named as its componentName", () => {
    const files = sxaFiles().filter((f) => /^[^.]+\/[A-Z]\w+\.tsx$/.test(f)).map((f) => path.basename(f, ".tsx"));
    assert.deepEqual(files.sort(), [...RENDERINGS].sort());
  });
  test("the licence and the attribution travel with the code", () => {
    assert.match(fs.readFileSync("src/components/sxa/LICENSE-xmcloud-starter-js.md", "utf8"), /Apache License/);
    for (const name of RENDERINGS) {
      const file = sxaFiles().find((f) => f.endsWith(`/${name}.tsx`))!;
      assert.match(fs.readFileSync(path.join("src/components/sxa", file), "utf8"), /xmcloud-starter-js.*\n\/\/ Apache License 2\.0/, file);
    }
  });
});

describe("images", () => {
  // (rendering them needs both the server-only file route and the kit's client link component — checked in a
  // browser instead; here the guarantee that matters: no image bypasses the portal's file route)
  const src = (name: string) => fs.readFileSync(path.join("src/components/sxa", sxaFiles().find((f) => f.endsWith(`/${name}.tsx`))!), "utf8");
  test("Image and Promo pass every image field through the portal's file route (portalImageField)", () => {
    for (const name of ["Image", "Promo"]) {
      const code = src(name);
      assert.match(code, /import \{ portalImageField \} from ['"]src\/lib\/portal\/dam-image['"]/, name);
      assert.doesNotMatch(code, /NextImage as|import [^;]*\bNextImage\b/, `${name}: no next/image optimizer`);
      const uses = code.match(/<ContentSdkImage\b[^>]*field=\{([^}]+)\}/g) ?? [];
      assert.ok(uses.length > 0, name);
      for (const u of uses) assert.match(u, /field=\{(portalImageField\(|imageField\b)/, `${name}: ${u}`);
    }
    // where a local imageField is used, it was built with portalImageField
    assert.equal((src("Image").match(/const (baseImageField|imageField) = portalImageField\(/g) ?? []).length, 2);
  });
  test("no other SXA component renders images", () => {
    for (const name of RENDERINGS.filter((n) => !["Image", "Promo"].includes(n))) assert.doesNotMatch(src(name), /<(ContentSdkImage|NextImage|img)\b/, name);
  });
});
