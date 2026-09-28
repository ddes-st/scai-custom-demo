// Direct probe of the SitecoreAI search API — replicates exactly what
// @sitecore-content-sdk/nextjs/search useSearch sends, with zero component code.
// Replaces the missing "test query" feature in Search Configuration Manager.
//
// Usage (from examples/basic-nextjs):
//   node docs/ai/scripts/search-probe.mjs <searchIndexGuid> [keyphrase]
//
// Reads NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID (or SITECORE_EDGE_CONTEXT_ID) from .env.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [indexId, keyphrase = ''] = process.argv.slice(2);

if (!indexId) {
  console.error('Usage: node docs/ai/scripts/search-probe.mjs <searchIndexGuid> [keyphrase]');
  process.exit(1);
}

const readEnvVar = (name) => {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      const match = content.match(new RegExp(`^${name}=(.+)$`, 'm'));
      if (match) return match[1].trim();
    } catch {
      // file missing — try next
    }
  }
  return undefined;
};

const contextId =
  readEnvVar('NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID') ?? readEnvVar('SITECORE_EDGE_CONTEXT_ID');

if (!contextId) {
  console.error('No SITECORE_EDGE_CONTEXT_ID found in environment, .env.local, or .env');
  process.exit(1);
}

const response = await fetch('https://edge-platform.sitecorecloud.io/v1/search', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-sitecore-contextid': contextId,
  },
  body: JSON.stringify({
    config: { id: indexId },
    limit: 10,
    offset: 0,
    query: { keyphrase },
    sessionId: '',
    sort: { fields: [] },
  }),
});

const text = await response.text();
console.log(`HTTP ${response.status} ${response.statusText}`);

let data;
try {
  data = JSON.parse(text);
} catch {
  console.log(text);
  process.exit(response.ok ? 0 : 1);
}

const results = data.content ?? [];
console.log(`total: ${data.total ?? 0}, returned: ${results.length}`);

if (results.length > 0) {
  console.log('\n--- attribute names in first result (use these for fieldsMapping) ---');
  console.log(Object.keys(results[0]).join(', '));
  console.log('\n--- results ---');
  for (const doc of results) {
    console.log(JSON.stringify(doc, null, 2));
  }
} else if (!response.ok) {
  console.log(JSON.stringify(data, null, 2));
}
