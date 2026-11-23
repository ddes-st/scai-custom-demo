import fs from "node:fs";
import { applyAuthoringItem } from "./authoring-apply-bridge";
import path from "node:path";
import type {
  DataFieldDef,
  DataFieldValue,
  DataPlacement,
  DataImageValue,
  DataLinkValue,
} from "../definitions/types";
import {
  DEFAULT_PROJECT_COLLECTION,
  resolveDataPlacement,
  type DataPlacementSiteContext,
} from "./data-placement";
import {
  encodeGeneralLink,
  isUnderSiteHome,
  normalizeDataFolderSegments,
  proposeValidItemName,
  toPlainDisplayName,
  unwrapStringValue,
  type GeneralLinkInput,
} from "./naming";
import { materializeGeneralLinkXml } from "./ensure-home-link-page";
import type { ScsField } from "./provenance";
import {
  emptyWriteStats,
  formatMultilistItems,
  mergeWriteStats,
  recordWrite,
  type ScsLanguageBlock,
  type ScsWriteStats
} from "./authoring-item-model";
import { isMultilineFieldValue } from "./template-field-defaults";
import { looksAlreadyEnglish, translateText } from "./translate";
import {
  isEnglishCulture,
  normalizeCultureKey,
  resolveContentLanguages,
} from "./resolve-content-languages";
import { translateFieldForEmitCulture } from "./link-list-culture";
import { ensureFolderChain } from "../definitions/apply/shared";
import {
  canSkipContentLeaf,
  computeContentLeafPayloadHash,
  getActiveApplyDefinitionKey,
  getActiveApplyInventorySession,
  loadApplyInventory,
  normalizeInventoryDiskPath,
  recordActiveInventoryEntry,
} from "./apply-inventory";
import { getActiveApplyManifest } from "./apply-context";
import {
  materializeImageFieldValue,
  type MaterializeImageOptions,
} from "../definitions/apply/media";
import { ensureItemByPath, readItemFieldValue } from "./authoring-items";
import { getCachedAuthoringPathId } from "./authoring-path-cache";
import { braceGuid } from "./ids";
import { resolveItemIdByPath } from "./resolve-item-id-by-path";
import { BASE_FOLDER_TEMPLATE } from "./system-ids";
import { warnCreateVerbose } from "./id-resolve-log";
import { STANDARD_FIELDS } from "./standard-fields";

const DISPLAY_NAME_FIELD = STANDARD_FIELDS.displayName;

function normText(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export type SiteContentFieldMeta = DataFieldDef & {
  id: string;
  sectionName: string;
};

export type SiteContentItemDef = {
  name: string;
  /** Marketer-facing Sitecore `__Display name` (per culture via translate). */
  displayName?: string;
  versions?: Array<{ version: number; fields?: Record<string, DataFieldValue> }>;
  fields?: Record<string, DataFieldValue>;
  children?: SiteContentItemDef[];
};

export type SiteContentMediaContext = {
  handle: string;
  folder: string[];
  collectionSystem: string;
  label: string;
  /** When set, same-site General Links materialize EN pages under Home. */
  siteSystem?: string;
  siteOrigin?: string | null;
  sourceLanguage?: string | null;
  /** Source culture of definition seed strings (content.culture). */
  culture?: string | null;
  /** Extra cultures for Home page YAML language versions. */
  cultures?: string[] | null;
};

/** Options for Image field materialization (site leaf + English Path culture). */
export function buildMaterializeImageOptions(
  media: SiteContentMediaContext,
  itemName: string,
  fieldName: string,
): MaterializeImageOptions {
  return {
    handle: media.handle,
    folder: media.folder,
    itemName: `${itemName}-${fieldName}`,
    collectionSystem: media.collectionSystem ?? DEFAULT_PROJECT_COLLECTION,
    siteName: media.siteSystem,
    siteOrigin: media.siteOrigin,
    sourceLanguage: media.sourceLanguage || media.culture,
    label: `${media.label}: field "${fieldName}" on item "${itemName}"`,
  };
}

export type PreparedSiteContentFolder = {
  leafId: string;
  leafSitecorePath: string;
  itemsDiskDir: string;
  stats: ScsWriteStats;
};

/** Build field metadata from a datasource/item template model (no YAML emit). */
export function buildFieldMetaFromModel(
  sections: { name: string; fields?: DataFieldDef[] }[] | undefined,
  resolveFieldId: (sectionName: string, fieldName: string) => string,
): SiteContentFieldMeta[] {
  const fields: SiteContentFieldMeta[] = [];
  for (const section of sections ?? []) {
    for (const field of section.fields ?? []) {
      fields.push({
        ...field,
        id: resolveFieldId(section.name, field.name),
        sectionName: section.name,
      });
    }
  }
  return fields;
}

/** Resolve placement + ensure folder chain under Data or Home. */
export async function prepareSiteContentFolder(options: {
  label: string;
  location: DataPlacement;
  handle: string;
  folderTemplateId: string;
  /** When set, place content under this site instead of SCOPES.site (bq-demo). */
  siteContext?: DataPlacementSiteContext;
  /**
   * Skip rewriting existing folder YAML for the first N segments
   * (e.g. preserve CM-owned `Data/Link Lists`).
   */
  skipExistingRootDepth?: number;
  /** Capture/source culture for English folder segment names. */
  sourceLanguage?: string | null;
  leafFolder?: {
    displayName?: string;
    description?: string;
    shortDescription?: string;
  };
}): Promise<PreparedSiteContentFolder> {
  const folderSegments = normalizeDataFolderSegments(options.location.folder) ?? [];
  if (folderSegments.length === 0) {
    throw new Error(`${options.label}: location.folder must have at least one segment`);
  }

  const placement = resolveDataPlacement(options.location, options.siteContext);
  // Live Data/Home id from Authoring (in-run cache / CM path) — not YAML.
  let rootId: string;
  const rootResolved = await resolveItemIdByPath({
    sitecorePath: placement.sitecorePath,
    logPrefix: "[bq:apply:content-root]",
  });
  if (!rootResolved.found || !rootResolved.id) {
    // Ensure Data/Home under the site root when CM does not have it yet.
    const sitePath = placement.sitecorePath.replace(/\/(?:Data|Home)$/i, "");
    const siteResolved = await resolveItemIdByPath({
      sitecorePath: sitePath,
      logPrefix: "[bq:apply:content-site]",
    });
    if (!siteResolved.found || !siteResolved.id) {
      throw new Error(
        `${options.label}: site root missing on CM at ${sitePath} (emit site first)`,
      );
    }
    const ensuredRoot = await ensureItemByPath({
      path: placement.sitecorePath,
      parentId: siteResolved.id,
      templateId: BASE_FOLDER_TEMPLATE,
      name: options.location.root === "home" ? "Home" : "Data",
    });
    rootId = ensuredRoot.itemId;
  } else {
    rootId = rootResolved.id;
  }
  const contentScope = {
    diskRoot: placement.diskRoot,
    sitecorePath: placement.sitecorePath,
    rootItemId: rootId,
  };

  const { parentId, parentSitecorePath, diskDir, stats } = await ensureFolderChain(
    contentScope,
    folderSegments,
    options.handle,
    {
      folderTemplate: options.folderTemplateId,
      skipExistingRootDepth: options.skipExistingRootDepth,
      sourceLanguage: options.sourceLanguage,
      leafFolder: options.leafFolder,
    },
  );

  return {
    leafId: parentId,
    leafSitecorePath: parentSitecorePath,
    itemsDiskDir: diskDir,
    stats,
  };
}

function isTranslatableField(field: SiteContentFieldMeta): boolean {
  if (field.shared) return false;
  const t = field.type.toLowerCase();
  if (
    t.includes("image") ||
    t.includes("file") ||
    t.includes("droplink") ||
    t.includes("droplist") ||
    t.includes("multilist") ||
    t.includes("treelist") ||
    t.includes("checklist") ||
    t.includes("checkbox")
  ) {
    return false;
  }
  // General Link: translate link text only (handled separately)
  if (isLinkField(field.type)) return false;
  return true;
}

/**
 * Translate General Link XML: translate `text="…"` only; keep url/linktype/etc.
 */
export async function translateGeneralLinkXml(
  xml: string,
  culture: string,
  sourceCulture = "en",
): Promise<string> {
  const raw = String(xml || "");
  if (!raw.trim()) return raw;
  const textMatch = raw.match(/\btext="([^"]*)"/i);
  if (!textMatch) return raw;
  const originalText = unwrapStringValue(textMatch[1] ?? "");
  if (!originalText.trim()) return raw;
  const translated = await translateText(originalText, culture, sourceCulture);
  if (translated === originalText) return raw;
  return raw.replace(
    /\btext="[^"]*"/i,
    `text="${translated.replace(/"/g, "&quot;")}"`,
  );
}

function isLinkField(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("link") && !t.includes("droplink");
}

function isImageField(type: string): boolean {
  return type.toLowerCase().includes("image");
}

/** Single-/Multi-Line Text and Rich Text — scalar string seeds (or space-joined primitives). */
function isTextLikeField(type: string): boolean {
  const t = type.toLowerCase().replace(/[\s_-]+/g, "");
  return (
    t === "singlelinetext" ||
    t === "multilinetext" ||
    t === "richtext" ||
    t.includes("singleline") ||
    t.includes("multiline") ||
    t.includes("richtext")
  );
}

function isPrimitiveSeedElement(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Join AI-seeded token arrays (e.g. Styles: ["level1","card"]) into a Sitecore text value. */
function joinPrimitiveArrayForTextField(raw: unknown[]): string {
  return raw
    .map((el) => {
      if (typeof el === "boolean") return el ? "1" : "";
      return String(el);
    })
    .filter((s) => s.length > 0)
    .join(" ");
}

function isLinkObject(value: unknown): value is DataLinkValue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DataLinkValue).url === "string" &&
    !(typeof (value as DataImageValue).base64 === "string") &&
    !(typeof (value as DataImageValue).svgMarkup === "string") &&
    !(typeof (value as DataImageValue).definitionKey === "string") &&
    !(typeof (value as DataImageValue).path === "string") &&
    !(typeof (value as DataImageValue).guid === "string")
  );
}

function isImageObject(value: unknown): value is DataImageValue {
  if (typeof value !== "object" || value === null) return false;
  const v = value as DataImageValue;
  return (
    (typeof v.url === "string" && v.url.length > 0) ||
    (typeof v.base64 === "string" && v.base64.length > 0) ||
    (typeof v.svgMarkup === "string" && v.svgMarkup.length > 0) ||
    (typeof v.definitionKey === "string" && v.definitionKey.length > 0) ||
    (typeof v.path === "string" && v.path.length > 0) ||
    (typeof v.guid === "string" && v.guid.length > 0)
  );
}

/** `{ url: "" }` / `{ text, url: "" }` placeholders from AI seeds — treat as blank. */
function isEmptyLinkObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  const keys = Object.keys(v);
  if (!keys.length) return true;
  const allowed = new Set(["url", "text", "href", "target", "title", "anchor", "querystring", "class"]);
  if (!keys.every((k) => allowed.has(k))) return false;
  const url = typeof v.url === "string" ? v.url : typeof v.href === "string" ? v.href : "";
  return !url.trim();
}

/** `{ url: "", alt: "" }` placeholders from AI seeds — treat as blank. */
function isEmptyImageObject(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as DataImageValue & Record<string, unknown>;
  const keys = Object.keys(v);
  if (!keys.length) return true;
  const allowed = new Set([
    "url",
    "alt",
    "name",
    "extension",
    "base64",
    "svgMarkup",
    "path",
    "guid",
    "definitionKey",
  ]);
  if (!keys.every((k) => allowed.has(k))) return false;
  return !isImageObject(value);
}

function unwrapLinkObjectInput(raw: GeneralLinkInput): GeneralLinkInput {
  return {
    ...raw,
    text:
      typeof raw.text === "string" ? unwrapStringValue(raw.text) : raw.text,
    url: unwrapStringValue(String(raw.url ?? "")),
    title:
      typeof raw.title === "string" ? unwrapStringValue(raw.title) : raw.title,
  };
}

export async function resolveSiteContentFieldValue(
  field: SiteContentFieldMeta,
  raw: DataFieldValue,
  media: SiteContentMediaContext,
  itemName: string,
): Promise<{ value: string; stats: ScsWriteStats }> {
  const empty = emptyWriteStats();
  if (raw === undefined || raw === null) return { value: "", stats: empty };
  if (typeof raw === "boolean") {
    return { value: raw ? "1" : "", stats: empty };
  }
  if (typeof raw === "number") {
    return { value: String(raw), stats: empty };
  }

  // Earliest apply read: strip JSON.stringify wrapping quotes before encode/CM/translate.
  if (typeof raw === "string") {
    raw = unwrapStringValue(raw);
  } else if (isLinkObject(raw)) {
    raw = unwrapLinkObjectInput(raw as GeneralLinkInput) as DataFieldValue;
  } else if (isImageObject(raw)) {
    const img = raw as DataImageValue;
    raw = {
      ...img,
      ...(typeof img.url === "string"
        ? { url: unwrapStringValue(img.url) }
        : {}),
      ...(typeof img.alt === "string"
        ? { alt: unwrapStringValue(img.alt) }
        : {}),
      ...(typeof img.name === "string"
        ? { name: unwrapStringValue(img.name) }
        : {}),
    } as DataFieldValue;
  }

  if (isLinkField(field.type)) {
    if (typeof raw === "string") {
      if (
        media.siteSystem &&
        media.collectionSystem &&
        !raw.trim().startsWith("<link")
      ) {
        const materialized = await materializeGeneralLinkXml(raw, {
          collectionSystem: media.collectionSystem,
          siteSystem: media.siteSystem,
          siteOrigin: media.siteOrigin,
          sourceLanguage: media.sourceLanguage || media.culture,
          cultures: media.cultures ?? undefined,
        });
        return { value: materialized.value, stats: materialized.stats };
      }
      return {
        value: encodeGeneralLink(raw),
        stats: empty,
      };
    }
    if (isLinkObject(raw)) {
      if (media.siteSystem && media.collectionSystem) {
        const materialized = await materializeGeneralLinkXml(
          raw as GeneralLinkInput,
          {
            collectionSystem: media.collectionSystem,
            siteSystem: media.siteSystem,
            siteOrigin: media.siteOrigin,
            sourceLanguage: media.sourceLanguage || media.culture,
            cultures: media.cultures ?? undefined,
          },
        );
        return { value: materialized.value, stats: materialized.stats };
      }
      return {
        value: encodeGeneralLink(raw as GeneralLinkInput),
        stats: empty,
      };
    }
    if (isEmptyLinkObject(raw)) {
      return { value: "", stats: empty };
    }
  }

  if (isImageField(field.type)) {
    if (typeof raw === "string") {
      if (!raw.trim()) return { value: "", stats: empty };
      return materializeImageFieldValue(
        raw,
        buildMaterializeImageOptions(media, itemName, field.name),
      );
    }
    if (isImageObject(raw)) {
      return materializeImageFieldValue(
        raw as DataImageValue,
        buildMaterializeImageOptions(media, itemName, field.name),
      );
    }
    if (isEmptyImageObject(raw)) {
      return { value: "", stats: empty };
    }
  }

  // Codegen sometimes seeds text tokens as JS arrays (e.g. Styles: ["level1"]).
  // Sitecore text fields are scalars — join primitive elements with spaces.
  if (Array.isArray(raw) && isTextLikeField(field.type)) {
    const elements = raw as unknown[];
    if (elements.every(isPrimitiveSeedElement)) {
      return {
        value: unwrapStringValue(joinPrimitiveArrayForTextField(elements)),
        stats: empty,
      };
    }
  }

  if (typeof raw === "object") {
    const typeHint = String(field.type || "");
    const typeLooksInvented = /^(array|object|json|list|map)$/i.test(
      typeHint.trim(),
    );
    const inventHint = typeLooksInvented
      ? ` Invalid Sitecore field type "${typeHint}" — use child items / childItemTemplate for repeating rows (allowed types: Single-Line Text, Multi-Line Text, Rich Text, Image, General Link, Checkbox).`
      : "";
    throw new Error(
      `${media.label}: field "${field.name}" on item "${itemName}" received an object value that is not a usable Link/Image payload (field type "${field.type}").${inventHint}`,
    );
  }

  return { value: unwrapStringValue(String(raw)), stats: empty };
}

function fieldToScsEntry(field: SiteContentFieldMeta, value: string): ScsField {
  return {
    id: field.id,
    hint: field.name,
    value,
    multiline: isMultilineFieldValue(value, {
      fieldType: field.type,
      richTypeHeuristic: true,
    }),
  };
}

type ItemVersionDef = { version: number; fields?: Record<string, DataFieldValue> };

function resolveItemVersions(
  item: SiteContentItemDef,
  label: string,
): ItemVersionDef[] {
  const hasVersions = Boolean(item.versions?.length);
  const hasFields = item.fields !== undefined;
  if (hasVersions && hasFields) {
    throw new Error(`${label}: item "${item.name}" must not declare both fields and versions[]`);
  }
  if (hasVersions) return item.versions!;
  if (hasFields) return [{ version: 1, fields: item.fields }];
  throw new Error(
    `${label}: item "${item.name}" must declare fields or versions: [{ version, fields }]`,
  );
}

async function applyOneSiteContentItem(options: {
  item: SiteContentItemDef;
  handle: string;
  label: string;
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  itemTemplateId: string;
  fields: SiteContentFieldMeta[];
  cultures: string[];
  media: SiteContentMediaContext;
}): Promise<{ itemId: string; englishName: string; stats: ScsWriteStats }> {
  const {
    item,
    handle,
    label,
    parentId,
    parentSitecorePath,
    diskDir,
    itemTemplateId,
    fields,
    cultures,
    media,
  } = options;

  let stats = emptyWriteStats();
  const itemVersions = resolveItemVersions(item, label);
  const sourceCulture = normalizeCultureKey(
    media.sourceLanguage || media.culture || "en",
  );
  const forUrl = isUnderSiteHome(`${parentSitecorePath}/${item.name}`);
  // Definition content items are Path-normalized post-AI (EN name + capture-lang
  // displayName). Trust item.name — sanitize only; do not nl→en translate again.
  const englishName = proposeValidItemName(String(item.name || "").trim() || "unnamed-item", "unnamed-item", {
    forUrl,
  });
  const sitecorePath = `${parentSitecorePath}/${englishName}`;
  const itemYamlPath = path.join(diskDir, `${englishName}.yml`);
  const defKey = getActiveApplyDefinitionKey();
  const payloadHash = computeContentLeafPayloadHash({
    name: item.name,
    displayName: item.displayName,
    fields: item.fields,
    versions: item.versions,
    children: item.children,
    templateId: itemTemplateId,
    cultures,
  });
  if (
    defKey &&
    canSkipContentLeaf({
      inventory: loadApplyInventory(defKey),
      leafName: englishName,
      payloadHash,
      // Scope to this YAML path so parent `Contact.yml` never skips via child
      // inventory entry `Contact/Contact.yml` (same leafName).
      diskPath: itemYamlPath,
    })
  ) {
    const prior = loadApplyInventory(defKey);
    const wantDisk = normalizeInventoryDiskPath(itemYamlPath);
    const entry = prior?.entries.find(
      (e) =>
        String(e.kind).toLowerCase() === "content" &&
        e.diskPath &&
        normalizeInventoryDiskPath(e.diskPath) === wantDisk,
    );
    // Hard: never skip when the intended parent/child YAML is missing on disk.
    // Live id must come from Authoring path cache / CM — never inventory GUID.
    if (entry && fs.existsSync(itemYamlPath)) {
      const cached = getCachedAuthoringPathId(sitecorePath);
      const resolved = cached
        ? { found: true as const, id: cached }
        : await resolveItemIdByPath({
            sitecorePath,
            logPrefix: "[bq:apply:content]",
          });
      if (!resolved.found || !resolved.id) {
        // Fall through to create/update below.
      } else {
        recordActiveInventoryEntry({
          ...entry,
          id: resolved.id,
          payloadHash,
        });
        if (entry.diskPath) getActiveApplyManifest()?.track(entry.diskPath);
        recordWrite(stats, "unchanged");
        return {
          itemId: resolved.id,
          englishName,
          stats,
        };
      }
    }
  }

  const fieldByName = new Map(fields.map((f) => [f.name, f] as const));
  const seenVersionNumbers = new Set<number>();
  const mediaForLinks: SiteContentMediaContext = {
    ...media,
    cultures: media.cultures ?? cultures,
    culture: media.culture || media.sourceLanguage,
    sourceLanguage: media.sourceLanguage || media.culture,
  };

  for (const ver of itemVersions) {
    if (!Number.isInteger(ver.version) || ver.version < 1) {
      throw new Error(
        `${label}: item "${item.name}" has invalid version ${ver.version}`,
      );
    }
    if (seenVersionNumbers.has(ver.version)) {
      throw new Error(
        `${label}: item "${item.name}" repeats version ${ver.version}`,
      );
    }
    seenVersionNumbers.add(ver.version);
  }

  const sharedById = new Map<string, ScsField>();
  const enVersions: Array<{ version: number; versionFields: ScsField[] }> = [];

  for (const ver of itemVersions) {
    const versionFields: ScsField[] = [];

    for (const [name, raw] of Object.entries(ver.fields ?? {})) {
      if (raw === undefined || raw === null) continue;
      // Omit empty string seeds — do not write `Value: ""` (truly empty = absent).
      // Checkbox `false` still resolves below; skip only explicit empty strings.
      if (typeof raw === "string" && raw.trim() === "") continue;
      const meta =
        fieldByName.get(name) ||
        fieldByName.get(name.replace(/([a-z0-9])([A-Z])/g, "$1 $2")) ||
        fieldByName.get(name.replace(/\s+/g, ""));
      if (!meta) {
        throw new Error(
          `${label}: item "${item.name}" v${ver.version} has unknown field "${name}"`,
        );
      }
      if (meta.name !== name) {
        console.warn(
          `  ⚠ Content emit: remapped seed field "${name}" → "${meta.name}" (match current template field name)`,
        );
      }
      let resolved: { value: string; stats: ScsWriteStats };
      try {
        resolved = await resolveSiteContentFieldValue(
          meta,
          raw,
          mediaForLinks,
          item.name,
        );
      } catch (err) {
        // Sparse / bad-optional field values are expected — omit this field and
        // still write the item YAML. Detail only under BQ_CREATE_LOG=verbose.
        const msg = err instanceof Error ? err.message : String(err);
        warnCreateVerbose(
          `[bq:apply:content] ${label}: omitted field "${meta.name}" on item "${item.name}" v${ver.version}: ${msg}`,
        );
        continue;
      }
      stats = mergeWriteStats(stats, resolved.stats);
      // Skip resolved empties (empty link/image objects, etc.) — same as std-values.
      if (resolved.value === "" && typeof raw !== "boolean") continue;
      const entry = fieldToScsEntry(meta, resolved.value);
      if (meta.shared) {
        sharedById.set(meta.id, entry);
      } else {
        versionFields.push(entry);
      }
    }

    enVersions.push({ version: ver.version, versionFields });
  }

  const sharedFields = [...sharedById.values()];

  async function translateVersionFields(
    versionFields: ScsField[],
    culture: string,
    fromCulture: string,
  ): Promise<ScsField[]> {
    const translated: ScsField[] = [];
    const enNameHint =
      looksAlreadyEnglish(englishName) && englishName.trim()
        ? englishName.trim()
        : null;
    for (const f of versionFields) {
      const meta = fields.find((m) => m.id === f.id);
      // Keep prior culture value when the source-culture seed is unchanged
      // (stops re-generate AI drift). Read sticky values from CM via Authoring.
      const fieldName = meta?.name || f.hint;
      const stickyTarget = fieldName
        ? await readItemFieldValue({
            path: sitecorePath,
            fieldName,
            language: culture,
          })
        : undefined;
      const stickySource = fieldName
        ? await readItemFieldValue({
            path: sitecorePath,
            fieldName,
            language: fromCulture,
          })
        : undefined;
      if (
        stickyTarget?.trim() &&
        stickySource !== undefined &&
        stickySource === String(f.value)
      ) {
        translated.push({ ...f, value: stickyTarget });
        continue;
      }
      if (meta && isLinkField(meta.type)) {
        translated.push({
          ...f,
          value: await translateGeneralLinkXml(
            String(f.value),
            culture,
            fromCulture,
          ),
        });
      } else if (meta && isTranslatableField(meta)) {
        const hint = meta.name;
        const isTitleLike =
          hint === "Title" ||
          hint === "Heading" ||
          hint === "__Display Name" ||
          hint === "__Display name";
        if (
          isTitleLike &&
          isEnglishCulture(culture) &&
          enNameHint &&
          normText(enNameHint) !== normText(String(f.value)) &&
          !looksAlreadyEnglish(String(f.value))
        ) {
          // Prefer English item name over translating Dutch Title via poisoned cache.
          translated.push({ ...f, value: enNameHint });
        } else {
          translated.push({
            ...f,
            value: await translateFieldForEmitCulture(
              String(f.value),
              culture,
              fromCulture,
            ),
          });
        }
      } else {
        translated.push(f);
      }
    }
    return translated;
  }

  const { emitCultures } = resolveContentLanguages({
    culture: sourceCulture,
    cultures,
  });
  const srcKey = sourceCulture.toLowerCase();

  const sourceDisplayName = resolveContentItemDisplayName(item);

  const langBlocks: ScsLanguageBlock[] = [];
  for (const lang of emitCultures) {
    const isSource = normalizeCultureKey(lang).toLowerCase() === srcKey;
    let display = sourceDisplayName;
    if (!isSource && sourceDisplayName) {
      const enNameHint =
        looksAlreadyEnglish(englishName) && englishName.trim()
          ? englishName.trim()
          : null;
      if (
        isEnglishCulture(lang) &&
        enNameHint &&
        normText(enNameHint) !== normText(sourceDisplayName) &&
        !looksAlreadyEnglish(sourceDisplayName)
      ) {
        display = enNameHint;
      } else {
        const stickyDisplay = await readItemFieldValue({
          path: sitecorePath,
          fieldName: DISPLAY_NAME_FIELD.hint || "__Display name",
          language: lang,
        });
        const stickySourceDisplay = await readItemFieldValue({
          path: sitecorePath,
          fieldName: DISPLAY_NAME_FIELD.hint || "__Display name",
          language: sourceCulture,
        });
        if (
          stickyDisplay?.trim() &&
          stickySourceDisplay !== undefined &&
          stickySourceDisplay === sourceDisplayName
        ) {
          display = stickyDisplay;
        } else {
          display = await translateFieldForEmitCulture(
            sourceDisplayName,
            lang,
            sourceCulture,
          );
        }
      }
    }
    display = toPlainDisplayName(display);
    const languageFields: ScsField[] = display
      ? [
          {
            id: DISPLAY_NAME_FIELD.id,
            hint: DISPLAY_NAME_FIELD.hint,
            value: display,
          },
        ]
      : [];

    if (isSource) {
      langBlocks.push({
        language: lang,
        languageFields: languageFields.length ? languageFields : undefined,
        versions: enVersions.map((v) => ({
          version: v.version,
          versionFields: v.versionFields.length ? v.versionFields : undefined,
        })),
      });
      continue;
    }
    const cultureVersions: ScsLanguageBlock["versions"] = [];
    for (const srcVer of enVersions) {
      const translated = await translateVersionFields(
        srcVer.versionFields,
        lang,
        sourceCulture,
      );
      cultureVersions.push({
        version: srcVer.version,
        versionFields: translated.length ? translated : undefined,
      });
    }
    langBlocks.push({
      language: lang,
      languageFields: languageFields.length ? languageFields : undefined,
      versions: cultureVersions,
    });
  }

  const applied = await applyAuthoringItem(itemYamlPath, {
    parent: parentId,
    template: itemTemplateId,
    path: sitecorePath,
    sharedFields: sharedFields.length ? sharedFields : undefined,
    languages: langBlocks,
  });
  recordWrite(stats, applied);
  const itemId = applied.itemId;
  getActiveApplyInventorySession()?.record({
    id: itemId,
    path: sitecorePath,
    diskPath: itemYamlPath,
    kind: "content",
    leafName: englishName,
    payloadHash,
  });

  return { itemId, englishName, stats };
}

/**
 * Prefer explicit displayName, then Title/Heading seed, then spaced item name.
 * Always plain text (no HTML tags) for Sitecore `__Display name`.
 */
function resolveContentItemDisplayName(item: SiteContentItemDef): string {
  const explicit = toPlainDisplayName(String(item.displayName || "").trim());
  if (explicit) return explicit;
  const fields = item.fields ?? item.versions?.[0]?.fields ?? {};
  for (const key of ["Title", "Heading", "title", "heading"]) {
    const raw = fields[key];
    if (typeof raw === "string" && raw.trim() && !/^https?:\/\//i.test(raw)) {
      return toPlainDisplayName(raw.trim());
    }
  }
  return toPlainDisplayName(
    String(item.name || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .trim(),
  );
}

/**
 * Sitecore clone / suffix noise left by repeated serialize pulls.
 * Matches `Offer Copy`, `Contact Us Duplicate`, `Themes Repeat`, Dutch `… herhalen`,
 * and leading `Copy direct links` / `Duplicate themes`.
 */
export function isStaleContentCloneLeafName(name: string): boolean {
  const base = String(name || "")
    .trim()
    .replace(/\.ya?ml$/i, "");
  if (!base) return false;
  if (/\s+(Copy|Duplicate|Repeat)(\s+\d+)?$/i.test(base)) return true;
  if (/\s+herhalen(\s+\d+)?$/i.test(base)) return true;
  if (/^(Copy|Duplicate)\s+/i.test(base)) return true;
  return false;
}

/**
 * Delete `* Copy` / `* Duplicate` / `* Repeat` / `* herhalen` YAML files and
 * matching child directories under an owned content folder so definition item
 * names are the only lookup targets.
 *
 * @returns removed absolute paths
 */
export function pruneStaleContentCloneLeaves(diskDir: string): string[] {
  const root = String(diskDir || "").trim();
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return [];
  }
  /** @type {string[]} */
  const removed: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const ent of entries) {
    const leaf = ent.name;
    if (!isStaleContentCloneLeafName(leaf)) continue;
    const full = path.join(root, leaf);
    try {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(full);
    } catch (err) {
      console.warn(
        `[bq:apply:content] failed to prune stale clone "${full}": ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
  if (removed.length) {
    console.log(
      `[bq:apply:content] pruned ${removed.length} stale Copy/Duplicate/Repeat leaf(ves) under ${root}`,
    );
  }
  return removed;
}

/** Emit a flat list of site content items (data definitions). */
export async function applySiteContentItems(options: {
  items: SiteContentItemDef[];
  handle: string;
  label: string;
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  itemTemplateId: string;
  fields: SiteContentFieldMeta[];
  cultures: string[];
  media: SiteContentMediaContext;
}): Promise<ScsWriteStats> {
  let stats = emptyWriteStats();
  pruneStaleContentCloneLeaves(options.diskDir);
  for (const item of options.items) {
    const result = await applyOneSiteContentItem({
      item,
      handle: options.handle,
      label: options.label,
      parentId: options.parentId,
      parentSitecorePath: options.parentSitecorePath,
      diskDir: options.diskDir,
      itemTemplateId: options.itemTemplateId,
      fields: options.fields,
      cultures: options.cultures,
      media: options.media,
    });
    stats = mergeWriteStats(stats, result.stats);
  }
  return stats;
}

/** Emit site content items with optional nested `children` (component content). */
export async function applySiteContentItemTree(options: {
  items: SiteContentItemDef[];
  handle: string;
  label: string;
  parentId: string;
  parentSitecorePath: string;
  diskDir: string;
  itemTemplateId: string;
  fields: SiteContentFieldMeta[];
  /**
   * When set, nested children (and deeper descendants) use this template /
   * field meta instead of the parent item template.
   */
  childItemTemplateId?: string;
  childFields?: SiteContentFieldMeta[];
  cultures: string[];
  media: SiteContentMediaContext;
}): Promise<ScsWriteStats> {
  let stats = emptyWriteStats();
  // Definition names only — drop Sitecore clone siblings before writing parents.
  pruneStaleContentCloneLeaves(options.diskDir);
  const linksField = options.fields.find(
    (f) =>
      f.name === "Links" &&
      (f.type.toLowerCase().includes("treelist") ||
        f.type.toLowerCase().includes("multilist")),
  );

  async function visit(
    items: SiteContentItemDef[],
    ctx: Pick<
      typeof options,
      "parentId" | "parentSitecorePath" | "diskDir"
    >,
    template: { itemTemplateId: string; fields: SiteContentFieldMeta[] },
  ): Promise<void> {
    pruneStaleContentCloneLeaves(ctx.diskDir);
    for (const item of items) {
      // Emit parent first; wire Links from live child ids after children exist.
      const needsLinksPatch =
        Boolean(linksField) &&
        Boolean(item.children?.length) &&
        !(item.fields && "Links" in item.fields);

      let result: { itemId: string; englishName: string; stats: ScsWriteStats };
      try {
        result = await applyOneSiteContentItem({
          item,
          handle: options.handle,
          label: options.label,
          parentId: ctx.parentId,
          parentSitecorePath: ctx.parentSitecorePath,
          diskDir: ctx.diskDir,
          itemTemplateId: template.itemTemplateId,
          fields: template.fields,
          cultures: options.cultures,
          media: options.media,
        });
      } catch (err) {
        // One bad seed (e.g. media download) must not block siblings — definition
        // lists N items and layout children need every datasource YAML present.
        console.warn(
          `[bq:apply:content] ${options.label}: failed item "${item.name}": ${
            err instanceof Error ? err.message : err
          } (continuing with remaining items)`,
        );
        continue;
      }
      stats = mergeWriteStats(stats, result.stats);

      if (item.children?.length) {
        const childTemplate =
          options.childItemTemplateId && options.childFields
            ? {
                itemTemplateId: options.childItemTemplateId,
                fields: options.childFields,
              }
            : template;
        const childDiskDir = path.join(ctx.diskDir, result.englishName);
        const childIds: string[] = [];
        for (const child of item.children) {
          let childResult: {
            itemId: string;
            englishName: string;
            stats: ScsWriteStats;
          };
          try {
            childResult = await applyOneSiteContentItem({
              item: child,
              handle: options.handle,
              label: options.label,
              parentId: result.itemId,
              parentSitecorePath: `${ctx.parentSitecorePath}/${result.englishName}`,
              diskDir: childDiskDir,
              itemTemplateId: childTemplate.itemTemplateId,
              fields: childTemplate.fields,
              cultures: options.cultures,
              media: options.media,
            });
          } catch (err) {
            console.warn(
              `[bq:apply:content] ${options.label}: failed child "${child.name}": ${
                err instanceof Error ? err.message : err
              } (continuing)`,
            );
            continue;
          }
          stats = mergeWriteStats(stats, childResult.stats);
          childIds.push(braceGuid(childResult.itemId));
          if (child.children?.length) {
            await visit(
              child.children,
              {
                parentId: childResult.itemId,
                parentSitecorePath: `${ctx.parentSitecorePath}/${result.englishName}/${childResult.englishName}`,
                diskDir: path.join(childDiskDir, childResult.englishName),
              },
              childTemplate,
            );
          }
        }
        if (needsLinksPatch && childIds.length && linksField) {
          const multilist = formatMultilistItems(childIds);
          const parentYaml = path.join(ctx.diskDir, `${result.englishName}.yml`);
          const patched = await applyAuthoringItem(parentYaml, {
            parent: ctx.parentId,
            template: template.itemTemplateId,
            path: `${ctx.parentSitecorePath}/${result.englishName}`,
            languages: [
              {
                language: "en",
                versionFields: [
                  {
                    id: linksField.id,
                    hint: linksField.name,
                    value: multilist.value,
                    ...(multilist.multiline ? { multiline: true } : {}),
                  },
                ],
              },
            ],
          });
          recordWrite(stats, patched);
        }
      }
    }
  }

  await visit(
    options.items,
    {
      parentId: options.parentId,
      parentSitecorePath: options.parentSitecorePath,
      diskDir: options.diskDir,
    },
    {
      itemTemplateId: options.itemTemplateId,
      fields: options.fields,
    },
  );

  return stats;
}
