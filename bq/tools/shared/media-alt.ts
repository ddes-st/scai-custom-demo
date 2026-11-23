/**
 * Resolve Image Alt for media emit: seed first, then in-run cache, then Azure vision.
 */
import { createHash } from "node:crypto";
import {
  getActiveAiLedger,
  getMediaAltCache,
} from "./apply-context";

export type MediaAltSource = "seed" | "cache" | "media-yaml" | "openai" | "skip";

export type ResolveMediaAltResult = {
  alt: string;
  source: MediaAltSource;
};

/** Stable key so the same CDN asset (desktop vs mobile crops stay distinct via cw/ch). */
export function stableMediaImageKey(opts: {
  url?: string;
  bytes?: Buffer;
}): string {
  if (opts.url?.trim()) {
    try {
      const raw = opts.url.trim().startsWith("//")
        ? `https:${opts.url.trim()}`
        : opts.url.trim();
      const u = new URL(raw);
      for (const key of [...u.searchParams.keys()]) {
        if (/^(savif|swebp|hash|rev|la)$/i.test(key)) {
          u.searchParams.delete(key);
        }
      }
      u.hash = "";
      return `url:${decodeURIComponent(u.pathname).toLowerCase()}?${u.searchParams.toString()}`;
    } catch {
      return `url:${opts.url.trim()}`;
    }
  }
  if (opts.bytes?.length) {
    return `bytes:${createHash("sha256").update(opts.bytes).digest("hex").slice(0, 24)}`;
  }
  return "unknown";
}

type AiLedgerLike = {
  record: (entry: Record<string, unknown>) => unknown;
};

async function generateAltWithOpenAi(
  bytes: Buffer,
  mime: string,
  ledger: AiLedgerLike | undefined,
  meta: { itemName?: string; imageKey: string },
): Promise<string | null> {
  const azure = await import(
    "../capture/lib/design-system/ai/azure-chat.mjs"
  );
  const { azureChatCompletion, imageContentPart } = azure;

  // Vision APIs accept jpeg/png/webp/gif — convert odd formats via sharp when needed
  let visionBytes = bytes;
  let visionMime = mime;
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(mime)) {
    try {
      const sharp = (await import("sharp")).default;
      visionBytes = await sharp(bytes).jpeg({ quality: 85 }).toBuffer();
      visionMime = "image/jpeg";
    } catch {
      /* try original bytes */
    }
  }

  const result = await azureChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You write concise accessibility alt text for website images. " +
          "Reply with ONLY the alt text (one short sentence, no quotes, no markdown). " +
          "Describe what is visible; do not invent brand slogans.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image for an alt attribute:" },
          imageContentPart(visionBytes, visionMime),
        ],
      },
    ],
  });

  if (!result) {
    ledger?.record({
      purpose: "media-alt",
      componentName: meta.itemName || null,
      ok: false,
      skipReason: "null-result",
    });
    return null;
  }

  ledger?.record({
    purpose: "media-alt",
    componentName: meta.itemName || null,
    ok: Boolean(result.ok),
    model: result.model,
    usage: result.usage,
    costEstimate: "costEstimate" in result ? result.costEstimate : undefined,
    skipReason: result.skipReason,
  });

  if (!result.ok || !("content" in result) || !result.content?.trim()) {
    return null;
  }
  return String(result.content)
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/\s+/g, " ")
    .slice(0, 250);
}

/**
 * @param opts.existingAlt — Alt already on media YAML (reuse, no OpenAI)
 */
export async function resolveMediaAlt(opts: {
  alt?: string;
  url?: string;
  bytes: Buffer;
  mime?: string;
  itemName?: string;
  existingAlt?: string;
  /** Skip OpenAI (still uses seed/cache). */
  skipOpenAi?: boolean;
}): Promise<ResolveMediaAltResult> {
  const seed = opts.alt?.trim();
  if (seed) return { alt: seed, source: "seed" };

  const existing = opts.existingAlt?.trim();
  if (existing) return { alt: existing, source: "media-yaml" };

  const imageKey = stableMediaImageKey({ url: opts.url, bytes: opts.bytes });
  const cache = getMediaAltCache();
  const cached = cache.get(imageKey);
  if (cached?.trim()) {
    getActiveAiLedger()?.record({
      purpose: "media-alt",
      componentName: opts.itemName || null,
      ok: true,
      skipReason: `cache hit (${imageKey.slice(0, 64)})`,
    });
    return { alt: cached.trim(), source: "cache" };
  }

  if (opts.skipOpenAi) {
    return { alt: "", source: "skip" };
  }

  const ledger = getActiveAiLedger() as AiLedgerLike | undefined;
  const generated = await generateAltWithOpenAi(
    opts.bytes,
    opts.mime || "image/jpeg",
    ledger,
    { itemName: opts.itemName, imageKey },
  );

  if (generated?.trim()) {
    cache.set(imageKey, generated.trim());
    return { alt: generated.trim(), source: "openai" };
  }

  return { alt: "", source: "skip" };
}
