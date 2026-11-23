import { ApplyManifest } from "./apply-manifest";
import type { ApplyRunLog } from "./apply-run-log";
import {
  beginApplyInventorySession,
  clearApplyInventorySession,
  endApplyInventorySession,
  getActiveApplyDefinitionKey,
  getActiveApplyInventorySession,
  setActiveApplyDefinitionKey,
  type ApplyInventorySession,
} from "./apply-inventory";
import { setTranslationAiLedger } from "./translate-core.mjs";

export {
  beginApplyInventorySession,
  clearApplyInventorySession,
  endApplyInventorySession,
  getActiveApplyDefinitionKey,
  getActiveApplyInventorySession,
  setActiveApplyDefinitionKey,
  type ApplyInventorySession,
};

/** Minimal AI ledger surface used by media-alt (matches createAiLedger). */
export type AiLedgerLike = {
  record: (entry: Record<string, unknown>) => unknown;
  printPageTotals?: () => void;
  totals?: () => {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costEstimateUsd: number;
    callCount: number;
  };
};

/** Per-definition emit session — tracks YAML paths the emitter touched this run. */
let activeManifest: ApplyManifest | undefined;
/** Whole generate-run detail log (optional). */
let activeRunLog: ApplyRunLog | undefined;
/** Optional AI usage ledger (definitions:generate / media-alt). */
let activeAiLedger: AiLedgerLike | undefined;
/** In-run cache: stable image key → alt text (dedupe OpenAI vision). */
let mediaAltCache: Map<string, string> = new Map();

export function setActiveApplyManifest(manifest: ApplyManifest | undefined): void {
  activeManifest = manifest;
}

export function getActiveApplyManifest(): ApplyManifest | undefined {
  return activeManifest;
}

export function setActiveApplyRunLog(log: ApplyRunLog | undefined): void {
  activeRunLog = log;
}

export function getActiveApplyRunLog(): ApplyRunLog | undefined {
  return activeRunLog;
}

export function setActiveAiLedger(ledger: AiLedgerLike | undefined): void {
  activeAiLedger = ledger;
  setTranslationAiLedger(ledger);
}

export function getActiveAiLedger(): AiLedgerLike | undefined {
  return activeAiLedger;
}

export function getMediaAltCache(): Map<string, string> {
  return mediaAltCache;
}

export function clearMediaAltCache(): void {
  mediaAltCache = new Map();
}
