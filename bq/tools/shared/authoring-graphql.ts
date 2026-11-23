/**
 * Shared Authoring GraphQL POST with retries + apply-run API logging.
 */
import {
  SITECORE_CONNECTION_MAX_RETRIES,
  SITECORE_CONNECTION_RETRY_DELAY_MS,
} from "./sitecore-auth";
import {
  graphqlOperationName,
  recordApplyApiCall,
  redactApplyApiPayload,
} from "./apply-api-run-log";

/** Same transient signals as CM lookup retries (kept local to avoid cycles). */
export function isRetryableAuthoringFailure(err: unknown): boolean {
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

export type AuthoringGraphqlOptions = {
  host: string;
  token: string;
  query: string;
  variables?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  /** Override operation label in logs (default: inferred from query). */
  operation?: string;
  maxRetries?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    error: string;
  }) => void;
};

function extractResultSummary(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (!val || typeof val !== "object") continue;
    const obj = val as Record<string, unknown>;
    const item = (obj.item || obj.itemTemplate || obj) as
      | Record<string, unknown>
      | undefined;
    if (item && typeof item === "object") {
      if (item.itemId) out.itemId = item.itemId;
      if (item.path) out.path = item.path;
      if (item.name) out.name = item.name;
      if (obj.presignedUploadUrl) out.presignedUploadUrl = true;
      if (obj.successful != null) out.successful = obj.successful;
    }
  }
  return out;
}

/**
 * POST to Authoring GraphQL with connection retries and apply-run logging.
 */
export async function runAuthoringGraphql(
  options: AuthoringGraphqlOptions,
): Promise<Record<string, unknown>> {
  const fetchImpl = options.fetchImpl || fetch;
  const maxRetries = options.maxRetries ?? SITECORE_CONNECTION_MAX_RETRIES;
  const delayMs = options.delayMs ?? SITECORE_CONNECTION_RETRY_DELAY_MS;
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const operation =
    options.operation || graphqlOperationName(options.query);
  const url = `${options.host.replace(/\/$/, "")}/sitecore/api/authoring/graphql/v1`;

  const started = Date.now();
  let attempts = 0;
  let lastErr: unknown;

  while (attempts <= maxRetries) {
    attempts += 1;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify({
          query: options.query,
          variables: options.variables,
        }),
      });
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
      const data = json.data || {};
      recordApplyApiCall({
        kind: "authoring-graphql",
        operation,
        durationMs: Date.now() - started,
        ok: true,
        attempts,
        summary: {
          operation,
          ...extractResultSummary(data),
        },
        detail: {
          variables: redactApplyApiPayload(options.variables),
          data: redactApplyApiPayload(data),
        },
      });
      return data;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        attempts <= maxRetries && isRetryableAuthoringFailure(err);
      if (!retryable) {
        recordApplyApiCall({
          kind: "authoring-graphql",
          operation,
          durationMs: Date.now() - started,
          ok: false,
          attempts,
          error: msg.slice(0, 2000),
          summary: { operation },
          detail: {
            variables: redactApplyApiPayload(options.variables),
            query: String(options.query || "").slice(0, 500),
          },
        });
        throw err;
      }
      options.onRetry?.({
        attempt: attempts,
        maxRetries,
        delayMs,
        error: msg,
      });
      console.warn(
        `[bq:apply:authoring] retry ${attempts}/${maxRetries} ${operation}: ${msg.slice(0, 160)}`,
      );
      await sleep(delayMs);
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  recordApplyApiCall({
    kind: "authoring-graphql",
    operation,
    durationMs: Date.now() - started,
    ok: false,
    attempts,
    error: msg.slice(0, 2000),
    summary: { operation },
  });
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
