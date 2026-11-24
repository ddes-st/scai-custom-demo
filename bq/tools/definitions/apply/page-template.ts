/**
 * Custom page templates that inherit the site Page template.
 * Insert Options for the template are written only on the routes named by
 * the page definition (`insertOnlyUnder`), so authors cannot pick it elsewhere.
 */
import {
  ensureItemByPath,
  ensureItemTemplate,
  updateItem,
  type AuthoringTemplateSectionInput,
} from "../../shared/authoring-items";
import { braceGuid } from "../../shared/ids";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import { ensureHomePageFromRoute } from "../../shared/ensure-home-link-page";
import { saiHandleFrom } from "../../shared/sai-handle";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import type { PageContentFields, PageFieldValue } from "../types";
import { materializeImageFieldValue } from "./media";

const LOG_PREFIX = "[bq:apply:page-template]";

const ARTICLE_SECTIONS = [
  {
    name: "Article",
    fields: [
      { name: "Title", type: "Single-Line Text" },
      { name: "Date", type: "Single-Line Text" },
      { name: "Category", type: "Single-Line Text" },
      { name: "Introduction", type: "Rich Text" },
      { name: "Image", type: "Image" },
      { name: "Image Caption", type: "Single-Line Text" },
      { name: "Heading", type: "Single-Line Text" },
      { name: "Body", type: "Rich Text" },
      { name: "Label", type: "Single-Line Text" },
      { name: "Page Url", type: "Single-Line Text" },
      { name: "Summary", type: "Single-Line Text" },
    ],
  },
];

function isImageValue(value: PageFieldValue): value is { url: string; alt?: string } {
  return typeof value === "object" && value !== null && typeof value.url === "string";
}

export async function ensureProjectPageTemplate(options: {
  collectionSystem: string;
  name: string;
  sections?: AuthoringTemplateSectionInput[];
  endpointName?: string;
}): Promise<{ templateId: string; templatePath: string }> {
  const collectionSystem = options.collectionSystem.trim();
  const name = options.name.trim();
  const parentPath = `/sitecore/templates/Project/${collectionSystem}`;
  const templatePath = `${parentPath}/${name}`;
  const basePath = `${parentPath}/Page`;

  const parent = await resolveItemIdByPath({
    sitecorePath: parentPath,
    endpointName: options.endpointName,
    logPrefix: LOG_PREFIX,
  });
  if (!parent.found) {
    throw new Error(`${LOG_PREFIX} template folder missing: ${parentPath}`);
  }
  const base = await resolveItemIdByPath({
    sitecorePath: basePath,
    endpointName: options.endpointName,
    logPrefix: LOG_PREFIX,
  });
  if (!base.found) {
    throw new Error(`${LOG_PREFIX} site Page template missing: ${basePath}`);
  }

  const ensured = await ensureItemTemplate({
    path: templatePath,
    parentId: parent.id,
    name,
    baseTemplates: [base.id],
    icon: "Office/32x32/document_empty_landscape.png",
    sections: options.sections?.length ? options.sections : ARTICLE_SECTIONS,
    endpointName: options.endpointName,
  });
  return { templateId: ensured.itemId, templatePath };
}

/**
 * Write the article onto the page item, restrict Insert Options to the news
 * branch, and give the template standard values the same component layout
 * (without a datasource, so a new page reads its own fields).
 */
export async function applyPageTemplateBindings(options: {
  collectionSystem: string;
  siteSystem: string;
  templateId: string;
  templatePath: string;
  insertOnlyUnder: string[];
  fields?: PageContentFields;
  pageId: string;
  pagePath: string;
  standardValuesLayoutXml: string;
  endpointName?: string;
}): Promise<ScsWriteStats> {
  let stats = emptyWriteStats();
  const endpointName = options.endpointName;
  const templateId = braceGuid(options.templateId);

  if (options.fields && Object.keys(options.fields).length) {
    const fields: Array<{ name: string; value: string }> = [];
    for (const [name, raw] of Object.entries(options.fields)) {
      if (isImageValue(raw)) {
        const image = await materializeImageFieldValue(raw, {
          handle: saiHandleFrom(`page-image:${options.pagePath}:${name}`, 1),
          folder: ["News"],
          itemName: `${options.pagePath.split("/").filter(Boolean).pop() || "article"}-${name}`,
          collectionSystem: options.collectionSystem,
          siteName: options.siteSystem,
          label: `${options.pagePath} ${name}`,
        });
        stats = mergeWriteStats(stats, image.stats);
        fields.push({ name, value: image.value });
      } else {
        fields.push({ name, value: raw });
      }
    }
    await updateItem({
      itemId: options.pageId,
      path: options.pagePath,
      language: "en",
      endpointName,
      fields,
    });
    recordWrite(stats, "updated");
  }

  for (const route of options.insertOnlyUnder) {
    const pathname = route.startsWith("/") ? route : `/${route}`;
    const ensured = await ensureHomePageFromRoute({
      collectionSystem: options.collectionSystem,
      siteSystem: options.siteSystem,
      pathname,
      leafDisplayName: pathname.split("/").filter(Boolean).pop() || "News",
      sourceLanguage: "en",
      cultures: [],
      handleKey: saiHandleFrom(`news-branch:${pathname}`, 1),
      endpointName,
    });
    if (!ensured) {
      console.warn(`${LOG_PREFIX} could not ensure insert-options parent ${pathname}`);
      continue;
    }
    stats = mergeWriteStats(stats, ensured.stats);
    await updateItem({
      itemId: ensured.itemId,
      path: ensured.sitecorePath,
      endpointName,
      fields: [{ name: "__Masters", value: templateId }],
    });
    recordWrite(stats, "updated");
    console.log(`${LOG_PREFIX} Insert Options on ${ensured.sitecorePath} → ${options.templatePath}`);
  }

  const standardValuesPath = `${options.templatePath}/__Standard Values`;
  const standardValues = await ensureItemByPath({
    path: standardValuesPath,
    parentId: options.templateId,
    templateId: options.templateId,
    endpointName,
    fields: [
      { name: "__Renderings", value: options.standardValuesLayoutXml },
      { name: "__Masters", value: templateId },
    ],
  });
  recordWrite(stats, standardValues.created ? "created" : "updated");
  await updateItem({
    itemId: options.templateId,
    path: options.templatePath,
    endpointName,
    fields: [{ name: "__Standard values", value: braceGuid(standardValues.itemId) }],
  });
  recordWrite(stats, "updated");
  return stats;
}
