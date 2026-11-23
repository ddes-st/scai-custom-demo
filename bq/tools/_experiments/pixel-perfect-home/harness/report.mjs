/**
 * Aggregate method score.json files into a leaderboard.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { methodsOutRoot, reportsOutRoot } from '../lib/paths.mjs';

async function collectScores() {
  const rows = [];
  let methods = [];
  try {
    methods = await readdir(methodsOutRoot);
  } catch {
    return rows;
  }
  for (const method of methods.sort()) {
    const methodDir = path.join(methodsOutRoot, method);
    let targets = [];
    try {
      targets = await readdir(methodDir);
    } catch {
      continue;
    }
    for (const target of targets) {
      const scorePath = path.join(methodDir, target, 'score.json');
      try {
        const raw = await readFile(scorePath, 'utf8');
        const summary = JSON.parse(raw);
        const byVp = {};
        for (const r of summary.results || []) {
          byVp[r.viewport] = r.skipped ? null : r.mismatchPercent;
        }
        rows.push({
          method,
          target,
          kind: summary.kind,
          avgMismatchPercent: summary.avgMismatchPercent,
          desktop: byVp.desktop ?? null,
          tablet: byVp.tablet ?? null,
          mobile: byVp.mobile ?? null,
          notes: (summary.results || [])
            .filter((r) => r.skipped)
            .map((r) => `${r.viewport}:${r.reason}`)
            .join('; '),
        });
      } catch {
        // no score yet
      }
    }
  }
  return rows;
}

export async function writeReport() {
  await mkdir(reportsOutRoot, { recursive: true });
  const rows = await collectScores();
  rows.sort((a, b) => {
    const av = a.avgMismatchPercent ?? 999;
    const bv = b.avgMismatchPercent ?? 999;
    return av - bv;
  });

  const csvHeader = 'method,target,kind,avgMismatchPercent,desktop,tablet,mobile,notes\n';
  const csvBody = rows
    .map((r) =>
      [
        r.method,
        r.target,
        r.kind,
        r.avgMismatchPercent ?? '',
        r.desktop ?? '',
        r.tablet ?? '',
        r.mobile ?? '',
        JSON.stringify(r.notes || ''),
      ].join(',')
    )
    .join('\n');
  await writeFile(path.join(reportsOutRoot, 'leaderboard.csv'), csvHeader + csvBody + '\n');

  const md = [
    '# Pixel-perfect experiment leaderboard',
    '',
    '| Method | Target | Avg mismatch % | Desktop | Tablet | Mobile |',
    '|--------|--------|----------------|---------|--------|--------|',
    ...rows.map(
      (r) =>
        `| ${r.method} | ${r.target} | ${r.avgMismatchPercent ?? '—'} | ${r.desktop ?? '—'} | ${r.tablet ?? '—'} | ${r.mobile ?? '—'} |`
    ),
    '',
    `_Generated ${new Date().toISOString()}_`,
    '',
  ].join('\n');
  await writeFile(path.join(reportsOutRoot, 'leaderboard.md'), md);
  await writeFile(path.join(reportsOutRoot, 'leaderboard.json'), JSON.stringify(rows, null, 2));
  return rows;
}

async function main() {
  const rows = await writeReport();
  console.log(`Wrote ${rows.length} rows to ${reportsOutRoot}`);
}

const isDirect = process.argv[1] && path.normalize(process.argv[1]).endsWith(`${path.sep}report.mjs`);
if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
