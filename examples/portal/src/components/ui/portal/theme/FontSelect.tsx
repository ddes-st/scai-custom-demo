"use client";
/**
 * A Google Fonts drop-down: category chips, a filter box and a <select> of every matching
 * family, A to Z, with the chosen family loaded into this document so the sample line renders
 * in it. A typed name also finds families of the other categories (listed in their own group),
 * so "Cairo" turns up while the Serif chip is on. "" = inherit (Content Hub / default).
 */
import React, { useEffect, useMemo, useState } from "react";
import { FONT_CATEGORY_LABELS, GOOGLE_FONT_CATALOG, type FontCategory } from "src/lib/portal/google-fonts";
import { ensureGoogleFont } from "src/lib/portal/theme-bus";

const CATEGORIES: Array<FontCategory | "all"> = ["all", "sans", "serif", "display", "handwriting", "mono"];
const byName = (a: { family: string }, b: { family: string }) => a.family.localeCompare(b.family);

export function FontSelect({ label, value, inherited, defaultCategory, onChange }: {
  label: string; value: string; inherited: string; defaultCategory: FontCategory; onChange: (family: string) => void;
}) {
  const [category, setCategory] = useState<FontCategory | "all">(defaultCategory);
  const [filter, setFilter] = useState("");
  const shown = value || inherited;

  useEffect(() => { if (shown) ensureGoogleFont(document, shown); }, [shown]);

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matches = GOOGLE_FONT_CATALOG.filter((f) => !q || f.family.toLowerCase().includes(q));
    const inCategory = matches.filter((f) => category === "all" || f.category === category).sort(byName);
    // a typed name searches every category; those matches get their own group
    const elsewhere = q && category !== "all" ? matches.filter((f) => f.category !== category).sort(byName) : [];
    // the chosen family stays selectable even when the filter hides it (or the catalog lacks it)
    const current = value && !inCategory.some((f) => f.family === value) && !elsewhere.some((f) => f.family === value) ? value : "";
    return { inCategory, elsewhere, current };
  }, [category, filter, value]);

  return (
    <div className="te-font">
      <div className="te-row-head">
        <label>{label}</label>
        <span className="te-inherit">{value ? <button type="button" className="link" onClick={() => onChange("")}>inherit</button> : `inherits ${inherited || "default"}`}</span>
      </div>
      <div className="te-chips">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={c === category ? "on" : ""} onClick={() => setCategory(c)}>{c === "all" ? "All" : FONT_CATEGORY_LABELS[c]}</button>
        ))}
      </div>
      <div className="te-font-pick">
        <input type="search" placeholder="Filter fonts…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={`Filter ${label} fonts`} />
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          <option value="">— inherit ({inherited || "default"}) —</option>
          {options.current && <option value={options.current}>{options.current}</option>}
          {options.elsewhere.length > 0 ? (
            <>
              <optgroup label={FONT_CATEGORY_LABELS[category as FontCategory]}>{options.inCategory.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}</optgroup>
              <optgroup label="Other categories">{options.elsewhere.map((f) => <option key={f.family} value={f.family}>{f.family} ({FONT_CATEGORY_LABELS[f.category]})</option>)}</optgroup>
            </>
          ) : options.inCategory.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
        </select>
      </div>
      <div className="te-font-sample" style={{ fontFamily: shown ? `"${shown}", sans-serif` : undefined }}>
        {shown || "Default"} — The quick brown fox jumps over the lazy dog
        <span className="te-more"> · {options.inCategory.length + options.elsewhere.length} fonts</span>
      </div>
    </div>
  );
}
