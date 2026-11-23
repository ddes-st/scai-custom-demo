/**
 * Bundle + serve a visual-fidelity preview of a Sitecore component tree.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { bqRoot } from '../../capture/paths.mjs';
import { NAVIGATION_REFERENCE_SOURCE } from '../ensure-navigation-reference.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUB_PATH = path.join(__dirname, 'sitecore-preview-stub.mjs');
/** Resolve packages from bq/ only — preview TSX lives under .bq/ and would otherwise miss bq/node_modules (sibling of .bq). */
const requireFromBq = createRequire(path.join(bqRoot, 'package.json'));

/** @param {string} specifier */
function tryResolveFromBq(specifier) {
  try {
    return { path: requireFromBq.resolve(specifier) };
  } catch {
    return null;
  }
}

/**
 * Shared esbuild plugin for VF preview bundles.
 * Stubs Sitecore/Next, force-resolves react from bq, and resolves other bare
 * npm packages (lucide-react, @fortawesome/*, …) via requireFromBq so imports
 * from `.bq/captures/.../preview` do not fail.
 *
 * @param {{
 *   emptyModulePath: string,
 *   includeMarqueeStubs?: boolean,
 *   includeNavReference?: boolean,
 *   includeSitecorePathAlias?: boolean,
 * }} opts
 */
function createPreviewResolvePlugin(opts) {
  const {
    emptyModulePath,
    includeMarqueeStubs = false,
    includeNavReference = false,
    includeSitecorePathAlias = false,
  } = opts;

  return {
    name: 'sitecore-stub',
    setup(build) {
      // Single React copy (bq/node_modules) so FaIcon / useId hooks share one dispatcher.
      build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
        path: requireFromBq.resolve(args.path),
      }));
      build.onResolve({ filter: /^react-dom(\/.*)?$/ }, (args) => ({
        path: requireFromBq.resolve(args.path),
      }));

      if (includeMarqueeStubs) {
        // ContinuousMarquee's layout sync can busy-loop in headless VF (hidden chrome /
        // zero-width viewports). Passthrough keeps children visible for screenshots.
        build.onResolve({ filter: /continuous-marquee(\.tsx)?$/ }, () => ({
          path: path.join(__dirname, 'marquee-passthrough-stub.mjs'),
        }));
        build.onResolve({ filter: /continuous-marquee-dom(\.ts)?$/ }, () => ({
          path: path.join(__dirname, 'marquee-passthrough-stub.mjs'),
        }));
      }

      build.onResolve({ filter: /^@sitecore-content-sdk\/nextjs$/ }, () => ({
        path: STUB_PATH,
      }));
      build.onResolve({ filter: /^@sitecore-content-sdk\/nextjs\/.*/ }, () => ({
        path: STUB_PATH,
      }));
      build.onResolve({ filter: /^next\/image$/ }, () => ({ path: STUB_PATH }));
      build.onResolve({ filter: /^next\/link$/ }, () => ({
        path: path.join(__dirname, 'next-link-stub.mjs'),
      }));

      if (includeNavReference) {
        // Prompt primer is not always on disk beside packages; map any
        // Navigation.reference import to the canonical reference module.
        build.onResolve({ filter: /Navigation\.reference(\.tsx?)?$/ }, () => ({
          path: NAVIGATION_REFERENCE_SOURCE,
          namespace: 'file',
        }));
      }

      build.onResolve({ filter: /(^|\/)\.sitecore\/component-map$/ }, () => ({
        path: emptyModulePath,
      }));
      build.onResolve({ filter: /^lib\// }, async (args) => ({
        path: await resolveWithExt(path.join(bqRoot, 'src', args.path)),
        namespace: 'file',
      }));
      build.onResolve({ filter: /^components\// }, async (args) => ({
        path: await resolveWithExt(path.join(bqRoot, 'src', args.path)),
        namespace: 'file',
      }));
      build.onResolve({ filter: /^src\// }, async (args) => ({
        path: await resolveWithExt(path.join(bqRoot, args.path)),
        namespace: 'file',
      }));

      if (includeSitecorePathAlias) {
        build.onResolve({ filter: /^\.sitecore\// }, async (args) => ({
          path: await resolveWithExt(path.join(bqRoot, args.path)),
          namespace: 'file',
        }));
      }

      // Bare packages (lucide-react, @fortawesome/*, …). Preview workDirs under
      // .bq/ never see bq/node_modules via Node's walk-up from the importer.
      build.onResolve(
        { filter: /^(@?[\w-]+(?:\/[\w.-]+)*)$/ },
        (args) => {
          if (args.kind === 'entry-point') return undefined;
          return tryResolveFromBq(args.path) || undefined;
        },
      );
    },
  };
}

async function resolveWithExt(baseNoExt) {
  const { stat } = await import('node:fs/promises');
  const candidates = [
    `${baseNoExt}.ts`,
    `${baseNoExt}.tsx`,
    `${baseNoExt}.js`,
    `${baseNoExt}.jsx`,
    `${baseNoExt}.mjs`,
    path.join(baseNoExt, 'index.ts'),
    path.join(baseNoExt, 'index.tsx'),
    path.join(baseNoExt, 'index.js'),
    baseNoExt,
  ];
  for (const c of candidates) {
    try {
      const st = await stat(c);
      if (st.isFile()) return c;
      if (st.isDirectory()) {
        for (const idx of ['index.ts', 'index.tsx', 'index.js', 'index.mjs']) {
          const p = path.join(c, idx);
          try {
            const ist = await stat(p);
            if (ist.isFile()) return p;
          } catch {
            /* next */
          }
        }
      }
    } catch {
      /* try next */
    }
  }
  return `${baseNoExt}.ts`;
}

const OVERLAY_CSS = `
html, body { margin: 0; padding: 0; scrollbar-width: none !important; }
* { scrollbar-width: none !important; animation: none !important; transition: none !important; }
::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
#root { min-height: 1px; }
`;

/** @type {Map<string, string>} */
const compiledGlobalsCssBySourceKey = new Map();

/**
 * Drop process-level preview CSS cache (tests / forced rebuilds).
 */
export function clearPreviewGlobalsCssCache() {
  compiledGlobalsCssBySourceKey.clear();
}

/**
 * @param {string[]} extraSourceDirs
 * @returns {string}
 */
function previewCssSourceKey(extraSourceDirs) {
  return [...new Set(extraSourceDirs.map((d) => path.resolve(d)))]
    .sort()
    .join('|');
}

/**
 * Compile `bq/src/app/globals.css` for Playwright preview (browsers cannot load
 * `@import "tailwindcss"`). globals.css uses `source("..")` so `bq/src` is
 * scanned; pass `extraSourceDirs` (e.g. VF workDir) for ephemeral preview TSX.
 *
 * @param {{ extraSourceDirs?: string[] }} [opts]
 * @returns {Promise<string>}
 */
export async function compilePreviewGlobalsCss(opts = {}) {
  const extraSourceDirs = Array.isArray(opts.extraSourceDirs)
    ? opts.extraSourceDirs.filter(Boolean)
    : [];
  const cacheKey = previewCssSourceKey(extraSourceDirs);
  const hit = compiledGlobalsCssBySourceKey.get(cacheKey);
  if (hit) return hit;

  const cssPath = path.join(bqRoot, 'src', 'app', 'globals.css');
  const cssDir = path.dirname(cssPath);
  const rawCss = await readFile(cssPath, 'utf8');

  const sourceDirectives = [...new Set(extraSourceDirs.map((d) => path.resolve(d)))]
    .sort()
    .map((absDir) => {
      let rel = path.relative(cssDir, absDir).replace(/\\/g, '/');
      if (!rel || rel === '.') return null;
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `@source "${rel}";`;
    })
    .filter(Boolean)
    .join('\n');

  const cssInput = sourceDirectives ? `${rawCss}\n${sourceDirectives}\n` : rawCss;

  let compiledCss;
  try {
    const compiled = await postcss([tailwindcss]).process(cssInput, { from: cssPath });
    compiledCss = compiled.css;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[visual-fidelity] Tailwind compile failed for ${cssPath}: ${msg}`,
    );
  }
  if (
    !compiledCss ||
    /@import\s+["']tailwindcss["']/.test(compiledCss) ||
    compiledCss.length < rawCss.length
  ) {
    throw new Error(
      `[visual-fidelity] Tailwind compile produced unusable CSS for ${cssPath} ` +
        `(len=${compiledCss?.length ?? 0}; still has @import "tailwindcss" or shorter than source).`,
    );
  }
  compiledGlobalsCssBySourceKey.set(cacheKey, compiledCss);
  return compiledCss;
}

/**
 * @param {{
 *   workDir: string,
 *   tree: Awaited<ReturnType<import('./compose-tree.mjs')['loadComponentPackages']>>,
 * }} opts
 */
export async function buildPreviewBundle(opts) {
  const { workDir, tree } = opts;
  await mkdir(workDir, { recursive: true });

  const entryPath = path.join(workDir, 'preview-entry.jsx');
  const propsPath = path.join(workDir, 'preview-props.json');
  const outJs = path.join(workDir, 'preview.bundle.js');
  const outHtml = path.join(workDir, 'preview.html');

  await writeFile(
    propsPath,
    JSON.stringify(
      {
        parent: tree.parent.props,
        children: tree.children.map((c) => ({
          componentName: c.componentName,
          props: c.props,
          placeholderKey: c.placeholderKey || tree.placeholderKey,
        })),
        placeholderKey: tree.placeholderKey,
      },
      null,
      2,
    ),
    'utf8',
  );

  const childImports = tree.children
    .map((c, i) => {
      const abs = c.tsxPath.replace(/\\/g, '/');
      return `import * as Child${i} from ${JSON.stringify(abs)};`;
    })
    .join('\n');

  const childMounts = tree.children
    .map((c, i) => {
      const mountKey = c.placeholderKey || tree.placeholderKey || 'main';
      return `
  {
    const mod = Child${i};
    const Comp = mod.Default || mod[Object.keys(mod).find(k => typeof mod[k] === 'function')];
    if (Comp) {
      const node = React.createElement(Comp, childProps[${i}] || {});
      const key = ${JSON.stringify(mountKey)};
      if (!byBase[key]) byBase[key] = [];
      byBase[key].push(node);
      const dyn = key + '-1';
      if (!byBase[dyn]) byBase[dyn] = [];
      byBase[dyn].push(node);
      // Sitecore dynamic placeholder form used by many generated parents
      const braceDyn = key + '-{1}';
      if (!byBase[braceDyn]) byBase[braceDyn] = [];
      byBase[braceDyn].push(node);
    }
  }`;
    })
    .join('\n');

  const parentAbs = tree.parent.tsxPath.replace(/\\/g, '/');
  const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as ParentMod from ${JSON.stringify(parentAbs)};
${childImports}
import { __bqPlaceholderChildren } from ${JSON.stringify(STUB_PATH.replace(/\\/g, '/'))};
import propsData from ${JSON.stringify(propsPath.replace(/\\/g, '/'))};

const byBase = __bqPlaceholderChildren.byBase;
Object.keys(byBase).forEach((k) => delete byBase[k]);
const childProps = (propsData.children || []).map((c) => c.props);
${childMounts}

const Parent = ParentMod.Default || ParentMod[Object.keys(ParentMod).find((k) => typeof ParentMod[k] === 'function')];
const rootEl = document.getElementById('root');
if (Parent && rootEl) {
  createRoot(rootEl).render(React.createElement(Parent, propsData.parent || {}));
}
`;

  await writeFile(entryPath, entrySrc, 'utf8');

  // Compile Tailwind (globals scans bq/src; @source workDir for ephemeral TSX).
  const globalsCss = await compilePreviewGlobalsCss({
    extraSourceDirs: [workDir],
  });
  await writeFile(path.join(workDir, 'globals.css'), globalsCss, 'utf8');

  const emptyModulePath = path.join(__dirname, 'empty-module.mjs');
  await writeFile(
    emptyModulePath,
    'export default {};\nexport const componentMap = {};\n',
    'utf8',
  );

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: outJs,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    absWorkingDir: bqRoot,
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.json': 'json',
      '.css': 'css',
      '.svg': 'dataurl',
      '.png': 'dataurl',
    },
    plugins: [
      createPreviewResolvePlugin({
        emptyModulePath,
        includeMarqueeStubs: true,
        includeNavReference: true,
        includeSitecorePathAlias: true,
      }),
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'silent',
    external: [],
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${OVERLAY_CSS}</style>
${globalsCss ? '<link rel="stylesheet" href="./globals.css"/>' : ''}
</head>
<body>
<div id="root"></div>
<script src="./preview.bundle.js"></script>
</body>
</html>`;
  await writeFile(outHtml, html, 'utf8');

  return { htmlPath: outHtml, jsPath: outJs, workDir };
}

/**
 * Bundle a single standalone visual TSX module (Default export, no Sitecore props).
 * Used for pre-Sitecoreize inspection shots.
 * @param {{ workDir: string, tsxPath: string }} opts
 */
export async function buildStandaloneTsxPreview(opts) {
  const { workDir, tsxPath } = opts;
  await mkdir(workDir, { recursive: true });

  const entryPath = path.join(workDir, 'preview-entry.jsx');
  const outJs = path.join(workDir, 'preview.bundle.js');
  const outHtml = path.join(workDir, 'preview.html');
  const tsxAbs = path.resolve(tsxPath).replace(/\\/g, '/');

  const entrySrc = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Mod from ${JSON.stringify(tsxAbs)};

const Comp = Mod.Default || Mod[Object.keys(Mod).find((k) => typeof Mod[k] === 'function')];
const rootEl = document.getElementById('root');
if (Comp && rootEl) {
  createRoot(rootEl).render(React.createElement(Comp, {}));
}
`;

  await writeFile(entryPath, entrySrc, 'utf8');

  // Scan workDir so standalone visual TSX utilities (often absent from bq/src) emit CSS.
  const globalsCss = await compilePreviewGlobalsCss({
    extraSourceDirs: [workDir],
  });
  await writeFile(path.join(workDir, 'globals.css'), globalsCss, 'utf8');

  const emptyModulePath = path.join(__dirname, 'empty-module.mjs');
  await writeFile(
    emptyModulePath,
    'export default {};\nexport const componentMap = {};\n',
    'utf8',
  );

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    outfile: outJs,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    absWorkingDir: bqRoot,
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
      '.jsx': 'jsx',
      '.json': 'json',
      '.css': 'css',
      '.svg': 'dataurl',
      '.png': 'dataurl',
    },
    plugins: [
      createPreviewResolvePlugin({ emptyModulePath }),
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'silent',
    external: [],
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${OVERLAY_CSS}</style>
${globalsCss ? '<link rel="stylesheet" href="./globals.css"/>' : ''}
</head>
<body>
<div id="root"></div>
<script src="./preview.bundle.js"></script>
</body>
</html>`;
  await writeFile(outHtml, html, 'utf8');

  return { htmlPath: outHtml, jsPath: outJs, workDir };
}

/**
 * @param {string} rootDir directory to serve
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void> }>}
 */
export function startPreviewServer(rootDir) {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };

  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'preview.html';
      const filePath = path.resolve(rootDir, rel);
      if (!filePath.startsWith(path.resolve(rootDir))) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((res, rej) => {
            server.close((e) => (e ? rej(e) : res()));
          }),
      });
    });
  });
}

export async function cleanupWorkDir(workDir) {
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
