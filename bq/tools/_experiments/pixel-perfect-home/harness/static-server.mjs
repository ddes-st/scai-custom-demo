/**
 * Tiny static file server for capture assets + method previews.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { capturePageDir, experimentOutRoot } from '../lib/paths.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.json': 'application/json',
};

/**
 * @returns {Promise<{ port: number, baseUrl: string, close: () => Promise<void> }>}
 */
export function startStaticServer() {
  const roots = [
    { urlPrefix: '/capture', dir: capturePageDir },
    { urlPrefix: '/exp', dir: experimentOutRoot },
  ];

  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url || '/', 'http://127.0.0.1');
      let rel = decodeURIComponent(u.pathname);
      let filePath = null;
      for (const r of roots) {
        if (rel === r.urlPrefix || rel.startsWith(r.urlPrefix + '/')) {
          const rest = rel.slice(r.urlPrefix.length).replace(/^\/+/, '');
          filePath = path.join(r.dir, rest);
          break;
        }
      }
      if (!filePath) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const resolved = path.resolve(filePath);
      const allowed = roots.some((r) => resolved.startsWith(path.resolve(r.dir)));
      if (!allowed) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(resolved).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((res, rej) => {
            server.close((e) => (e ? rej(e) : res()));
          }),
      });
    });
  });
}

/** Map a filesystem path under capture or exp to an HTTP URL */
export function toServerUrl(baseUrl, absPath) {
  const capture = path.resolve(capturePageDir);
  const exp = path.resolve(experimentOutRoot);
  const abs = path.resolve(absPath);
  if (abs.startsWith(capture)) {
    const rest = abs.slice(capture.length).split(path.sep).join('/');
    return `${baseUrl}/capture${rest.startsWith('/') ? rest : '/' + rest}`;
  }
  if (abs.startsWith(exp)) {
    const rest = abs.slice(exp.length).split(path.sep).join('/');
    return `${baseUrl}/exp${rest.startsWith('/') ? rest : '/' + rest}`;
  }
  return null;
}
