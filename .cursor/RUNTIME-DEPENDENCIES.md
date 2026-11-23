# Runtime dependency layout

```txt
<repo>/
  .bq/
    definitions/
      definitions-generate.log
      cache/                  # translations + other generate temps
    captures/
      {domain}/…              # e.g. www-sitecore-net (+ capture.log)
  bq/
    package.json              # playwright is a devDependency
    node_modules/
    tools/capture/
```

Setup:

```bash
cd bq
npm install
npm run setup:playwright
```

Run:

```bash
cd bq
npm run capture:webpage -- --urls "https://example.com" --manifest
npm run definitions:generate
```
