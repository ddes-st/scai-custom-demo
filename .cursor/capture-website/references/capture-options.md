# Capture options

Canonical docs: `bq/tools/capture/references/capture-options.md`

From `bq/`:

```bash
npm run capture:webpage -- --urls "https://example.com" --manifest
npm run capture:merge-sections -- --url "https://example.com/" --use-ai
```

Webpage capture always AI-enriches `{page}/sections/` in place. Merge `--use-ai` clusters into `{project}/ai-sections/`.

Default out: `<repo>/.bq/captures`
