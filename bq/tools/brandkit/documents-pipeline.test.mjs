/**
 * Run: node --test tools/brandkit/documents-pipeline.test.mjs
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  deleteBrandkitDocument,
  listBrandkitDocuments,
  resolveDocumentsApiBase,
  resolvePriorGuidelineDocumentIds,
  uploadBrandkitDocument,
} from './documents.mjs';
import {
  resolvePipelineApiBase,
  runBrandIngestionPipeline,
} from './pipeline.mjs';
import { draftToGuidelinesHtml } from './export-guidelines-pdf.mjs';

describe('API bases', () => {
  it('documents default', () => {
    assert.match(resolveDocumentsApiBase({}), /ai-document-api$/);
  });
  it('pipeline default', () => {
    assert.match(resolvePipelineApiBase({}), /ai-pipeline-api$/);
  });
});

describe('draftToGuidelinesHtml', () => {
  it('includes section field prose', () => {
    const html = draftToGuidelinesHtml({
      brandName: 'Acme',
      description: 'We power homes.',
      sections: {
        'Tone of Voice': {
          Friendly: 'Line one\nLine two\nLine three',
        },
      },
    });
    assert.match(html, /Acme/);
    assert.match(html, /Tone of Voice/);
    assert.match(html, /Line one/);
  });
});

describe('uploadBrandkitDocument request shape', () => {
  it('POSTs multipart to documents v2 with brandkit reference', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'bq-docs-'));
    const pdfPath = path.join(dir, 'guidelines.pdf');
    await writeFile(pdfPath, Buffer.from('%PDF-1.4 fake'));

    /** @type {RequestInit|undefined} */
    let captured;
    /** @type {string|undefined} */
    let capturedUrl;
    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
      capturedUrl = String(url);
      captured = init;
      return new Response(JSON.stringify({ id: 'doc-42' }), { status: 200 });
    });

    try {
      const result = await uploadBrandkitDocument(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-document-api',
          token: 'tok',
        },
        {
          brandkitId: 'kit-9',
          filePath: pdfPath,
          title: 'Guidelines',
        },
      );
      assert.equal(result.documentId, 'doc-42');
      assert.match(
        capturedUrl || '',
        /\/api\/documents\/v2\/organizations\/org_1\/documents$/,
      );
      assert.equal(captured?.method, 'POST');
      assert.ok(captured?.body instanceof FormData);
    } finally {
      fetchMock.mock.restore();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('deleteBrandkitDocument request shape', () => {
  it('DELETEs documents v1 by id', async () => {
    /** @type {string|undefined} */
    let capturedUrl;
    /** @type {string|undefined} */
    let capturedMethod;
    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = init?.method || 'GET';
      return new Response(null, { status: 200 });
    });

    try {
      const result = await deleteBrandkitDocument(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-document-api',
          token: 'tok',
        },
        'doc-old',
      );
      assert.equal(result.ok, true);
      assert.equal(capturedMethod, 'DELETE');
      assert.match(
        capturedUrl || '',
        /\/api\/documents\/v1\/organizations\/org_1\/documents\/doc-old$/,
      );
    } finally {
      fetchMock.mock.restore();
    }
  });

  it('treats 404 as already gone', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      return new Response('gone', { status: 404 });
    });
    try {
      const result = await deleteBrandkitDocument(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-document-api',
          token: 'tok',
        },
        'missing',
      );
      assert.equal(result.ok, true);
      assert.equal(result.alreadyGone, true);
    } finally {
      fetchMock.mock.restore();
    }
  });
});

describe('list + resolvePriorGuidelineDocumentIds', () => {
  it('lists with brandkit reference filters', async () => {
    /** @type {string|undefined} */
    let capturedUrl;
    const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          data: [{ id: 'listed-1', type: 'brand guidelines' }],
        }),
        { status: 200 },
      );
    });

    try {
      const docs = await listBrandkitDocuments(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-document-api',
          token: 'tok',
        },
        { brandkitId: 'kit-9', type: 'brand guidelines' },
      );
      assert.equal(docs.length, 1);
      assert.equal(docs[0].id, 'listed-1');
      assert.match(capturedUrl || '', /referenceType=brandkit/);
      assert.match(capturedUrl || '', /referenceId=kit-9/);
      assert.match(capturedUrl || '', /type=brand(\+|%20)guidelines/);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it('unions state documentId with listed ids without duplicates', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          data: [
            { id: 'state-doc' },
            { id: 'listed-2' },
          ],
        }),
        { status: 200 },
      );
    });

    try {
      const ids = await resolvePriorGuidelineDocumentIds(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-document-api',
          token: 'tok',
        },
        { brandkitId: 'kit-9', stateDocumentId: 'state-doc' },
      );
      assert.deepEqual(ids.sort(), ['listed-2', 'state-doc'].sort());
    } finally {
      fetchMock.mock.restore();
    }
  });
});

describe('runBrandIngestionPipeline request shape', () => {
  it('POSTs BrandIngestionPipeline with populateSections false', async () => {
    /** @type {string|undefined} */
    let body;
    /** @type {string|undefined} */
    let capturedUrl;
    const fetchMock = mock.method(globalThis, 'fetch', async (url, init) => {
      capturedUrl = String(url);
      body = String(init?.body || '');
      return new Response(
        JSON.stringify({ id: 'run-1', status: 'Running' }),
        { status: 200 },
      );
    });

    try {
      const result = await runBrandIngestionPipeline(
        {
          organizationId: 'org_1',
          baseUrl: 'https://edge.example/ai/ai-pipeline-api',
          token: 'tok',
        },
        {
          brandkitId: 'kit-9',
          documentId: 'doc-42',
          populateSections: false,
        },
      );
      assert.equal(result.pipelineRunId, 'run-1');
      assert.match(
        capturedUrl || '',
        /\/pipeline\/BrandIngestionPipeline$/,
      );
      const parsed = JSON.parse(body || '{}');
      assert.equal(parsed.parameters.brand_kit_id, 'kit-9');
      assert.equal(parsed.parameters.documentIdsList, 'doc-42');
      assert.equal(parsed.parameters.populateSections, false);
    } finally {
      fetchMock.mock.restore();
    }
  });
});
