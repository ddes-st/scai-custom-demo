import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ALL_SECTIONS, methodsOutRoot } from './lib/paths.mjs';
import { wrapHtmlDocument, writeMethodArtifacts, exists } from './lib/io.mjs';
import { withCaptureCss } from './lib/preview-tweaks.mjs';
import { scoreMethodTarget } from './harness/score.mjs';
import { writeReport } from './harness/report.mjs';

const parts = [];
const imports = [];
const usages = [];
for (const section of ALL_SECTIONS) {
  const p = path.join(methodsOutRoot, 'M01', section, 'preview.html');
  if (!(await exists(p))) continue;
  const html = await readFile(p, 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
  parts.push(`<!-- ${section} -->\n${body}`);
  const n = section.replace(/\D/g, '');
  imports.push(`import Section${n} from '../M01/${section}/Component';`);
  usages.push(`      <Section${n} key="${section}" />`);
}

await writeMethodArtifacts('PATH_A', 'full-page', {
  tsx: `import React from 'react';
${imports.join('\n')}

export default function PathAFull() {
  return (
    <>
${usages.join('\n')}
    </>
  );
}
`,
  previewHtml: wrapHtmlDocument(parts.join('\n'), {
    title: 'Path A all sections',
    extraHead: withCaptureCss(),
  }),
  meta: { path: 'A', sections: ALL_SECTIONS.length, source: 'M01 section.html compose' },
});

console.log('composed', parts.length);
const s = await scoreMethodTarget(path.join(methodsOutRoot, 'PATH_A', 'full-page'), { kind: 'page' });
console.log('PATH_A full-page', s.avgMismatchPercent);
await writeReport();
