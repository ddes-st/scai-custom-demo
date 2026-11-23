/**
 * Attach brandKitId to a SitecoreAI site via Sites API + optional local definition stamp.
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  createSitesApiContext,
  findSiteByName,
  updateSiteViaApi,
} from '../definitions/apply/sites-api.ts';

/**
 * @param {{
 *   siteSystem: string,
 *   brandKitId: string,
 *   dryRun?: boolean,
 * }} opts
 */
export async function linkBrandKitToSite(opts) {
  const siteSystem = String(opts.siteSystem || '').trim();
  const brandKitId = String(opts.brandKitId || '').trim();
  if (!siteSystem) {
    throw new Error('[bq:brandkit] linkBrandKitToSite requires siteSystem');
  }
  if (!brandKitId) {
    throw new Error('[bq:brandkit] linkBrandKitToSite requires brandKitId');
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] would PATCH site "${siteSystem}" brandKitId=${brandKitId}`,
    );
    return { ok: true, dryRun: true, siteSystem, brandKitId };
  }

  const ctx = await createSitesApiContext();
  const site = await findSiteByName(ctx, siteSystem);
  if (!site?.id) {
    throw new Error(
      `[bq:brandkit] Site "${siteSystem}" not found remotely — bootstrap Sites API first`,
    );
  }

  const existing = String(site.brandKitId || '').trim();
  if (existing && existing.toLowerCase() === brandKitId.toLowerCase()) {
    console.log(
      `  brandkit: site "${siteSystem}" already linked (brandKitId=${brandKitId})`,
    );
    return {
      ok: true,
      unchanged: true,
      siteId: site.id,
      siteSystem,
      brandKitId,
    };
  }

  console.log(
    `  brandkit: linking site "${siteSystem}" → brandKitId=${brandKitId}`,
  );
  const updated = await updateSiteViaApi(ctx, site.id, { brandKitId });
  return {
    ok: true,
    siteId: site.id,
    siteSystem,
    brandKitId,
    site: updated,
  };
}

/**
 * Stamp `api.brandKitId` onto a site *.definition.ts file.
 * @param {string} siteDefinitionPath
 * @param {string} brandKitId
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function stampSiteDefinitionBrandKitId(
  siteDefinitionPath,
  brandKitId,
  opts = {},
) {
  const id = String(brandKitId || '').trim();
  if (!id || !siteDefinitionPath) {
    return { ok: false, skipReason: 'missing path or brandKitId' };
  }

  let text;
  try {
    text = await readFile(siteDefinitionPath, 'utf8');
  } catch {
    return { ok: false, skipReason: `site definition not found: ${siteDefinitionPath}` };
  }

  if (new RegExp(`brandKitId:\\s*["']${escapeRegExp(id)}["']`).test(text)) {
    return { ok: true, unchanged: true };
  }

  let next = text;
  if (/brandKitId:\s*["'][^"']*["']/.test(text)) {
    next = text.replace(
      /brandKitId:\s*["'][^"']*["']/,
      `brandKitId: "${id}"`,
    );
  } else if (/api:\s*\{/.test(text)) {
    next = text.replace(/api:\s*\{/, `api: {\n    brandKitId: "${id}",`);
  } else {
    // Insert api block before closing of export object
    next = text.replace(
      /(\n\} satisfies SiteDefinition;)/,
      `,\n  api: {\n    brandKitId: "${id}",\n  }$1`,
    );
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] would stamp brandKitId on ${siteDefinitionPath}`,
    );
    return { ok: true, dryRun: true };
  }

  await writeFile(siteDefinitionPath, next, 'utf8');
  return { ok: true, path: siteDefinitionPath, brandKitId: id };
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
