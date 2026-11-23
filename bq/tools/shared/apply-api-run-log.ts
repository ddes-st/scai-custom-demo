/**
 * Per-run Authoring / Sites API call logging for definitions:generate apply.
 *
 * Layout:
 * ```
 * .bq/definitions/apply-runs/{runId}/
 *   run.json
 *   api-calls.jsonl
 *   api-calls.log
 *   definitions/{definitionKey}/
 *     {basename}.definition.ts.apply-snapshot
 *     api-calls.jsonl
 * ```
 *
 * Snapshot suffix {@link DEFINITION_APPLY_SNAPSHOT_SUFFIX} is not discoverable
 * as a real definition (`endsWith(".definition.ts")` is false).
 */
import fs from "node:fs";
import path from "node:path";
import {
  BQ_APPLY_RUNS_DIR,
  DEFINITION_APPLY_SNAPSHOT_SUFFIX,
  REPO_ROOT,
} from "./paths";
import { isCreateVerbose } from "./id-resolve-log";

export type ApplyApiCallKind =
  | "authoring-graphql"
  | "sites-rest"
  | "media-upload";

export type ApplyApiCallRecord = {
  ts: string;
  kind: ApplyApiCallKind;
  operation: string;
  definitionKey: string | null;
  definitionFile: string | null;
  durationMs: number;
  ok: boolean;
  attempts: number;
  error?: string;
  /** Always: short summary (mutation name, path, status). */
  summary?: Record<string, unknown>;
  /** Verbose only: request/response payloads (redacted). */
  detail?: Record<string, unknown>;
};

export type ApplyApiRunSession = {
  runId: string;
  runDir: string;
  startedAt: string;
  verbose: boolean;
  endpointName?: string;
};

let active: ApplyApiRunSession | undefined;
let activeDefinitionKey: string | null = null;
let activeDefinitionFile: string | null = null;
const callBuffer: ApplyApiCallRecord[] = [];
const snapshottedKeys = new Set<string>();

function safeSegment(raw: string): string {
  return (
    String(raw || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "unnamed"
  );
}

function stampRunId(d = new Date()): string {
  const iso = d.toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${iso}_${rand}`;
}

export function isApplyApiVerbose(argv: string[] = process.argv.slice(2)): boolean {
  if (isCreateVerbose()) return true;
  const env = String(process.env.BQ_APPLY_API_LOG || "")
    .trim()
    .toLowerCase();
  if (env === "verbose" || env === "debug" || env === "v" || env === "1") {
    return true;
  }
  return argv.includes("--verbose") || argv.includes("-v");
}

export function getActiveApplyApiRun(): ApplyApiRunSession | undefined {
  return active;
}

export function getActiveApplyApiDefinitionKey(): string | null {
  return activeDefinitionKey;
}

/**
 * Start a generate-run API log folder. No-ops if already started.
 */
export function beginApplyApiRun(options?: {
  endpointName?: string;
  verbose?: boolean;
  runId?: string;
}): ApplyApiRunSession {
  if (active) return active;
  const verbose = options?.verbose ?? isApplyApiVerbose();
  const runId = options?.runId || stampRunId();
  const runDir = path.join(BQ_APPLY_RUNS_DIR, runId);
  fs.mkdirSync(path.join(runDir, "definitions"), { recursive: true });
  const startedAt = new Date().toISOString();
  active = {
    runId,
    runDir,
    startedAt,
    verbose,
    endpointName: options?.endpointName,
  };
  callBuffer.length = 0;
  snapshottedKeys.clear();
  activeDefinitionKey = null;
  activeDefinitionFile = null;

  const meta = {
    runId,
    startedAt,
    verbose,
    endpointName: options?.endpointName || null,
    repo: REPO_ROOT,
  };
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `[bq:apply:api-log] run ${runId}` +
      (verbose ? " (verbose)" : "") +
      ` → ${path.relative(REPO_ROOT, runDir).split(path.sep).join("/")}`,
  );
  return active;
}

/**
 * Bind subsequent API calls to a definition; copy source once per key.
 */
export function beginApplyApiDefinition(options: {
  definitionKey: string;
  definitionFile?: string | null;
}): void {
  if (!active) return;
  activeDefinitionKey = options.definitionKey || null;
  activeDefinitionFile = options.definitionFile
    ? path.resolve(options.definitionFile)
    : null;
  if (!activeDefinitionKey || !activeDefinitionFile) return;
  if (snapshottedKeys.has(activeDefinitionKey)) return;
  if (!fs.existsSync(activeDefinitionFile)) return;

  const keySeg = safeSegment(activeDefinitionKey);
  const defDir = path.join(active.runDir, "definitions", keySeg);
  fs.mkdirSync(defDir, { recursive: true });
  const base = path.basename(activeDefinitionFile);
  // e.g. menzis-nl-site.definition.ts → menzis-nl-site.definition.ts.apply-snapshot
  const snapName = base.endsWith(".definition.ts")
    ? `${base.slice(0, -".definition.ts".length)}${DEFINITION_APPLY_SNAPSHOT_SUFFIX}`
    : `${base}${DEFINITION_APPLY_SNAPSHOT_SUFFIX}`;
  const dest = path.join(defDir, snapName);
  fs.copyFileSync(activeDefinitionFile, dest);
  fs.writeFileSync(
    path.join(defDir, "source.json"),
    `${JSON.stringify(
      {
        definitionKey: activeDefinitionKey,
        sourceFile: path
          .relative(REPO_ROOT, activeDefinitionFile)
          .split(path.sep)
          .join("/"),
        snapshot: path.relative(active.runDir, dest).split(path.sep).join("/"),
        copiedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  snapshottedKeys.add(activeDefinitionKey);
}

export function endApplyApiDefinition(): void {
  activeDefinitionKey = null;
  activeDefinitionFile = null;
}

function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (/^Bearer\s+/i.test(value)) return "Bearer ***";
    if (value.length > 4000) return `${value.slice(0, 4000)}…[truncated]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/token|authorization|secret|password|presigned/i.test(k)) {
        out[k] = "***";
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}

function inferGraphqlOperation(query: string): string {
  const m = String(query || "").match(
    /\b(mutation|query)\s*(?:\w+\s*)?(?:\([^)]*\))?\s*\{\s*(\w+)/i,
  );
  if (m?.[2]) return m[2];
  const bare = String(query || "").match(/\b(createItem|updateItem|createItemTemplate|updateItemTemplate|uploadMedia|deleteItem|renameItem|moveItem|item)\b/);
  return bare?.[1] || "graphql";
}

export function recordApplyApiCall(
  partial: Omit<
    ApplyApiCallRecord,
    "ts" | "definitionKey" | "definitionFile"
  > & {
    definitionKey?: string | null;
    definitionFile?: string | null;
  },
): void {
  if (!active) return;
  const record: ApplyApiCallRecord = {
    ts: new Date().toISOString(),
    kind: partial.kind,
    operation: partial.operation,
    definitionKey:
      partial.definitionKey !== undefined
        ? partial.definitionKey
        : activeDefinitionKey,
    definitionFile:
      partial.definitionFile !== undefined
        ? partial.definitionFile
        : activeDefinitionFile
          ? path
              .relative(REPO_ROOT, activeDefinitionFile)
              .split(path.sep)
              .join("/")
          : null,
    durationMs: partial.durationMs,
    ok: partial.ok,
    attempts: partial.attempts,
    error: partial.error,
    summary: partial.summary,
    detail: active.verbose ? partial.detail : undefined,
  };
  callBuffer.push(record);

  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(path.join(active.runDir, "api-calls.jsonl"), line, "utf8");

  if (record.definitionKey) {
    const defDir = path.join(
      active.runDir,
      "definitions",
      safeSegment(record.definitionKey),
    );
    fs.mkdirSync(defDir, { recursive: true });
    fs.appendFileSync(path.join(defDir, "api-calls.jsonl"), line, "utf8");
  }
}

/**
 * Wrap an API call with timing + optional retry logging hooks.
 */
export async function traceApplyApiCall<T>(options: {
  kind: ApplyApiCallKind;
  operation: string;
  summary?: Record<string, unknown>;
  detail?: Record<string, unknown>;
  run: () => Promise<T>;
  summarizeResult?: (result: T) => Record<string, unknown>;
  attempts?: number;
}): Promise<T> {
  const started = Date.now();
  const attempts = options.attempts ?? 1;
  try {
    const result = await options.run();
    const summary = {
      ...(options.summary || {}),
      ...(options.summarizeResult?.(result) || {}),
    };
    recordApplyApiCall({
      kind: options.kind,
      operation: options.operation,
      durationMs: Date.now() - started,
      ok: true,
      attempts,
      summary,
      detail: {
        ...(options.detail || {}),
        result: options.summarizeResult
          ? undefined
          : redactSecrets(result as unknown),
      },
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordApplyApiCall({
      kind: options.kind,
      operation: options.operation,
      durationMs: Date.now() - started,
      ok: false,
      attempts,
      error: msg.slice(0, 2000),
      summary: options.summary,
      detail: options.detail,
    });
    throw err;
  }
}

export function graphqlOperationName(query: string): string {
  return inferGraphqlOperation(query);
}

export function redactApplyApiPayload(value: unknown): unknown {
  return redactSecrets(value);
}

function formatHumanLog(records: ApplyApiCallRecord[]): string {
  const lines: string[] = [
    `# definitions:generate apply API log`,
    `# run: ${active?.runId || "(unknown)"}`,
    `# started: ${active?.startedAt || ""}`,
    `# finished: ${new Date().toISOString()}`,
    `# verbose: ${active?.verbose ? "yes" : "no"}`,
    `# calls: ${records.length}`,
    ``,
  ];
  let lastDef: string | null | undefined = undefined;
  for (const r of records) {
    if (r.definitionKey !== lastDef) {
      lastDef = r.definitionKey;
      lines.push(``);
      lines.push(`## ${r.definitionKey || "(run-scoped)"}`);
      if (r.definitionFile) lines.push(`source: ${r.definitionFile}`);
    }
    const status = r.ok ? "ok" : "FAIL";
    lines.push(
      `- [${r.ts}] ${status} ${r.kind}/${r.operation} ${r.durationMs}ms` +
        (r.attempts > 1 ? ` attempts=${r.attempts}` : "") +
        (r.error ? ` error=${r.error.slice(0, 180)}` : ""),
    );
    if (r.summary && Object.keys(r.summary).length) {
      lines.push(`  summary: ${JSON.stringify(r.summary)}`);
    }
    if (r.detail && active?.verbose) {
      lines.push(`  detail: ${JSON.stringify(r.detail)}`);
    }
  }
  lines.push(``);
  return `${lines.join("\n")}\n`;
}

/**
 * Flush human-readable log + finalize run.json. Clears active session.
 */
export function endApplyApiRun(): string | undefined {
  if (!active) return undefined;
  const runDir = active.runDir;
  const finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(runDir, "api-calls.log"),
    formatHumanLog(callBuffer),
    "utf8",
  );

  let prior: Record<string, unknown> = {};
  try {
    prior = JSON.parse(
      fs.readFileSync(path.join(runDir, "run.json"), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  const okCount = callBuffer.filter((c) => c.ok).length;
  const failCount = callBuffer.length - okCount;
  const totalMs = callBuffer.reduce((s, c) => s + c.durationMs, 0);
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    `${JSON.stringify(
      {
        ...prior,
        finishedAt,
        callCount: callBuffer.length,
        okCount,
        failCount,
        totalDurationMs: totalMs,
        definitionSnapshots: snapshottedKeys.size,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const rel = path.relative(REPO_ROOT, runDir).split(path.sep).join("/");
  console.log(
    `[bq:apply:api-log] finished ${active.runId}: calls=${callBuffer.length} ok=${okCount} fail=${failCount} → ${rel}`,
  );

  active = undefined;
  activeDefinitionKey = null;
  activeDefinitionFile = null;
  callBuffer.length = 0;
  snapshottedKeys.clear();
  return runDir;
}

/** Test helper */
export function __resetApplyApiRunForTests(): void {
  active = undefined;
  activeDefinitionKey = null;
  activeDefinitionFile = null;
  callBuffer.length = 0;
  snapshottedKeys.clear();
}
