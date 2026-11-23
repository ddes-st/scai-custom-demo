/**
 * Sitecore Sites API client (HTTP only).
 * Collection / site / language CRUD + job polling. No ser pull/push or local YAML.
 */
import {
  AUTH_WALKTHROUGH,
  authFailureHint,
  resolveEnvironmentId,
  resolveSitecoreEndpoint,
  resolveSitesApiAccessToken,
  type SitecoreCliEndpoint,
} from "../../shared/sitecore-auth";
import type { SitesApiOptions } from "../types";
import { sanitizeSingleLineText } from "../../shared/naming";

const SITES_API_BASE =
  process.env.BQ_SITES_API_BASE?.trim() ||
  "https://xmapps-api.sitecorecloud.io";

export type SitesApiContext = {
  endpoint: SitecoreCliEndpoint;
  environmentId: string;
  token: string;
};

export type ApiCollection = {
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
};

export type ApiSite = {
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
  description?: string | null;
  collectionId?: string | null;
  /** Sitecore Stream brand kit id associated with this site. */
  brandKitId?: string | null;
  /** Languages in use / returned on some payloads. */
  languages?: string[] | null;
  /** Supported languages (Settings Treelist) — PATCH field name. */
  supportedLanguages?: string[] | null;
};

/**
 * Normalize site supported-language culture codes: always include `en`,
 * collapse `en-*` → `en`, dedupe case-insensitively (preserve first casing).
 */
export function normalizeSiteSupportedLanguages(
  languages: Iterable<string | null | undefined> | null | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const t = String(raw || "").trim();
    if (!t) return;
    const key = t.toLowerCase();
    const value = key === "en" || key.startsWith("en-") ? "en" : t;
    if (seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    out.push(value);
  };
  add("en");
  if (languages) {
    for (const l of languages) add(l);
  }
  return out;
}

/** Remote site supported set from GET site payload. */
export function remoteSiteSupportedLanguages(site: ApiSite): string[] {
  const raw = site.supportedLanguages ?? site.languages ?? [];
  return normalizeSiteSupportedLanguages(
    Array.isArray(raw) ? raw.map((v) => String(v ?? "")) : [],
  );
}

export function mergeSiteSupportedLanguages(
  existing: string[],
  needed: string[],
): string[] {
  return normalizeSiteSupportedLanguages([...existing, ...needed]);
}

/** True when any needed culture is missing from the remote supported list. */
export function siteSupportedLanguagesIncomplete(
  remote: string[],
  needed: string[],
): boolean {
  const have = new Set(remote.map((c) => c.toLowerCase()));
  return needed.some((c) => !have.has(String(c).toLowerCase()));
}

export type ApiSiteTemplate = {
  id?: string | null;
  name?: string | null;
  enabled?: boolean;
};

/** Sites API Language object (`GET/POST /api/v1/languages`). */
export type ApiLanguage = {
  id?: string | null;
  iso?: string | null;
  regionalIsoCode?: string | null;
  name?: string | null;
  displayName?: string | null;
  nativeName?: string | null;
  englishName?: string | null;
  fallbackLanguageIso?: string | null;
};

export type CreateLanguageViaApiInput = {
  /** ISO language code, e.g. `nl` (required by Sites API). */
  languageCode: string;
  /** Item / culture name, e.g. `nl-NL`. */
  name?: string;
  /** Region segment only, e.g. `NL` for `nl-NL`. */
  regionCode?: string;
  charset?: string;
  codePage?: string;
  encoding?: string;
  database?: string;
  fallbackLanguage?: string;
  spellChecker?: string;
  customCode?: string;
};

export type JobStatus = {
  name?: string | null;
  handle?: string | null;
  status?: string | null;
  state?: string | null;
  /** Official Sites API field — true when job finished. */
  done?: boolean;
  isCompleted?: boolean;
  isFailed?: boolean;
  error?: string | null;
  message?: string | null;
  site?: string | null;
  siteCollection?: string | null;
  jobType?: string | null;
  queueTime?: string | null;
  endTime?: string | null;
  statistics?: {
    itemsProcessed?: number | null;
    pagesProcessed?: number | null;
  } | null;
};

function envQuery(environmentId: string): string {
  // Official Sites API docs use `environmentId`; some OpenAPI builds use `sc_env`.
  const id = encodeURIComponent(environmentId);
  return `environmentId=${id}&sc_env=${id}`;
}

async function sitesFetch<T>(
  ctx: SitesApiContext,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<{ status: number; data: T | undefined; raw: string }> {
  const {
    SITECORE_CONNECTION_MAX_RETRIES,
    SITECORE_CONNECTION_RETRY_DELAY_MS,
  } = await import("../../shared/sitecore-auth");
  const { isRetryableAuthoringFailure } = await import(
    "../../shared/authoring-graphql"
  );
  const {
    recordApplyApiCall,
    redactApplyApiPayload,
  } = await import("../../shared/apply-api-run-log");

  const url = `${SITES_API_BASE}${apiPath}${apiPath.includes("?") ? "&" : "?"}${envQuery(ctx.environmentId)}`;
  const started = Date.now();
  let attempts = 0;
  let lastErr: unknown;
  const maxRetries = SITECORE_CONNECTION_MAX_RETRIES;

  while (attempts <= maxRetries) {
    attempts += 1;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${ctx.token}`,
          Accept: "application/json",
          ...(body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const raw = await response.text().catch(() => "");
      let data: T | undefined;
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as T;
        } catch {
          data = undefined;
        }
      }

      if (!response.ok) {
        const hint = authFailureHint(response.status);
        throw new Error(
          `[bq:apply:sites-api] ${method} ${apiPath} failed (${response.status}).${hint} ` +
            `${raw.slice(0, 500)}`,
        );
      }

      const idGuess =
        data && typeof data === "object"
          ? ((data as { id?: string; systemName?: string }).id ??
            (data as { systemName?: string }).systemName)
          : undefined;
      recordApplyApiCall({
        kind: "sites-rest",
        operation: `${method} ${apiPath}`,
        durationMs: Date.now() - started,
        ok: true,
        attempts,
        summary: {
          method,
          path: apiPath,
          status: response.status,
          id: idGuess,
        },
        detail: {
          body: redactApplyApiPayload(body),
          data: redactApplyApiPayload(data),
        },
      });

      return { status: response.status, data, raw };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempts > maxRetries || !isRetryableAuthoringFailure(err)) {
        recordApplyApiCall({
          kind: "sites-rest",
          operation: `${method} ${apiPath}`,
          durationMs: Date.now() - started,
          ok: false,
          attempts,
          error: msg.slice(0, 2000),
          summary: { method, path: apiPath },
          detail: { body: redactApplyApiPayload(body) },
        });
        throw err;
      }
      console.warn(
        `[bq:apply:sites-api] retry ${attempts}/${maxRetries} ${method} ${apiPath}: ${msg.slice(0, 160)}`,
      );
      await new Promise((r) =>
        setTimeout(r, SITECORE_CONNECTION_RETRY_DELAY_MS),
      );
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function createSitesApiContext(
  options?: SitesApiOptions,
): Promise<SitesApiContext> {
  const endpoint = resolveSitecoreEndpoint(options?.endpointName);
  const environmentId = resolveEnvironmentId({
    environmentId: options?.environmentId,
    endpoint,
  });
  const token = await resolveSitesApiAccessToken(endpoint, {
    clientId: options?.clientId,
    clientSecret: options?.clientSecret,
  });
  return { endpoint, environmentId, token };
}

export async function listCollections(
  ctx: SitesApiContext,
): Promise<ApiCollection[]> {
  const { data } = await sitesFetch<ApiCollection[] | { data?: ApiCollection[] }>(
    ctx,
    "GET",
    "/api/v1/collections",
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * List languages already added to the environment.
 * @see https://api-docs.sitecore.com/sai/sites-api/languages/listlanguages
 */
export async function listLanguagesViaApi(
  ctx: SitesApiContext,
): Promise<ApiLanguage[]> {
  const { data } = await sitesFetch<ApiLanguage[] | { data?: ApiLanguage[] }>(
    ctx,
    "GET",
    "/api/v1/languages",
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function languageMatchesCulture(lang: ApiLanguage, culture: string): boolean {
  const needle = culture.trim().toLowerCase();
  if (!needle) return false;
  const candidates = [lang.name, lang.regionalIsoCode, lang.iso]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);
  return candidates.includes(needle);
}

export async function findLanguageByCulture(
  ctx: SitesApiContext,
  culture: string,
  cached?: ApiLanguage[],
): Promise<ApiLanguage | undefined> {
  const all = cached ?? (await listLanguagesViaApi(ctx));
  return all.find((l) => languageMatchesCulture(l, culture));
}

/**
 * Add a language to the environment (creates `/sitecore/system/Languages/{name}`).
 * @see https://api-docs.sitecore.com/sai/sites-api/languages/createlanguage
 */
export async function createLanguageViaApi(
  ctx: SitesApiContext,
  input: CreateLanguageViaApiInput,
): Promise<ApiLanguage | undefined> {
  const languageCode = String(input.languageCode || "").trim();
  if (!languageCode) {
    throw new Error(
      "[bq:apply:sites-api] createLanguageViaApi requires languageCode",
    );
  }
  const body: Record<string, string> = {
    languageCode,
    database: input.database || "master",
  };
  if (input.name?.trim()) body.name = input.name.trim();
  if (input.regionCode?.trim()) body.regionCode = input.regionCode.trim();
  if (input.charset?.trim()) body.charset = input.charset.trim();
  if (input.codePage?.trim()) body.codePage = input.codePage.trim();
  if (input.encoding?.trim()) body.encoding = input.encoding.trim();
  if (input.fallbackLanguage?.trim()) {
    body.fallbackLanguage = input.fallbackLanguage.trim();
  }
  if (input.spellChecker?.trim()) body.spellChecker = input.spellChecker.trim();
  if (input.customCode?.trim()) body.customCode = input.customCode.trim();

  const { data } = await sitesFetch<ApiLanguage>(
    ctx,
    "POST",
    "/api/v1/languages",
    body,
  );
  return data;
}

export async function findCollectionByName(
  ctx: SitesApiContext,
  systemName: string,
): Promise<ApiCollection | undefined> {
  const needle = systemName.trim().toLowerCase();
  const all = await listCollections(ctx);
  return all.find((c) => (c.name ?? "").trim().toLowerCase() === needle);
}

function normalizeId(id: string | null | undefined): string | undefined {
  const cleaned = id?.replace(/[{}]/g, "").trim();
  return cleaned || undefined;
}

function textChanged(
  remote: string | null | undefined,
  next: string | undefined,
): boolean {
  if (next === undefined) return false;
  return (remote ?? "").trim() !== next.trim();
}

export async function updateCollectionViaApi(
  ctx: SitesApiContext,
  collectionId: string,
  input: { displayName?: string; description?: string },
): Promise<ApiCollection | undefined> {
  const id = normalizeId(collectionId);
  if (!id) throw new Error("[bq:apply:sites-api] update collection requires collectionId");
  const { data } = await sitesFetch<ApiCollection>(
    ctx,
    "PATCH",
    `/api/v1/collections/${encodeURIComponent(id)}`,
    {
      displayName:
        input.displayName !== undefined
          ? sanitizeSingleLineText(input.displayName)
          : undefined,
      description:
        input.description !== undefined
          ? sanitizeSingleLineText(input.description)
          : undefined,
    },
  );
  return data;
}

export async function renameCollectionViaApi(
  ctx: SitesApiContext,
  collectionId: string,
  systemName: string,
): Promise<string | undefined> {
  const id = normalizeId(collectionId);
  if (!id) throw new Error("[bq:apply:sites-api] rename collection requires collectionId");
  const { data } = await sitesFetch<{ handle?: string }>(
    ctx,
    "POST",
    `/api/v1/collections/${encodeURIComponent(id)}/rename`,
    { systemName },
  );
  const handle = data?.handle ?? undefined;
  if (handle) {
    await waitForJob(ctx, handle, {
      isReady: async () => Boolean((await findCollectionByName(ctx, systemName))?.name),
    });
  }
  return handle;
}

export async function deleteCollectionViaApi(
  ctx: SitesApiContext,
  collectionId: string,
): Promise<{ handle?: string; deleted: boolean }> {
  const id = normalizeId(collectionId);
  if (!id) throw new Error("[bq:apply:sites-api] delete collection requires collectionId");
  const { data } = await sitesFetch<{ handle?: string }>(
    ctx,
    "DELETE",
    `/api/v1/collections/${encodeURIComponent(id)}`,
  );
  const handle = data?.handle ?? undefined;
  if (handle) {
    await waitForJob(ctx, handle, {
      isReady: async () => {
        const all = await listCollections(ctx);
        return !all.some((c) => normalizeId(c.id) === id);
      },
    });
  }
  return { handle, deleted: true };
}

export type SyncCollectionResult = {
  collection?: ApiCollection;
  handle?: string;
  /** created | updated | renamed | unchanged | deleted | missing */
  action: "created" | "updated" | "unchanged" | "deleted" | "missing";
  mutated: boolean;
};

/**
 * Create, update, rename, or delete a collection via Sites API.
 */
export async function syncCollectionViaApi(
  ctx: SitesApiContext,
  input: {
    name: string;
    displayName?: string;
    description?: string;
    previousSystemName?: string;
    delete?: boolean;
  },
): Promise<SyncCollectionResult> {
  const lookupNames = [
    input.name,
    ...(input.previousSystemName?.trim()
      ? [input.previousSystemName.trim()]
      : []),
  ];
  let existing: ApiCollection | undefined;
  for (const candidate of lookupNames) {
    existing = await findCollectionByName(ctx, candidate);
    if (existing?.id) break;
  }

  if (input.delete) {
    if (!existing?.id) {
      console.log(
        `[bq:apply:sites-api] collection "${input.name}" not found remotely — nothing to delete`,
      );
      return { action: "missing", mutated: false };
    }
    await deleteCollectionViaApi(ctx, existing.id);
    console.log(
      `[bq:apply:sites-api] collection "${existing.name}" deleted (id=${existing.id})`,
    );
    return { collection: existing, action: "deleted", mutated: true };
  }

  if (!existing?.id) {
    const { data } = await sitesFetch<{ handle?: string }>(
      ctx,
      "POST",
      "/api/v1/collections",
      {
        name: input.name,
        displayName: sanitizeSingleLineText(
          input.displayName ?? input.name,
        ),
        description:
          input.description !== undefined
            ? sanitizeSingleLineText(input.description)
            : undefined,
      },
    );

    const handle = data?.handle ?? undefined;
    const isReady = async () =>
      Boolean((await findCollectionByName(ctx, input.name))?.name);
    if (handle) await waitForJob(ctx, handle, { isReady });

    const created = await pollUntil(
      () => findCollectionByName(ctx, input.name),
      (collection) => Boolean(collection?.id || collection?.name),
      { label: `collection "${input.name}"`, timeoutMs: 180_000 },
    );

    return { collection: created, handle, action: "created", mutated: true };
  }

  let mutated = false;
  const id = existing.id;
  const remoteSystem = (existing.name ?? "").trim();
  if (remoteSystem && remoteSystem.toLowerCase() !== input.name.toLowerCase()) {
    console.log(
      `[bq:apply:sites-api] renaming collection "${remoteSystem}" → "${input.name}"`,
    );
    await renameCollectionViaApi(ctx, id, input.name);
    mutated = true;
  }

  const displayName = sanitizeSingleLineText(
    input.displayName ?? input.name,
  );
  const description =
    input.description !== undefined
      ? sanitizeSingleLineText(input.description)
      : undefined;
  const needsPatch =
    textChanged(existing.displayName, displayName) ||
    textChanged(existing.description, description);

  if (needsPatch) {
    console.log(
      `[bq:apply:sites-api] updating collection "${input.name}" (displayName/description)`,
    );
    const updated = await updateCollectionViaApi(ctx, id, {
      displayName,
      description,
    });
    return {
      collection: updated ?? (await findCollectionByName(ctx, input.name)),
      action: "updated",
      mutated: true,
    };
  }

  if (mutated) {
    const renamed = await findCollectionByName(ctx, input.name);
    return { collection: renamed ?? existing, action: "updated", mutated: true };
  }

  console.log(
    `[bq:apply:sites-api] collection "${input.name}" already up to date (id=${id})`,
  );
  return { collection: existing, action: "unchanged", mutated: false };
}

/** @deprecated Prefer {@link syncCollectionViaApi}. */
export async function createCollectionViaApi(
  ctx: SitesApiContext,
  input: { name: string; displayName?: string; description?: string },
): Promise<{ collection?: ApiCollection; handle?: string; reused: boolean }> {
  const result = await syncCollectionViaApi(ctx, input);
  return {
    collection: result.collection,
    handle: result.handle,
    reused: result.action === "unchanged" || result.action === "updated",
  };
}

export async function listSites(ctx: SitesApiContext): Promise<ApiSite[]> {
  const { data } = await sitesFetch<ApiSite[] | { data?: ApiSite[] }>(
    ctx,
    "GET",
    "/api/v1/sites",
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function findSiteByName(
  ctx: SitesApiContext,
  systemName: string,
): Promise<ApiSite | undefined> {
  const needle = systemName.trim().toLowerCase();
  const all = await listSites(ctx);
  return all.find((s) => (s.name ?? "").trim().toLowerCase() === needle);
}

export async function listSiteTemplates(
  ctx: SitesApiContext,
): Promise<ApiSiteTemplate[]> {
  const { data } = await sitesFetch<
    ApiSiteTemplate[] | { data?: ApiSiteTemplate[] }
  >(ctx, "GET", "/api/v1/sites/templates");
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function resolveSiteTemplateId(
  ctx: SitesApiContext,
  options?: { templateId?: string; templateName?: string },
): Promise<string> {
  if (options?.templateId?.trim()) return options.templateId.trim();

  const want = (options?.templateName?.trim() || "Basic").toLowerCase();
  const templates = await listSiteTemplates(ctx);
  const match =
    templates.find((t) => (t.name ?? "").trim().toLowerCase() === want) ||
    templates.find((t) => t.enabled !== false);

  const id = match?.id?.replace(/[{}]/g, "").trim();
  if (!id) {
    throw new Error(
      `[bq:apply:sites-api] No site template found (looked for "${want}"). ` +
        `Pass api.templateId explicitly.`,
    );
  }
  return id;
}

export async function updateSiteViaApi(
  ctx: SitesApiContext,
  siteId: string,
  input: {
    displayName?: string;
    description?: string;
    brandKitId?: string | null;
    /** Culture codes for Settings Supported languages (PATCH field). */
    supportedLanguages?: string[];
  },
): Promise<ApiSite | undefined> {
  const id = normalizeId(siteId);
  if (!id) throw new Error("[bq:apply:sites-api] update site requires siteId");
  const body: Record<string, unknown> = {};
  if (input.displayName !== undefined) {
    body.displayName = sanitizeSingleLineText(input.displayName);
  }
  if (input.description !== undefined) {
    body.description = sanitizeSingleLineText(input.description);
  }
  if (input.brandKitId !== undefined) body.brandKitId = input.brandKitId;
  if (input.supportedLanguages !== undefined) {
    body.supportedLanguages = normalizeSiteSupportedLanguages(
      input.supportedLanguages,
    );
  }
  const { data } = await sitesFetch<ApiSite>(
    ctx,
    "PATCH",
    `/api/v1/sites/${encodeURIComponent(id)}`,
    body,
  );
  return data;
}

export async function renameSiteViaApi(
  ctx: SitesApiContext,
  siteId: string,
  name: string,
): Promise<string | undefined> {
  const id = normalizeId(siteId);
  if (!id) throw new Error("[bq:apply:sites-api] rename site requires siteId");
  const { data } = await sitesFetch<{ handle?: string }>(
    ctx,
    "POST",
    `/api/v1/sites/${encodeURIComponent(id)}/rename`,
    { name },
  );
  const handle = data?.handle ?? undefined;
  if (handle) {
    await waitForJob(ctx, handle, {
      isReady: async () => Boolean((await findSiteByName(ctx, name))?.name),
    });
  }
  return handle;
}

export async function deleteSiteViaApi(
  ctx: SitesApiContext,
  siteId: string,
  options?: { force?: boolean },
): Promise<{ handle?: string; deleted: boolean }> {
  const id = normalizeId(siteId);
  if (!id) throw new Error("[bq:apply:sites-api] delete site requires siteId");
  const apiPath = options?.force
    ? `/api/v1/sites/${encodeURIComponent(id)}?force=true`
    : `/api/v1/sites/${encodeURIComponent(id)}`;
  const { data } = await sitesFetch<{ handle?: string }>(
    ctx,
    "DELETE",
    apiPath,
  );
  const handle = data?.handle ?? undefined;
  if (handle) {
    await waitForJob(ctx, handle, {
      isReady: async () => {
        const all = await listSites(ctx);
        return !all.some((s) => normalizeId(s.id) === id);
      },
    });
  }
  return { handle, deleted: true };
}

export type SyncSiteResult = {
  site?: ApiSite;
  handle?: string;
  action: "created" | "updated" | "unchanged" | "deleted" | "missing";
  mutated: boolean;
};

/**
 * Create, update, rename, or delete a site via Sites API.
 */
export async function syncSiteViaApi(
  ctx: SitesApiContext,
  input: {
    siteName: string;
    displayName?: string;
    description?: string;
    previousSystemName?: string;
    delete?: boolean;
    forceDelete?: boolean;
    language?: string;
    languages?: string[];
    templateId?: string;
    hostName?: string;
    collectionId?: string;
    collectionName?: string;
    collectionDisplayName?: string;
    collectionDescription?: string;
    /** Associate Sitecore Stream brand kit with the site. */
    brandKitId?: string | null;
  },
): Promise<SyncSiteResult> {
  const lookupNames = [
    input.siteName,
    ...(input.previousSystemName?.trim()
      ? [input.previousSystemName.trim()]
      : []),
  ];
  let existing: ApiSite | undefined;
  for (const candidate of lookupNames) {
    existing = await findSiteByName(ctx, candidate);
    if (existing?.id) break;
  }

  if (input.delete) {
    if (!existing?.id) {
      console.log(
        `[bq:apply:sites-api] site "${input.siteName}" not found remotely — nothing to delete`,
      );
      return { action: "missing", mutated: false };
    }
    await deleteSiteViaApi(ctx, existing.id, { force: input.forceDelete });
    console.log(
      `[bq:apply:sites-api] site "${existing.name}" deleted (id=${existing.id})`,
    );
    return { site: existing, action: "deleted", mutated: true };
  }

  const createLanguages = normalizeSiteSupportedLanguages([
    input.language,
    ...(input.languages || []),
  ]);

  if (!existing?.id) {
    if (!input.templateId?.trim()) {
      throw new Error("[bq:apply:sites-api] create site requires templateId");
    }
    if (!input.language?.trim()) {
      throw new Error("[bq:apply:sites-api] create site requires language");
    }

    const collectionHint = input.collectionId
      ? `collectionId=${input.collectionId}`
      : input.collectionName
        ? `collectionName=${input.collectionName}`
        : "no collection";
    console.log(
      `[bq:apply:sites-api] creating site "${input.siteName}" (${collectionHint})…`,
    );

    // Env languages must exist before create (`languages` = supported set).
    // Dynamic import avoids a static cycle with ensure-languages → sites-api.
    const { ensureSystemLanguages } = await import(
      "../../shared/ensure-languages"
    );
    await ensureSystemLanguages(createLanguages);

    const body: Record<string, unknown> = {
      language: input.language,
      siteName: input.siteName,
      templateId: input.templateId,
      displayName: sanitizeSingleLineText(
        input.displayName ?? input.siteName,
      ),
      description:
        input.description !== undefined
          ? sanitizeSingleLineText(input.description)
          : undefined,
      languages: createLanguages,
    };
    if (input.hostName) body.hostName = input.hostName;

    if (input.collectionId) {
      body.collectionId = input.collectionId;
    } else if (input.collectionName) {
      body.collectionName = input.collectionName;
      body.collectionDisplayName = sanitizeSingleLineText(
        input.collectionDisplayName ?? input.collectionName,
      );
      if (input.collectionDescription) {
        body.collectionDescription = sanitizeSingleLineText(
          input.collectionDescription,
        );
      }
    } else {
      throw new Error(
        "[bq:apply:sites-api] create site requires collectionId or collectionName",
      );
    }

    const { data } = await sitesFetch<{ handle?: string }>(
      ctx,
      "POST",
      "/api/v1/sites",
      body,
    );

    const handle = data?.handle ?? undefined;
    const isReady = async () =>
      Boolean((await findSiteByName(ctx, input.siteName))?.name);
    if (handle) await waitForJob(ctx, handle, { isReady });

    const created = await pollUntil(
      () => findSiteByName(ctx, input.siteName),
      (site) => Boolean(site?.id || site?.name),
      { label: `site "${input.siteName}"`, timeoutMs: 180_000 },
    );

    return { site: created, handle, action: "created", mutated: true };
  }

  let mutated = false;
  const id = existing.id;
  const remoteSystem = (existing.name ?? "").trim();
  if (
    remoteSystem &&
    remoteSystem.toLowerCase() !== input.siteName.toLowerCase()
  ) {
    console.log(
      `[bq:apply:sites-api] renaming site "${remoteSystem}" → "${input.siteName}"`,
    );
    await renameSiteViaApi(ctx, id, input.siteName);
    mutated = true;
  }

  const displayName = sanitizeSingleLineText(
    input.displayName ?? input.siteName,
  );
  const description =
    input.description !== undefined
      ? sanitizeSingleLineText(input.description)
      : undefined;
  const brandKitChanged =
    input.brandKitId !== undefined &&
    textChanged(existing.brandKitId, input.brandKitId ?? undefined);

  let supportedLanguagesToWrite: string[] | undefined;
  if (input.languages?.length || input.language?.trim()) {
    const desired = createLanguages;
    const remote = remoteSiteSupportedLanguages(existing);
    if (siteSupportedLanguagesIncomplete(remote, desired)) {
      const { ensureSystemLanguages } = await import(
        "../../shared/ensure-languages"
      );
      await ensureSystemLanguages(desired);
      supportedLanguagesToWrite = mergeSiteSupportedLanguages(remote, desired);
    }
  }

  const needsPatch =
    textChanged(existing.displayName, displayName) ||
    textChanged(existing.description, description) ||
    brandKitChanged ||
    Boolean(supportedLanguagesToWrite);

  if (needsPatch) {
    const langNote = supportedLanguagesToWrite
      ? `/supportedLanguages=${supportedLanguagesToWrite.join(",")}`
      : "";
    console.log(
      `[bq:apply:sites-api] updating site "${input.siteName}" (displayName/description` +
        (brandKitChanged ? "/brandKitId" : "") +
        langNote +
        `)`,
    );
    const updated = await updateSiteViaApi(ctx, id, {
      displayName,
      description,
      ...(input.brandKitId !== undefined
        ? { brandKitId: input.brandKitId }
        : {}),
      ...(supportedLanguagesToWrite
        ? { supportedLanguages: supportedLanguagesToWrite }
        : {}),
    });
    return {
      site: updated ?? (await findSiteByName(ctx, input.siteName)),
      action: "updated",
      mutated: true,
    };
  }

  if (mutated) {
    const renamed = await findSiteByName(ctx, input.siteName);
    return { site: renamed ?? existing, action: "updated", mutated: true };
  }

  console.log(
    `[bq:apply:sites-api] site "${input.siteName}" already up to date (id=${id})`,
  );
  return { site: existing, action: "unchanged", mutated: false };
}

function jobHandleCandidates(handle: string): string[] {
  const trimmed = handle.trim();
  const guidOnly = trimmed.split(";")[0]?.trim();
  const candidates = [trimmed];
  if (guidOnly && guidOnly !== trimmed) candidates.push(guidOnly);
  return candidates;
}

function handlesMatch(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left === right) return true;
  const leftGuid = left.split(";")[0];
  const rightGuid = right.split(";")[0];
  return Boolean(leftGuid && rightGuid && leftGuid === rightGuid);
}

function isJobTerminal(status: JobStatus): "ok" | "failed" | false {
  if (status.isFailed) return "failed";
  const state = `${status.status || status.state || ""}`.toLowerCase();
  if (state === "failed" || state.includes("fail")) return "failed";
  if (status.done === true || status.isCompleted === true) return "ok";
  if (
    state === "completed" ||
    state.includes("complete") ||
    state.includes("success") ||
    state === "done" ||
    state === "finished"
  ) {
    return "ok";
  }
  return false;
}

function jobHasProgressFields(status: JobStatus | undefined): boolean {
  if (!status) return false;
  return Boolean(
    status.status ||
      status.state ||
      status.done !== undefined ||
      status.isCompleted !== undefined ||
      status.isFailed !== undefined ||
      status.jobType ||
      status.name,
  );
}

function mergeJobStatus(
  base: JobStatus | undefined,
  detail: JobStatus | undefined,
): JobStatus | undefined {
  if (!base && !detail) return undefined;
  return { ...(base || {}), ...(detail || {}) };
}

function formatJobProgress(status: JobStatus | undefined): string {
  if (!status) return "not listed yet (no status payload)";
  const state =
    status.status ||
    status.state ||
    (status.done === true || status.isCompleted === true
      ? "Completed"
      : status.isFailed
        ? "Failed"
        : "unknown-status");
  const parts = [state];
  if (status.jobType) parts.push(String(status.jobType));
  if (status.name) parts.push(`name=${status.name}`);
  if (status.site) parts.push(`site=${status.site}`);
  if (status.siteCollection) parts.push(`collection=${status.siteCollection}`);
  if (status.statistics?.itemsProcessed != null) {
    parts.push(`items=${status.statistics.itemsProcessed}`);
  }
  if (status.statistics?.pagesProcessed != null) {
    parts.push(`pages=${status.statistics.pagesProcessed}`);
  }
  if (status.done !== undefined) parts.push(`done=${status.done}`);
  if (status.message) parts.push(String(status.message).slice(0, 80));
  if (status.error) parts.push(`error=${String(status.error).slice(0, 80)}`);
  return parts.join(" · ");
}

async function retrieveJobStatus(
  ctx: SitesApiContext,
  handle: string,
): Promise<{ status?: JobStatus; error?: string }> {
  const errors: string[] = [];
  for (const candidate of jobHandleCandidates(handle)) {
    try {
      const { data } = await sitesFetch<JobStatus>(
        ctx,
        "GET",
        `/api/v1/jobs/${encodeURIComponent(candidate)}/status`,
      );
      if (data) return { status: data };
      errors.push(`${candidate}: empty body`);
    } catch (err) {
      errors.push(
        `${candidate}: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`,
      );
    }
  }
  return { error: errors.join("; ") || "no candidates" };
}

async function listJobs(ctx: SitesApiContext): Promise<JobStatus[]> {
  const { data } = await sitesFetch<JobStatus[] | { data?: JobStatus[] }>(
    ctx,
    "GET",
    "/api/v1/jobs",
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

async function fetchJobStatus(
  ctx: SitesApiContext,
  handle: string,
): Promise<{ status?: JobStatus; missReason?: string }> {
  let fromList: JobStatus | undefined;
  let listError: string | undefined;
  try {
    const jobs = await listJobs(ctx);
    fromList = jobs.find((job) => handlesMatch(job.handle, handle));
    if (!fromList) {
      listError = `not in jobs list (${jobs.length} job(s))`;
    }
  } catch (err) {
    listError = `list failed: ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`;
  }

  if (fromList && jobHasProgressFields(fromList)) {
    return { status: fromList };
  }

  const retrieved = await retrieveJobStatus(ctx, handle);
  if (retrieved.status) {
    return { status: mergeJobStatus(fromList, retrieved.status) };
  }

  if (fromList) {
    return {
      status: fromList,
      missReason: `listed but thin payload; RetrieveJob: ${retrieved.error || "no detail"}`,
    };
  }

  return {
    missReason: [listError, retrieved.error && `RetrieveJob: ${retrieved.error}`]
      .filter(Boolean)
      .join("; "),
  };
}

/**
 * Wait for a Sites API background job. Also accepts an optional `isReady`
 * predicate (e.g. collection/site already visible) so we don't hang if the
 * status endpoint 404s after completion.
 */
async function waitForJob(
  ctx: SitesApiContext,
  handle: string,
  options?: { isReady?: () => Promise<boolean>; timeoutMs?: number },
): Promise<void> {
  const short = handle.split(";")[0] || handle;
  console.log(`[bq:apply:sites-api] waiting for job ${short}…`);
  const timeoutMs = options?.timeoutMs ?? 300_000;
  const intervalMs = 3_000;
  const deadline = Date.now() + timeoutMs;
  let lastLog = 0;
  let loggedMissReason = false;

  while (Date.now() < deadline) {
    if (options?.isReady && (await options.isReady())) {
      console.log(
        `[bq:apply:sites-api] job ${short}: target already visible — continuing`,
      );
      return;
    }

    const { status, missReason } = await fetchJobStatus(ctx, handle);
    if (missReason && !loggedMissReason) {
      loggedMissReason = true;
      console.log(`[bq:apply:sites-api] job ${short}: status lookup — ${missReason}`);
    }
    const terminal = status ? isJobTerminal(status) : false;
    if (terminal === "failed") {
      throw new Error(
        `[bq:apply:sites-api] job ${short} failed: ${status?.error || status?.message || status?.status || "unknown"}`,
      );
    }
    if (terminal === "ok") {
      console.log(`[bq:apply:sites-api] job ${short}: ${formatJobProgress(status)}`);
      return;
    }

    const now = Date.now();
    if (now - lastLog > 15_000) {
      lastLog = now;
      console.log(`[bq:apply:sites-api] job ${short}: ${formatJobProgress(status)}…`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  if (options?.isReady && (await options.isReady())) {
    console.warn(
      `[bq:apply:sites-api] job ${short}: timed out on status, but target is visible — continuing`,
    );
    return;
  }

  throw new Error(
    `[bq:apply:sites-api] Timed out waiting for job ${short}. ` +
      `If auth failed earlier, see ${AUTH_WALKTHROUGH}`,
  );
}

async function pollUntil<T>(
  load: () => Promise<T>,
  done: (value: T) => boolean,
  options: { label: string; timeoutMs: number; intervalMs?: number },
): Promise<T> {
  const intervalMs = options.intervalMs ?? 2_500;
  const deadline = Date.now() + options.timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await load();
    if (done(last)) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `[bq:apply:sites-api] Timed out waiting for ${options.label}. ` +
      `If auth failed earlier, see ${AUTH_WALKTHROUGH}`,
  );
}
