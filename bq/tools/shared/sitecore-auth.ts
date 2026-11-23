import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { REPO_ROOT } from "./paths";

const AUTH_WALKTHROUGH =
  "https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/walkthrough--enabling-and-authorizing-requests-to-the-authoring-and-management-api.html";

const SITES_API_AUTH_DOCS =
  "https://api-docs.sitecore.com/sai/sites-api/sites";

const CREDENTIALS_DOCS =
  "https://doc.sitecore.com/sai/en/developers/sitecoreai/deploying-sitecoreai/deploy-app/managing-sitecoreai-client-credentials/manage-client-credentials-for-a-sitecoreai-organization-or-environment.html";

export type SitecoreCliEndpoint = {
  name: string;
  host?: string;
  accessToken?: string;
  authority?: string;
  audience?: string;
  clientId?: string;
  clientSecret?: string;
  variables?: Record<string, string>;
};

export type SitesApiCredentials = {
  clientId?: string;
  clientSecret?: string;
};

type UserJson = {
  defaultEndpoint?: string;
  endpoints?: Record<string, Record<string, unknown>>;
};

function userJsonPath(): string {
  return path.join(REPO_ROOT, ".sitecore", "user.json");
}

function readUserJson(): UserJson | undefined {
  const filePath = userJsonPath();
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as UserJson;
  } catch {
    return undefined;
  }
}

function endpointFromRaw(
  name: string,
  raw: Record<string, unknown>,
): SitecoreCliEndpoint {
  const variables =
    raw.variables && typeof raw.variables === "object"
      ? (raw.variables as Record<string, string>)
      : undefined;

  return {
    name,
    host: typeof raw.host === "string" ? raw.host : undefined,
    accessToken:
      typeof raw.accessToken === "string" ? raw.accessToken : undefined,
    authority: typeof raw.authority === "string" ? raw.authority : undefined,
    audience: typeof raw.audience === "string" ? raw.audience : undefined,
    clientId: typeof raw.clientId === "string" ? raw.clientId : undefined,
    clientSecret:
      typeof raw.clientSecret === "string" ? raw.clientSecret : undefined,
    variables,
  };
}

/**
 * Require an explicit Sitecore CLI endpoint name (no hardcoded defaults).
 * Priority: `endpointName` arg, then `BQ_SITECORE_ENDPOINT`.
 */
export function requireSitecoreEndpointName(endpointName?: string): string {
  const name =
    endpointName?.trim() || process.env.BQ_SITECORE_ENDPOINT?.trim() || "";
  if (!name) {
    throw new Error(
      `[sitecore-auth] Sitecore CLI endpoint is required. ` +
        `Set BQ_SITECORE_ENDPOINT in bq/.env.local (e.g. bqAuthoring), ` +
        `or pass --endpoint <name> to definitions:generate / authoring:generate. ` +
        `See ${AUTH_WALKTHROUGH}`,
    );
  }
  return name;
}

/**
 * Look up a named endpoint in a user.json-shaped object.
 * @param {UserJson | undefined} user
 * @param {string} name
 */
export function lookupSitecoreEndpoint(
  user: UserJson | undefined,
  name: string,
): SitecoreCliEndpoint {
  const raw = user?.endpoints?.[name];
  if (!raw || typeof raw !== "object") {
    const available = Object.keys(user?.endpoints || {}).join(", ") || "(none)";
    throw new Error(
      `[sitecore-auth] Endpoint "${name}" not found in .sitecore/user.json. ` +
        `Available: ${available}. ` +
        `Set BQ_SITECORE_ENDPOINT or --endpoint to one of those names.`,
    );
  }
  return endpointFromRaw(name, raw as Record<string, unknown>);
}

/**
 * Resolve a named Sitecore CLI endpoint from `.sitecore/user.json`.
 * Requires an explicit name: `endpointName` arg or `BQ_SITECORE_ENDPOINT`.
 * No hardcoded defaults (xmCloud / jbe-showcase) and no defaultEndpoint fallback.
 */
export function resolveSitecoreEndpoint(
  endpointName?: string,
): SitecoreCliEndpoint {
  return lookupSitecoreEndpoint(
    readUserJson(),
    requireSitecoreEndpointName(endpointName),
  );
}

export function resolveEnvironmentId(options?: {
  environmentId?: string;
  endpoint?: SitecoreCliEndpoint;
}): string {
  // Optional per-definition override (multi-env edge cases only).
  const fromDef = options?.environmentId?.trim();
  if (fromDef) return fromDef;

  // Primary: local/CI env (emitters load `.env.local` via loadLocalEnvFiles).
  const fromEnv =
    process.env.BQ_SITECORE_ENVIRONMENT_ID?.trim() ||
    process.env.SITECORE_ENVIRONMENT_ID?.trim();
  if (fromEnv) return fromEnv;

  const vars = options?.endpoint?.variables;
  if (vars) {
    for (const key of [
      "environmentId",
      "ENVIRONMENT_ID",
      "XM_CLOUD_ENVIRONMENT_ID",
      "Sitecore_EnvironmentId",
    ]) {
      const value = vars[key]?.trim();
      if (value) return value;
    }
  }

  throw new Error(
    `[sitecore-auth] Missing environment id for Sites API. ` +
      `Set BQ_SITECORE_ENVIRONMENT_ID (or SITECORE_ENVIRONMENT_ID) in bq/.env.local — ` +
      `not in definition files. Example for jbe-showcase CM: 7fXKks8vHFxRyAPkiethk0. ` +
      `Optional override: api.environmentId on a definition. See ${CREDENTIALS_DOCS}`,
  );
}

/**
 * Environment automation client credentials for Sites / XM Apps REST + non-interactive CLI login.
 * Reads `SITECORE_AUTH_CLIENT_ID` / `SITECORE_AUTH_CLIENT_SECRET` (same pair as Content SDK).
 * Values must be an Environment automation client (Deploy → Credentials → Environment → Automation).
 */
export function resolveAutomationClient(
  endpoint: SitecoreCliEndpoint,
  credentials?: SitesApiCredentials,
): { clientId: string; clientSecret: string } | undefined {
  const clientId =
    credentials?.clientId?.trim() ||
    process.env.SITECORE_AUTH_CLIENT_ID?.trim() ||
    endpoint.clientId?.trim();
  const clientSecret =
    credentials?.clientSecret?.trim() ||
    process.env.SITECORE_AUTH_CLIENT_SECRET?.trim() ||
    endpoint.clientSecret?.trim();

  if (clientId && clientSecret) return { clientId, clientSecret };
  return undefined;
}

/**
 * Bearer token for Sites REST API.
 * Requires environment automation client credentials (`xmcloud.cm:admin`).
 * Interactive CLI deploy tokens are rejected (401) by Sites API.
 */
export async function resolveSitesApiAccessToken(
  endpoint?: SitecoreCliEndpoint,
  credentials?: SitesApiCredentials,
): Promise<string> {
  const ep = endpoint ?? resolveSitecoreEndpoint();
  const automation = resolveAutomationClient(ep, credentials);

  if (automation) {
    return fetchClientCredentialsToken({
      ...ep,
      clientId: automation.clientId,
      clientSecret: automation.clientSecret,
    });
  }

  // Optional escape hatch for debugging only.
  if (process.env.BQ_SITECORE_ALLOW_INTERACTIVE_TOKEN === "1") {
    if (ep.accessToken?.trim()) return ep.accessToken.trim();
    if (ep.name !== "xmCloud") {
      const user = readUserJson();
      const xmRaw = user?.endpoints?.xmCloud;
      if (xmRaw && typeof xmRaw === "object") {
        const xm = endpointFromRaw("xmCloud", xmRaw as Record<string, unknown>);
        if (xm.accessToken?.trim()) return xm.accessToken.trim();
      }
    }
  }

  throw new Error(
    `[sitecore-auth] Sites API needs an Environment automation client ` +
      `(Deploy → Credentials → Environment → Automation) so the JWT has xmcloud.cm:admin. ` +
      `Set SITECORE_AUTH_CLIENT_ID / SITECORE_AUTH_CLIENT_SECRET in .env.local ` +
      `(Environment automation client). ` +
      `Interactive \`dotnet sitecore cloud login\` is not enough (401). ` +
      `Docs: ${SITES_API_AUTH_DOCS} · ${AUTH_WALKTHROUGH}`,
  );
}

/** @deprecated Prefer {@link resolveSitesApiAccessToken} for Sites API. */
export async function resolveAccessToken(
  endpoint?: SitecoreCliEndpoint,
  credentials?: SitesApiCredentials,
): Promise<string> {
  return resolveSitesApiAccessToken(endpoint, credentials);
}

async function fetchClientCredentialsToken(
  ep: SitecoreCliEndpoint,
): Promise<string> {
  const authority = (
    ep.authority?.trim() ||
    "https://auth.sitecorecloud.io"
  ).replace(/\/$/, "");
  const audience = ep.audience?.trim() || "https://api.sitecorecloud.io";

  const body = new URLSearchParams({
    client_id: ep.clientId!,
    client_secret: ep.clientSecret!,
    audience,
    grant_type: "client_credentials",
  });

  const response = await fetch(`${authority}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `[sitecore-auth] Token request failed (${response.status}). ` +
        `SITECORE_AUTH_CLIENT_ID/SECRET were rejected (wrong secret, revoked, ` +
        `or Organization/Design-Library client). Sites API needs Deploy → Credentials → ` +
        `Environment → Automation. Interactive \`dotnet sitecore cloud login\` will not fix this. ` +
        `See ${CREDENTIALS_DOCS}. ${text.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    access_token?: string;
    scope?: string;
  };
  if (!json.access_token?.trim()) {
    throw new Error(
      `[sitecore-auth] Token response missing access_token. See ${AUTH_WALKTHROUGH}`,
    );
  }

  const scope = (json.scope || "").trim();
  const hasDeployScopes = /\bxmclouddeploy\./.test(scope);
  // Environment automation clients typically return only `xmcloud.cm:admin`.
  // Organization clients include many xmclouddeploy.* scopes and get 401 on Sites API.
  if (hasDeployScopes) {
    throw new Error(
      `[sitecore-auth] Credentials look like an Organization automation client ` +
        `(JWT includes xmclouddeploy.* scopes). ` +
        `Sites API / XM Apps REST requires an Environment automation client: ` +
        `Deploy → Credentials → Environment → Create credentials → Automation ` +
        `(project jbe-showcase, environment jbe-showcase). ` +
        `Set SITECORE_AUTH_CLIENT_ID / SITECORE_AUTH_CLIENT_SECRET in .env.local. ` +
        `Organization clients cover Deploy + Authoring GraphQL across environments, ` +
        `but Sitecore scopes XM Apps REST (Sites/Pages) to environment clients only. ` +
        `${CREDENTIALS_DOCS}` +
        ` · Authoring GraphQL: ${AUTH_WALKTHROUGH}`,
    );
  }

  return json.access_token.trim();
}

export function authFailureHint(status: number): string {
  if (status !== 401 && status !== 403) return "";
  return (
    ` Authorization failed (${status}). For Sites API use an Environment automation client ` +
    `(not Organization). Deploy → Credentials → Environment → Automation. ` +
    `${CREDENTIALS_DOCS} · Authoring GraphQL walkthrough: ${AUTH_WALKTHROUGH}`
  );
}

const DEFAULT_SITECORE_CONNECTION_MAX_RETRIES = 3;
const DEFAULT_SITECORE_CONNECTION_RETRY_DELAY_MS = 5_000;

/**
 * Parse optional non-negative int env; invalid/empty → fallback.
 */
function parseConnectionRetryEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Shared Sitecore connection retry knobs (CLI login, CM lookup, ser push network).
 * Override via BQ_SITECORE_CONNECTION_MAX_RETRIES / BQ_SITECORE_CONNECTION_RETRY_DELAY_MS.
 * Retries after the first failed attempt (total attempts = 1 + this).
 */
export const SITECORE_CONNECTION_MAX_RETRIES = parseConnectionRetryEnv(
  "BQ_SITECORE_CONNECTION_MAX_RETRIES",
  DEFAULT_SITECORE_CONNECTION_MAX_RETRIES,
);
export const SITECORE_CONNECTION_RETRY_DELAY_MS = parseConnectionRetryEnv(
  "BQ_SITECORE_CONNECTION_RETRY_DELAY_MS",
  DEFAULT_SITECORE_CONNECTION_RETRY_DELAY_MS,
);

/** @deprecated Prefer SITECORE_CONNECTION_MAX_RETRIES */
export const CLI_LOGIN_MAX_RETRIES = SITECORE_CONNECTION_MAX_RETRIES;
/** @deprecated Prefer SITECORE_CONNECTION_RETRY_DELAY_MS */
export const CLI_LOGIN_RETRY_DELAY_MS = SITECORE_CONNECTION_RETRY_DELAY_MS;

export type CliLoginAttemptResult = { exitCode: number; output: string };

/**
 * True when `dotnet sitecore login` output looks like a transient auth/network
 * failure (e.g. OpenID discovery blip), not a credential/config error.
 */
export function isRetryableCliLoginFailure(output: string): boolean {
  const text = String(output || "");
  if (!text.trim()) return false;
  return (
    /discovering identity provider/i.test(text) ||
    /openid[- ]configuration/i.test(text) ||
    /OpenID metadata/i.test(text) ||
    /\bECONNRESET\b/i.test(text) ||
    /\bETIMEDOUT\b/i.test(text) ||
    /\bENOTFOUND\b/i.test(text) ||
    /\bEAI_AGAIN\b/i.test(text) ||
    /temporarily unavailable/i.test(text) ||
    /\bnetwork\b/i.test(text)
  );
}

/**
 * Re-run `runOnce` up to maxRetries times when the failure looks transient.
 * Unrelated failures return immediately (no wait).
 */
export async function runWithCliLoginRetries(
  runOnce: () => Promise<CliLoginAttemptResult>,
  options?: {
    maxRetries?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (info: {
      attempt: number;
      maxRetries: number;
      delayMs: number;
      output: string;
    }) => void;
  },
): Promise<CliLoginAttemptResult> {
  const maxRetries = options?.maxRetries ?? SITECORE_CONNECTION_MAX_RETRIES;
  const delayMs = options?.delayMs ?? SITECORE_CONNECTION_RETRY_DELAY_MS;
  const sleep =
    options?.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let result = await runOnce();
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (result.exitCode === 0) return result;
    if (!isRetryableCliLoginFailure(result.output)) return result;
    options?.onRetry?.({
      attempt,
      maxRetries,
      delayMs,
      output: result.output,
    });
    await sleep(delayMs);
    result = await runOnce();
  }
  return result;
}

/** Once per process — avoid re-running `dotnet sitecore login` on every ser call. */
let cliLoginPromise: Promise<void> | undefined;

/**
 * Non-interactive CLI login for `ser pull|push` using Environment automation credentials.
 * Does not open a browser / device-code flow. Never logs client secrets.
 */
export async function ensureSitecoreCliLogin(
  endpointName?: string,
): Promise<void> {
  if (!cliLoginPromise) {
    cliLoginPromise = runSitecoreCliLogin(endpointName).catch((err) => {
      cliLoginPromise = undefined;
      throw err;
    });
  }
  return cliLoginPromise;
}

async function runSitecoreCliLogin(endpointName?: string): Promise<void> {
  const endpoint = resolveSitecoreEndpoint(endpointName);
  const automation = resolveAutomationClient(endpoint);
  if (!automation) {
    console.log(
      `[sitecore-auth] Skipping auto CLI login — set SITECORE_AUTH_CLIENT_ID / ` +
        `SITECORE_AUTH_CLIENT_SECRET (Deploy → Credentials → Environment → Automation).`,
    );
    return;
  }

  const authority = (
    endpoint.authority?.trim() ||
    "https://auth.sitecorecloud.io"
  ).replace(/\/$/, "");
  const audience =
    endpoint.audience?.trim() || "https://api.sitecorecloud.io";
  const cm = endpoint.host?.trim();

  const args = [
    "sitecore",
    "login",
    "-n",
    endpoint.name,
    "--client-credentials",
    "true",
    "--client-id",
    automation.clientId,
    "--client-secret",
    automation.clientSecret,
    "--allow-write",
    "true",
    "--authority",
    authority,
    "--audience",
    audience,
  ];
  if (cm) {
    args.push("--cm", cm);
  }

  console.log(
    `[sitecore-auth] Non-interactive CLI login for endpoint "${endpoint.name}"` +
      (cm ? ` (cm ${cm})` : "") +
      "…",
  );

  const result = await runWithCliLoginRetries(
    () => spawnCliLogin(args),
    {
      onRetry: ({ attempt, maxRetries, delayMs, output }) => {
        const snippet = output.replace(/\r\n/g, "\n").trim().slice(0, 160);
        console.log(
          `[sitecore-auth] CLI login retry ${attempt}/${maxRetries} in ${Math.round(delayMs / 1000)}s…` +
            (snippet ? ` (${snippet})` : ""),
        );
      },
    },
  );

  if (result.exitCode !== 0) {
    const cleaned = result.output.replace(/\r\n/g, "\n").trim().slice(0, 500);
    throw new Error(
      `[sitecore-auth] Non-interactive \`dotnet sitecore login -n ${endpoint.name}\` ` +
        `exited ${result.exitCode}. Check SITECORE_AUTH_CLIENT_ID/SECRET (Environment Automation) ` +
        `and that endpoint "${endpoint.name}" exists in .sitecore/user.json with a CM host. ` +
        `Interactive cloud login is not required when automation credentials are valid. ` +
        (cleaned ? `Output: ${cleaned}` : ""),
    );
  }

  console.log(
    `[sitecore-auth] CLI login OK for endpoint "${endpoint.name}".`,
  );
}

function spawnCliLogin(args: string[]): Promise<CliLoginAttemptResult> {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn("dotnet", args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      resolve({ exitCode: code ?? 1, output }),
    );
  });
}

export { AUTH_WALKTHROUGH, SITES_API_AUTH_DOCS, CREDENTIALS_DOCS };
