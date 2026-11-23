# Rendering fields JSON contract

Use this shape when preparing generator input for a rendering:

```json
{
  "componentName": "HeroBanner",
  "templateName": "Hero Banner",
  "fields": [
    { "name": "Title", "type": "Single-Line Text" },
    { "name": "Body", "type": "Rich Text" },
    { "name": "Image", "type": "Image" },
    { "name": "PrimaryLink", "type": "General Link" }
  ],
  "parameters": [
    { "name": "Styles", "type": "Droplink" }
  ],
  "placeholders": []
}
```
