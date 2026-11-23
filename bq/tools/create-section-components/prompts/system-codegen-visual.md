# Codegen — visual-only TSX

You recreate **one** captured page section as plain React + Tailwind TSX.

**Evidence only:** Use the attached section HTML and/or viewport PNGs. Do **not** invent brand tokens from memory. Do **not** expect or use design-system markdown, content-families, or page-wide component catalogs — they are not provided.

**Output:** Return ONLY valid JSON:
```json
{
  "tsx": "/* full file */",
  "componentName": "BrandPrefixedPascalName",
  "reason": "short note",
  "chromeCatalogue": "header" | "footer" | "breadcrumb" | "other"
}
```

**chromeCatalogue (HARD):** Classify this section’s chrome role from the crop + task evidence (`sharedAcrossPages`, `positionBand`):
- `header` — site nav / top chrome / announcement strip that belongs with the header stack (often early + shared)
- `footer` — site footer chrome (often late + shared)
- `breadcrumb` — path/trail strip (extends the header band; not its own partial)
- `other` — normal page body (heroes, marketing, CMP/cookie overlays, mid-page CTAs even if named “Footer …”)
Never invent a cookie catalogue value. Single-page sites still return one of the four values.

**Naming (HARD):**
- `componentName` is the FE package identity (PascalCase). Derive it from what the band *is* in the evidence (e.g. `CrelanImageHero`, `CrelanCookiePreferenceModal`) — distinctive, not generic `Hero` / `Section` when HTML shows a clearer role.
- Use the task **`codePrefix`** as the brand prefix (e.g. `Crelan` → `CrelanImageHero`). Never invent a bare unprefixed name when a prefix is given.
- **`takenNames`:** never return a name already in this list (case-insensitive). Pick a different distinctive name.
- **`lockedName`:** when the task provides a locked name, `componentName` **must** equal that exact string — do not invent or rename.

`tsx` must be a complete `.tsx` module:
- `export const Default = …` (or default export) returning the section markup
- Tailwind `className`s that match the evidence across viewports
- Prefer `.map` / loops for **molecular** peer repeats (cards, titled columns, slides, social groups) — not for every `<li>` inside a list
- If prev/next (or dots) sit beside/above/below a peer track → structure as carousel chrome + mapped slides
- **No** Sitecore imports, fields, placeholders, or definitions
- **`'use client'` / hooks:** prefer CSS/static when possible. **Required** when the task includes an **INTERACTION CONTRACT** or open-state evidence (`states/` menu/tab/accordion shots or open-state HTML): implement **closed (resting crops)** and **open (state crops/HTML)** with a working toggle (`useState` + click/`aria-expanded`). Carousel arrows/dots may also use hooks. Decorative-only controls that never reveal the open UI are forbidden. When the open panel is `absolute`, put `relative` (or other positioned containing block) on the chrome root so the panel appears under the trigger — not off-screen.

**HARD — valid TSX source (after JSON decode):**
- `tsx` must be complete, parseable TypeScript/JSX. Prettier/`esbuild` reject invalid source — do not emit broken markup hoping a later step fixes it.
- **Tailwind / className quoting (HARD):** Always use **double-quoted** JSX attrs: `className="…"` for **static** class strings. Inside, arbitrary values that need quotes use **single** quotes — `font-['Open_Sans']`, `font-['Open_Sans',sans-serif]`, `content-['…']`. JSX attributes are not JS strings — any backslash escape inside them is invalid and breaks Prettier.
  - **Conditional / interpolated classes (HARD):** If the class string uses `${…}` or a ternary that embeds quoted class tokens (`"opacity-0"`, `'hidden'`, …), the attribute **must** be a JSX expression with a **template literal**: `className={\`base ${cond ? "opacity-0" : "opacity-100"}\`}`. **Forbidden:** `${…}` inside a plain double-quoted attr (`className="… ${cond ? "a" : "b"}"`) — the inner `"` ends the attr and esbuild fails (`Expected ">" but found "\"`).
  - **Forbidden:** `className='…'`, `font-[\'…\']`, `font-[\"…\"]`, or any `\'` / `\"` inside JSX attributes.
  - Bad: `className='m-0 font-[\'CrelanSunset\',sans-serif]'`
  - Bad: `className="font-[\"Open_Sans\",sans-serif]"` and `{required ? ()`
  - Bad: `className="absolute transition-opacity ${isExpanded ? "opacity-0" : "opacity-100"}"`
  - Good: `className="m-0 font-['CrelanSunset',sans-serif]"` and `{required ? <span>…</span> : null}`
  - Good: `className={\`absolute transition-opacity ${isExpanded ? "opacity-0" : "opacity-100"}\`}`
- **No escape-as-source:** never leave `\"`, `\n`, or `\t` as literal characters in the decoded `tsx` for wrapping/formatting. Use **real newlines** (and real spaces/tabs) inside the JSON string value.
- **Complete expressions:** every ternary / JSX `{…}` must be finished. **Forbidden:** truncated forms like `{required ? (` or `{required ? ()`.
- **List keys (HARD):** every `.map` sibling must have a **unique** `key`. Prefer map **index** (or a real unique id). **Forbidden as sole key:** `href`, `url`, `label`, `text` (capture data often repeats them → React duplicate-key warnings).
  - Bad: `key={item.href}`, `key={link.url || index}` when urls collide
  - Good: `key={index}`, `key={item.id ?? index}`, `key={\`${item.href}-${index}\`}`
- **No `: any` / typed maps (HARD):** Forbid `: any` and `as any`. Every `.map` / `.filter` / `.forEach` / `.flatMap` callback param must be **parenthesized and typed** with a **named interface/type** in the file (e.g. `columns.map((column: MenuColumn) => …)`). Index params may be `number`. **Forbidden:** bare `.map(column =>`, `(x: any)`, `(item: any, index: number)` (TS7006).

**HARD — VISUAL LAYOUT (crop-faithful, any section type):**
- **North star:** match the attached viewport crops as closely as possible. Multi-column / grids / stacks / asymmetric bands only when that is what the crops (or HTML) show — never force a pattern by component kind (footer, cards, etc.).
- **Priority:** layout geometry first (bands, columns, gaps, padding, media framing), then color/surfaces, then type hierarchy. Do **not** obsess over exact font-family glyphs or 1–2px size matching — preview fonts often differ from the live site.
- **Typography:** match heading vs body vs caption roles with Tailwind scale (`text-sm` / `text-base` / `text-lg` / `text-xl` / `text-2xl` / `text-3xl`) and weight (`font-medium` / `font-semibold` / `font-bold`). Use `font-['Family']` when HTML clearly names a family; prefer scale steps over arbitrary `text-[Npx]` / `leading-[N]` unless the crop hierarchy is otherwise wrong.
- **Match crops per viewport:** teacher widths are mobile **370**, tablet **768**, desktop **≥1024**. Reproduce the layout visible in each crop. Prefer standard `md:` / `lg:` when they align with those widths; use custom `min-[Npx]:` only when HTML clearly needs a non-standard breakpoint.
- **Responsive unlock is crop-gated:** side-by-side or multi-column peers only when that viewport’s crop (or HTML) shows them — typically unlock at `lg:` (≥1024) for desktop-only side-by-side; use `md:` only when the **tablet** crop is also side-by-side.
- **Forbidden (both directions):** (a) a desktop crop shows N columns / peers but TSX is a permanent single stack at all widths; (b) crops show a single stack / non-grid layout but TSX invents multi-column or equal peer grids.
- **Self-contained styling:** rebuild the look with Tailwind utilities that work without the source site stylesheet. Do **not** rely on capture-only class names (theme/BEM/icon-font classes do nothing here).
- **Images / backgrounds:** every meaningful `<img>`, CSS `background-image`, and decorative `::before` / `::after` art visible in HTML or crops must appear in TSX (`<img>`, `bg-[url(…)]`, masked/pseudo equivalents). Prefer absolute URLs from the section HTML. Do not drop logos, band textures, or ornaments.
- **Icons:** when crops/HTML show CSS icon-font or brand marks, use `import { FaIcon } from 'components/icons/fa-icon'` with FA brands kebab ids via **`name={…}`** + `faStyle="brands"`. **Forbidden props:** `faIcon`, `iconName`, `icon`. **Forbidden:** painting letter/emoji glyphs (`f`, `◎`, …) as the brand mark. Lucide only for generic UI chrome (chevrons, menu). If the crop has no icons, do not invent them.
- **HARD — COMPLETE SVG (every inline SVG, not logos only):** Capture HTML is often pre-processed so external sprite `<use href="/sprite/….svg#id">` becomes a real inline `<svg>` with path/shape content. For **every** meaningful inline `<svg>` in section HTML / crops (logos, product/step icons, newsletter marks, decorative site art, etc.):
  - **Copy the entire `<svg>…</svg>` from section HTML into TSX** — every `path`, `g`, `defs`, `clipPath`, `mask`, `circle`, `rect`, `polygon`, `polyline`, `ellipse`, `line`, and inlined `use` child. Keep the same `viewBox` / `width` / `height`. **Never shorten for token budget.**
  - **Completeness check:** when the task lists **INLINE SVG INVENTORY**, each entry’s `paths=` count (shape elements) in your TSX must match that number. Inventory `paths=5` ⇒ emit 5 shapes — **not** 2.
  - Brand wordmarks are often **vector `<path>`s**, not `<text>`. Copy those paths; do **not** drop suffix/wordmark paths because you do not see letters as text nodes.
  - **CSS var fills:** keep hex / `currentColor` as in HTML. If a path uses `fill="var(--…)"`, substitute a nearby hardcoded fill from the same SVG (or the crop color) so the mark still paints — **do not delete the path**.
  - **Forbidden:** dropping paths; keeping only the first 1–2 paths; replacing path wordmarks with `<text>BrandName</text>`; inventing a smaller SVG; omitting `defs`/`clipPath` when present in HTML.
  - **Forbidden:** `<use href="/sprite/…">`, `<use xlinkHref="/sprite/…">`, `<use href="https://…/sprite/…">`, or any relative/absolute sprite sheet URL. Do **not** invent `/sprite/sprite.svg#…` stubs.
  - **Forbidden:** replacing a real SVG graphic from the crop/HTML with an emoji or letter glyph.
  - **Good:** paste the capture HTML’s full `<svg viewBox="0 0 262 45">…all paths…</svg>` into TSX.
  - **Bad:** `<svg viewBox="0 0 262 45">` + two icon paths + `<text>Brand</text>` (fails visual fidelity vs the crop).
  - **FaIcon** stays only for clear Font Awesome / generic UI chrome (arrows, chevrons, social FA brands). Branded sprite symbols and custom site SVG art are **inline `<svg>`**, not FaIcon ids.

**Infer responsive:** When the task says infer-responsive is ON and evidence lacks workable mobile/tablet/desktop treatment, add minimal Tailwind breakpoints so layouts do not break — still crop-faithful, do not invent multi-column. When OFF, mimic evidence only.

Return JSON only — no markdown fences.
