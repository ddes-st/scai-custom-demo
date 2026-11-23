# Component review contract

```json
{
  "project": "example-com",
  "sourceUrls": ["https://example.com"],
  "generatedAt": "YYYY-MM-DDTHH:mm:ssZ",
  "components": [
    {
      "id": "S1",
      "cmsName": "VerticalTeaserGrid",
      "visualRole": "three-card teaser section with title",
      "scope": "page",
      "action": "create",
      "pageSlugs": ["home"],
      "sectionFolder": "vertical-teaser-grid",
      "evidence": [
        "design-screenshots/example-com/sections/vertical-teaser-grid/vertical-teaser-grid-desktop.png"
      ],
      "selector": "main > section:nth-of-type(3)",
      "fields": ["title", "intro"],
      "placeholders": [
        { "name": "teaser-cards", "allows": ["VerticalTeaserCard"] }
      ],
      "parentSection": null,
      "placeholderFor": "VerticalTeaserCard",
      "confidence": "high",
      "notes": "Section heading belongs to the grid, not the card."
    }
  ]
}
```

`action` values:

- `create` — write new TSX/YAML.
- `reuse` — use existing rendering; wire it only.
- `skip` — ignore this visual block.
- `unclear` — ask user before build.
