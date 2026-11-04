"use client";

import React, { useId, useState } from "react";
import { useRouter } from "src/i18n/navigation";
import { cn } from "lib/utils";

export interface HeroSearchKind {
  id: string;
  label: string;
}

/**
 * The brand-hub search: a scope dropdown, a question field and suggestion chips.
 * Submitting opens the media library with ?q= and ?kind=, which MediaBrowser reads.
 */
export function HeroSearch({
  prompts,
  kinds,
  placeholder,
  searchLabel,
}: {
  prompts: string[];
  kinds: HeroSearchKind[];
  placeholder: string;
  searchLabel: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState(kinds[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  const go = (query: string, scope = kind) => {
    const params = new URLSearchParams();
    const text = query.trim();
    if (text) params.set("q", text);
    if (scope) params.set("kind", scope);
    const qs = params.toString();
    router.push(qs ? `/media?${qs}` : "/media");
  };

  return (
    <form
      className="hub-search mt-6 max-w-xl"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
    >
      <div className="flex items-stretch overflow-hidden rounded-2xl bg-white shadow-[0_16px_40px_rgba(20,8,40,0.28)] ring-1 ring-white/40 transition motion-safe:duration-200 focus-within:ring-2 focus-within:ring-white">
        <label className="relative flex items-center border-r border-black/10">
          <span className="sr-only">{kinds[0]?.label}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            aria-expanded={open}
            className="cursor-pointer appearance-none bg-transparent py-3.5 ps-4 pe-8 text-sm font-medium text-neutral-800 outline-none"
          >
            {kinds.map((k) => (
              <option key={k.id || "any"} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute inset-e-2 text-xs text-neutral-500">
            ▾
          </span>
        </label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          aria-label={searchLabel}
          className="m-1.5 grid w-11 place-items-center rounded-xl bg-[var(--portal-accent,#3c1f8b)] text-white transition motion-safe:duration-200 hover:brightness-110 motion-safe:active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {prompts.length > 0 && (
        <ul id={listId} className="mt-4 flex flex-wrap gap-2" aria-label={placeholder}>
          {prompts.map((prompt, i) => (
            <li key={prompt} className="hub-chip" style={{ animationDelay: `${120 + i * 70}ms` }}>
              <button
                type="button"
                onClick={() => {
                  setQ(prompt);
                  go(prompt);
                }}
                className={cn(
                  "rounded-full border border-white/25 bg-white/20 px-3 py-1.5 text-left text-[13px] text-white/95 backdrop-blur-sm",
                  "transition motion-safe:duration-200 hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/30",
                )}
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
