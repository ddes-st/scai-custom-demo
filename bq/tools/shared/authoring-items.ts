/**
 * Sitecore Authoring GraphQL item helpers for definitions:generate apply.
 * Prefer {@link ensureItemByPath} for idempotent create-or-update.
 */
import {
  formatAuthoringItemId,
  resolveAuthoringGraphqlAuth,
} from "./cm-delete-item";
import { findItemByPath } from "./cm-sibling-lookup";
import { canonicalItemId } from "./ids";
import {
  cacheAuthoringPathId,
  getCachedAuthoringPathId,
} from "./authoring-path-cache";
import { warnCreateVerbose } from "./id-resolve-log";
import {
  proposeValidItemName,
  proposeValidSitecorePath,
} from "./naming";

const AUTHORING_LOG = "[bq:apipush:authoring]";

export type AuthoringAuth = { host: string; token: string };

export type AuthoringFieldInput = {
  name: string;
  value: string;
  reset?: boolean;
};

export type AuthoringItemResult = {
  itemId: string;
  name?: string;
  path?: string;
};

export type AuthoringTemplateSectionInput = {
  name: string;
  templateSectionId?: string;
  fields?: Array<{
    name: string;
    type?: string;
    fieldId?: string;
  }>;
};

export type EnsureItemByPathOptions = {
  path: string;
  parentId: string;
  templateId: string;
  language?: string;
  fields?: AuthoringFieldInput[];
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
  /** Override leaf name (default: last path segment). */
  name?: string;
};

export type CreateItemOptions = {
  name: string;
  parentId: string;
  templateId: string;
  language?: string;
  fields?: AuthoringFieldInput[];
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
};

export type UpdateItemOptions = {
  itemId?: string;
  path?: string;
  language?: string;
  fields: AuthoringFieldInput[];
  database?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
};

export type AddItemVersionOptions = {
  itemId: string;
  language?: string;
  database?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
};

export type CreateItemTemplateOptions = {
  name: string;
  parentId: string;
  sections?: AuthoringTemplateSectionInput[];
  /**
   * Base template IDs for Authoring `baseTemplates` (e.g. Standard Template).
   * Prefer this over updateItem `__Base template` — Authoring does not apply
   * inheritance via that field on createItemTemplate-managed templates.
   */
  baseTemplates?: string[];
  /** Sitecore icon path (e.g. Office/32x32/window_dialog.png). */
  icon?: string;
  /** Full Sitecore path for cache / post-create lookup. */
  path?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
};

export type UpdateItemTemplateOptions = {
  templateId: string;
  name?: string;
  sections?: AuthoringTemplateSectionInput[];
  /** Base template IDs for Authoring `baseTemplates` (see create). */
  baseTemplates?: string[];
  /** Sitecore icon path (e.g. Office/32x32/window_dialog.png). */
  icon?: string;
  path?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
};

export type UploadMediaOptions = {
  /** Media library relative path (no `/sitecore/media library` prefix). */
  itemPath: string;
  filePath: string;
  alt?: string;
  overwriteExisting?: boolean;
  language?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
  /** Absolute Sitecore path for find/ensure (defaults from itemPath). */
  sitecorePath?: string;
};

function normalizeId(id: string): string {
  return canonicalItemId(id) || id.replace(/[{}]/g, "").trim().toLowerCase();
}

function leafNameFromPath(sitecorePath: string): string {
  const parts = String(sitecorePath || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || "unnamed-item";
}

/** Authoring GraphQL `baseTemplates: [ID!]` payload. */
function formatBaseTemplateIds(ids?: string[]): string[] | undefined {
  if (!ids?.length) return undefined;
  const out = ids
    .map((id) => formatAuthoringItemId(String(id || "").trim()))
    .filter(Boolean);
  return out.length ? out : undefined;
}

function isMissingFieldError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Cannot find a field with the name/i.test(msg);
}

function isMissingLanguageVersionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    /does not contain version/i.test(msg) ||
    /does not contain a version/i.test(msg) ||
    /no version.*(language|culture)/i.test(msg)
  );
}

function missingFieldNameFromError(err: unknown): string | undefined {
  const msg = err instanceof Error ? err.message : String(err);
  // Field names may contain spaces (e.g. "__Display name"). Stop at . or ; so
  // joined GraphQL errors do not swallow the whole remainder of the message.
  const m = msg.match(/Cannot find a field with the name\s+([^.;]+)/i);
  return m?.[1]?.replace(/[`'"]/g, "").trim() || undefined;
}

function fieldNameEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Update fields; create missing language versions once, drop Authoring-rejected
 * field names (e.g. __Icon on __Standard Values), and retry remaining defaults.
 */
async function updateItemToleratingMissingFields(
  options: UpdateItemOptions,
): Promise<AuthoringItemResult> {
  let fields = [...(options.fields || [])];
  const dropped: string[] = [];
  let versionEnsured = false;
  while (true) {
    try {
      return await updateItem({ ...options, fields });
    } catch (err) {
      if (!versionEnsured && isMissingLanguageVersionError(err)) {
        const itemId =
          options.itemId ||
          (options.path ? getCachedAuthoringPathId(options.path) : undefined);
        if (!itemId) throw err;
        const language = options.language || "en";
        warnCreateVerbose(
          `${AUTHORING_LOG} missing ${language} version for ${options.path || itemId}; addItemVersion then retry`,
        );
        await addItemVersion({
          itemId,
          language,
          database: options.database,
          endpointName: options.endpointName,
          auth: options.auth,
          fetchImpl: options.fetchImpl,
        });
        versionEnsured = true;
        continue;
      }
      if (!isMissingFieldError(err) || !fields.length) throw err;
      const missing = missingFieldNameFromError(err);
      const next = missing
        ? fields.filter((f) => !fieldNameEquals(f.name, missing))
        : fields.slice(0, -1);
      if (next.length === fields.length) throw err;
      if (missing) dropped.push(missing);
      fields = next;
      if (!fields.length) {
        console.warn(
          `${AUTHORING_LOG} updateItem skipped all fields` +
            (dropped.length ? ` (rejected: ${dropped.join(", ")})` : "") +
            ` for ${options.path || options.itemId}`,
        );
        const id = options.itemId
          ? normalizeId(options.itemId)
          : options.path
            ? getCachedAuthoringPathId(options.path)
            : undefined;
        if (!id) throw err;
        return cacheResult(options.path, id);
      }
      warnCreateVerbose(
        `${AUTHORING_LOG} updateItem omitted rejected field` +
          (missing ? ` "${missing}"` : "") +
          ` on ${options.path || options.itemId}; retrying with ${fields.length} field(s)`,
      );
    }
  }
}

function isNameExistsError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err || "");
  return (
    /already exists/i.test(text) ||
    /already defined/i.test(text) ||
    /defined on this level/i.test(text) ||
    /duplicate/i.test(text) ||
    /name is not unique/i.test(text) ||
    /item name.*exist/i.test(text) ||
    /An item with the same name/i.test(text)
  );
}

async function authoringGql(
  host: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const { runAuthoringGraphql } = await import("./authoring-graphql");
  return runAuthoringGraphql({
    host,
    token,
    query,
    variables,
    fetchImpl,
  });
}

async function resolveAuth(options?: {
  endpointName?: string;
  auth?: AuthoringAuth;
}): Promise<AuthoringAuth> {
  if (options?.auth) return options.auth;
  const auth = await resolveAuthoringGraphqlAuth({
    endpointName: options?.endpointName,
  });
  return { host: auth.host, token: auth.token };
}

function cacheResult(
  path: string | undefined,
  itemId: string,
): AuthoringItemResult {
  const id = normalizeId(itemId);
  if (path) cacheAuthoringPathId(path, id);
  return { itemId: id, path };
}

export async function createItem(
  options: CreateItemOptions,
): Promise<AuthoringItemResult> {
  const auth = await resolveAuth(options);
  const language = options.language || "en";
  const data = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: CreateItemInput!) {
      createItem(input: $input) {
        item { itemId name path }
      }
    }`,
    {
      input: {
        name: options.name,
        parent: formatAuthoringItemId(options.parentId),
        templateId: formatAuthoringItemId(options.templateId),
        language,
        ...(options.fields?.length
          ? {
              fields: options.fields.map((f) => ({
                name: f.name,
                value: f.value,
              })),
            }
          : {}),
      },
    },
    options.fetchImpl,
  );
  const item = (data.createItem as { item?: AuthoringItemResult } | undefined)
    ?.item;
  if (!item?.itemId) {
    throw new Error(
      `[bq:apply:authoring] createItem returned no itemId for "${options.name}"`,
    );
  }
  return cacheResult(item.path, item.itemId);
}

export async function updateItem(
  options: UpdateItemOptions,
): Promise<AuthoringItemResult> {
  if (!options.itemId && !options.path) {
    throw new Error("[bq:apply:authoring] updateItem requires itemId or path");
  }
  const auth = await resolveAuth(options);
  const language = options.language || "en";
  const input: Record<string, unknown> = {
    database: options.database || "master",
    language,
    fields: options.fields.map((f) => ({
      name: f.name,
      value: f.value,
      ...(f.reset != null ? { reset: f.reset } : {}),
    })),
  };
  if (options.itemId) {
    input.itemId = formatAuthoringItemId(options.itemId);
  }
  if (options.path) {
    input.path = options.path;
  }

  const data = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: UpdateItemInput!) {
      updateItem(input: $input) {
        item { itemId name path }
      }
    }`,
    { input },
    options.fetchImpl,
  );
  const item = (data.updateItem as { item?: AuthoringItemResult } | undefined)
    ?.item;
  if (!item?.itemId) {
    const fallbackId = options.itemId
      ? normalizeId(options.itemId)
      : options.path
        ? getCachedAuthoringPathId(options.path)
        : undefined;
    if (!fallbackId) {
      throw new Error(
        `[bq:apply:authoring] updateItem returned no itemId for ${options.itemId || options.path}`,
      );
    }
    return cacheResult(options.path || item?.path, fallbackId);
  }
  return cacheResult(item.path || options.path, item.itemId);
}

/**
 * Create a language version shell for an existing item (Authoring `addItemVersion`).
 * Required before `updateItem` when the item has no version in that language.
 */
export async function addItemVersion(
  options: AddItemVersionOptions,
): Promise<AuthoringItemResult> {
  const itemId = String(options.itemId || "").trim();
  if (!itemId) {
    throw new Error("[bq:apply:authoring] addItemVersion requires itemId");
  }
  const auth = await resolveAuth(options);
  const language = options.language || "en";
  const data = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: AddItemVersionInput!) {
      addItemVersion(input: $input) {
        item { itemId name path }
      }
    }`,
    {
      input: {
        database: options.database || "master",
        itemId: formatAuthoringItemId(itemId),
        language,
      },
    },
    options.fetchImpl,
  );
  const item = (
    data.addItemVersion as { item?: AuthoringItemResult } | undefined
  )?.item;
  if (!item?.itemId) {
    return cacheResult(item?.path, itemId);
  }
  return cacheResult(item.path, item.itemId);
}

/**
 * Read one field value from a CM item by Sitecore path (master).
 * Returns `""` when the item exists but the field is empty/absent, and
 * `undefined` when the value could not be determined (item missing / schema error)
 * so callers can fail closed instead of overwriting unknown content.
 */
export async function readItemFieldValue(options: {
  path: string;
  fieldName: string;
  /** Sitecore language/culture (e.g. `en`, `nl-BE`). Defaults to master language context. */
  language?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
}): Promise<string | undefined> {
  const sitecorePath = String(options.path || "").trim();
  const fieldName = String(options.fieldName || "").trim();
  if (!sitecorePath || !fieldName) return undefined;
  const auth = await resolveAuth(options);
  const language = String(options.language || "").trim();

  type FieldNode = { name?: string; value?: string | null };
  const whereClause = language
    ? `where: { path: $path, database: "master", language: $language }`
    : `where: { path: $path, database: "master" }`;
  const varDecl = language
    ? `$path: String!, $name: String!, $language: String!`
    : `$path: String!, $name: String!`;
  const listVarDecl = language
    ? `$path: String!, $language: String!`
    : `$path: String!`;
  const baseVars: Record<string, unknown> = language
    ? { path: sitecorePath, name: fieldName, language }
    : { path: sitecorePath, name: fieldName };
  const listVars: Record<string, unknown> = language
    ? { path: sitecorePath, language }
    : { path: sitecorePath };

  const queries: Array<{
    query: string;
    variables: Record<string, unknown>;
    pick: (item: unknown) => string | undefined;
  }> = [
    {
      variables: baseVars,
      query: `query(${varDecl}) {
        item(${whereClause}) {
          field(name: $name) { value }
        }
      }`,
      pick: (item) => {
        const row = item as { field?: { value?: string | null } | null } | null;
        if (!row) return undefined;
        return String(row.field?.value ?? "");
      },
    },
    {
      variables: listVars,
      query: `query(${listVarDecl}) {
        item(${whereClause}) {
          fields(ownFields: true) { nodes { name value } }
        }
      }`,
      pick: (item) => {
        const row = item as { fields?: { nodes?: FieldNode[] } } | null;
        if (!row) return undefined;
        const hit = (row.fields?.nodes || []).find(
          (n) => String(n.name || "").toLowerCase() === fieldName.toLowerCase(),
        );
        return String(hit?.value ?? "");
      },
    },
  ];

  for (const { query, variables, pick } of queries) {
    try {
      const data = await authoringGql(
        auth.host,
        auth.token,
        query,
        variables,
        options.fetchImpl,
      );
      const picked = pick(data.item);
      if (picked !== undefined) return picked;
    } catch {
      /* try next query shape */
    }
  }
  return undefined;
}

/**
 * Idempotent upsert by Sitecore path:
 * find → update; miss → create; create race → re-find → update.
 */
export async function ensureItemByPath(
  options: EnsureItemByPathOptions,
): Promise<AuthoringItemResult & { created: boolean }> {
  const rawPath = String(options.path || "").trim();
  if (!rawPath) {
    throw new Error("[bq:apply:authoring] ensureItemByPath requires path");
  }
  // Choke point: Path leaf + create name always go through naming.ts helpers
  // so InvalidItemNameChars (e.g. quotes from JSON.stringify Path names) never
  // reach Authoring GraphQL createItem.
  const sitecorePath = proposeValidSitecorePath(rawPath);
  const rawName = options.name || leafNameFromPath(sitecorePath);
  const name = proposeValidItemName(
    rawName,
    leafNameFromPath(sitecorePath) || "unnamed-item",
  );
  const language = options.language || "en";
  const fields = options.fields || [];

  const cached = getCachedAuthoringPathId(sitecorePath);
  let existingId = cached;
  if (!existingId) {
    const hit = await findItemByPath({
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    existingId = hit?.itemId;
  }

  const updateOpts = {
    path: sitecorePath,
    language,
    fields,
    endpointName: options.endpointName,
    auth: options.auth,
    fetchImpl: options.fetchImpl,
  };

  if (existingId) {
    if (fields.length) {
      const updated = await updateItemToleratingMissingFields({
        ...updateOpts,
        itemId: existingId,
      });
      return { ...updated, created: false };
    }
    const cachedHit = cacheResult(sitecorePath, existingId);
    return { ...cachedHit, created: false };
  }

  try {
    // Create without fields, then update — createItem rejects many system fields.
    const created = await createItem({
      name,
      parentId: options.parentId,
      templateId: options.templateId,
      language,
      fields: [],
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    cacheAuthoringPathId(sitecorePath, created.itemId);
    if (fields.length) {
      const updated = await updateItemToleratingMissingFields({
        ...updateOpts,
        itemId: created.itemId,
      });
      return {
        ...updated,
        path: updated.path || created.path || sitecorePath,
        created: true,
      };
    }
    return { ...created, path: created.path || sitecorePath, created: true };
  } catch (err) {
    if (!isNameExistsError(err)) throw err;
    const again = await findItemByPath({
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    if (!again?.itemId) throw err;
    if (fields.length) {
      const updated = await updateItemToleratingMissingFields({
        ...updateOpts,
        itemId: again.itemId,
      });
      return { ...updated, created: false };
    }
    return { ...cacheResult(sitecorePath, again.itemId), created: false };
  }
}

export async function createItemTemplate(
  options: CreateItemTemplateOptions,
): Promise<AuthoringItemResult> {
  const auth = await resolveAuth(options);
  const baseTemplates = formatBaseTemplateIds(options.baseTemplates);
  const data = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: CreateItemTemplateInput!) {
      createItemTemplate(input: $input) {
        itemTemplate {
          name
          ownFields { nodes { name type } }
        }
      }
    }`,
    {
      input: {
        name: options.name,
        parent: formatAuthoringItemId(options.parentId),
        ...(options.icon ? { icon: options.icon } : {}),
        ...(baseTemplates ? { baseTemplates } : {}),
        ...(options.sections?.length
          ? {
              sections: options.sections.map((s) => ({
                name: s.name,
                ...(s.templateSectionId
                  ? {
                      templateSectionId: formatAuthoringItemId(
                        s.templateSectionId,
                      ),
                    }
                  : {}),
                ...(s.fields?.length
                  ? {
                      fields: s.fields.map((f) => ({
                        name: f.name,
                        ...(f.type ? { type: f.type } : {}),
                        ...(f.fieldId
                          ? { fieldId: formatAuthoringItemId(f.fieldId) }
                          : {}),
                      })),
                    }
                  : {}),
              })),
            }
          : {}),
      },
    },
    options.fetchImpl,
  );

  const templatePath =
    options.path ||
    (await inferChildPath(options.parentId, options.name, options));
  if (templatePath) {
    const hit = await findItemByPath({
      path: templatePath,
      endpointName: options.endpointName,
      auth,
      fetchImpl: options.fetchImpl,
    });
    if (hit?.itemId) {
      return cacheResult(templatePath, hit.itemId);
    }
  }

  const name = (
    data.createItemTemplate as
      | { itemTemplate?: { name?: string } }
      | undefined
  )?.itemTemplate?.name;
  if (!name) {
    throw new Error(
      `[bq:apply:authoring] createItemTemplate failed for "${options.name}"`,
    );
  }
  throw new Error(
    `[bq:apply:authoring] createItemTemplate created "${options.name}" but path lookup failed` +
      (templatePath ? ` (${templatePath})` : ""),
  );
}

async function inferChildPath(
  parentId: string,
  name: string,
  options: {
    endpointName?: string;
    auth?: AuthoringAuth;
    fetchImpl?: typeof fetch;
  },
): Promise<string | undefined> {
  try {
    const auth = await resolveAuth(options);
    const data = await authoringGql(
      auth.host,
      auth.token,
      `query($id: String!) {
        item(where: { itemId: $id, database: "master" }) { path }
      }`,
      { id: formatAuthoringItemId(parentId) },
      options.fetchImpl,
    );
    const parentPath = (data.item as { path?: string } | null | undefined)?.path;
    if (!parentPath) return undefined;
    return `${parentPath.replace(/\/$/, "")}/${name}`;
  } catch {
    return undefined;
  }
}

export async function updateItemTemplate(
  options: UpdateItemTemplateOptions,
): Promise<AuthoringItemResult> {
  const auth = await resolveAuth(options);
  const baseTemplates = formatBaseTemplateIds(options.baseTemplates);
  await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: UpdateItemTemplateInput!) {
      updateItemTemplate(input: $input) {
        itemTemplate {
          name
          ownFields { nodes { name type } }
        }
      }
    }`,
    {
      input: {
        templateId: formatAuthoringItemId(options.templateId),
        ...(options.name ? { name: options.name } : {}),
        ...(options.icon ? { icon: options.icon } : {}),
        ...(baseTemplates ? { baseTemplates } : {}),
        ...(options.sections?.length
          ? {
              sections: options.sections.map((s) => ({
                name: s.name,
                ...(s.templateSectionId
                  ? {
                      templateSectionId: formatAuthoringItemId(
                        s.templateSectionId,
                      ),
                    }
                  : {}),
                ...(s.fields?.length
                  ? {
                      fields: s.fields.map((f) => ({
                        name: f.name,
                        ...(f.type ? { type: f.type } : {}),
                        ...(f.fieldId
                          ? { fieldId: formatAuthoringItemId(f.fieldId) }
                          : {}),
                      })),
                    }
                  : {}),
              })),
            }
          : {}),
      },
    },
    options.fetchImpl,
  );

  const id = normalizeId(options.templateId);
  if (options.path) cacheAuthoringPathId(options.path, id);
  return { itemId: id, path: options.path };
}

/**
 * Idempotent template ensure: path lookup → updateItemTemplate, else createItemTemplate.
 */
export async function ensureItemTemplate(options: {
  path: string;
  parentId: string;
  name?: string;
  sections?: AuthoringTemplateSectionInput[];
  /** Base template IDs (Authoring `baseTemplates`). */
  baseTemplates?: string[];
  /** Sitecore icon path for the template definition. */
  icon?: string;
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
}): Promise<AuthoringItemResult & { created: boolean }> {
  const sitecorePath = String(options.path || "").trim();
  const name = options.name || leafNameFromPath(sitecorePath);
  const cached = getCachedAuthoringPathId(sitecorePath);
  let existingId = cached;
  if (!existingId) {
    const hit = await findItemByPath({
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    existingId = hit?.itemId;
  }

  if (existingId) {
    const updated = await updateItemTemplate({
      templateId: existingId,
      name,
      sections: options.sections,
      baseTemplates: options.baseTemplates,
      icon: options.icon,
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    return { ...updated, created: false };
  }

  try {
    const created = await createItemTemplate({
      name,
      parentId: options.parentId,
      sections: options.sections,
      baseTemplates: options.baseTemplates,
      icon: options.icon,
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    return { ...created, created: true };
  } catch (err) {
    if (!isNameExistsError(err)) throw err;
    const again = await findItemByPath({
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    if (!again?.itemId) throw err;
    const updated = await updateItemTemplate({
      templateId: again.itemId,
      name,
      sections: options.sections,
      baseTemplates: options.baseTemplates,
      icon: options.icon,
      path: sitecorePath,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    return { ...updated, created: false };
  }
}

export async function uploadMedia(
  options: UploadMediaOptions,
): Promise<AuthoringItemResult & { created: boolean }> {
  const { readFile } = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const auth = await resolveAuth(options);
  const itemPath = String(options.itemPath || "").replace(/^\/+/, "");
  const sitecorePath =
    options.sitecorePath ||
    `/sitecore/media library/${itemPath.replace(/^sitecore\/media library\//i, "")}`;

  const existing = await findItemByPath({
    path: sitecorePath,
    endpointName: options.endpointName,
    auth,
    fetchImpl: options.fetchImpl,
  });

  const gqlData = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: UploadMediaInput!) {
      uploadMedia(input: $input) {
        presignedUploadUrl
      }
    }`,
    {
      input: {
        itemPath,
        ...(options.alt != null ? { alt: options.alt } : {}),
        overwriteExisting: options.overwriteExisting !== false,
      },
    },
    options.fetchImpl,
  );

  const presigned = (
    gqlData.uploadMedia as { presignedUploadUrl?: string } | undefined
  )?.presignedUploadUrl;
  if (!presigned) {
    throw new Error(
      `[bq:apply:authoring] uploadMedia returned no presignedUploadUrl for ${itemPath}`,
    );
  }

  const bytes = await readFile(options.filePath);
  const fileName = pathMod.basename(options.filePath);

  const fetchImpl = options.fetchImpl || fetch;
  const {
    recordApplyApiCall,
    redactApplyApiPayload,
  } = await import("./apply-api-run-log");
  const {
    SITECORE_CONNECTION_MAX_RETRIES,
    SITECORE_CONNECTION_RETRY_DELAY_MS,
  } = await import("./sitecore-auth");
  const { isRetryableAuthoringFailure } = await import("./authoring-graphql");

  const uploadStarted = Date.now();
  let uploadAttempts = 0;
  let uploadRes: Response | undefined;
  let uploadText = "";
  let uploadJson: Record<string, unknown> = {};
  let lastUploadErr: unknown;
  const maxUploadRetries = SITECORE_CONNECTION_MAX_RETRIES;
  while (uploadAttempts <= maxUploadRetries) {
    uploadAttempts += 1;
    try {
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type: "application/octet-stream" }),
        fileName,
      );
      uploadRes = await fetchImpl(presigned, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: form,
      });
      uploadText = await uploadRes.text();
      try {
        uploadJson = JSON.parse(uploadText) as Record<string, unknown>;
      } catch {
        uploadJson = { raw: uploadText };
      }
      if (!uploadRes.ok) {
        throw new Error(
          `[bq:apply:authoring] media upload POST failed HTTP ${uploadRes.status}: ${uploadText.slice(0, 400)}`,
        );
      }
      lastUploadErr = undefined;
      break;
    } catch (err) {
      lastUploadErr = err;
      if (
        uploadAttempts > maxUploadRetries ||
        !isRetryableAuthoringFailure(err)
      ) {
        break;
      }
      console.warn(
        `[bq:apply:authoring] media upload retry ${uploadAttempts}/${maxUploadRetries}: ` +
          `${err instanceof Error ? err.message.slice(0, 120) : String(err)}`,
      );
      await new Promise((r) =>
        setTimeout(r, SITECORE_CONNECTION_RETRY_DELAY_MS),
      );
    }
  }
  if (lastUploadErr || !uploadRes?.ok) {
    const msg =
      lastUploadErr instanceof Error
        ? lastUploadErr.message
        : String(lastUploadErr || `HTTP ${uploadRes?.status}`);
    recordApplyApiCall({
      kind: "media-upload",
      operation: "uploadMediaBinary",
      durationMs: Date.now() - uploadStarted,
      ok: false,
      attempts: uploadAttempts,
      error: msg.slice(0, 2000),
      summary: { itemPath, sitecorePath },
    });
    throw lastUploadErr instanceof Error
      ? lastUploadErr
      : new Error(msg);
  }
  recordApplyApiCall({
    kind: "media-upload",
    operation: "uploadMediaBinary",
    durationMs: Date.now() - uploadStarted,
    ok: true,
    attempts: uploadAttempts,
    summary: {
      itemPath,
      sitecorePath,
      status: uploadRes.status,
      itemId:
        (uploadJson.Id as string) ||
        (uploadJson.id as string) ||
        (uploadJson.itemId as string) ||
        undefined,
    },
    detail: { response: redactApplyApiPayload(uploadJson) },
  });

  const mediaIdRaw =
    (uploadJson.Id as string) ||
    (uploadJson.id as string) ||
    (uploadJson.itemId as string) ||
    (uploadJson.ItemId as string) ||
    existing?.itemId;

  if (!mediaIdRaw) {
    const hit = await findItemByPath({
      path: sitecorePath,
      endpointName: options.endpointName,
      auth,
      fetchImpl: options.fetchImpl,
    });
    if (!hit?.itemId) {
      throw new Error(
        `[bq:apply:authoring] uploadMedia completed but no media itemId for ${sitecorePath}`,
      );
    }
    if (options.alt) {
      await updateItem({
        itemId: hit.itemId,
        language: options.language || "en",
        fields: [{ name: "Alt", value: options.alt }],
        endpointName: options.endpointName,
        auth,
        fetchImpl: options.fetchImpl,
      });
    }
    return { ...cacheResult(sitecorePath, hit.itemId), created: !existing };
  }

  const mediaId = normalizeId(String(mediaIdRaw));
  if (options.alt) {
    await updateItem({
      itemId: mediaId,
      language: options.language || "en",
      fields: [{ name: "Alt", value: options.alt }],
      endpointName: options.endpointName,
      auth,
      fetchImpl: options.fetchImpl,
    }).catch(() => undefined);
  }
  return { ...cacheResult(sitecorePath, mediaId), created: !existing };
}

/** @internal exported for tests */
export const __test = {
  isNameExistsError,
  isMissingLanguageVersionError,
  leafNameFromPath,
  formatBaseTemplateIds,
};
