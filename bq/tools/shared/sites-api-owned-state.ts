import fs from "node:fs";
import path from "node:path";
import { BQ_DEFINITIONS_DIR } from "./paths";

/**
 * Desired-state inventory for Sites API collections/sites managed by BQ.
 *
 * Sitecore API creates do not stamp `__Created by` as BQ, so we cannot use YAML
 * provenance pruning. Instead we persist what the last successful generate owned
 * (by definitionKey). On the next run, keys missing from current definitions are
 * deleted remotely — same “remove the definition file → remove the entity” model.
 *
 * Stored under `.bq/definitions`. Content is written through the Authoring API;
 * this inventory does not depend on a serialization module.
 */
export type OwnedCollectionRecord = {
  systemName: string;
  id?: string;
};

export type OwnedSiteRecord = {
  systemName: string;
  collectionSystem: string;
  id?: string;
};

export type SitesApiOwnedState = {
  version: 1;
  collections: Record<string, OwnedCollectionRecord>;
  sites: Record<string, OwnedSiteRecord>;
};

const STATE_FILE_NAME = "bq-sites-api-owned.json";

export function sitesApiOwnedStatePath(): string {
  return path.join(BQ_DEFINITIONS_DIR, STATE_FILE_NAME);
}

export function emptySitesApiOwnedState(): SitesApiOwnedState {
  return { version: 1, collections: {}, sites: {} };
}

export function readSitesApiOwnedState(): SitesApiOwnedState {
  const filePath = sitesApiOwnedStatePath();
  if (!fs.existsSync(filePath)) return emptySitesApiOwnedState();
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<SitesApiOwnedState>;
    return {
      version: 1,
      collections: raw.collections && typeof raw.collections === "object" ? raw.collections : {},
      sites: raw.sites && typeof raw.sites === "object" ? raw.sites : {},
    };
  } catch (error) {
    throw new Error(
      `[sites-api-owned] Failed to read ${filePath}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export function writeSitesApiOwnedState(state: SitesApiOwnedState): void {
  const filePath = sitesApiOwnedStatePath();
  const normalized: SitesApiOwnedState = {
    version: 1,
    collections: Object.fromEntries(
      Object.entries(state.collections).sort(([a], [b]) => a.localeCompare(b)),
    ),
    sites: Object.fromEntries(
      Object.entries(state.sites).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  console.log(
    `[sites-api-owned] wrote ${filePath} ` +
      `(${Object.keys(normalized.collections).length} collection(s), ` +
      `${Object.keys(normalized.sites).length} site(s))`,
  );
}

/** In-memory ledger for one generate run; flushed after upserts. */
export class SitesApiOwnedLedger {
  private readonly previous: SitesApiOwnedState;
  private readonly next: SitesApiOwnedState;

  constructor(previous: SitesApiOwnedState = readSitesApiOwnedState()) {
    this.previous = previous;
    this.next = emptySitesApiOwnedState();
  }

  getPrevious(): SitesApiOwnedState {
    return this.previous;
  }

  previousCollection(definitionKey: string): OwnedCollectionRecord | undefined {
    return this.previous.collections[definitionKey];
  }

  previousSite(definitionKey: string): OwnedSiteRecord | undefined {
    return this.previous.sites[definitionKey];
  }

  trackCollection(
    definitionKey: string,
    record: OwnedCollectionRecord,
  ): void {
    this.next.collections[definitionKey] = {
      systemName: record.systemName,
      ...(record.id ? { id: record.id } : undefined),
    };
  }

  trackSite(definitionKey: string, record: OwnedSiteRecord): void {
    this.next.sites[definitionKey] = {
      systemName: record.systemName,
      collectionSystem: record.collectionSystem,
      ...(record.id ? { id: record.id } : undefined),
    };
  }

  flush(): void {
    writeSitesApiOwnedState(this.next);
  }
}

let activeLedger: SitesApiOwnedLedger | undefined;

export function setActiveSitesApiOwnedLedger(
  ledger: SitesApiOwnedLedger | undefined,
): void {
  activeLedger = ledger;
}

export function getActiveSitesApiOwnedLedger(): SitesApiOwnedLedger | undefined {
  return activeLedger;
}
