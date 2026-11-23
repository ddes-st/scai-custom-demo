/**
 * Publish brand kit: export guidelines PDF → Documents upload → BrandIngestionPipeline.
 */
import { exportBrandkitGuidelinesPdf } from './export-guidelines-pdf.mjs';
import {
  createDocumentsApiContext,
  deleteBrandkitDocument,
  resolvePriorGuidelineDocumentIds,
  uploadBrandkitDocument,
} from './documents.mjs';
import {
  createPipelineApiContext,
  runBrandIngestionPipeline,
} from './pipeline.mjs';
import { getBrandKit } from './client.mjs';
import { writeBrandkitState, readBrandkitState } from './state.mjs';

/**
 * Delete prior guideline docs for this kit (state + remote list). Warn and continue on failure.
 * @param {object} docsCtx
 * @param {{ brandkitId: string, stateDocumentId?: string|null }} opts
 */
export async function deletePriorGuidelineDocuments(docsCtx, opts) {
  const priorIds = await resolvePriorGuidelineDocumentIds(docsCtx, {
    brandkitId: opts.brandkitId,
    stateDocumentId: opts.stateDocumentId,
  });

  /** @type {string[]} */
  const deleted = [];
  for (const documentId of priorIds) {
    try {
      console.log(`  brandkit: deleting previous document id=${documentId}`);
      const result = await deleteBrandkitDocument(docsCtx, documentId);
      if (result.alreadyGone) {
        console.log(`  brandkit: document ${documentId} already gone (404)`);
      }
      deleted.push(documentId);
    } catch (err) {
      console.warn(
        `  ⚠ brandkit: delete document ${documentId} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  return { priorIds, deleted };
}

/**
 * @param {{
 *   ctx: { organizationId: string, baseUrl: string, token: string },
 *   hostProjectRoot: string,
 *   brandkitId: string,
 *   draft: object,
 *   kitName?: string,
 *   dryRun?: boolean,
 * }} opts
 */
export async function publishBrandKit(opts) {
  const { brandkitId, hostProjectRoot, draft, dryRun } = opts;

  if (dryRun) {
    console.log(
      '  [dry-run] would replace prior document, export PDF, upload, run BrandIngestionPipeline',
    );
    return { ok: true, dryRun: true };
  }

  console.log('  brandkit: exporting guidelines.pdf…');
  const pdfResult = await exportBrandkitGuidelinesPdf({
    hostProjectRoot,
    draft,
  });
  if (!pdfResult.ok || !pdfResult.pdfPath) {
    return { ok: false, skipReason: 'guidelines PDF export failed' };
  }
  console.log(`  brandkit: wrote ${pdfResult.pdfPath}`);

  const docsCtx = await createDocumentsApiContext();
  if (!docsCtx.ok) {
    return { ok: false, skipReason: docsCtx.skipReason };
  }

  const prev = (await readBrandkitState(hostProjectRoot)) || {};
  await deletePriorGuidelineDocuments(docsCtx, {
    brandkitId,
    stateDocumentId: prev.documentId,
  });

  console.log('  brandkit: uploading guidelines PDF to Documents API…');
  const uploaded = await uploadBrandkitDocument(docsCtx, {
    brandkitId,
    filePath: pdfResult.pdfPath,
    title: `${opts.kitName || 'Brand kit'} guidelines`,
    summary: 'BQ-generated brand guidelines from website capture artifacts',
  });
  console.log(`  brandkit: document id=${uploaded.documentId}`);

  const pipeCtx = await createPipelineApiContext();
  if (!pipeCtx.ok) {
    return { ok: false, skipReason: pipeCtx.skipReason, documentId: uploaded.documentId };
  }

  console.log(
    '  brandkit: running BrandIngestionPipeline (populateSections=false)…',
  );
  const pipeline = await runBrandIngestionPipeline(pipeCtx, {
    brandkitId,
    documentId: uploaded.documentId,
    populateSections: false,
  });
  console.log(
    `  brandkit: pipeline run id=${pipeline.pipelineRunId || '?'} status=${pipeline.status || '?'}`,
  );

  let remoteStatus = null;
  try {
    const kit = await getBrandKit(opts.ctx, brandkitId);
    remoteStatus = kit?.status || null;
    if (remoteStatus) {
      console.log(`  brandkit: remote status=${remoteStatus}`);
    }
  } catch {
    /* optional */
  }

  await writeBrandkitState(hostProjectRoot, {
    ...prev,
    brandkitId,
    documentId: uploaded.documentId,
    pipelineRunId: pipeline.pipelineRunId,
    publishStatus: remoteStatus || pipeline.status || 'submitted',
  });

  return {
    ok: true,
    documentId: uploaded.documentId,
    pipelineRunId: pipeline.pipelineRunId,
    status: remoteStatus || pipeline.status,
    pdfPath: pdfResult.pdfPath,
  };
}
