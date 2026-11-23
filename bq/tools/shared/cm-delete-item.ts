/**
 * Permanently delete CM items via Authoring GraphQL `deleteItem`.
 * Used when ser push UpdateItem NRE hits a broken/orphan GUID — delete then
 * re-push so Create can recreate under the local Parent.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths";
import {
  resolveSitecoreEndpoint,
  resolveSitesApiAccessToken,
  type SitecoreCliEndpoint,
} from "./sitecore-auth";
import { canonicalItemId, toAuthoringGuid } from "./ids";

/** Log marker — bq-console maps this to orange (between red error and yellow warn). */
export const CM_DELETE_VIA_AUTHORING_API =
  "CM delete via Authoring API (permanent)";

export type CmDeleteResult = {
  itemId: string;
  ok: boolean;
  error?: string;
};

function idHex(id: string): string {
  return canonicalItemId(id) || String(id).replace(/[{}]/g, "").toLowerCase();
}

/** Braced uppercase GUID for Authoring GraphQL. */
export function formatAuthoringItemId(id: string): string {
  return toAuthoringGuid(id);
}

function readUserJsonEndpoints(): Record<string, Record<string, unknown>> {
  for (const filePath of [
    path.join(REPO_ROOT, ".sitecore", "user.json"),
    path.join(REPO_ROOT, "bq", ".sitecore", "user.json"),
  ]) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const user = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        endpoints?: Record<string, Record<string, unknown>>;
      };
      return user.endpoints || {};
    } catch {
      /* try next */
    }
  }
  return {};
}

function tokenFromEndpointRaw(
  raw: Record<string, unknown> | undefined,
): string {
  if (!raw || typeof raw !== "object") return "";
  if (typeof raw.accessToken === "string" && raw.accessToken.trim()) {
    return raw.accessToken.trim();
  }
  const vars = raw.variables;
  if (vars && typeof vars === "object") {
    const t = (vars as Record<string, string>).accessToken;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return "";
}

/**
 * Resolve CM host + bearer for Authoring GraphQL.
 * Prefers CLI endpoint token (post `ensureSitecoreCliLogin`), then automation
 * client credentials, then any token in user.json.
 */
export async function resolveAuthoringGraphqlAuth(options?: {
  endpointName?: string;
}): Promise<{ host: string; token: string; endpointName: string }> {
  const endpoint = resolveSitecoreEndpoint(options?.endpointName);
  // Re-read after possible CLI login so accessToken is fresh.
  let fresh: SitecoreCliEndpoint = endpoint;
  try {
    fresh = resolveSitecoreEndpoint(endpoint.name);
  } catch {
    /* keep endpoint */
  }

  const host = String(fresh.host || endpoint.host || "")
    .trim()
    .replace(/\/$/, "");
  if (!host) {
    throw new Error(
      `[cm-delete] Endpoint "${endpoint.name}" has no CM host in .sitecore/user.json`,
    );
  }

  let token = fresh.accessToken?.trim() || endpoint.accessToken?.trim() || "";

  if (!token) {
    const endpoints = readUserJsonEndpoints();
    const raw = endpoints[endpoint.name];
    token = tokenFromEndpointRaw(raw);
    if (!token && raw && typeof raw.ref === "string") {
      const refKey =
        Object.keys(endpoints).find(
          (k) => k.toLowerCase() === String(raw.ref).toLowerCase(),
        ) || String(raw.ref);
      token = tokenFromEndpointRaw(endpoints[refKey]);
    }
    if (!token) {
      for (const other of Object.values(endpoints)) {
        token = tokenFromEndpointRaw(other);
        if (token) break;
      }
    }
  }

  if (!token) {
    try {
      token = await resolveSitesApiAccessToken(fresh);
    } catch {
      /* fall through */
    }
  }

  if (!token) {
    throw new Error(
      `[cm-delete] No access token for Authoring GraphQL on "${endpoint.name}". ` +
        `Run definitions:generate (auto CLI login) or set SITECORE_AUTH_CLIENT_ID/SECRET.`,
    );
  }

  return { host, token, endpointName: endpoint.name };
}

async function authoringGql(
  host: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(
    `${host.replace(/\/$/, "")}/sitecore/api/authoring/graphql/v1`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || json.errors?.length) {
    const msg =
      json.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data || {};
}

const TEMPLATE_IN_USE_RE = /template is used by at least one item/i;
const DELETE_NOT_FOUND_RE = /was not found|may have been deleted/i;

const SEARCH_PAGE_SIZE = 50;
const SEARCH_MAX_PAGES = 20;
/** Full find → delete-deps → retry-original rounds per template. */
export const TEMPLATE_IN_USE_MAX_ROUNDS = 3;
/** Max recursive depth when cascading nested template-in-use deletes. */
export const TEMPLATE_CASCADE_MAX_DEPTH = 8;
/** Backoff when search returns 0 hits but Sitecore still says in-use (index lag). */
export const TEMPLATE_IN_USE_EMPTY_SEARCH_BACKOFF_MS = 400;

type TemplateDependentHit = {
  itemId: string;
  path: string;
  name: string;
};

function pathSegmentCount(sitecorePath: string): number {
  return String(sitecorePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean).length;
}

/**
 * Authoring search: items whose `_template` is the given template GUID.
 */
export async function findItemsByTemplateId(options: {
  templateId: string;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
}): Promise<TemplateDependentHit[]> {
  const templateHex = idHex(options.templateId);
  if (!templateHex) return [];

  const auth =
    options.auth ||
    (await resolveAuthoringGraphqlAuth({
      endpointName: options.endpointName,
    }));
  const fetchImpl = options.fetchImpl || fetch;
  const hits: TemplateDependentHit[] = [];

  for (let pageIndex = 0; pageIndex < SEARCH_MAX_PAGES; pageIndex += 1) {
    const data = await authoringGql(
      auth.host,
      auth.token,
      `query($pageSize: Int!, $pageIndex: Int!, $skip: Int!, $templateHex: String!) {
        search(
          query: {
            index: "sitecore_master_index"
            paging: { pageSize: $pageSize, skip: $skip, pageIndex: $pageIndex }
            searchStatement: {
              criteria: [
                { operator: MUST, field: "_template", value: $templateHex }
              ]
            }
          }
        ) {
          results {
            innerItem {
              itemId
              name
              path
            }
          }
        }
      }`,
      {
        pageSize: SEARCH_PAGE_SIZE,
        pageIndex,
        skip: pageIndex * SEARCH_PAGE_SIZE,
        templateHex,
      },
      fetchImpl,
    );

    const search = data.search as
      | {
          results?: Array<{
            innerItem?: {
              itemId?: string;
              name?: string;
              path?: string;
            } | null;
          }>;
        }
      | undefined;
    const page = Array.isArray(search?.results) ? search!.results! : [];
    for (const row of page) {
      const inner = row?.innerItem;
      const itemId = String(inner?.itemId || "").trim();
      if (!itemId) continue;
      hits.push({
        itemId,
        name: String(inner?.name || ""),
        path: String(inner?.path || ""),
      });
    }
    if (page.length < SEARCH_PAGE_SIZE) break;
  }

  return hits;
}

async function deleteCmItemOnce(options: {
  itemId: string;
  host: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<CmDeleteResult> {
  const braced = formatAuthoringItemId(options.itemId);
  try {
    const data = await authoringGql(
      options.host,
      options.token,
      `mutation($input: DeleteItemInput!) {
          deleteItem(input: $input) { successful }
        }`,
      {
        input: {
          itemId: braced,
          permanently: true,
          database: "master",
        },
      },
      options.fetchImpl,
    );
    const payload = data.deleteItem as { successful?: boolean } | undefined;
    if (payload?.successful === false) {
      return {
        itemId: braced,
        ok: false,
        error: "deleteItem returned successful:false",
      };
    }
    return { itemId: braced, ok: true };
  } catch (err) {
    return {
      itemId: braced,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type DeleteCmItemByIdOptions = {
  itemId: string;
  endpointName?: string;
  /** Injected for tests */
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  /**
   * Injectable delay (tests). Used when search returns 0 hits while still in-use.
   * Default: real setTimeout.
   */
  sleep?: (ms: number) => Promise<void>;
  /** @internal recursive cascade bookkeeping — do not set from callers */
  _cascade?: {
    visited: Set<string>;
    depth: number;
  };
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ItemChildHit = {
  itemId: string;
  path: string;
  name: string;
};

/**
 * List direct children of a CM item (Authoring GraphQL). Local to avoid
 * circular import with cm-sibling-lookup.
 */
async function listItemChildren(options: {
  parentId: string;
  host: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<ItemChildHit[]> {
  const braced = formatAuthoringItemId(options.parentId);
  const hex = idHex(options.parentId);
  const idCandidates = [braced, hex].filter(Boolean);
  const queries = [
    `query($id: ID!) {
      item(where: { itemId: $id, database: "master" }) {
        children { nodes { itemId name path } }
      }
    }`,
    `query($id: String!) {
      item(where: { itemId: $id, database: "master" }) {
        children { nodes { itemId name path } }
      }
    }`,
  ];

  type Child = { itemId?: string; name?: string; path?: string };
  let children: Child[] = [];

  for (const query of queries) {
    for (const idCandidate of idCandidates) {
      try {
        const data = await authoringGql(
          options.host,
          options.token,
          query,
          { id: idCandidate },
          options.fetchImpl,
        );
        const item = data.item as
          | { children?: { nodes?: Child[] } }
          | null
          | undefined;
        children = item?.children?.nodes || [];
        if (children.length || item) break;
      } catch {
        /* try next */
      }
    }
    if (children.length) break;
  }

  return children
    .filter((c) => c.itemId)
    .map((c) => ({
      itemId: String(c.itemId),
      name: String(c.name || ""),
      path: String(c.path || ""),
    }));
}

type CascadeCtx = {
  endpointName?: string;
  auth: { host: string; token: string };
  fetchImpl?: typeof fetch;
  log: (message: string) => void;
  sleep: (ms: number) => Promise<void>;
  visited: Set<string>;
  depth: number;
};

/**
 * Wipe all descendants under parent (deepest-first post-order), then stop.
 * Does not delete `parentId` itself.
 */
async function wipeSubitemsDeepestFirst(
  parentId: string,
  ctx: CascadeCtx,
): Promise<{ cleared: number; failed: string[] }> {
  let cleared = 0;
  const failed: string[] = [];
  let children: ItemChildHit[] = [];
  try {
    children = await listItemChildren({
      parentId,
      host: ctx.auth.host,
      token: ctx.auth.token,
      fetchImpl: ctx.fetchImpl,
    });
  } catch (err) {
    ctx.log(
      `[bq:apply:sites-api] ⚠ ${CM_DELETE_VIA_AUTHORING_API} list children failed for ${formatAuthoringItemId(parentId)}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { cleared, failed };
  }

  const parentHex = idHex(parentId);
  const sorted = [...children]
    .filter((c) => idHex(c.itemId) !== parentHex)
    .sort((a, b) => pathSegmentCount(b.path) - pathSegmentCount(a.path));

  if (sorted.length) {
    ctx.log(
      `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: wiping ${sorted.length} subitem(s) under ${formatAuthoringItemId(parentId)} (depth ${ctx.depth})`,
    );
  }

  for (const child of sorted) {
    // Post-order: clear nested subitems before deleting this child.
    const nested = await wipeSubitemsDeepestFirst(child.itemId, {
      ...ctx,
      depth: ctx.depth + 1,
    });
    cleared += nested.cleared;
    failed.push(...nested.failed);

    const label = child.path || child.name || child.itemId;
    const childBraced = formatAuthoringItemId(child.itemId);
    ctx.log(
      `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: cascade delete subitem ${childBraced} ${label}`,
    );
    const result = await deleteCmItemById({
      itemId: child.itemId,
      endpointName: ctx.endpointName,
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
      log: ctx.log,
      sleep: ctx.sleep,
      _cascade: { visited: ctx.visited, depth: ctx.depth + 1 },
    });
    if (result.ok || DELETE_NOT_FOUND_RE.test(result.error || "")) {
      cleared += 1;
    } else {
      ctx.log(
        `[bq:apply:sites-api] ⚠ ${CM_DELETE_VIA_AUTHORING_API} subitem failed for ${result.itemId}: ${result.error || "unknown"}`,
      );
      failed.push(`${childBraced} (${label}): ${result.error || "unknown"}`);
    }
  }

  return { cleared, failed };
}

/**
 * Permanently delete one CM item by GUID (path omitted — unreliable for orphans).
 *
 * Template-in-use cascade (central loop):
 * 1. Try delete
 * 2. If “template is used by at least one item”:
 *    a. Wipe all subitems under the template (deepest-first)
 *    b. Search + delete items based on this template (`_template`)
 *    c. Retry original
 * 3. Up to {@link TEMPLATE_IN_USE_MAX_ROUNDS} rounds; brief backoff when search
 *    returns 0 hits (index lag) but Sitecore still blocks
 * 4. Enriched error if still failing — never silently leave leftovers
 */
export async function deleteCmItemById(
  options: DeleteCmItemByIdOptions,
): Promise<CmDeleteResult> {
  const braced = formatAuthoringItemId(options.itemId);
  const templateHex = idHex(options.itemId);
  const log = options.log || ((m: string) => console.warn(m));
  const sleep = options.sleep || defaultSleep;
  const visited = options._cascade?.visited || new Set<string>();
  const depth = options._cascade?.depth ?? 0;

  if (templateHex && visited.has(templateHex)) {
    return {
      itemId: braced,
      ok: false,
      error: `template-in-use cascade: already visiting ${braced} (cycle)`,
    };
  }
  if (depth > TEMPLATE_CASCADE_MAX_DEPTH) {
    return {
      itemId: braced,
      ok: false,
      error: `template-in-use cascade: max depth ${TEMPLATE_CASCADE_MAX_DEPTH} at ${braced}`,
    };
  }

  let auth: { host: string; token: string };
  try {
    auth =
      options.auth ||
      (await resolveAuthoringGraphqlAuth({
        endpointName: options.endpointName,
      }));
  } catch (err) {
    return {
      itemId: braced,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const tryDelete = () =>
    deleteCmItemOnce({
      itemId: options.itemId,
      host: auth.host,
      token: auth.token,
      fetchImpl: options.fetchImpl,
    });

  let attempt = await tryDelete();
  if (attempt.ok) return attempt;
  if (!TEMPLATE_IN_USE_RE.test(attempt.error || "")) return attempt;

  if (templateHex) visited.add(templateHex);

  log(
    `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: template in use — wipe subitems then dependents of ${braced} (depth ${depth})`,
  );

  const ctx: CascadeCtx = {
    endpointName: options.endpointName,
    auth,
    fetchImpl: options.fetchImpl,
    log,
    sleep,
    visited,
    depth,
  };

  let lastError = attempt.error || "template in use";
  let totalDependentsDeleted = 0;
  const remainingAfterRounds: string[] = [];

  for (let round = 1; round <= TEMPLATE_IN_USE_MAX_ROUNDS; round += 1) {
    // 1) All subitems under the template (SV, fields, nested templates, …).
    const sub = await wipeSubitemsDeepestFirst(options.itemId, {
      ...ctx,
      depth,
    });
    totalDependentsDeleted += sub.cleared;
    remainingAfterRounds.push(...sub.failed);

    // 2) Items based on this template.
    let dependents: TemplateDependentHit[] = [];
    try {
      dependents = await findItemsByTemplateId({
        templateId: options.itemId,
        endpointName: options.endpointName,
        auth,
        fetchImpl: options.fetchImpl,
      });
    } catch (err) {
      return {
        itemId: braced,
        ok: false,
        error: `template-in-use cascade search failed (round ${round}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }

    // Index lag: Sitecore blocks delete but search has not indexed yet.
    if (dependents.length === 0 && sub.cleared === 0) {
      log(
        `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: found 0 dependent(s) for ${braced} (round ${round}) — backoff + re-search`,
      );
      await sleep(TEMPLATE_IN_USE_EMPTY_SEARCH_BACKOFF_MS);
      try {
        dependents = await findItemsByTemplateId({
          templateId: options.itemId,
          endpointName: options.endpointName,
          auth,
          fetchImpl: options.fetchImpl,
        });
      } catch (err) {
        return {
          itemId: braced,
          ok: false,
          error: `template-in-use cascade re-search failed (round ${round}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        };
      }
    }

    const sorted = [...dependents]
      .filter((d) => idHex(d.itemId) !== templateHex)
      .sort((a, b) => pathSegmentCount(b.path) - pathSegmentCount(a.path));

    log(
      `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: found ${sorted.length} based-on dependent(s) for ${braced} (round ${round})`,
    );

    for (const dep of sorted) {
      const depBraced = formatAuthoringItemId(dep.itemId);
      const label = dep.path || dep.name || dep.itemId;
      log(
        `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: cascade delete dependent ${depBraced} ${label}`,
      );
      const depResult = await deleteCmItemById({
        itemId: dep.itemId,
        endpointName: options.endpointName,
        auth,
        fetchImpl: options.fetchImpl,
        log,
        sleep,
        _cascade: { visited, depth: depth + 1 },
      });
      if (depResult.ok || DELETE_NOT_FOUND_RE.test(depResult.error || "")) {
        totalDependentsDeleted += 1;
      } else {
        log(
          `[bq:apply:sites-api] ⚠ ${CM_DELETE_VIA_AUTHORING_API} dependent failed for ${depResult.itemId}: ${depResult.error || "unknown"}`,
        );
        remainingAfterRounds.push(
          `${depBraced} (${label}): ${depResult.error || "unknown"}`,
        );
      }
    }

    // 3) Retry the template.
    log(
      `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: retry original ${braced} after round ${round}`,
    );
    attempt = await tryDelete();
    if (attempt.ok) return attempt;
    lastError = attempt.error || lastError;
    if (!TEMPLATE_IN_USE_RE.test(attempt.error || "")) {
      return attempt;
    }
  }

  const enrichParts = [
    `template-in-use cascade exhausted after ${TEMPLATE_IN_USE_MAX_ROUNDS} round(s) for ${braced}`,
    `last error: ${lastError}`,
    `dependents cleared this call: ${totalDependentsDeleted}`,
  ];
  if (remainingAfterRounds.length) {
    enrichParts.push(
      `failed dependents: ${remainingAfterRounds.slice(0, 8).join("; ")}`,
    );
  }
  return {
    itemId: braced,
    ok: false,
    error: enrichParts.join(" — "),
  };
}

export type DeleteCmItemsOptions = {
  items: Array<{ itemId: string; path?: string; name?: string }>;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
};

/**
 * Delete each item; logs orange-marked Authoring API lines via `log` (default console.log).
 */
export async function deleteCmItemsByIds(
  options: DeleteCmItemsOptions,
): Promise<CmDeleteResult[]> {
  const log = options.log || ((m: string) => console.log(m));
  const results: CmDeleteResult[] = [];
  const seen = new Set<string>();

  for (const item of options.items) {
    const hex = idHex(item.itemId);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);

    const label = item.path || item.name || hex;
    log(
      `[bq:apply:sites-api] ${CM_DELETE_VIA_AUTHORING_API}: ${formatAuthoringItemId(item.itemId)} ${label}`,
    );

    const result = await deleteCmItemById({
      itemId: item.itemId,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
      log,
    });
    results.push(result);
    if (!result.ok) {
      log(
        `[bq:apply:sites-api] ⚠ ${CM_DELETE_VIA_AUTHORING_API} failed for ${result.itemId}: ${result.error || "unknown"}`,
      );
    }
  }

  return results;
}
