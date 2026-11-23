# Site authoring wiring (after renderings exist)

Rendering/template YAML alone is not enough for Pages/Experience Editor. Complete this checklist for every new site or bulk component set.

## 1. Placeholder settings

For every TSX `<Placeholder name={...}>`:

| Artifact | Location |
|---|---|
| Placeholder setting item | `placeholder-settings/{system}/{key}.yml` |
| Folder parent | `placeholder-settings/{system}.yml` |
| Allowed Controls | child rendering IDs editors may insert |

Dynamic keys use the base key in settings (e.g. `teaser-cards`) and `${DynamicPlaceholderId}` only in TSX/layout XML.

## 2. Rendering `Placeholders` field

Parent rendering YAML must list placeholder setting IDs (braced GUIDs), one per line:

```yaml
- ID: "069a8361-b1cd-437c-8c32-a3be78941446"
  Hint: Placeholders
  Value: |
    {868B1B9F-6DF8-4A31-ACF4-C38249089FF5}
    {B56DEE10-1BAD-4433-8E50-81C0A0EC31F4}
```

Missing this field → editors cannot add children even if placeholder-settings exist.

## 3. Datasource folders + default items

Under `{site}/Data/`:

```txt
Data/{ComponentName}s/          # folder (template: {ComponentName} Folder)
Data/{ComponentName}s/{Item}.yml  # at least one default datasource
```

Rules:

- Datasource `Template:` = datasource template ID from `{ComponentName} Templates/{ComponentName}.yml`.
- Field values must use **existing field definition IDs** from template `Data/*.yml` (search by `Hint:` / Path). Never invent field IDs.
- Rendering `Datasource Location` query must match the folder template name.

## 4. Available Renderings

Register every project rendering under:

```txt
Presentation/Available Renderings/{Group}.yml
```

Typical groups: `Page Content`, `Navigation`, `Page Structure`. Store rendering IDs in the `Renderings` multilist field. Unregistered renderings do not appear in the insert dialog.

## 5. Partial designs vs page renderings

| Content | Wire into |
|---|---|
| Header, Footer, Cookie, shared chrome | `Presentation/Partial Designs/{Name}.yml` → `__Renderings` on partial |
| Page-specific body sections | Page item `__Renderings` (Home, child pages) |
| Which partials apply | `Presentation/Page Designs/Default.yml` + `TemplatesMapping` → Page template |

Layout host placeholders (Content SDK) must match partial/page targets, e.g. `headless-header`, `headless-main`, `headless-footer`, `headless-cookie`.

### Required for partials to appear on pages

Editing a Partial Design alone puts components directly under `headless-*`. On a **page**, Layout Service wraps them in `PartialDesignDynamicPlaceholder` under key `sxa-{Signature}`.

For every Partial Design with Signature `header` / `footer` / `cookie` (etc.):

1. Set `Signature` on the partial (do not leave blank).
2. Create `Presentation/Placeholder Settings/Partial Design/{Name}.yml` with Placeholder Key `sxa-{signature}` (e.g. `sxa-header`). Sitecore creates these automatically when partials are made in Pages; hand-authored YAML must include them.
3. Register `PartialDesignDynamicPlaceholder` in the host component map (starter kit includes it).

Without the `sxa-*` placeholder settings, partials look fine when opened alone but render empty when applied via a Page Design / template mapping.

## 6. Page `__Renderings` XML

- Valid layout UIDs (fresh GUIDs per rendering instance).
- `ds=` / datasource attributes point at real Data item IDs.
- Placeholder keys match TSX + placeholder settings (including dynamic suffix when used).
- Escape XML attributes correctly.
- Child pages that need stub routes for nav links must exist before push.

## 7. Validate order

1. Fix any `NON-UNIQUE ITEM PATH` ([non-unique-item-paths.md](non-unique-item-paths.md)).
2. `dotnet sitecore ser validate --fix -i {namespace}-scs`
3. Push only when requested: `dotnet sitecore ser push -i {namespace}-scs`
