import fs from "node:fs";
import path from "node:path";
import { BQ_DEFINITIONS_DIR, DEFINITIONS_GENERATE_LOG, REPO_ROOT } from "./paths";
import type { ScsWriteResult } from "./authoring-item-model";

export type ApplyLogWriteAction = ScsWriteResult;
export type ApplyLogPruneAction = "removed" | "kept";

type EmitLogEntry =
  | { kind: "write"; action: ApplyLogWriteAction; filePath: string }
  | {
      kind: "prune";
      action: ApplyLogPruneAction;
      filePath: string;
      reason: string;
    };

type EmitLogSection = {
  title: string;
  entries: EmitLogEntry[];
};

/**
 * Collects per-YAML create/update/unchanged/prune detail for one generate run.
 * Terminal stays short; full paths go in a detail log file.
 */
export class ApplyRunLog {
  private readonly startedAt = new Date();
  private readonly sections: EmitLogSection[] = [];
  private current: EmitLogSection | undefined;
  private validateResult:
    | { ok: boolean; summary: string; output: string }
    | undefined;

  beginDefinition(title: string): void {
    this.current = { title, entries: [] };
    this.sections.push(this.current);
  }

  setValidateResult(result: {
    ok: boolean;
    summary: string;
    output: string;
  }): void {
    this.validateResult = result;
  }

  recordWrite(action: ApplyLogWriteAction, filePath: string): void {
    this.ensureSection().entries.push({
      kind: "write",
      action,
      filePath: path.normalize(path.resolve(filePath)),
    });
  }

  recordPrune(
    action: ApplyLogPruneAction,
    filePath: string,
    reason: string,
  ): void {
    this.ensureSection().entries.push({
      kind: "prune",
      action,
      filePath: path.normalize(path.resolve(filePath)),
      reason,
    });
  }

  private ensureSection(): EmitLogSection {
    if (!this.current) {
      this.beginDefinition("(unscoped)");
    }
    return this.current!;
  }

  /**
   * Console summary of apply writes + prune for this generate run.
   * Full paths stay in the detail log; terminal shows counts + a short sample.
   */
  logApplySummaryToConsole(options?: {
    label?: string;
    pruneDeleted?: number;
    pruneSkippedNotBq?: number;
    sampleLimit?: number;
  }): void {
    const label = options?.label?.trim() || "generate";
    const sampleLimit = Math.max(0, options?.sampleLimit ?? 8);
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let prunedRemoved = 0;
    /** @type {string[]} */
    const createdSamples: string[] = [];
    /** @type {string[]} */
    const prunedSamples: string[] = [];

    for (const section of this.sections) {
      for (const entry of section.entries) {
        if (entry.kind === "write") {
          if (entry.action === "created") {
            created += 1;
            if (createdSamples.length < sampleLimit) {
              createdSamples.push(relToRepo(entry.filePath));
            }
          } else if (entry.action === "updated") {
            updated += 1;
          } else if (entry.action === "unchanged") {
            unchanged += 1;
          }
        } else if (entry.kind === "prune" && entry.action === "removed") {
          prunedRemoved += 1;
          if (prunedSamples.length < sampleLimit) {
            prunedSamples.push(relToRepo(entry.filePath));
          }
        }
      }
    }

    const pruneDeleted =
      typeof options?.pruneDeleted === "number"
        ? options.pruneDeleted
        : prunedRemoved;
    const pruneSkipped = options?.pruneSkippedNotBq ?? 0;

    console.log(
      `[bq:definitions:generate] Apply summary (${label}): ` +
        `created=${created} updated=${updated} kept/unchanged=${unchanged} ` +
        `pruned=${pruneDeleted}` +
        (pruneSkipped ? ` skippedNotBq=${pruneSkipped}` : ""),
    );
    if (createdSamples.length) {
      console.log(
        `[bq:definitions:generate]   created sample: ${createdSamples.join(", ")}` +
          (created > createdSamples.length
            ? ` (+${created - createdSamples.length} more)`
            : ""),
      );
    }
    if (prunedSamples.length) {
      console.log(
        `[bq:definitions:generate]   pruned sample: ${prunedSamples.join(", ")}` +
          (pruneDeleted > prunedSamples.length
            ? ` (+${pruneDeleted - prunedSamples.length} more)`
            : ""),
      );
    }
  }

  /** Absolute path to the written detail log (clickable in most terminals). */
  writeToDisk(fileName = "definitions-generate.log"): string {
    fs.mkdirSync(BQ_DEFINITIONS_DIR, { recursive: true });
    const outPath =
      fileName === "definitions-generate.log"
        ? DEFINITIONS_GENERATE_LOG
        : path.join(BQ_DEFINITIONS_DIR, fileName);
    const lines: string[] = [
      `# definitions:generate detail log`,
      `# started: ${this.startedAt.toISOString()}`,
      `# finished: ${new Date().toISOString()}`,
      `# repo: ${REPO_ROOT}`,
      ``,
    ];

    for (const section of this.sections) {
      lines.push(`## ${section.title}`);
      const writes = section.entries.filter((e) => e.kind === "write");
      const prunes = section.entries.filter((e) => e.kind === "prune");

      if (writes.length) {
        lines.push(`### YAML writes (${writes.length})`);
        for (const entry of writes) {
          if (entry.kind !== "write") continue;
          lines.push(
            `  ${entry.action.padEnd(9)}  ${relToRepo(entry.filePath)}`,
          );
        }
      } else {
        lines.push(`### YAML writes (0)`);
      }

      if (prunes.length) {
        lines.push(`### Prune (${prunes.length})`);
        for (const entry of prunes) {
          if (entry.kind !== "prune") continue;
          lines.push(
            `  ${entry.action.padEnd(9)}  ${relToRepo(entry.filePath)}  (${entry.reason})`,
          );
        }
      }
      lines.push(``);
    }

    if (this.validateResult) {
      lines.push(`## ser validate (read-only, no --fix)`);
      lines.push(
        `result: ${this.validateResult.ok ? "OK" : "ERRORS"} - ${this.validateResult.summary}`,
      );
      lines.push(``);
      lines.push("```");
      lines.push(this.validateResult.output || "(no output)");
      lines.push("```");
      lines.push(``);
    }

    fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
    return outPath;
  }
}

function relToRepo(absolutePath: string): string {
  const rel = path.relative(REPO_ROOT, absolutePath);
  return rel && !rel.startsWith("..")
    ? rel.split(path.sep).join("/")
    : absolutePath;
}

/** Default detail log path for docs / env overrides. */
export function definitionsGenerateDetailLogPath(): string {
  return DEFINITIONS_GENERATE_LOG;
}
