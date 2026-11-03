# portal — the head app

Next.js 16 (App Router) + Sitecore Content SDK 2.x head for the Content Hub portal. See the repository [README](../../README.md) and [doc/sitecoreai-setup.md](../../doc/sitecoreai-setup.md).

```bash
cp .env.remote.example .env.local   # SitecoreAI context id + Content Hub credentials
npm install
npm run dev                          # http://localhost:3000
```

- `src/components/Portal/*` — the SitecoreAI renderings (server components; the component map is generated from this folder).
- `src/components/ui/portal/*` — client islands and shared UI (not in the component map).
- `src/lib/ch/*` — server-only Content Hub loaders (`import "server-only"`); never import them from a client component.
- `src/lib/portal/*` — Portal Settings, section pages, request context, detail resolution.
- `scripts/copy-pdf-worker.mjs` — copies the pdf.js build into `public/` before `dev`/`build`.
