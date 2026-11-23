/**
 * M17 — Vercel v0 Platform API v2 (v0-mini).
 * Uses REST fetch; skips if V0_API_KEY missing.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadLocalEnvFiles } from '../../../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../../../capture/paths.mjs';
import { readSectionHtml, readSectionInfo, ensureDir, methodTargetDir, exists } from '../lib/io.mjs';
import {
  writeNekoArtifacts,
  extractTsx,
  extractFenced,
  desktopPngBuf,
  componentNameFor,
  NEKO_BAKEOFF,
  buildTailwindPreview,
} from '../lib/neko-shared.mjs';

const V0_API = 'https://api.v0.dev/v2';

function getV0Key() {
  loadLocalEnvFiles({ root: bqRoot });
  return (process.env.V0_API_KEY || process.env.V0_API || '').trim();
}

/**
 * Extract TSX from v0 chat create response (files / message parts).
 */
function extractFromV0Response(data) {
  const files = [];
  const walk = (obj, depth = 0) => {
    if (!obj || depth > 8) return;
    if (Array.isArray(obj)) {
      for (const x of obj) walk(x, depth + 1);
      return;
    }
    if (typeof obj !== 'object') return;
    // Common shapes: { name, content } or { path, source } or { language, content }
    const name = obj.name || obj.path || obj.filename || '';
    const content = obj.content || obj.source || obj.code || obj.text || '';
    if (typeof content === 'string' && content.length > 40) {
      if (/\.tsx?$/i.test(name) || /export default|function |className=/.test(content)) {
        files.push({ name: String(name || 'Component.tsx'), content });
      }
    }
    if (typeof obj.content === 'string' && obj.type === 'text' && obj.content.includes('```')) {
      files.push({ name: 'message.md', content: obj.content });
    }
    for (const v of Object.values(obj)) walk(v, depth + 1);
  };
  walk(data);

  // Prefer .tsx files
  const tsxFile = files.find((f) => /\.tsx$/i.test(f.name)) || files.find((f) => /export default/.test(f.content));
  if (tsxFile) {
    let tsx = tsxFile.content;
    if (tsx.includes('```')) tsx = extractTsx(tsx);
    return { tsx, files, rawJson: data };
  }

  // Fallback: stringify assistant message
  const msg =
    data?.latestVersion?.files ||
    data?.chat?.latestVersion?.files ||
    data?.files ||
    null;
  if (msg) {
    walk(msg);
    const again = files.find((f) => /export default|className=/.test(f.content));
    if (again) return { tsx: extractTsx(again.content), files, rawJson: data };
  }

  const asText = JSON.stringify(data).slice(0, 5000);
  return { tsx: null, files, rawJson: data, note: asText };
}

async function createV0Chat({ apiKey, message, attachments, modelId = 'v0-mini' }) {
  const body = {
    message,
    privacy: 'private',
    modelConfiguration: {
      modelId,
      imageGenerations: false,
    },
  };
  if (attachments?.length) body.attachments = attachments;

  const res = await fetch(`${V0_API}/chats`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, skipReason: `v0 non-JSON HTTP ${res.status}: ${text.slice(0, 400)}` };
  }
  if (!res.ok) {
    const err = data?.error?.message || data?.message || text.slice(0, 400);
    return { ok: false, skipReason: `v0 HTTP ${res.status}: ${err}`, data };
  }
  return { ok: true, data };
}

export async function runM17(sections = NEKO_BAKEOFF) {
  const apiKey = getV0Key();
  if (!apiKey) {
    for (const section of sections) {
      const dir = await ensureDir(methodTargetDir('M17', section));
      await writeFile(
        path.join(dir, 'COST.md'),
        `# M17 v0\n\nSkipped: set \`V0_API_KEY\` in bq/.env.local\n\nAPI: https://api.v0.dev/v2/chats\nModel planned: v0-mini\n`,
        'utf8'
      );
      await writeNekoArtifacts('M17', section, {
        tsx: `/** v0 skipped — no V0_API_KEY */\nexport default function V0Skipped(){ return <div>V0_API_KEY missing</div> }\n`,
        raw: 'V0_API_KEY missing',
        meta: {
          method: 'M17',
          skipped: true,
          reason: 'V0_API_KEY missing',
          tool: 'v0 Platform API v2',
          modelPlanned: 'v0-mini',
        },
        htmlFence: '<p>V0_API_KEY missing — skipped</p>',
      });
    }
    return { skipped: true, reason: 'V0_API_KEY missing' };
  }

  for (const section of sections) {
    console.log(`  M17 ${section} (v0-mini)…`);
    const info = await readSectionInfo(section);
    const name = componentNameFor(section);
    const html = (await readSectionHtml(section)).slice(0, 8000);
    const png = await desktopPngBuf(section);
    const attachments = [];
    if (png) {
      attachments.push({
        url: `data:image/png;base64,${png.toString('base64')}`,
      });
    }
    attachments.push({
      url: `data:text/plain;base64,${Buffer.from(html, 'utf8').toString('base64')}`,
    });

    const message = `Recreate this website section as a single React TypeScript component named ${name}.

Context:
- Site: https://www.sitecore.com/
- Section: ${section} (${info.cmsName || 'unknown'})
- Heading: ${info.heading || ''}

Requirements:
- Next.js + Tailwind CSS (shadcn ok)
- Static visual fidelity to the attached screenshot
- One export default function component only
- No backend / no API routes
- Prefer matching layout, spacing, colors, typography

A text/plain attachment contains truncated source HTML for this section. Use the screenshot as the primary visual reference.`;

    const r = await createV0Chat({
      apiKey,
      message,
      attachments,
      modelId: 'v0-mini',
    });

    const dir = await ensureDir(methodTargetDir('M17', section));
    await writeFile(path.join(dir, 'raw-v0.json'), JSON.stringify(r.data || { error: r.skipReason }, null, 2));

    if (!r.ok) {
      await writeFile(
        path.join(dir, 'COST.md'),
        `# M17 v0\n\nFailed: ${r.skipReason}\n`,
        'utf8'
      );
      await writeNekoArtifacts('M17', section, {
        tsx: `export default function V0Failed(){ return <div>v0 failed</div> }\n`,
        raw: r.skipReason,
        meta: { method: 'M17', skipped: true, reason: r.skipReason, tool: 'v0 API' },
        htmlFence: `<p>${String(r.skipReason).replace(/</g, '&lt;')}</p>`,
      });
      continue;
    }

    const extracted = extractFromV0Response(r.data);
    let tsx = extracted.tsx;
    if (!tsx) {
      // Try demoFiles / latestVersion nested
      const blob = JSON.stringify(r.data);
      const fence = blob.match(/```tsx\\n([\s\S]*?)```/);
      if (fence) tsx = fence[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    if (!tsx) {
      tsx = `export default function V0NoTsx(){ return <div>v0 returned no extractable TSX — see raw-v0.json</div> }\n`;
    }

    const usage = r.data?.usage || r.data?.chat?.usage || null;
    await writeFile(
      path.join(dir, 'COST.md'),
      `# M17 v0\n\nModel: v0-mini\nUsage: ${JSON.stringify(usage, null, 2)}\nChat id: ${r.data?.chat?.id || r.data?.id || 'n/a'}\n`,
      'utf8'
    );

    const htmlFence = extractFenced(tsx, 'html'); // unlikely
    await writeNekoArtifacts('M17', section, {
      tsx: tsx.includes('export') ? tsx : extractTsx(tsx),
      raw: typeof extracted.note === 'string' ? extracted.note : JSON.stringify(extracted.files?.slice(0, 3)),
      htmlFence,
      meta: {
        method: 'M17',
        tool: 'v0 Platform API v2',
        model: 'v0-mini',
        chatId: r.data?.chat?.id || r.data?.id || null,
        usage,
        filesFound: (extracted.files || []).map((f) => f.name),
      },
    });

    // If preview is weak, still ensure preview.html exists via buildTailwindPreview
    const previewPath = path.join(methodTargetDir('M17', section), 'preview.html');
    if (!(await exists(previewPath))) {
      await writeFile(
        previewPath,
        buildTailwindPreview(tsx, { title: `M17 ${section}` }),
        'utf8'
      );
    }
  }
  return { skipped: false };
}
