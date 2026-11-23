/**
 * Entry point: ensure Stream brand kit for a captured host + link to SitecoreAI site.
 */
import { readFile } from 'node:fs/promises';
import { generateBrandkitDraft } from './generate-content.mjs';
import { resolveCreateBrandkit } from './resolve-flag.mjs';
import {
  brandKitNameForSite,
  writeBrandkitState,
} from './state.mjs';
import {
  createBrandkitApiContext,
  getBrandKit,
  listBrandKitSectionFields,
  listBrandKitSections,
  patchBrandKit,
} from './client.mjs';
import {
  applyDraftToBrandkitFields,
  createBrandKitOrReuse,
  resolveExistingBrandkitId,
} from './upsert.mjs';
import { resolveBrandkitLogo } from './resolve-logo.mjs';

/** Lazy: sites-api graph is heavy and not needed on skip-existing. */
async function loadSiteLink() {
  return import('./site-link.mjs');
}

/** Lazy: publish only after draft/fields succeed. */
async function loadPublish() {
  return import('./publish.mjs');
}

/**
 * Read display name from a site definition file.
 * @param {string} siteDefinitionPath
 */
export async function readSiteDisplayNameFromDefinition(siteDefinitionPath) {
  try {
    const text = await readFile(siteDefinitionPath, 'utf8');
    const m = text.match(/^\s*name:\s*"((?:\\.|[^"\\])*)"/m);
    return m ? m[1].replace(/\\"/g, '"').trim() : '';
  } catch {
    return '';
  }
}

/**
 * Build schema map from remote brand kit for AI prompting.
 * @param {object} ctx
 * @param {string} brandkitId
 * @returns {Promise<Record<string, string[]>>}
 */
export async function loadRemoteBrandkitSchema(ctx, brandkitId) {
  const sections = await listBrandKitSections(ctx, brandkitId);
  /** @type {Record<string, string[]>} */
  const schema = {};
  for (const section of sections) {
    const name = String(section?.name || '').trim();
    const id = String(section?.id || '').trim();
    if (!name || !id) continue;
    const fields = await listBrandKitSectionFields(ctx, brandkitId, id);
    schema[name] = fields
      .map((f) => String(f?.name || '').trim())
      .filter(Boolean);
  }
  return schema;
}

/**
 * Best-effort logo set on an existing kit (OpenAPI may reject PATCH).
 * @param {object} ctx
 * @param {string} brandkitId
 * @param {string} logoUrl
 * @param {object|null} [existingKit]
 */
async function trySetLogoOnExistingKit(ctx, brandkitId, logoUrl, existingKit) {
  const remoteLogo = String(existingKit?.logo || '').trim();
  if (remoteLogo) {
    console.log('  brandkit: remote kit already has logo — leaving as-is');
    return { attempted: false, ok: true };
  }
  try {
    await patchBrandKit(ctx, brandkitId, { logo: logoUrl });
    console.log('  brandkit: set logo via PATCH on existing kit');
    return { attempted: true, ok: true };
  } catch (err) {
    console.warn(
      `  ⚠ brandkit: logo PATCH not supported or failed (${err instanceof Error ? err.message : err}) — logo remains create-time only`,
    );
    return { attempted: true, ok: false };
  }
}

/**
 * True when an existing Stream kit should be left alone (no overwrite without --force).
 * @param {{ brandkitId?: string|null, force?: boolean }} opts
 */
export function shouldSkipExistingBrandkit(opts) {
  return Boolean(String(opts?.brandkitId || '').trim()) && !opts?.force;
}

/**
 * @param {{
 *   enabled?: boolean,
 *   url: string,
 *   hostProjectRoot: string,
 *   pageDir?: string,
 *   siteSystem: string,
 *   siteDisplayName?: string,
 *   siteDefinitionPath?: string,
 *   force?: boolean,
 *   dryRun?: boolean,
 *   ledger?: { record: (entry: object) => unknown },
 *   args?: { brandkit?: boolean|null },
 *   deps?: {
 *     createBrandkitApiContext?: typeof createBrandkitApiContext,
 *     resolveExistingBrandkitId?: typeof resolveExistingBrandkitId,
 *     resolveBrandkitLogo?: typeof resolveBrandkitLogo,
 *     generateBrandkitDraft?: typeof generateBrandkitDraft,
 *   },
 * }} opts
 */
export async function ensureBrandKitForHost(opts) {
  const enabled =
    opts.enabled != null
      ? Boolean(opts.enabled)
      : resolveCreateBrandkit(opts.args || {});

  if (!enabled) {
    return { ok: true, skipped: true, reason: 'brandkit disabled' };
  }

  const deps = opts.deps || {};
  const createCtx = deps.createBrandkitApiContext || createBrandkitApiContext;
  const resolveExisting =
    deps.resolveExistingBrandkitId || resolveExistingBrandkitId;
  const resolveLogo = deps.resolveBrandkitLogo || resolveBrandkitLogo;
  const generateDraft = deps.generateBrandkitDraft || generateBrandkitDraft;

  const siteDisplayName =
    String(opts.siteDisplayName || '').trim() ||
    (opts.siteDefinitionPath
      ? await readSiteDisplayNameFromDefinition(opts.siteDefinitionPath)
      : '') ||
    opts.siteSystem;

  const kitName = brandKitNameForSite(siteDisplayName);
  console.log(`  brandkit: ensure for "${kitName}" (site=${opts.siteSystem})`);

  const ctxResult = await createCtx();
  if (!ctxResult.ok) {
    console.warn(`  ⚠ brandkit skipped: ${ctxResult.skipReason}`);
    return { ok: false, skipReason: ctxResult.skipReason };
  }
  const ctx = ctxResult;

  if (opts.dryRun) {
    console.log('  [dry-run] brandkit ensure (auth ok)');
  }

  // Resolve existing kit before any logo/AI/field work so a skip truly does nothing.
  const existing = await resolveExisting(ctx, {
    hostProjectRoot: opts.hostProjectRoot,
    kitName,
  });

  if (shouldSkipExistingBrandkit({ brandkitId: existing.brandkitId, force: opts.force })) {
    const brandkitId = existing.brandkitId;
    const source = existing.source || 'none';
    if (opts.dryRun) {
      console.log(
        `  [dry-run] would skip existing brandkit id=${brandkitId} (via ${source})`,
      );
    } else {
      console.log(
        `  brandkit: already exists id=${brandkitId} (via ${source}) — skipping (pass --force to overwrite)`,
      );
    }
    return {
      ok: true,
      skipped: true,
      reason: 'existing',
      brandkitId,
      kitName,
      action: 'skipped-existing',
      source,
    };
  }

  if (opts.dryRun && existing.brandkitId && opts.force) {
    console.log(
      `  [dry-run] would overwrite existing brandkit id=${existing.brandkitId} (--force)`,
    );
  }

  // Resolve logo from capture HTML (public URL for Stream).
  /** @type {string|null} */
  let logoUrl = null;
  if (opts.pageDir) {
    try {
      const logo = await resolveLogo({
        pageDir: opts.pageDir,
        siteUrl: opts.url,
        hostProjectRoot: opts.hostProjectRoot,
        downloadCopy: !opts.dryRun,
      });
      logoUrl = logo.logoUrl;
      if (logoUrl) {
        const srcNote = logo.fromCaptureLogo ? ' (from capture Logo/meta)' : '';
        console.log(`  brandkit: resolved logo ${logoUrl}${srcNote}`);
      } else {
        console.log('  brandkit: no logo URL found in capture HTML');
      }
    } catch (err) {
      console.warn(
        `  ⚠ brandkit logo resolve failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // 1) Resolve or create kit so we can read real section/field names.
  let brandkitId = existing.brandkitId;
  let action = brandkitId ? 'updated' : 'created';
  let source = existing.source;

  if (!brandkitId && !opts.dryRun) {
    console.log(`  brandkit: creating "${kitName}"…`);
    const created = await createBrandKitOrReuse(ctx, {
      name: kitName,
      description: `Brand kit for ${siteDisplayName} (created by BQ tooling)`,
      brandName: siteDisplayName,
      ...(logoUrl ? { logo: logoUrl } : {}),
    });
    brandkitId = created.brandkitId;
    source = created.source;
    action = created.source === 'created' ? 'created' : 'updated';
    if (created.source !== 'created') {
      console.log(
        `  brandkit: reusing id=${brandkitId} (via ${created.source})`,
      );
      if (logoUrl) {
        await trySetLogoOnExistingKit(ctx, brandkitId, logoUrl, created.kit);
      }
    }
  } else if (brandkitId) {
    console.log(
      `  brandkit: reusing id=${brandkitId} (via ${existing.source})`,
    );
    if (logoUrl && !opts.dryRun) {
      let kit = existing.kit;
      if (!kit?.logo) {
        try {
          kit = await getBrandKit(ctx, brandkitId);
        } catch {
          /* use existing */
        }
      }
      await trySetLogoOnExistingKit(ctx, brandkitId, logoUrl, kit);
    }
  }

  /** @type {Record<string, string[]>|null} */
  let schema = null;
  if (brandkitId && !opts.dryRun) {
    schema = await loadRemoteBrandkitSchema(ctx, brandkitId);
    const secCount = Object.keys(schema).length;
    const fieldCount = Object.values(schema).reduce((n, a) => n + a.length, 0);
    console.log(
      `  brandkit: remote schema sections=${secCount} fields=${fieldCount}`,
    );
  }

  // 2) AI draft (URL + company + HTML/CSS), optionally constrained to schema.
  const gen = await generateDraft({
    url: opts.url,
    companyName: siteDisplayName,
    hostProjectRoot: opts.hostProjectRoot,
    pageDir: opts.pageDir,
    force: opts.force,
    dryRun: opts.dryRun,
    ledger: opts.ledger,
    schema,
  });

  if (!gen.ok) {
    console.warn(`  ⚠ brandkit AI draft failed: ${gen.skipReason}`);
    if (brandkitId && !opts.dryRun) {
      await writeBrandkitState(opts.hostProjectRoot, {
        brandkitId,
        kitName,
        siteDisplayName,
        createdBy: 'bq',
        action,
        source,
        organizationId: ctx.organizationId,
        draftError: gen.skipReason,
        ...(logoUrl ? { logoUrl } : {}),
      });
      try {
        const { linkBrandKitToSite } = await loadSiteLink();
        await linkBrandKitToSite({
          siteSystem: opts.siteSystem,
          brandKitId: brandkitId,
          dryRun: opts.dryRun,
        });
      } catch (err) {
        console.warn(
          `  ⚠ brandkit site link failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { ok: false, skipReason: gen.skipReason, brandkitId };
  }

  if (gen.reused) {
    console.log('  brandkit: reusing cached draft.json');
  } else if (!gen.dryRun) {
    console.log('  brandkit: wrote draft.json from Azure');
  }

  const draft = gen.draft || {};
  const forceOverwriteFields = !gen.reused;

  // 3) PATCH section fields from draft (always overwrite when draft regenerated)
  let fieldStats = { patched: 0, skipped: 0, sectionCount: 0 };
  if (brandkitId && !opts.dryRun) {
    fieldStats = await applyDraftToBrandkitFields(ctx, brandkitId, draft, {
      forceOverwrite: forceOverwriteFields,
    });
    console.log(
      `  brandkit: fields patched=${fieldStats.patched} skipped=${fieldStats.skipped} sections=${fieldStats.sectionCount}${forceOverwriteFields ? ' (force overwrite)' : ''}`,
    );
    await writeBrandkitState(opts.hostProjectRoot, {
      brandkitId,
      kitName,
      siteDisplayName,
      createdBy: 'bq',
      action,
      source,
      organizationId: ctx.organizationId,
      fieldStats,
      draftReused: Boolean(gen.reused),
      ...(logoUrl ? { logoUrl } : {}),
    });
  }

  // 4) Link site brandKitId
  let link = null;
  if (brandkitId) {
    try {
      const { linkBrandKitToSite } = await loadSiteLink();
      link = await linkBrandKitToSite({
        siteSystem: opts.siteSystem,
        brandKitId: brandkitId,
        dryRun: opts.dryRun,
      });
    } catch (err) {
      console.warn(
        `  ⚠ brandkit site link failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // 5) Stamp local site definition
  if (brandkitId && opts.siteDefinitionPath) {
    const { stampSiteDefinitionBrandKitId } = await loadSiteLink();
    await stampSiteDefinitionBrandKitId(
      opts.siteDefinitionPath,
      brandkitId,
      { dryRun: opts.dryRun },
    );
  }

  // 6) Publish via Documents + BrandIngestionPipeline (warn & continue on failure)
  /** @type {object|null} */
  let publish = null;
  if (brandkitId && !opts.dryRun) {
    try {
      const { publishBrandKit } = await loadPublish();
      publish = await publishBrandKit({
        ctx,
        hostProjectRoot: opts.hostProjectRoot,
        brandkitId,
        draft,
        kitName,
      });
      if (!publish.ok) {
        console.warn(
          `  ⚠ brandkit publish skipped: ${publish.skipReason || 'unknown'}`,
        );
      }
    } catch (err) {
      console.warn(
        `  ⚠ brandkit publish failed: ${err instanceof Error ? err.message : err}`,
      );
      publish = {
        ok: false,
        skipReason: err instanceof Error ? err.message : String(err),
      };
    }
  } else if (opts.dryRun) {
    console.log('  [dry-run] would publish via Documents + BrandIngestionPipeline');
  }

  return {
    ok: true,
    brandkitId,
    kitName,
    action,
    source,
    fieldStats,
    link,
    logoUrl,
    publish,
    reusedDraft: Boolean(gen.reused),
  };
}

export { resolveCreateBrandkit };
export { readBrandkitState } from './state.mjs';
