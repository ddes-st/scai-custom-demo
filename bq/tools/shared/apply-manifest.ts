import fs from "node:fs";
import path from "node:path";
import { readExistingCreateProvenance } from "./authoring-item-model";
import { isBqProvenanceActor } from "./provenance";
import { getActiveApplyRunLog } from "./apply-context";

export type PruneStats = {
  deleted: number;
  skipped: number;
};

export function emptyPruneStats(): PruneStats {
  return { deleted: 0, skipped: 0 };
}

export function mergePruneStats(...all: PruneStats[]): PruneStats {
  const out = emptyPruneStats();
  for (const stats of all) {
    out.deleted += stats.deleted;
    out.skipped += stats.skipped;
  }
  return out;
}

export function formatPruneStats(stats: PruneStats): string | undefined {
  const parts: string[] = [];
  if (stats.deleted) {
    parts.push(
      `${stats.deleted} yaml removed (orphaned BQ items no longer in definition)`,
    );
  }
  if (stats.skipped) {
    parts.push(
      `${stats.skipped} yaml kept (not BQ-owned — left untouched)`,
    );
  }
  return parts.length ? parts.join("; ") : undefined;
}

/** Paths the current emit run intends to keep (written or unchanged). */
export class ApplyManifest {
  private readonly paths = new Set<string>();

  track(filePath: string): void {
    this.paths.add(path.normalize(path.resolve(filePath)));
  }

  has(filePath: string): boolean {
    return this.paths.has(path.normalize(path.resolve(filePath)));
  }

  get size(): number {
    return this.paths.size;
  }

  /** Absolute normalized paths tracked this run. */
  trackedPaths(): readonly string[] {
    return [...this.paths];
  }
}

/**
 * True when `__Created by` (or `__Updated by` fallback) is the BQ actor.
 * Hand-authored or Sitecore-synced YAML is never treated as BQ-owned.
 */
export function isBqGeneratedItem(filePath: string): boolean {
  let yaml: string;
  try {
    yaml = fs.readFileSync(filePath, "utf8");
  } catch {
    return false;
  }

  const provenance = readExistingCreateProvenance(yaml);
  return isBqProvenanceActor(provenance);
}

function walkYamlFiles(rootDir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(rootDir)) return out;

  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (
        entry.name.endsWith(".yml") ||
        entry.name.endsWith(".yaml")
      ) {
        out.push(full);
      }
    }
  };

  visit(rootDir);
  return out;
}

function yamlPathsUnderRoots(roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const root of roots) {
    const resolved = path.normalize(path.resolve(root));
    if (!fs.existsSync(resolved)) continue;
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      if (
        (resolved.endsWith(".yml") || resolved.endsWith(".yaml")) &&
        !seen.has(resolved)
      ) {
        seen.add(resolved);
        out.push(resolved);
      }
      continue;
    }
    for (const yamlPath of walkYamlFiles(resolved)) {
      const norm = path.normalize(path.resolve(yamlPath));
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

/**
 * After ser pull: absolute paths of BQ-owned YAML under emit roots.
 */
export function snapshotBqYaml(roots: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const yamlPath of yamlPathsUnderRoots(roots)) {
    if (isBqGeneratedItem(yamlPath)) {
      out.add(yamlPath);
    }
  }
  return out;
}

/**
 * Delete BQ YAML that were present in the post-pull snapshot but never
 * tracked by this run's emit manifest. Empty-dir cleanup is limited to SCS
 * path-length hash folders (not logical Data/template folders).
 */
export function pruneUntrackedBqYaml(
  snapshot: ReadonlySet<string>,
  manifest: ApplyManifest,
): PruneStats {
  const stats = emptyPruneStats();
  for (const filePath of snapshot) {
    const resolved = path.normalize(path.resolve(filePath));
    if (manifest.has(resolved)) continue;
    if (!fs.existsSync(resolved)) continue;

    if (!isBqGeneratedItem(resolved)) {
      stats.skipped += 1;
      getActiveApplyRunLog()?.recordPrune("kept", resolved, "not BQ-owned");
      continue;
    }

    fs.unlinkSync(resolved);
    stats.deleted += 1;
    getActiveApplyRunLog()?.recordPrune(
      "removed",
      resolved,
      "orphaned BQ item not emitted this run",
    );
  }
  return stats;
}

/**
 * Delete BQ-generated YAML under `roots` that was not tracked in `manifest`.
 * Prefer {@link pruneUntrackedBqYaml} for run-level orphan cleanup.
 */
export function pruneEmitPaths(
  roots: readonly string[],
  manifest: ApplyManifest,
): PruneStats {
  const stats = emptyPruneStats();
  for (const yamlPath of yamlPathsUnderRoots(roots)) {
    const resolved = path.normalize(path.resolve(yamlPath));
    if (manifest.has(resolved)) continue;
    if (!fs.existsSync(resolved)) continue;

    if (!isBqGeneratedItem(resolved)) {
      stats.skipped += 1;
      getActiveApplyRunLog()?.recordPrune("kept", resolved, "not BQ-owned");
      continue;
    }

    fs.unlinkSync(resolved);
    stats.deleted += 1;
    getActiveApplyRunLog()?.recordPrune(
      "removed",
      resolved,
      "orphaned BQ item no longer in definition",
    );
  }
  return stats;
}
