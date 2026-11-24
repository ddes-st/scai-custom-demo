/**
 * Publish page definitions through the Authoring API.
 * Does not read or write a serialization module.
 *
 *   npx tsx tools/definitions/publish-pages.ts den-dam-tapkey
 */
import { loadLocalEnvFiles } from "../shared/load-local-env";
import { discoverFiles, importAllDefinitions } from "../shared/discover";
import {
  ensureSitecoreCliLogin,
  requireSitecoreEndpointName,
} from "../shared/sitecore-auth";
import { setAuthoringApplyOptions } from "../shared/authoring-apply-bridge";
import { beginApplyApiRun, endApplyApiRun } from "../shared/apply-api-run-log";
import { clearAuthoringPathCache } from "../shared/authoring-path-cache";
import { clearItemIdByPathCmCache } from "../shared/resolve-item-id-by-path";
import { resolveAuthoringGraphqlAuth } from "../shared/cm-delete-item";
import { runAuthoringGraphql } from "../shared/authoring-graphql";
import { resolveItemIdByPath } from "../shared/resolve-item-id-by-path";
import { applyPageStubDefinition } from "./apply/page-stub";
import { applyComponentDefinition } from "./apply/component";
import { applySitePresentationDefinition } from "./apply/site-presentation";
import { applyComponentTemplateContent } from "../content/apply/items";
import type {
  ComponentTemplateDefinition,
  Definition,
  PageDefinition,
} from "./types";

const CONTENT_ROOT = "/sitecore/content/domsecurity/domsecurity-com";
const TEMPLATE_ROOT = "/sitecore/templates/Project/domsecurity";

function pagePaths(definition: PageDefinition): string[] {
  const route = definition.routePath.replace(/^\/+|\/+$/g, "");
  const home = `${CONTENT_ROOT}/Home`;
  const pagePath = route ? `${home}/${route}` : home;
  const parents = (definition.pageTemplate?.insertOnlyUnder ?? []).map(
    (segment) => `${home}/${segment.replace(/^\/+|\/+$/g, "")}`,
  );
  const templateName = definition.pageTemplate?.name?.trim();
  const templatePath = templateName
    ? `${TEMPLATE_ROOT}/${templateName}`
    : "";
  const landing = (definition.renderings || []).some(
    (entry) => entry.definitionKey === "dom-security-landing-band",
  );
  const about = definition.definitionKey === "about-us";
  return [
    ...(templatePath ? [templatePath] : []),
    pagePath,
    ...parents,
    `${CONTENT_ROOT}/Presentation/Page Designs`,
    ...(about
      ? [
          `${CONTENT_ROOT}/Data/Technology Heroes`,
          `${CONTENT_ROOT}/Data/About Stories`,
          `${CONTENT_ROOT}/Data/Competence Showcases`,
          `${CONTENT_ROOT}/Data/Competence Slides`,
          `${CONTENT_ROOT}/Data/Centered Copy`,
          "/sitecore/layout/Renderings/Project/domsecurity/Technology Hero",
          "/sitecore/layout/Renderings/Project/domsecurity/About Story",
          "/sitecore/layout/Renderings/Project/domsecurity/Competence Showcase",
          "/sitecore/layout/Renderings/Project/domsecurity/Competence Slide",
          "/sitecore/layout/Renderings/Project/domsecurity/Centered Copy",
        ]
      : []),
    ...(landing
      ? [
          `${CONTENT_ROOT}/Presentation/Partial Designs`,
          `${CONTENT_ROOT}/Presentation/Headless Variants`,
          `${CONTENT_ROOT}/Data/Landing Bands`,
          `${CONTENT_ROOT}/Data/Landing Cards`,
          `${CONTENT_ROOT}/Data/Contact Information Sections`,
          "/sitecore/layout/Renderings/Project/domsecurity/Landing Band",
          "/sitecore/layout/Renderings/Project/domsecurity/Landing Card",
        ]
      : about
        ? []
        : [
          "/sitecore/layout/Renderings/Project/domsecurity/DomSecurityArticleHeader",
          "/sitecore/layout/Renderings/Project/domsecurity/DomSecurityShareBar",
          "/sitecore/layout/Renderings/Project/domsecurity/DomSecurityEditorialArticleBody",
        ]),
  ];
}

function collectRenderingKeys(
  entries: Array<{ definitionKey: string; children?: Array<{ definitionKey: string }> }> | undefined,
  into: Set<string>,
): void {
  for (const entry of entries || []) {
    into.add(entry.definitionKey);
    collectRenderingKeys(entry.children, into);
  }
}

async function applyReferencedComponents(
  definition: PageDefinition,
  registry: Map<string, Definition>,
): Promise<void> {
  const keys = new Set<string>();
  collectRenderingKeys(definition.renderings, keys);
  for (const key of keys) {
    const component = registry.get(key);
    if (!component || component.kind !== "component") continue;
    console.log(`[bq:publish] component ${key}`);
    await applyComponentDefinition(component, registry);
    await applyComponentTemplateContent(component as ComponentTemplateDefinition);
  }
  if (!keys.size) return;
  await applySitePresentationDefinition(
    {
      kind: "site-presentation",
      definitionKey: `${definition.definitionKey}-available-renderings`,
      siteSystem: definition.siteSystem,
      collectionSystem: definition.collectionSystem,
      availableRenderings: { "Page Content": [...keys] },
    },
    registry,
  );
}

async function publishPath(sitecorePath: string, endpointName: string): Promise<void> {
  const resolved = await resolveItemIdByPath({
    sitecorePath,
    endpointName,
    logPrefix: "[bq:publish]",
  });
  if (!resolved.found || !resolved.id) {
    console.warn(`[bq:publish] skip missing ${sitecorePath}`);
    return;
  }
  const auth = await resolveAuthoringGraphqlAuth({ endpointName });
  const data = await runAuthoringGraphql({
    host: auth.host,
    token: auth.token,
    operation: "publishItem",
    query: `
      mutation PublishItem($id: ID!) {
        publishItem(
          input: {
            rootItemId: $id
            languages: ["en", "nl-BE", "fr-BE"]
            targetDatabases: ["experienceedge"]
            publishItemMode: SMART
            publishRelatedItems: true
            publishSubItems: true
          }
        ) {
          operationId
        }
      }
    `,
    variables: { id: resolved.id },
  });
  const operationId = (
    data.publishItem as { operationId?: string } | undefined
  )?.operationId;
  console.log(
    `[bq:publish] queued ${sitecorePath}` +
      (operationId ? ` operation=${operationId}` : ""),
  );
}

async function main(): Promise<void> {
  const keys = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (!keys.length) keys.push("den-dam-tapkey");

  loadLocalEnvFiles();
  const endpointName = requireSitecoreEndpointName();
  console.log(`[bq:publish] Sitecore CLI endpoint: ${endpointName}`);
  await ensureSitecoreCliLogin(endpointName);
  clearAuthoringPathCache();
  clearItemIdByPathCmCache();
  setAuthoringApplyOptions({ endpointName });
  beginApplyApiRun({ endpointName });

  const registry = new Map<string, Definition>();
  for (const file of discoverFiles(".definition.ts")) {
    for (const definition of await importAllDefinitions<Definition>(file)) {
      registry.set(definition.definitionKey, definition);
    }
  }

  try {
    for (const key of keys) {
      const definition = registry.get(key);
      if (!definition || definition.kind !== "page") {
        throw new Error(`[bq:publish] "${key}" is not a page definition`);
      }
      console.log(`[bq:publish] authoring ${key} ${definition.routePath}`);
      await applyReferencedComponents(definition, registry);
      const stats = await applyPageStubDefinition(definition, registry);
      console.log(
        `[bq:publish] authored ${key} created=${stats.created} updated=${stats.updated} unchanged=${stats.unchanged}`,
      );
      for (const sitecorePath of pagePaths(definition)) {
        await publishPath(sitecorePath, endpointName);
      }
    }
  } finally {
    endApplyApiRun();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
