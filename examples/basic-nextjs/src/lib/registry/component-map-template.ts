import * as fs from "node:fs";
import * as path from "node:path";
/**
 * Custom Sitecore Content SDK component-map template.
 *
 * The Content SDK ships an auto-generation step (`sitecore-tools:generate-map`,
 * triggered from the starter's `build` and `dev` scripts) that scans
 * `componentMap.paths` configured in `sitecore.cli.config.ts`, groups
 * sibling files into a single map entry per component (with variants
 * merged via object-spread), and writes `.sitecore/component-map.ts`.
 *
 * The default template emits entries like:
 *
 *   ['AvatarBlock', { ...AvatarBlock, ...AvatarBlockTeam }]
 *
 * leaving every export raw — Sitecore's lookup hands the inner
 * component the layout-service `{fields, params, rendering, isEditing}`
 * shape directly. That works only when each export speaks layout-service
 * shape itself; in this codebase, components author against a
 * presentation contract and the layout-service translation is the job
 * of `withSitecore(...)`.
 *
 * `serverMapTemplate` / `clientMapTemplate` substitute the spread merge
 * with `withSitecoreModule(...)`, which wraps every component-shaped
 * export in each module via `withSitecore` (and skips already-wrapped
 * exports via the brand check). The shape the SDK consumer sees is
 * unchanged: `componentMap.get("AvatarBlock").Author` still returns a
 * function, but it's now a wrapped one.
 *
 * Wire into `sitecore.cli.config.ts`:
 *
 *   import { mapGenerator } from "@/lib/registry/component-map-template";
 *
 *   export default defineCliConfig({
 *     componentMap: {
 *       paths: ["src/components"],
 *       exclude: [...],
 *       generator: mapGenerator,
 *     },
 *   });
 *
 * Why `mapGenerator` exists:
 *
 *   `@sitecore-content-sdk/cli@1.x`'s `generate-map` command
 *   destructured only `{ paths, destination, componentImports, exclude,
 *   clientComponentMap, includeVariants }` from `componentMap` before
 *   invoking `componentMap.generator` — silently dropping `mapTemplate`
 *   and `clientMapTemplate`. The CLI's TYPES advertised both fields,
 *   but the runtime ignored them, so the wired templates never ran and
 *   the SDK's default object-spread shape — `['Form', { ...Form,
 *   componentType: 'client' }]` — was what got emitted, tripping a TS
 *   compiler assertion (`serializeTypeOfExpression` → "Debug Failure.
 *   False expression.") during `next:build` typecheck.
 *
 *   `mapGenerator` works around 1.x by overriding `componentMap.generator`
 *   (the field the CLI _did_ pass through) with a wrapper that calls
 *   the SDK's `generateMap` with our templates pre-bound.
 *
 *   **SDK 2.x note:** the destructure bug is fixed in 2.x —
 *   `generateMap` now passes `mapTemplate` / `clientMapTemplate`
 *   straight through. New consumers can wire `serverMapTemplate` /
 *   `clientMapTemplate` directly into `sitecore.cli.config.ts` and skip
 *   `mapGenerator` entirely. `mapGenerator` is kept as a backwards-
 *   compatible export for existing consumers on 1.x → 2.x; it's a
 *   no-op-over-direct-wiring on 2.x but still works.
 *
 * Why this shape over forking the SDK's bootstrap script:
 *   - `mapTemplate` / `clientMapTemplate` are the SDK's public extension
 *     points (documented at
 *     https://doc.sitecore.com/sai/.../register-a-component-in-the-component-map.html).
 *     File discovery, exclude rules, App-vs-Pages router detection, and
 *     the dual server/client emit stay in the SDK.
 *   - The SDK pre-computes `ctx.entries` (one per registered component,
 *     with import lines + a value expression) and passes them in. We
 *     rewrite only the value expression — the entry keys, import
 *     ordering, and built-in components (BYOCWrapper / FEaaSWrapper /
 *     Form) all use the SDK's own logic.
 */
import {
  type GenerateMapArgs,
  generateMap,
} from "@sitecore-content-sdk/nextjs/tools";
import ts from "typescript";

// Local mirror of the Content SDK's internal templating types.
//
// Defined here (not imported from `@sitecore-content-sdk/content/tools`,
// which is where they moved in SDK 2.x — they were in
// `@sitecore-content-sdk/core/tools` in 1.x) because:
//   - `content` (formerly `core`) is a transitive dependency of
//     `@sitecore-content-sdk/nextjs`, not a direct one — pnpm's strict
//     resolution makes the deep subpath import fragile in starter repos
//     that don't list `content` explicitly.
//   - `ComponentMapEntry` / `EnhancedComponentMapTemplate` are tagged
//     `@internal` in the SDK's API extractor; the public re-export
//     from `@sitecore-content-sdk/nextjs/tools` deliberately omits
//     them.
//
// These shapes match the SDK 2.1 internal types verbatim and were
// stable across SDK 1.x. A future major-version bump that changes the
// `EnhancedComponentMapTemplate` signature is the upgrade hazard the
// runtime check at the top of `buildTemplate` guards against.

type ComponentType = "server" | "client" | "universal";

interface ComponentFile {
  filePath: string;
  importPath: string;
  moduleName: string;
  componentName: string;
  componentType?: ComponentType;
}

interface ComponentImport {
  importName: string;
  importInfo: {
    importFrom: string;
    namedImports?: string[];
  };
}

interface ComponentMapEntry {
  key: string;
  imports: string[];
  annotateClient: boolean;
  valueExpr: string;
}

type EnhancedComponentMapTemplate = (
  components: ComponentFile[],
  componentImports: ComponentImport[] | undefined,
  ctx: {
    entries: ComponentMapEntry[];
    includeVariants: boolean;
    isClientMap: boolean;
  },
) => string;

/**
 * Path the generated `component-map.ts` uses to import the runtime
 * helpers. Resolves against the starter's `tsconfig.json` `paths`
 * mapping, which (in every starter we provision) points
 * `@/lib/registry/*` at `src/lib/registry/*`.
 */
const WITH_SITECORE_IMPORT_PATH = "@/lib/registry/with-sitecore";

/**
 * JS reserved words can't be used as `import * as <name>` bindings — the
 * SDK derives the binding from the component basename, so a component
 * literally named `switch` (`primitives/core/switch`) yields the invalid
 * `import * as switch`.
 */
const RESERVED_WORD_BINDINGS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "await",
]);

/**
 * Rewrite a bare `src/...` specifier to the `@/...` path alias so the
 * generated map both type-checks and resolves like the rest of the app
 * (tsconfig maps `@/*` → `./src/*`). Non-`src/` specifiers (npm packages,
 * already-aliased paths) pass through untouched.
 */
const aliasSpecifier = (importPath: string): string =>
  importPath.startsWith("src/") ? `@/${importPath.slice(4)}` : importPath;

export type BindingResolver = (rawName: string, importPath: string) => string;

/**
 * Per-generation registry that hands each distinct import path one unique,
 * legal `import * as` binding and emits the deduped import block. Fixes
 * three latent codegen hazards in one place so the generated map is a
 * valid, importable TS module:
 *   - reserved words   (`switch` → `switch$`)
 *   - duplicate names   (two different `image` modules → `image`, `image_2`)
 *   - bare specifiers   (`src/...` → `@/...`)
 * The map KEY stays the component name; only the internal binding +
 * specifier are normalized, so the runtime map is semantically unchanged.
 */
const createBindingRegistry = (): {
  bindingFor: BindingResolver;
  importLines: () => string[];
} => {
  const byPath = new Map<string, string>();
  const used = new Set<string>();
  const bindingFor: BindingResolver = (rawName, importPath) => {
    const existing = byPath.get(importPath);
    if (existing) return existing;
    const base = RESERVED_WORD_BINDINGS.has(rawName) ? `${rawName}$` : rawName;
    let candidate = base;
    let n = 1;
    while (used.has(candidate)) {
      n += 1;
      candidate = `${base}_${n}`;
    }
    used.add(candidate);
    byPath.set(importPath, candidate);
    return candidate;
  };
  const importLines = (): string[] =>
    [...byPath.entries()].map(
      ([importPath, binding]) =>
        `import * as ${binding} from "${aliasSpecifier(importPath)}";`,
    );
  return { bindingFor, importLines };
};

/**
 * Pulls the module identifier and import-path out of a single
 * `import * as X from '<path>';` line. Robust against grammar drift:
 * the SDK's `valueExpr` shape is internal, but the import-line grammar
 * is a stable language feature, so parsing the import line survives
 * SDK upgrades better than parsing `valueExpr`.
 */
const NAMESPACE_IMPORT_RE =
  /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/;

interface ParsedImport {
  /** The local identifier (`AvatarBlock`, `AvatarBlockSitecore`). */
  moduleName: string;
  /** The import specifier (`src/components/.../avatar-block.sitecore`). */
  importPath: string;
}

/**
 * Convention test: does this import path point at a `.sitecore.{ts,tsx}`
 * sibling file (the per-component adapter)?
 *
 * The SDK strips the file extension when it builds the import
 * specifier, so the test is "path ends with `.sitecore`" — a folder
 * named `<base>.sitecore/index.tsx` would match too, but that layout
 * is unconventional and `<base>.sitecore.ts` is the documented
 * adapter shape.
 */
const isAdapterPath = (importPath: string): boolean =>
  /\.sitecore$/.test(importPath);

interface SeparatedImports {
  /** Component-module imports the SDK discovered for this entry. */
  components: ParsedImport[];
  /**
   * The single adapter import paired with this component, if any.
   * The convention is one adapter per component prefix; if more than
   * one is found we keep only the first (cosmetic fallback — should
   * not happen with the file naming convention).
   */
  adapter?: ParsedImport;
}

/**
 * Walk a recipe's `fields:` array literal and collect the names of
 * every field whose shape is `"reference"` and whose `multiple` is
 * `true` — i.e. every Treelist field. The recipe is the single
 * source of truth: declaring `multiple: true` on a reference field
 * IS the declaration "this is a linked-items array the component
 * wants flattened."
 *
 * Pulled out of the runtime path — this runs at codegen time only
 * (component-map.ts generation). The parsed result is baked into
 * the generated map as a literal `flattenLinkedItems: [...]` array
 * so the runtime cost is zero.
 */
function discoverTreelistFieldsInRecipe(recipePath: string): string[] {
  let source: string;
  try {
    source = fs.readFileSync(recipePath, "utf8");
  } catch {
    return [];
  }
  const sourceFile = ts.createSourceFile(
    recipePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const treelistFields: string[] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AST visitor — branching matches the property-by-property recipe shape walk; refactoring fragments the locality.
  const visit = (node: ts.Node) => {
    // We're looking for object literals shaped like
    //   { name: "Items", shape: "reference", multiple: true, ... }
    // inside the recipe's `fields:` array. Walk every object literal
    // in the file and check the three sibling keys — no need to
    // anchor on the surrounding `fields:` key (the only place those
    // three keys co-exist with `shape: "reference"` is a field
    // definition, so anchoring buys nothing and adds parsing cost).
    if (ts.isObjectLiteralExpression(node)) {
      let name: string | undefined;
      let shape: string | undefined;
      let multiple = false;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))
          continue;
        const key = prop.name.text;
        if (key === "name" && ts.isStringLiteral(prop.initializer)) {
          name = prop.initializer.text;
        } else if (key === "shape" && ts.isStringLiteral(prop.initializer)) {
          shape = prop.initializer.text;
        } else if (
          key === "multiple" &&
          prop.initializer.kind === ts.SyntaxKind.TrueKeyword
        ) {
          multiple = true;
        }
      }
      if (shape === "reference" && multiple && name) {
        treelistFields.push(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return treelistFields;
}

/**
 * Walk a recipe's `datasource.templates` array and collect the handles of
 * its compatible datasource templates (e.g. `"link-list-content@1"`).
 *
 * A rendering whose Treelist fields live in an EXTERNAL datasource template —
 * rather than inline on its own template via `autoCreate` — declares those
 * fields in the *content-template* recipe, not the rendering recipe. `link-
 * list@1` is the canonical case: its `Items` Treelist lives in `link-list-
 * content@1`, and it lists two compatible datasource templates. To emit the
 * right `flattenLinkedItems`, the flatten discovery must follow these handles
 * to the templates that actually declare the fields.
 */
function datasourceTemplateHandlesInRecipe(recipePath: string): string[] {
  let source: string;
  try {
    source = fs.readFileSync(recipePath, "utf8");
  } catch {
    return [];
  }
  const sourceFile = ts.createSourceFile(
    recipePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const handles: string[] = [];
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AST visitor — the nesting mirrors the `datasource.templates[].handle` shape walk; extracting each level fragments the locality (same rationale as discoverTreelistFieldsInRecipe).
  const visit = (node: ts.Node) => {
    // Anchor on `datasource: { … templates: [ { handle: "…" } ] }` so we
    // don't mistake `section: { handle }` or the recipe's own top-level
    // `handle` for a datasource template.
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "datasource" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (
          !ts.isPropertyAssignment(prop) ||
          !ts.isIdentifier(prop.name) ||
          prop.name.text !== "templates" ||
          !ts.isArrayLiteralExpression(prop.initializer)
        )
          continue;
        for (const element of prop.initializer.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          for (const entry of element.properties) {
            if (
              ts.isPropertyAssignment(entry) &&
              ts.isIdentifier(entry.name) &&
              entry.name.text === "handle" &&
              ts.isStringLiteral(entry.initializer)
            ) {
              handles.push(entry.initializer.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return handles;
}

/**
 * Extract a recipe file's OWN handle — the `handle` on the object literal
 * that also carries a `kind` (`"component-template"`, `"content-template"`,
 * …). That pairing uniquely identifies the recipe root, so we never pick up
 * a nested `section`/`datasource.templates` handle by mistake.
 *
 * Exported for the component-map coverage gate
 * (`tests/registry/unit/lib/component-map-coverage.test.ts`), which walks
 * every placeable recipe and asserts its bare handle resolves in the
 * committed client component map.
 */
export function recipeRootHandle(recipePath: string): string | undefined {
  let source: string;
  try {
    source = fs.readFileSync(recipePath, "utf8");
  } catch {
    return undefined;
  }
  const sourceFile = ts.createSourceFile(
    recipePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  let handle: string | undefined;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AST visitor — the branching mirrors the recipe-root object walk (kind + handle pairing); extracting fragments the locality (same rationale as discoverTreelistFieldsInRecipe).
  const visit = (node: ts.Node) => {
    if (handle) return;
    if (ts.isObjectLiteralExpression(node)) {
      let kind: string | undefined;
      let candidate: string | undefined;
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name))
          continue;
        if (prop.name.text === "kind" && ts.isStringLiteral(prop.initializer)) {
          kind = prop.initializer.text;
        } else if (
          prop.name.text === "handle" &&
          ts.isStringLiteral(prop.initializer)
        ) {
          candidate = prop.initializer.text;
        }
      }
      if (kind && candidate) {
        handle = candidate;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return handle;
}

/**
 * Lazily-built `handle → absolute recipe path` index across every
 * `.recipe.ts` under `src/components`. Used to resolve a rendering's
 * external datasource-template handles to the recipe files that declare
 * their fields. Built once per codegen run (the map is generated twice —
 * server then client — so the walk must be memoized).
 */
let handleToRecipePath: Map<string, string> | null = null;

function recipeHandleIndex(): Map<string, string> {
  if (handleToRecipePath) return handleToRecipePath;
  const index = new Map<string, string>();
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".recipe.ts")) {
        const handle = recipeRootHandle(full);
        if (handle && !index.has(handle)) index.set(handle, full);
      }
    }
  };
  walk(path.resolve(process.cwd(), "src/components"));
  handleToRecipePath = index;
  return index;
}

/**
 * Cache for `discoverTreelistFieldsInRecipe` — the SDK's
 * `generateMap` calls `serverMapTemplate` then `clientMapTemplate`
 * back-to-back, each iterating the same entries; without a cache
 * we'd parse every recipe twice per build.
 */
const treelistFieldsCache = new Map<string, string[]>();

/**
 * Given a parsed component import (e.g.
 * `src/components/.../accordion-block`), find its sibling
 * `.recipe.ts` and return the discovered Treelist field names. The
 * import path the SDK emits is relative to the repo root, so resolve
 * against `process.cwd()` (which IS the repo root during the
 * `sitecore-tools` build step). Falls through to `[]` for components
 * with no recipe (primitives, blocks, lib utilities re-exported into
 * `src/components`).
 */
function treelistFieldsForComponentImport(importPath: string): string[] {
  if (treelistFieldsCache.has(importPath)) {
    const cached = treelistFieldsCache.get(importPath);
    if (cached) return cached;
  }
  // Compound-directory entries import from `<dir>/index`; their
  // recipe lives one level up at `<dir>.recipe.ts`. Single-file
  // components have the recipe alongside as `<file>.recipe.ts`.
  const candidates = importPath.endsWith("/index")
    ? [`${importPath.replace(/\/index$/, "")}.recipe.ts`]
    : [`${importPath}.recipe.ts`];
  const fields = new Set<string>();
  for (const rel of candidates) {
    const absolute = path.resolve(process.cwd(), rel);
    // Inline Treelist fields declared on the rendering's own template
    // (the `autoCreate` / main-nav case).
    for (const f of discoverTreelistFieldsInRecipe(absolute)) fields.add(f);
    // Treelist fields declared on an EXTERNAL compatible datasource
    // template (the link-list case): follow each `datasource.templates`
    // handle to the content-template recipe and scan it too, so the
    // rendering still gets `flattenLinkedItems` even though the fields
    // don't live on its own recipe.
    for (const handle of datasourceTemplateHandlesInRecipe(absolute)) {
      const dsPath = recipeHandleIndex().get(handle);
      if (dsPath)
        for (const f of discoverTreelistFieldsInRecipe(dsPath)) fields.add(f);
    }
  }
  const result = [...fields];
  treelistFieldsCache.set(importPath, result);
  return result;
}

/**
 * Locate the on-disk sibling `.sitecore` adapter for a component import
 * path, if any. Compound-directory entries import from `<dir>/index`;
 * their adapter lives at `<dir>.sitecore.ts` (same convention as recipes).
 *
 * Why this exists: the Content SDK's client-map collection
 * (`generate-map.js`, verified 2.1.1) type-classifies every scanned file
 * and keeps only `client` / `universal` ones for
 * `component-map.client.ts`. A hand-authored `<name>.sitecore.ts` adapter
 * is a plain `.ts` data module — no `"use client"` directive, no
 * `componentType` export — so it classifies as `server` and is stripped
 * from the client map's entry group even though its base component
 * survives. The adapter is part of the component's field-translation
 * contract in BOTH maps (the showcase page-render path resolves against
 * the CLIENT map), so `buildEntryValue` re-pairs it from disk when the
 * SDK dropped it.
 */
const findSiblingAdapter = (importPath: string): ParsedImport | undefined => {
  const base = importPath.endsWith("/index")
    ? importPath.replace(/\/index$/, "")
    : importPath;
  const adapterImportPath = `${base}.sitecore`;
  const exists = [".ts", ".tsx"].some((ext) =>
    fs.existsSync(path.resolve(process.cwd(), `${adapterImportPath}${ext}`)),
  );
  if (!exists) return undefined;
  // Mirror the SDK's binding derivation (`name.replace(/[^\w]+/g, "")`
  // over the file basename) so the synthesized import is byte-identical
  // to what the SDK emits when it DOES keep the adapter (server map).
  const moduleName = `${path.basename(base)}.sitecore`.replace(/[^\w$]+/g, "");
  return { moduleName, importPath: adapterImportPath };
};

/**
 * Mirror of the SDK's `toPascalCase` introduced in
 * `@sitecore-content-sdk/content@2.2.1` (`tools/templating/components.js`):
 * splits on `-`/`_`, capitalizes each word, joins. Kept byte-compatible
 * so `restoreEntryKey` can recognize a key the SDK renamed.
 */
const sdkToPascalCase = (name: string): string =>
  name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

/**
 * Restore the on-disk module basename as the map key.
 *
 * `@sitecore-content-sdk/content@2.2.1` (a PATCH release, floated into
 * every fresh starter build via the scaffold's `^2.2.0` range) changed
 * the component scanner to PascalCase every `componentName` — so the
 * entry keys the SDK hands this template flipped from the raw file
 * basename (`reviews-carousel`) to `ReviewsCarousel`. Every Sitecore
 * rendering this registry pushes is registered under the kebab-case
 * basename, so a PascalCase-keyed map misses on EVERY lookup and each
 * placed component renders the SDK's "missing React implementation"
 * fallback.
 *
 * The entry's own import lines still carry the truth: the module's
 * on-disk path. Re-derive the key from the first component import whose
 * basename either equals the SDK key (SDK ≤ 2.2.0 — no-op, output stays
 * byte-identical) or PascalCases to it (SDK ≥ 2.2.1 — restores the
 * kebab key). Entries with no matching component import (built-ins,
 * package imports) keep the SDK's key untouched.
 */
const restoreEntryKey = (entry: ComponentMapEntry): string => {
  const { components } = separateImports(entry);
  const candidates = components.map((c) =>
    path.basename(
      c.importPath.endsWith("/index")
        ? c.importPath.replace(/\/index$/, "")
        : c.importPath,
    ),
  );
  if (candidates.includes(entry.key)) return entry.key;
  const renamed = candidates.find(
    (candidate) => sdkToPascalCase(candidate) === entry.key,
  );
  return renamed ?? entry.key;
};

const separateImports = (entry: ComponentMapEntry): SeparatedImports => {
  const components: ParsedImport[] = [];
  let adapter: ParsedImport | undefined;
  for (const line of entry.imports) {
    const match = line.match(NAMESPACE_IMPORT_RE);
    if (!match) continue;
    const moduleName = match[1];
    const importPath = match[2];
    if (typeof moduleName !== "string" || typeof importPath !== "string")
      continue;
    const parsed: ParsedImport = { moduleName, importPath };
    if (isAdapterPath(parsed.importPath)) {
      adapter ??= parsed;
    } else {
      components.push(parsed);
    }
  }
  return { components, adapter };
};

type ServerOrClient = "server" | "client";

const SERVER_BUILT_INS = `
import {
  BYOCServerWrapper,
  type NextjsContentSdkComponent,
  FEaaSServerWrapper,
  Form,
} from "@sitecore-content-sdk/nextjs";
`;
const SERVER_BUILT_IN_ENTRIES = [
  `["BYOCWrapper", BYOCServerWrapper]`,
  `["FEaaSWrapper", FEaaSServerWrapper]`,
  `["Form", Form]`,
];

const CLIENT_BUILT_INS = `
import {
  BYOCClientWrapper,
  type NextjsContentSdkComponent,
  FEaaSClientWrapper,
  Form,
} from "@sitecore-content-sdk/nextjs";
`;
const CLIENT_BUILT_IN_ENTRIES = [
  `["BYOCWrapper", BYOCClientWrapper]`,
  `["FEaaSWrapper", FEaaSClientWrapper]`,
  `["Form", Form]`,
];

const buildEntryValue = (
  entry: ComponentMapEntry,
  bindingFor: BindingResolver,
): string => {
  const { components, adapter: sdkAdapter } = separateImports(entry);
  // Re-pair the adapter the SDK's client-map filter stripped (see
  // `findSiblingAdapter`): a component whose group carries no adapter
  // import gets its on-disk `.sitecore` sibling back, so client-map
  // entries keep the same field-translation wiring as server-map ones.
  // Recipe-only groups (`<child>.recipe` content templates) have no
  // `.sitecore` sibling and pass through unchanged.
  const adapter =
    sdkAdapter ??
    components
      .map((c) => findSiblingAdapter(c.importPath))
      .find((found) => found !== undefined);
  if (components.length === 0 && !adapter) {
    // Fallback: SDK emitted no imports for this entry. Shouldn't
    // happen for module-namespace entries, but if it does the
    // valueExpr is the safest passthrough.
    return entry.valueExpr;
  }
  const moduleArgs = components
    .map((c) => bindingFor(c.moduleName, c.importPath))
    .join(", ");
  // Recipe-driven discovery — for each component import, parse the
  // sibling `.recipe.ts` (or `<dir>.recipe.ts` for compound-directory
  // index entries) and collect every Treelist field name. Merged
  // across all component modules in this entry (typically just one,
  // but section-wrapper + helpers + subscribe-footer is a 3-module
  // entry). When found, emit a `defaultOptions:{flattenLinkedItems}`
  // carrier so `withSitecoreModule` applies the option to every
  // variant of the module — no hand-authored adapter required for
  // the "Items"/"Skills"-style Treelist case.
  const treelistFields = new Set<string>();
  for (const c of components) {
    for (const field of treelistFieldsForComponentImport(c.importPath)) {
      treelistFields.add(field);
    }
  }
  const defaultOptionsArg =
    treelistFields.size > 0
      ? `, { defaultOptions: { flattenLinkedItems: ${JSON.stringify([
          ...treelistFields,
        ])} } }`
      : "";
  if (!adapter) {
    if (components.length === 0) return entry.valueExpr;
    return `withSitecoreModule(${moduleArgs}${defaultOptionsArg})`;
  }
  // Defensive: a `.sitecore.ts` file with no paired component module
  // is meaningless — the entry would have no variants to wrap. Pass
  // an empty modules list so the result is `{}` (Sitecore's missing-
  // component fallback kicks in at render time) and the situation is
  // diagnosable at the map call site rather than in a 500.
  const adapterBinding = bindingFor(adapter.moduleName, adapter.importPath);
  if (components.length === 0) {
    return `withSitecoreModule({ adapter: ${adapterBinding} }${defaultOptionsArg})`;
  }
  return `withSitecoreModule(${moduleArgs}, { adapter: ${adapterBinding} }${defaultOptionsArg})`;
};

/**
 * Render a `ComponentImport` package entry into the matching map line.
 * Wildcard packages (`namedImports` absent) get the same
 * `withSitecoreModule` wrapping as a discovered local component;
 * named-imports packages get per-name `withSitecore` wrapping so
 * individual exports flow through the brand check. Already-wrapped
 * exports pass through (the brand survives both helpers).
 */
const renderPackageImport = (
  pkg: ComponentImport,
  bindingFor: BindingResolver,
): { importLine: string | null; entries: string[] } => {
  if (pkg.importInfo.namedImports?.length) {
    const names = pkg.importInfo.namedImports;
    return {
      importLine: `import { ${names.join(", ")} } from "${aliasSpecifier(pkg.importInfo.importFrom)}";`,
      entries: names.map((name) => `["${name}", withSitecore(${name})]`),
    };
  }
  // Namespace package import — route the binding + import line through the
  // shared registry (unique, reserved-safe, `@/`-aliased), so it can't
  // collide with a component import that derives the same basename.
  const binding = bindingFor(pkg.importName, pkg.importInfo.importFrom);
  return {
    importLine: null,
    entries: [`["${pkg.importName}", withSitecoreModule(${binding})]`],
  };
};

interface BuildOpts {
  variant: ServerOrClient;
}

const buildTemplate = (
  _components: ComponentFile[],
  componentImports: ComponentImport[] | undefined,
  ctx:
    | {
        entries: ComponentMapEntry[];
        includeVariants: boolean;
        isClientMap: boolean;
      }
    | undefined,
  { variant }: BuildOpts,
): string => {
  if (!ctx) {
    // Defensive: every Content SDK ≥ 1.x calls the enhanced signature
    // when this template is registered as `mapTemplate`. If a future
    // SDK upgrade reverts to the 2-arg shape, fail loudly so the
    // starter author notices instead of silently emitting an unwrapped
    // map.
    throw new Error(
      "[component-map-template] Enhanced ctx missing — Content SDK ≥ 1.x is required.",
    );
  }

  const builtInImports =
    variant === "client" ? CLIENT_BUILT_INS : SERVER_BUILT_INS;
  const builtInEntries =
    variant === "client" ? CLIENT_BUILT_IN_ENTRIES : SERVER_BUILT_IN_ENTRIES;

  // One registry mints every namespace `import * as` binding so they're
  // unique, reserved-safe, and `@/`-aliased — and emits the deduped
  // import block. Entry values + namespace package entries pull their
  // bindings from it; named-import packages keep their own import line.
  const registry = createBindingRegistry();

  const entryLines: string[] = [...builtInEntries];
  for (const entry of ctx.entries) {
    entryLines.push(
      `["${restoreEntryKey(entry)}", ${buildEntryValue(entry, registry.bindingFor)}]`,
    );
  }

  const namedImportLines: string[] = [];
  for (const pkg of componentImports ?? []) {
    const rendered = renderPackageImport(pkg, registry.bindingFor);
    if (rendered.importLine) namedImportLines.push(rendered.importLine);
    entryLines.push(...rendered.entries);
  }

  // `registry.importLines()` is emitted AFTER all entries + packages are
  // processed so it captures every binding handed out above.
  const importsBlock = [...registry.importLines(), ...namedImportLines].join(
    "\n",
  );

  const headerComment =
    variant === "client"
      ? "Client-safe component map for App Router"
      : "Component map (server-aware) — generated by sitecore.cli.config";

  return `// ${headerComment}
// Generated by component-map-template.ts. Do not edit by hand —
// re-run \`pnpm sitecore-tools:generate-map\` (or any \`build\` /
// \`dev\` script) to regenerate.
${builtInImports}
import {
  withSitecore,
  withSitecoreModule,
} from "${WITH_SITECORE_IMPORT_PATH}";
// end of built-in components

${importsBlock}

export const componentMap = new Map<string, NextjsContentSdkComponent>([
${entryLines.map((line) => `  ${line},`).join("\n")}
] as Array<[string, NextjsContentSdkComponent]>);

export default componentMap;
`;
};

/**
 * Server-side component map template. Wires up to `componentMap.mapTemplate`
 * in `sitecore.cli.config.ts`. Emits the App-Router server variant of
 * the map (with `BYOCServerWrapper` + `FEaaSServerWrapper`).
 *
 * Declared with a rest parameter so `Function.length === 0`. The SDK's
 * client-template branch in `@sitecore-content-sdk/nextjs@1.6.0` and
 * still in `@2.1.0` reads:
 *
 *   if (clientTemplate.length >= 2) clientTemplate(components, imports);
 *   else                           clientTemplate(components, imports, ctx);
 *
 * — i.e. it invokes the LEGACY 2-arg shape when the user-provided
 * function declares ≥ 2 explicit (non-default) parameters, and the
 * ENHANCED 3-arg shape otherwise. (Yes, that's the wrong way round; the
 * documented type is 3-arg.) A 3-arg arrow function has `length === 3`,
 * so the SDK takes the 2-arg branch and `ctx` arrives as `undefined`.
 * Using `...args` collapses `.length` to `0`, routing us into the
 * 3-arg branch. The server template doesn't currently hit a `.length`
 * check, but we make both templates symmetric so a future SDK refactor
 * that mirrors the client check on the server side won't quietly break
 * us.
 */
export const serverMapTemplate: EnhancedComponentMapTemplate = (
  ...args: Parameters<EnhancedComponentMapTemplate>
) => {
  const [components, componentImports, ctx] = args;
  return buildTemplate(components, componentImports, ctx, {
    variant: "server",
  });
};

/**
 * Client-side component map template. Wires up to
 * `componentMap.clientMapTemplate` in `sitecore.cli.config.ts`. Emits
 * the App-Router client variant (with `BYOCClientWrapper` +
 * `FEaaSClientWrapper`); the SDK only invokes this when
 * `clientComponentMap` is true (the default for App Router projects).
 *
 * The `...args` rest signature is load-bearing — see the doc comment
 * on `serverMapTemplate` for the SDK's `.length`-based call dispatch.
 */
export const clientMapTemplate: EnhancedComponentMapTemplate = (
  ...args: Parameters<EnhancedComponentMapTemplate>
) => {
  const [components, componentImports, ctx] = args;
  return buildTemplate(components, componentImports, ctx, {
    variant: "client",
  });
};

/**
 * Drop-in replacement for `componentMap.generator` in
 * `sitecore.cli.config.ts`. Calls the SDK's `generateMap` with our
 * `serverMapTemplate` / `clientMapTemplate` pre-bound — necessary
 * because `@sitecore-content-sdk/cli@1.x` strips
 * `mapTemplate` / `clientMapTemplate` from the config before invoking
 * the generator (see file-top doc comment). Wiring via `generator`
 * survives the destructure.
 */
export const mapGenerator = (args: GenerateMapArgs): void => {
  generateMap({
    ...args,
    mapTemplate: serverMapTemplate,
    clientMapTemplate,
  });
};
