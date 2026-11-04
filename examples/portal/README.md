# portal — the head app

Next.js 16 (App Router) + Sitecore Content SDK 2.x head for the Content Hub portal. This repository's root README is the custom-demo builder (`examples/basic-nextjs`); it does not set up this head. The portal's setup narrative lives in the portal repository (`doc/sitecoreai-setup.md`, `doc/new-instance.md`). The step that is easy to miss when the items are copied into this project is below.

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

## Content Hub picker (Open app)

Copying the portal items does not connect them to the Content Hub extension app in this organization. The picks field and the banner, hero and logo **Content Hub image** fields are Marketplace Plugin fields. **Open app** shows only when each field's **Source** is the app id of an app installed here, with a custom-field extension point `/ch-picker`. A snapshot from another org still carries that org's app id, so the Page builder shows the JSON and the help text and no button. Deploying this rendering host does not change Source.

1. In this org's App Studio, create or reuse the custom app, add the **Custom field** extension point `/ch-picker`, and install the app into this environment.
2. Write that app id into Source. Open Portal setup from the app and choose **Content Hub picker → Use this app**, or from a shell against this authoring environment run `MARKETPLACE_APP_ID=<this org's app id> node tools/sitecoreai-setup.mjs` with `XMC_COLLECTION` and `XMC_SITE` set (for this project, `marketing` and `brand-hub`).
3. Publish the Portal templates and reload the Page builder.

The template fields are under `/sitecore/templates/Project/<collection>/Portal`:

- `Portal Banner/Banner/ImagePick` — the banner's Content Hub image
- `Portal Picks/Picks/Picks`
- `_Portal Texts/Portal/HeroImagePick`
- `Portal Header/Header/LogoPick`

Do not edit the datasource items under the site (for example `Data/Portal Banners`). Those hold the picked JSON, not the app link. This does not touch `/sitecore/content/group/sodexo` or the templates, renderings and media under `group` and `fmc-custom-demo`.

## Brand scope

Empty brand and product lists, with other entity types still returning, come from the brand scope, not from the Sitecore live context id itself. The head reads `BrandScope` on `/sitecore/content/<collection>/<site>/Settings/Portal Settings` through `SITECORE_EDGE_CONTEXT_ID` (a live context sees only the published value, cached 60 s). Each line is a Content Hub `M.Brand` identifier. When that published field is empty, or the item is not on this context, the rendering host's `PORTAL_BRANDS` is used instead. Both empty means every brand.

A copied site keeps the source environment's `BrandScope`. Identifiers that are not this tenant's remove every brand and every product linked to a brand. Assets and other types with no brand relation stay. Clear the field and leave `PORTAL_BRANDS` unset, or set this tenant's identifiers, then publish Portal Settings. Portal setup writes the field only for a new site, or on a re-run after a **Brands shown** box is ticked or cleared. The CLI writes it only when `PORTAL_BRAND_SCOPE` is set.
