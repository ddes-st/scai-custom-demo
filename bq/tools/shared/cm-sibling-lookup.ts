/**
 * CM-first sibling / path lookup for soft-BQ scaffold and section emit.
 * Prefer Authoring GraphQL IDs over local YAML when auth works.
 */
import {
  SITECORE_CONNECTION_MAX_RETRIES,
  SITECORE_CONNECTION_RETRY_DELAY_MS,
  ensureSitecoreCliLogin,
} from "./sitecore-auth";
import {
  deleteCmItemById,
  formatAuthoringItemId,
  resolveAuthoringGraphqlAuth,
} from "./cm-delete-item";
import {
  canonicalItemLeafName,
  isOrphanLeafName,
  logicalLeafEquals,
} from "./logical-item-leaf";
import { canonicalItemId, toScsYamlGuid } from "./ids";

export const CM_LOOKUP_MAX_RETRIES = SITECORE_CONNECTION_MAX_RETRIES;
export const CM_LOOKUP_RETRY_DELAY_MS = SITECORE_CONNECTION_RETRY_DELAY_MS;

export type CmChildNode = {
  itemId: string;
  name: string;
  path?: string;
};

export type CmLookupAuth = { host: string; token: string };

function normalizeId(id: string): string {
  return canonicalItemId(id) || id.replace(/[{}]/g, "").trim().toLowerCase();
}

function idHex(id: string): string {
  return canonicalItemId(id) || String(id).replace(/[{}-]/g, "").toLowerCase();
}

function guidQueryCandidates(id: string): string[] {
  const hex = idHex(id);
  if (hex.length !== 32) return [String(id || "")].filter(Boolean);
  const dashed = toScsYamlGuid(hex);
  return [`{${dashed}}`, dashed, hex];
}

export function isRetryableCmLookupFailure(err: unknown): boolean {
  const text =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!text.trim()) return false;
  return (
    /no access token|Skipping auto CLI login|Missing environment|SITECORE_AUTH_CLIENT/i.test(
      text,
    ) ||
    /discovering identity provider/i.test(text) ||
    /openid[- ]configuration/i.test(text) ||
    /OpenID metadata/i.test(text) ||
    /\bECONNRESET\b/i.test(text) ||
    /\bETIMEDOUT\b/i.test(text) ||
    /\bENOTFOUND\b/i.test(text) ||
    /\bEAI_AGAIN\b/i.test(text) ||
    /temporarily unavailable/i.test(text) ||
    /\bnetwork\b/i.test(text) ||
    /\b5\d\d\b/.test(text) ||
    /HTTP 5\d\d/i.test(text) ||
    /fetch failed/i.test(text) ||
    /timeout/i.test(text)
  );
}

export async function withCmLookupRetries<T>(
  runOnce: () => Promise<T>,
  options?: {
    maxRetries?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    endpointName?: string;
    onRetry?: (info: {
      attempt: number;
      maxRetries: number;
      delayMs: number;
      error: string;
    }) => void;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? CM_LOOKUP_MAX_RETRIES;
  const delayMs = options?.delayMs ?? CM_LOOKUP_RETRY_DELAY_MS;
  const sleep =
    options?.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0 && options?.endpointName) {
        await ensureSitecoreCliLogin(options.endpointName).catch(() => {
          /* continue — auth may still resolve via automation token */
        });
      }
      return await runOnce();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxRetries || !isRetryableCmLookupFailure(err)) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      options?.onRetry?.({
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: msg,
      });
      await sleep(delayMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
  auth?: CmLookupAuth;
}): Promise<CmLookupAuth & { endpointName?: string }> {
  if (options?.auth) {
    return { ...options.auth, endpointName: options.endpointName };
  }
  if (options?.endpointName) {
    await ensureSitecoreCliLogin(options.endpointName).catch(() => undefined);
  }
  const auth = await resolveAuthoringGraphqlAuth({
    endpointName: options?.endpointName,
  });
  return auth;
}

/**
 * Look up a CM item by Sitecore path (master).
 */
export async function findItemByPath(options: {
  path: string;
  endpointName?: string;
  auth?: CmLookupAuth;
  fetchImpl?: typeof fetch;
}): Promise<CmChildNode | undefined> {
  const sitecorePath = String(options.path || "").trim();
  if (!sitecorePath) return undefined;

  const auth = await resolveAuth(options);
  const data = await authoringGql(
    auth.host,
    auth.token,
    `query($path: String!) {
      item(where: { path: $path, database: "master" }) {
        itemId
        name
        path
      }
    }`,
    { path: sitecorePath },
    options.fetchImpl,
  );
  const item = data.item as
    | { itemId?: string; name?: string; path?: string }
    | null
    | undefined;
  if (!item?.itemId) return undefined;
  return {
    itemId: normalizeId(item.itemId),
    name: String(item.name || ""),
    path: item.path,
  };
}

/** @deprecated Use {@link findItemByPath}. */
export const findCmItemByPath = findItemByPath;

/**
 * List CM children under a parent item.
 */
export async function listCmChildren(options: {
  parentId: string;
  endpointName?: string;
  auth?: CmLookupAuth;
  fetchImpl?: typeof fetch;
}): Promise<CmChildNode[]> {
  if (!options.parentId) return [];
  const auth = await resolveAuth(options);

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
    for (const idCandidate of guidQueryCandidates(options.parentId)) {
      try {
        const data = await authoringGql(
          auth.host,
          auth.token,
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
        /* try next id shape / query */
      }
    }
    if (children.length) break;
  }

  return children
    .filter((c) => c.itemId)
    .map((c) => ({
      itemId: normalizeId(String(c.itemId)),
      name: String(c.name || ""),
      path: c.path,
    }));
}

function pickSibling(
  children: CmChildNode[],
  wantName: string,
): CmChildNode | undefined {
  const want = canonicalItemLeafName(wantName).toLowerCase();
  if (!want) return undefined;

  const matches = children.filter(
    (c) => logicalLeafEquals(c.name, want) && !isOrphanLeafName(c.name),
  );
  const pool =
    matches.length > 0
      ? matches
      : children.filter((c) => logicalLeafEquals(c.name, want));
  if (!pool.length) return undefined;

  pool.sort((a, b) => {
    const aCanon = !isOrphanLeafName(a.name) ? 0 : 1;
    const bCanon = !isOrphanLeafName(b.name) ? 0 : 1;
    if (aCanon !== bCanon) return aCanon - bCanon;
    return a.itemId.localeCompare(b.itemId);
  });
  return pool[0];
}

/**
 * Find a same-name CM child under parent (canonical preferred over orphan).
 */
export async function findCmSiblingId(options: {
  parentId: string;
  name: string;
  endpointName?: string;
  auth?: CmLookupAuth;
  fetchImpl?: typeof fetch;
  /** When true, retry auth/transient failures before giving up. */
  withRetries?: boolean;
  onRetry?: (info: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    error: string;
  }) => void;
  sleep?: (ms: number) => Promise<void>;
}): Promise<string | undefined> {
  const run = async () => {
    const children = await listCmChildren(options);
    const hit = pickSibling(children, options.name);
    return hit?.itemId;
  };

  if (options.withRetries === false) {
    try {
      return await run();
    } catch {
      return undefined;
    }
  }

  try {
    return await withCmLookupRetries(run, {
      endpointName: options.endpointName,
      onRetry: options.onRetry,
      sleep: options.sleep,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[cm-sibling] lookup skipped after retries: ${msg.slice(0, 160)}`,
    );
    return undefined;
  }
}

/**
 * All same-name CM children under parent (for Non-unique heal).
 */
export async function listCmSameNameSiblings(options: {
  parentId: string;
  name: string;
  endpointName?: string;
  auth?: CmLookupAuth;
  fetchImpl?: typeof fetch;
}): Promise<CmChildNode[]> {
  const want = canonicalItemLeafName(options.name).toLowerCase();
  if (!want) return [];
  const children = await listCmChildren(options);
  return children.filter((c) => logicalLeafEquals(c.name, want));
}

/**
 * When multiple same-name siblings exist, keep preferredId (or first) and
 * permanently delete the rest via Authoring API.
 */
export async function healDuplicateCmSiblings(options: {
  parentId: string;
  name: string;
  /** Prefer keeping this GUID when present among duplicates. */
  preferId?: string;
  endpointName?: string;
  auth?: CmLookupAuth;
  fetchImpl?: typeof fetch;
}): Promise<{ kept?: string; deleted: string[] }> {
  const siblings = await listCmSameNameSiblings(options);
  if (siblings.length <= 1) {
    return { kept: siblings[0]?.itemId, deleted: [] };
  }

  const prefer = options.preferId ? normalizeId(options.preferId) : "";
  const keep =
    siblings.find((s) => s.itemId === prefer) ||
    pickSibling(siblings, options.name) ||
    siblings[0]!;
  const deleted: string[] = [];

  for (const sib of siblings) {
    if (sib.itemId === keep.itemId) continue;
    const result = await deleteCmItemById({
      itemId: sib.itemId,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
    if (result.ok) {
      deleted.push(sib.itemId);
      console.log(
        `[cm-sibling] deleted duplicate ${formatAuthoringItemId(sib.itemId)} ` +
          `(kept ${formatAuthoringItemId(keep.itemId)} for "${options.name}")`,
      );
    } else {
      console.warn(
        `[cm-sibling] failed to delete duplicate ${sib.itemId}: ${result.error || "unknown"}`,
      );
    }
  }

  return { kept: keep.itemId, deleted };
}

/**
 * Parse SCS Non-unique path errors:
 *   Non-unique path /sitecore/.../shared (IDs aaa… vs bbb…)
 */
export function parseNonUniquePathsFromSerError(output: string): Array<{
  path: string;
  ids: string[];
}> {
  const text = String(output || "");
  const out: Array<{ path: string; ids: string[] }> = [];
  const re =
    /Non-unique path\s+(\/sitecore\/.+?)\s*\(IDs?\s*([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const sitecorePath = m[1]!.trim().replace(/\/$/, "");
    const ids = (m[2] || "")
      .split(/\s+vs\s+|,|\s+and\s+/i)
      .map((s) => normalizeId(s.replace(/[.…]/g, "").trim()))
      .filter((id) => id.length >= 8);
    out.push({ path: sitecorePath, ids });
  }
  // Broader fallback when ID list omitted
  if (!out.length) {
    const pathOnly =
      /Non-unique paths?[^\n]*?(\/sitecore\/[^\n(]+)/i.exec(text);
    if (pathOnly?.[1]) {
      out.push({
        path: pathOnly[1].trim().replace(/\/$/, ""),
        ids: [],
      });
    }
  }
  return out;
}

/** True when path looks like a soft-BQ collection/site scaffold destination. */
export function isSoftBqScaffoldSitecorePath(sitecorePath: string): boolean {
  const p = sitecorePath.toLowerCase();
  if (!p.startsWith("/sitecore/")) return false;
  // Media shared folder under Project/{collection}/shared
  if (/\/media library\/project\/[^/]+\/shared$/i.test(p)) return true;
  // Collection/site Data stubs commonly scaffolded (Link Lists, etc.)
  if (/\/sites\/content\/[^/]+\/[^/]+\/data\//i.test(p)) return true;
  if (/\/sites\/content\/[^/]+\/data\//i.test(p)) return true;
  // Layout / renderings / templates Project collection folders
  if (
    /\/(layout|renderings|templates|branch templates|system)\/project\/[^/]+/i.test(
      p,
    )
  ) {
    return true;
  }
  if (/\/media library\/project\/[^/]+$/i.test(p)) return true;
  return false;
}
