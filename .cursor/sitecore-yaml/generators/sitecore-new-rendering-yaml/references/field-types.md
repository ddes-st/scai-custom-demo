# Template field types

When adding fields under `Data/` (or additional sections), set the field definition `Type` shared field to one of the values below.

Official references:

- [Field types overview (SitecoreAI)](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/index.html)
- [Simple field types](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-simple-field-types.html)
- [Link field types](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-link-field-types.html)
- [List field types](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-list-field-types.html)
- [Developer field types](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-developer-field-types.html) — avoid for end-user content
- [System field types](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-system-field-types.html) — avoid for end-user content
- [Selection field Source property](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/configure-a-field/controlling-the-list-of-items-in-a-selection-field.html)
- [Multilist with search](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/configure-a-field/add-a-multilist-with-search-field-to-a-data-template/index.html)

## Common types for headless components

| Type string | Use for |
|-------------|---------|
| `Single-Line Text` | Short labels, titles, URLs as plain text |
| `Multi-Line Text` | Plain multi-line text (no HTML) |
| `Rich Text` | HTML content editable in Pages |
| `Checkbox` | Boolean — stored as `1` when checked, blank otherwise |
| `Image` | Media library image |
| `General Link` | Internal, external, media, anchor, mailto links |
| `Droplink` | Single item reference (stores GUID) |
| `Droplist` | Single list item (stores name) |
| `Multilist` | Multiple item references (GUIDs, pipe-separated) |
| `Treelist` | Tree multi-select (GUIDs) |
| `Taglist` | Taxonomy tags ([Taglist](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/data-templates/data-template-fields/the-data-template-field-types/the-simple-field-types.html#taglist)) |

## Sections

- Use **`Data`** when all fields fit one group (default from generator).
- Add sections when authors need logical grouping — each section is a `{SectionName}.yml` item (template `e269fbb5-3750-427a-9149-7aa950b49301`) with fields in `{SectionName}/{FieldName}.yml`.

Pass multiple sections via `--fields`:

```json
{
  "sections": [
    {
      "name": "Data",
      "fields": [
        { "name": "Title", "title": "Title", "type": "Single-Line Text", "sort": 100 }
      ]
    },
    {
      "name": "Settings",
      "fields": [
        { "name": "HideTitle", "title": "Hide title", "type": "Checkbox", "sort": 100 }
      ]
    }
  ]
}
```

## Field YAML fragment

See [field-item.template.yml](field-item.template.yml). Every field needs a **new random UUID** for `ID:` — never reuse IDs from other modules.

## Datasource items

After fields exist, copy field GUIDs into default datasource items under `site/.../Data/{ComponentName}s/` with matching `Hint` + `Value`.
