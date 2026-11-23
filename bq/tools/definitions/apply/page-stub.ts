/**
 * Emit page items under site Home from kind: "page" (or legacy page-stub) definitions.
 * Empty renderings → route shell only; with renderings → layout __Renderings via site-presentation helper.
 */
import { saiHandleFrom } from "../../shared/sai-handle";
import { ensureHomePageFromRoute } from "../../shared/ensure-home-link-page";
import {
  emptyWriteStats,
  mergeWriteStats,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import type {
  Definition,
  PageDefinition,
  PageStubDefinition,
  SitePresentationDefinition,
} from "../types";
import { toSystemName } from "../../shared/naming";
import { applySitePresentationDefinition } from "./site-presentation";

export type AnyPageDefinition = PageDefinition | PageStubDefinition;

export async function applyPageStubDefinition(
  definition: AnyPageDefinition,
  registry?: Map<string, Definition>,
): Promise<ScsWriteStats> {
  const siteSystem = toSystemName(definition.siteSystem);
  const collectionSystem = toSystemName(definition.collectionSystem);
  const pathname = definition.routePath.startsWith("/")
    ? definition.routePath
    : `/${definition.routePath}`;

  const ensured = await ensureHomePageFromRoute({
    collectionSystem,
    siteSystem,
    pathname,
    leafDisplayName: definition.navigationTitle || definition.name,
    sourceLanguage: definition.culture || null,
    cultures: definition.cultures ?? [],
    handleKey: saiHandleFrom(definition.definitionKey, 1),
    leafTemplateId: definition.pageTemplateId,
  });

  let stats = ensured ? ensured.stats : emptyWriteStats();

  const renderings = definition.renderings || [];
  if (renderings.length && registry) {
    const isHome = pathname === "/" || pathname === "";
    const pageKey = isHome
      ? "home"
      : definition.definitionKey.replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 64);
    const layoutCarrier = {
      kind: "site-presentation" as const,
      definitionKey: `${definition.definitionKey}-layout`,
      siteSystem: definition.siteSystem,
      collectionSystem: definition.collectionSystem,
      cultures: definition.cultures,
      pages: {
        [pageKey]: {
          routePath: isHome ? undefined : pathname,
          navigationTitle: definition.navigationTitle || definition.name,
          pageTemplateId: definition.pageTemplateId,
          renderings,
        },
      },
    } satisfies SitePresentationDefinition;
    stats = mergeWriteStats(
      stats,
      await applySitePresentationDefinition(layoutCarrier, registry),
    );
  }

  return stats;
}

/** Prefer this name from generate.ts for kind: "page". */
export const emitPageDefinition = applyPageStubDefinition;
