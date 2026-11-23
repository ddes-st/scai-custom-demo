# Sitecore build contract

## Component TSX

```txt
src/components/{namespace}/{ComponentName}.tsx
```

Every component should export at least `Default`. Add other variants only when required by screenshot or standard reusable behavior.

## Required YAML per rendering

- Template folder/item + field definitions under `Data/`
- Rendering item (`componentName`, Datasource Template/Location, Parameters Template)
- Headless variant item when the host uses variants
- Site `Data/{ComponentName}s/` folder + example datasource item
- Available Renderings entry (always for new project renderings)
- Placeholder settings + rendering `Placeholders` when the component exposes placeholders

## Fields

Map visual/content evidence to editable fields:

| Visual/content | Field type |
|---|---|
| Plain heading | Single-Line Text |
| Body with formatting | Rich Text |
| Image/logo/icon | Image |
| Button/CTA/nav item | General Link |
| Repeating child cards | Placeholder + child rendering |
| Boolean UI option | Checkbox or rendering parameter |
| Layout choice | Rendering parameter / variant |

When writing datasource YAML, copy field definition IDs from the template (readable tree or SCS hash folder). Do not create a second YAML file for an existing field Path.

## Naming

- TSX file, rendering item, and component-map key should match `cmsName`.
- Datasource template may use `{ComponentName}`.
- Rendering parameters template may use `{ComponentName} Parameters`.

## Site composition (required for editable pages)

| Layer | What to serialize |
|---|---|
| Chrome | Partial Designs (Header/Footer/Cookie) → Page Design → TemplatesMapping |
| Body | Page `__Renderings` with datasource IDs and placeholder keys |
| Insert dialog | Available Renderings groups |
| Nested slots | placeholder-settings + parent rendering `Placeholders` |

See `../../sitecore-yaml/references/site-authoring-wiring.md` and `../../sitecore-yaml/references/non-unique-item-paths.md`.
