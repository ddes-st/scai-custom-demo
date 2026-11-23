/**
 * Thin wrappers around `dotnet sitecore ser pull|push|validate` for
 * delete/restore YAML sessions. Normal create/apply stays Authoring GraphQL.
 */
import { spawn } from "node:child_process";
import {
  ensureSitecoreCliLogin,
  requireSitecoreEndpointName,
  resolveSitecoreEndpoint,
} from "./sitecore-auth";
import { getModuleIncludeName } from "../definitions/apply/module-json";
import { REPO_ROOT } from "./paths";
import { logShellCommand, recordSerOp } from "./phase-log.mjs";

export type SerAction = "pull" | "push" | "validate";

export type RunSerCommandOptions = {
  action: SerAction;
  endpointName?: string;
  moduleInclude?: string;
  /**
   * When `action` is `validate`, pass SCS `--fix`.
   */
  fix?: boolean;
  /**
   * Stdio mode for pull/push (validate always captures):
   * - `true` / omitted: inherit parent stdio
   * - `false`: capture only
   * - `"tee"`: capture and mirror
   */
  inheritStdio?: boolean | "tee";
  reason?: string;
};

export async function runSerCommand(
  options: RunSerCommandOptions,
): Promise<{ exitCode: number; output: string }> {
  if (options.action !== "validate" && options.endpointName) {
    await ensureSitecoreCliLogin(options.endpointName);
  }

  const configDir = REPO_ROOT;
  const args = ["sitecore", "ser", options.action];
  if (options.action !== "validate" && options.endpointName) {
    args.push("-n", options.endpointName);
  }
  args.push(
    "-i",
    options.moduleInclude ?? getModuleIncludeName(),
    "-c",
    configDir,
  );
  if (options.action === "validate" && options.fix) {
    args.push("--fix");
  }

  const mode: "inherit" | "capture" | "tee" =
    options.action === "validate"
      ? "capture"
      : options.inheritStdio === false
        ? "capture"
        : options.inheritStdio === "tee"
          ? "tee"
          : "inherit";

  logShellCommand(`dotnet ${args.join(" ")}`);

  const startedAt = Date.now();
  try {
    const result = await new Promise<{ exitCode: number; output: string }>(
      (resolve, reject) => {
        const child = spawn("dotnet", args, {
          cwd: configDir,
          stdio: mode === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
        });
        let output = "";
        if (mode !== "inherit") {
          const append = (
            chunk: Buffer | string,
            stream: "stdout" | "stderr",
          ) => {
            const text = chunk.toString();
            output += text;
            if (mode === "tee") {
              if (stream === "stdout") process.stdout.write(text);
              else process.stderr.write(text);
            }
          };
          child.stdout?.on("data", (chunk: Buffer | string) => {
            append(chunk, "stdout");
          });
          child.stderr?.on("data", (chunk: Buffer | string) => {
            append(chunk, "stderr");
          });
        }
        child.on("error", reject);
        child.on("exit", (code) => {
          resolve({ exitCode: code ?? 1, output });
        });
      },
    );
    recordSerOp({
      action: options.action,
      reason: options.reason,
      ms: Date.now() - startedAt,
      ok: result.exitCode === 0,
    });
    return result;
  } catch (err) {
    recordSerOp({
      action: options.action,
      reason: options.reason,
      ms: Date.now() - startedAt,
      ok: false,
    });
    throw err;
  }
}

/** `dotnet sitecore ser pull -n <endpoint> -i <module>`. */
export async function pullSerializationNow(options?: {
  endpointName?: string;
  moduleInclude?: string;
  reason?: string;
  skipPull?: boolean;
}): Promise<void> {
  if (options?.skipPull) {
    console.log(
      `[ser-cli] skipPull set — not running ser pull` +
        (options.reason ? ` (${options.reason})` : ""),
    );
    return;
  }
  const endpoint = resolveSitecoreEndpoint(options?.endpointName);
  const moduleInclude = options?.moduleInclude ?? getModuleIncludeName();
  const reason = options?.reason ?? "ser session";
  console.log(`[ser-cli] ser pull (${reason})…`);
  const { exitCode } = await runSerCommand({
    action: "pull",
    endpointName: endpoint.name,
    moduleInclude,
    reason,
  });
  if (exitCode !== 0) {
    throw new Error(
      `[ser-cli] ser pull exited with code ${exitCode}. ` +
        `Ensure CLI login works and module include matches ` +
        `${moduleInclude} (bq-demo.module.json namespace). ` +
        `Endpoint: ${requireSitecoreEndpointName(endpoint.name)}.`,
    );
  }
}

/** `dotnet sitecore ser push -n <endpoint> -i <module>`. */
export async function pushSerializationNow(options?: {
  endpointName?: string;
  moduleInclude?: string;
  reason?: string;
  skipPush?: boolean;
}): Promise<void> {
  if (options?.skipPush) {
    console.log(
      `[ser-cli] skipPush set — not running ser push` +
        (options.reason ? ` (${options.reason})` : ""),
    );
    return;
  }
  const endpoint = resolveSitecoreEndpoint(options?.endpointName);
  const moduleInclude = options?.moduleInclude ?? getModuleIncludeName();
  const reason = options?.reason ?? "ser session";
  console.log(`[ser-cli] ser push (${reason})…`);
  const { exitCode, output } = await runSerCommand({
    action: "push",
    endpointName: endpoint.name,
    moduleInclude,
    inheritStdio: "tee",
    reason,
  });
  if (exitCode !== 0) {
    const snippet = String(output || "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, 400);
    throw new Error(
      `[ser-cli] ser push exited with code ${exitCode}. ` +
        `Endpoint: ${endpoint.name}, include: ${moduleInclude}.` +
        (snippet ? ` Output: ${snippet}` : ""),
    );
  }
}
