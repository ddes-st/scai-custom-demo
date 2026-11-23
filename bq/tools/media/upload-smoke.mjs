/**
 * One-time Authoring GraphQL media upload smoke test.
 * Run: node tools/media/upload-smoke.mjs [--file path] [--item-path Project/menzis/menzis-nl/Johan] [--alt Johan]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveAuthoringGraphqlAuth } from '../shared/cm-delete-item.ts';
import { loadLocalEnvFiles } from '../shared/load-local-env.ts';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function parseArgs(argv) {
  /** @type {{ file?: string, itemPath: string, alt: string, endpoint?: string }} */
  const out = {
    itemPath: 'Project/menzis/menzis-nl/Johan',
    alt: 'Johan',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--item-path') out.itemPath = String(argv[++i] || '').trim();
    else if (a === '--alt') out.alt = String(argv[++i] || '').trim() || 'Johan';
    else if (a === '--endpoint') out.endpoint = String(argv[++i] || '').trim();
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node --import tsx tools/media/upload-smoke.mjs [--file path.png] [--item-path Project/…/Johan] [--alt text] [--endpoint bqAuthoring]',
      );
      process.exit(0);
    }
  }
  if (!out.itemPath) throw new Error('--item-path must be non-empty');
  return out;
}

/**
 * @param {string} host
 * @param {string} token
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
async function authoringGql(host, token, query, variables) {
  const url = `${host.replace(/\/$/, '')}/sitecore/api/authoring/graphql/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    const msg =
      json.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.body = json;
    throw err;
  }
  return json.data || {};
}

async function ensureFile(fileArg) {
  if (fileArg) {
    const abs = path.resolve(fileArg);
    await readFile(abs);
    return { abs, name: path.basename(abs) };
  }
  const dir = path.join(os.tmpdir(), 'bq-media-upload-smoke');
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, 'Johan.png');
  await writeFile(abs, Buffer.from(TINY_PNG_B64, 'base64'));
  return { abs, name: 'Johan.png' };
}

async function main() {
  loadLocalEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  if (args.endpoint) process.env.BQ_SITECORE_ENDPOINT = args.endpoint;
  const file = await ensureFile(args.file);
  console.log(`  file: ${file.abs}`);
  console.log(`  itemPath: ${args.itemPath}`);
  console.log(`  alt: ${args.alt}`);

  const auth = await resolveAuthoringGraphqlAuth({
    endpointName: args.endpoint || process.env.BQ_SITECORE_ENDPOINT,
  });
  console.log(`  endpoint: ${auth.endpointName}  host: ${auth.host}`);

  const gqlData = await authoringGql(
    auth.host,
    auth.token,
    `mutation($input: UploadMediaInput!) {
      uploadMedia(input: $input) {
        presignedUploadUrl
      }
    }`,
    {
      input: {
        itemPath: args.itemPath,
        alt: args.alt,
        overwriteExisting: true,
      },
    },
  );

  const presigned = gqlData?.uploadMedia?.presignedUploadUrl;
  if (!presigned) {
    console.error('  ✖ uploadMedia returned no presignedUploadUrl');
    console.error(JSON.stringify(gqlData, null, 2));
    process.exit(1);
  }
  console.log(`  ✓ got presignedUploadUrl`);

  const bytes = await readFile(file.abs);
  const form = new FormData();
  form.append(
    'file',
    new Blob([bytes], { type: 'image/png' }),
    file.name.endsWith('.png') ? file.name : `${file.name}.png`,
  );

  const uploadRes = await fetch(presigned, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
    body: form,
  });
  const uploadText = await uploadRes.text();
  let uploadJson;
  try {
    uploadJson = JSON.parse(uploadText);
  } catch {
    uploadJson = { raw: uploadText };
  }

  if (!uploadRes.ok) {
    console.error(`  ✖ upload POST failed HTTP ${uploadRes.status}`);
    console.error(uploadText.slice(0, 2000));
    process.exit(1);
  }

  console.log('  ✓ upload response:');
  console.log(JSON.stringify(uploadJson, null, 2));

  const mediaId =
    uploadJson?.Id ||
    uploadJson?.id ||
    uploadJson?.itemId ||
    uploadJson?.ItemId ||
    null;
  const reportedAlt =
    uploadJson?.Alt || uploadJson?.alt || uploadJson?.fields?.Alt || null;

  if (mediaId && reportedAlt !== args.alt) {
    console.log(
      `  · Alt not confirmed on upload response — updateItem Alt on ${mediaId}`,
    );
    try {
      const updated = await authoringGql(
        auth.host,
        auth.token,
        `mutation($input: UpdateItemInput!) {
          updateItem(input: $input) {
            item { itemId name path }
          }
        }`,
        {
          input: {
            database: 'master',
            itemId: String(mediaId).startsWith('{')
              ? mediaId
              : `{${String(mediaId).replace(/[{}]/g, '')}}`,
            language: 'en',
            fields: [{ name: 'Alt', value: args.alt }],
          },
        },
      );
      console.log('  ✓ updateItem Alt:');
      console.log(JSON.stringify(updated, null, 2));
    } catch (err) {
      console.warn(
        `  ⚠ updateItem Alt failed: ${err instanceof Error ? err.message : err}`,
      );
      if (err?.body) console.warn(JSON.stringify(err.body, null, 2));
    }
  } else if (reportedAlt === args.alt) {
    console.log(`  ✓ Alt already set on upload response: ${reportedAlt}`);
  }

  console.log('\nDone.');
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isMain) {
  main().catch((err) => {
    console.error(`  ✖ ${err instanceof Error ? err.message : err}`);
    if (err?.body) console.error(JSON.stringify(err.body, null, 2));
    process.exit(1);
  });
}
