/**
 * Create-or-update Stream brand kit from BQ draft; fill default section fields.
 */
import * as brandClient from './client.mjs';
import {
  DOS_DONT_EXTENSIONS_FIELD,
  DOS_DONT_RESTRICTIONS_FIELD,
  isDosAndDontsSectionName,
  lookupDraftFieldValue,
  MANDATORY_DOS_DONT_EXTENSION,
  MANDATORY_DOS_DONT_RESTRICTION,
} from './generate-content.mjs';
import {
  brandKitNameForSite,
  readBrandkitState,
  writeBrandkitState,
} from './state.mjs';

/**
 * Ensure Extensions + Restrictions subsections exist under Dos and Don'ts.
 * @param {object} ctx
 * @param {string} brandkitId
 * @param {string} sectionId
 * @param {object[]} fields
 * @returns {Promise<object[]>}
 */
export async function ensureDosDontRemoteSubsections(
  ctx,
  brandkitId,
  sectionId,
  fields,
) {
  /** @type {object[]} */
  let next = Array.isArray(fields) ? [...fields] : [];
  const wanted = [
    {
      name: DOS_DONT_EXTENSIONS_FIELD,
      value: MANDATORY_DOS_DONT_EXTENSION,
    },
    {
      name: DOS_DONT_RESTRICTIONS_FIELD,
      value: MANDATORY_DOS_DONT_RESTRICTION,
    },
  ];

  for (const item of wanted) {
    const exists = next.some(
      (f) =>
        String(f?.name || '').trim().toLowerCase() ===
        item.name.toLowerCase(),
    );
    if (exists) continue;
    console.log(`  brandkit: created subsection "${item.name}"`);
    const created = await brandClient.createBrandKitSectionField(
      ctx,
      brandkitId,
      sectionId,
      {
        name: item.name,
        type: 'text',
        value: item.value,
        aiEditable: false,
        verified: false,
      },
    );
    if (created?.id) {
      next.push(created);
    } else {
      // Re-list so PATCH can resolve the new field id
      next = await brandClient.listBrandKitSectionFields(
        ctx,
        brandkitId,
        sectionId,
      );
    }
  }

  return next;
}

/**
 * Resolve existing BQ-managed brand kit id (state → list by name).
 * @param {object} ctx
 * @param {{
 *   hostProjectRoot: string,
 *   kitName: string,
 * }} opts
 */
export async function resolveExistingBrandkitId(ctx, opts) {
  const state = await readBrandkitState(opts.hostProjectRoot);
  const stateId = String(state?.brandkitId || '').trim();
  if (stateId) {
    try {
      const kit = await brandClient.getBrandKit(ctx, stateId);
      if (kit?.id) {
        return {
          brandkitId: String(kit.id),
          source: 'state',
          kit,
          state,
        };
      }
    } catch {
      console.warn(
        `  brandkit: state id ${stateId} not found remotely — will search by name`,
      );
    }
  }

  const match = await brandClient.findBrandKitByName(ctx, opts.kitName);
  if (match?.id) {
    return {
      brandkitId: String(match.id),
      source: 'list-name',
      kit: match,
      state,
    };
  }

  return { brandkitId: null, source: 'none', state };
}

/**
 * Create kit or, on duplicate name, resolve and reuse existing.
 * @param {object} ctx
 * @param {{
 *   name: string,
 *   description?: string,
 *   industry?: string,
 *   brandName?: string,
 *   companyName?: string,
 *   logo?: string,
 * }} body
 */
export async function createBrandKitOrReuse(ctx, body) {
  try {
    const created = await brandClient.createBrandKit(ctx, body);
    const id = String(created?.id || '').trim();
    if (!id) throw new Error('[bq:brandkit] create response missing id');
    return { brandkitId: id, source: 'created', kit: created };
  } catch (err) {
    if (!brandClient.isDuplicateBrandKitNameError(err)) throw err;
    console.warn(
      `  brandkit: create hit duplicate name "${body.name}" — resolving existing kit`,
    );
    const match = await brandClient.findBrandKitByName(ctx, body.name);
    if (!match?.id) throw err;
    return {
      brandkitId: String(match.id),
      source: 'duplicate-name',
      kit: match,
    };
  }
}

/**
 * Apply draft values onto remote section fields (name match).
 * @param {object} ctx
 * @param {string} brandkitId
 * @param {object} draft
 * @param {{ forceOverwrite?: boolean }} [opts]
 */
export async function applyDraftToBrandkitFields(
  ctx,
  brandkitId,
  draft,
  opts = {},
) {
  const forceOverwrite = Boolean(opts.forceOverwrite);
  const sections = await brandClient.listBrandKitSections(ctx, brandkitId);
  let patched = 0;
  let skipped = 0;

  for (const section of sections) {
    const sectionId = String(section?.id || '').trim();
    const sectionName = String(section?.name || '').trim();
    if (!sectionId || !sectionName) continue;

    let fields = await brandClient.listBrandKitSectionFields(
      ctx,
      brandkitId,
      sectionId,
    );
    if (isDosAndDontsSectionName(sectionName)) {
      fields = await ensureDosDontRemoteSubsections(
        ctx,
        brandkitId,
        sectionId,
        fields,
      );
    }
    for (const field of fields) {
      const fieldId = String(field?.id || '').trim();
      const fieldName = String(field?.name || '').trim();
      if (!fieldId || !fieldName) continue;

      const value = lookupDraftFieldValue(draft, sectionName, fieldName);
      if (!value) {
        skipped += 1;
        continue;
      }

      const current =
        typeof field.value === 'string' ? field.value.trim() : '';
      if (!forceOverwrite && current === value) {
        skipped += 1;
        continue;
      }

      await brandClient.updateBrandKitSectionField(
        ctx,
        brandkitId,
        sectionId,
        fieldId,
        {
          value,
          aiEditable: false,
          verified: false,
        },
      );
      patched += 1;
    }
  }

  return { patched, skipped, sectionCount: sections.length };
}

/**
 * Ensure brand kit exists and is filled from draft.
 * @param {{
 *   hostProjectRoot: string,
 *   siteDisplayName: string,
 *   draft: object,
 *   dryRun?: boolean,
 *   logo?: string,
 *   forceOverwriteFields?: boolean,
 * }} opts
 */
export async function upsertBrandKitFromDraft(opts) {
  const kitName = brandKitNameForSite(opts.siteDisplayName);
  const ctxResult = await brandClient.createBrandkitApiContext();
  if (!ctxResult.ok) {
    return { ok: false, skipReason: ctxResult.skipReason };
  }
  const ctx = ctxResult;

  if (opts.dryRun) {
    console.log(`  [dry-run] would upsert brand kit "${kitName}"`);
    return { ok: true, dryRun: true, kitName };
  }

  const existing = await resolveExistingBrandkitId(ctx, {
    hostProjectRoot: opts.hostProjectRoot,
    kitName,
  });

  let brandkitId = existing.brandkitId;
  let action = 'updated';
  let source = existing.source;

  if (!brandkitId) {
    const body = {
      name: kitName,
      description:
        opts.draft?.description ||
        `Brand kit for ${opts.siteDisplayName} (created by BQ tooling)`,
      brandName:
        opts.draft?.brandName ||
        opts.draft?.companyName ||
        opts.siteDisplayName,
      companyName: opts.draft?.companyName || undefined,
      industry: opts.draft?.industry || undefined,
      ...(opts.logo ? { logo: opts.logo } : {}),
    };
    console.log(`  brandkit: creating "${kitName}"…`);
    const created = await createBrandKitOrReuse(ctx, body);
    brandkitId = created.brandkitId;
    source = created.source;
    action = created.source === 'created' ? 'created' : 'updated';
  } else {
    console.log(
      `  brandkit: reusing id=${brandkitId} (via ${existing.source})`,
    );
  }

  const fieldStats = await applyDraftToBrandkitFields(
    ctx,
    brandkitId,
    opts.draft,
    { forceOverwrite: Boolean(opts.forceOverwriteFields) },
  );
  console.log(
    `  brandkit: fields patched=${fieldStats.patched} skipped=${fieldStats.skipped} sections=${fieldStats.sectionCount}`,
  );

  const state = await writeBrandkitState(opts.hostProjectRoot, {
    brandkitId,
    kitName,
    siteDisplayName: opts.siteDisplayName,
    createdBy: 'bq',
    action,
    source,
    organizationId: ctx.organizationId,
    fieldStats,
    ...(opts.logo ? { logoUrl: opts.logo } : {}),
  });

  return {
    ok: true,
    brandkitId,
    kitName,
    action,
    source,
    fieldStats,
    state,
  };
}
