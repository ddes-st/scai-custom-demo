/**
 * Cross-definition reuse for platform Link Lists / Icon Link Lists / Image Link Lists.
 *
 * Definitions may seed the same group/link more than once. Emit must reuse the
 * existing CM item (ID + path) when fingerprints match — never create a second sibling.
 *
 * Fingerprints:
 * - path: `{relativeParent}/{childName}` (case-folded) under the site folder
 * - group title: any language Title value (case-folded)
 * - child link: normalized Link.url (raw + pathname for absolute URLs)
 */
import { findItemByPath, listCmChildren } from "./cm-sibling-lookup";
import { readItemFieldValue } from "./authoring-items";

export type LinkListReuseHit = {
  id: string;
  /** Label only — historically a YAML path; now mirrors sitecorePath. */
  yamlPath: string;
  sitecorePath: string;
  parentId: string;
  reason: "path" | "title" | "link-url";
};

export type LinkListReuseKind =
  | "Link Lists"
  | "Icon Link Lists"
  | "Image Link Lists";

type IndexedItem = {
  id: string;
  yamlPath: string;
  sitecorePath: string;
  parentId: string;
  /** Relative path under the folder root, case-folded (e.g. `belangrijke info/faq`). */
  relPathKey: string;
  /** Leaf item name, case-folded. */
  nameKey: string;
  isGroup: boolean;
};

/** Per Sitecore folder root — survives for the generate process. */
const indexesByRoot = new Map<string, LinkListReuseIndex>();

export function clearLinkListReuseIndexes(): void {
  indexesByRoot.clear();
}

export function getLinkListReuseIndex(
  folderSitecorePath: string,
  kind: LinkListReuseKind,
): LinkListReuseIndex {
  const root = String(folderSitecorePath || "")
    .replace(/\\/g, "/")
    .replace(/\/$/, "");
  const key = `${kind}::${root.toLowerCase()}`;
  let idx = indexesByRoot.get(key);
  if (!idx) {
    idx = new LinkListReuseIndex(root, kind);
    indexesByRoot.set(key, idx);
  }
  return idx;
}

export function normalizeLinkListText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Normalize a link URL for fingerprinting. Returns one or more keys
 * (absolute URL + pathname) so `/faq` matches `https://host/faq`.
 */
export function normalizeLinkUrlKeys(raw: string | undefined | null): string[] {
  if (!raw) return [];
  let s = String(raw).trim();
  if (!s) return [];
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (!s) return [];

  const keys = new Set<string>();
  const push = (u: string) => {
    let n = u.trim().toLowerCase();
    if (!n) return;
    if (n.length > 1 && n.endsWith("/")) n = n.slice(0, -1);
    keys.add(n);
  };

  push(s);

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      push(u.pathname + u.search + u.hash);
      push(u.pathname);
    }
  } catch {
    /* ignore invalid URL */
  }

  return [...keys];
}

export function extractUrlFromLinkXml(linkXml: string | undefined): string | undefined {
  if (!linkXml) return undefined;
  const m = linkXml.match(/\burl="([^"]*)"/i);
  return m?.[1];
}

export function extractUrlFromSeedLink(link: unknown): string | undefined {
  if (link == null) return undefined;
  if (typeof link === "string") {
    const t = link.trim();
    if (t.startsWith("<link")) return extractUrlFromLinkXml(t);
    return t;
  }
  if (typeof link === "object" && link !== null && "url" in link) {
    const url = (link as { url?: unknown }).url;
    return typeof url === "string" ? url : undefined;
  }
  return undefined;
}

function relPathKeyFromSitecorePath(
  sitecorePath: string,
  folderSitecorePath: string,
): string {
  const full = sitecorePath.replace(/\\/g, "/");
  const root = folderSitecorePath.replace(/\\/g, "/").replace(/\/$/, "");
  let rel = full;
  if (full.toLowerCase().startsWith(root.toLowerCase() + "/")) {
    rel = full.slice(root.length + 1);
  } else {
    const parts = full.split("/").filter(Boolean);
    const kindIdx = parts.findIndex(
      (p, i) =>
        i > 0 &&
        parts[i - 1]?.toLowerCase() === "data" &&
        /link lists$/i.test(p),
    );
    if (kindIdx >= 0) {
      rel = parts.slice(kindIdx + 1).join("/");
    } else {
      rel = parts[parts.length - 1] || full;
    }
  }
  return normalizeLinkListText(rel.replace(/\\/g, "/"));
}

export class LinkListReuseIndex {
  readonly folderSitecoreRoot: string;
  readonly kind: LinkListReuseKind;
  private readonly byPath = new Map<string, IndexedItem>();
  private readonly byTitle = new Map<string, IndexedItem>();
  private readonly byUrl = new Map<string, IndexedItem>();
  private folderSitecorePath = "";
  private seeded = false;
  private seedPromise: Promise<void> | null = null;

  constructor(folderSitecoreRoot: string, kind: LinkListReuseKind) {
    this.folderSitecoreRoot = folderSitecoreRoot;
    this.kind = kind;
    this.folderSitecorePath = folderSitecoreRoot;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    if (this.seedPromise) {
      await this.seedPromise;
      return;
    }
    this.seedPromise = this.seedFromCm();
    try {
      await this.seedPromise;
    } finally {
      this.seedPromise = null;
    }
  }

  private async seedFromCm(): Promise<void> {
    if (this.seeded) return;
    this.seeded = true;
    const rootPath = this.folderSitecoreRoot;
    if (!rootPath) return;

    try {
      const root = await findItemByPath({ path: rootPath });
      if (!root?.itemId) return;
      this.folderSitecorePath = root.path || rootPath;

      const walk = async (
        parentId: string,
        parentPath: string,
        depth: number,
      ): Promise<void> => {
        const children = await listCmChildren({ parentId });
        for (const child of children) {
          const childPath =
            child.path || `${parentPath.replace(/\/$/, "")}/${child.name}`;
          const isGroup = depth === 0;
          const titles: string[] = [];
          const urls: string[] = [];
          if (isGroup) {
            const title = await readItemFieldValue({
              path: childPath,
              fieldName: "Title",
              language: "en",
            });
            if (title?.trim()) titles.push(title);
          } else {
            const linkXml = await readItemFieldValue({
              path: childPath,
              fieldName: "Link",
              language: "en",
            });
            const url = extractUrlFromLinkXml(linkXml);
            if (url) urls.push(url);
          }

          const relPathKey = relPathKeyFromSitecorePath(
            childPath,
            this.folderSitecorePath,
          );
          const nameKey = normalizeLinkListText(
            relPathKey.includes("/")
              ? relPathKey.slice(relPathKey.lastIndexOf("/") + 1)
              : relPathKey,
          );
          const item: IndexedItem = {
            id: child.itemId.toLowerCase(),
            yamlPath: childPath,
            sitecorePath: childPath,
            parentId: parentId.toLowerCase(),
            relPathKey,
            nameKey,
            isGroup,
          };
          this.registerItem(item, { titles, urls });
          await walk(child.itemId, childPath, depth + 1);
        }
      };

      await walk(root.itemId, this.folderSitecorePath, 0);
    } catch {
      /* CM unavailable — in-run registerEmitted still indexes this process */
    }
  }

  private registerItem(
    item: IndexedItem,
    extra: { titles: string[]; urls: string[] },
  ): void {
    const pathKey = normalizeLinkListText(item.relPathKey);
    if (pathKey && !this.byPath.has(pathKey)) {
      this.byPath.set(pathKey, item);
    }
    if (item.isGroup && item.nameKey && !this.byPath.has(item.nameKey)) {
      this.byPath.set(item.nameKey, item);
    }
    for (const title of extra.titles) {
      const key = normalizeLinkListText(title);
      if (key && !this.byTitle.has(key)) {
        this.byTitle.set(key, item);
      }
    }
    const parentRelKey = item.relPathKey.includes("/")
      ? normalizeLinkListText(
          item.relPathKey.slice(0, item.relPathKey.lastIndexOf("/")),
        )
      : "";
    for (const url of extra.urls) {
      for (const urlKey of normalizeLinkUrlKeys(url)) {
        // Parent-scoped first so the same URL under Support vs Footer cannot collide.
        const scoped = `${parentRelKey}::${item.nameKey}::${urlKey}`;
        if (parentRelKey && !this.byUrl.has(scoped)) {
          this.byUrl.set(scoped, item);
        }
        const compound = `${item.nameKey}::${urlKey}`;
        if (!this.byUrl.has(compound)) {
          this.byUrl.set(compound, item);
        }
      }
    }
  }

  /**
   * Resolve a link-list group: **name/path first**, then Title only when the
   * hit’s leaf name matches the requested name.
   */
  async resolveGroup(options: {
    name: string;
    title?: string;
    parentSitecorePath: string;
  }): Promise<LinkListReuseHit | undefined> {
    await this.ensureSeeded();
    const nameKey = normalizeLinkListText(options.name);
    const byPath = this.byPath.get(nameKey);
    if (byPath?.isGroup) {
      return this.toHit(byPath, "path");
    }

    const titles = [options.title, options.name].filter(
      (t): t is string => Boolean(t && String(t).trim()),
    );
    for (const title of titles) {
      const hit = this.byTitle.get(normalizeLinkListText(title));
      if (hit?.isGroup && hit.nameKey === nameKey) {
        return this.toHit(hit, "title");
      }
    }
    return undefined;
  }

  /**
   * YAML orphan prune retired — Sites API / Authoring own CM identity.
   * Kept as a no-op so call sites do not need a mass rename.
   */
  pruneOrphanChildren(_options: {
    childDir: string;
    keepYamlPaths: Iterable<string>;
    label?: string;
  }): number {
    return 0;
  }

  async resolveChild(options: {
    name: string;
    linkUrl?: string;
    parentSitecorePath: string;
  }): Promise<LinkListReuseHit | undefined> {
    await this.ensureSeeded();
    const parentRel = relPathKeyFromSitecorePath(
      options.parentSitecorePath,
      this.folderSitecorePath ||
        options.parentSitecorePath.replace(/\/[^/]+$/, ""),
    );
    const childPathKey = normalizeLinkListText(
      `${parentRel}/${options.name}`.replace(/^\//, ""),
    );
    const byPath = this.byPath.get(childPathKey);
    if (byPath && !byPath.isGroup) {
      return this.toHit(byPath, "path");
    }

    const nameKey = normalizeLinkListText(options.name);
    const parentNorm = String(options.parentSitecorePath || "")
      .replace(/\\/g, "/")
      .replace(/\/$/, "")
      .toLowerCase();
    const hitUnderParent = (hit: IndexedItem): boolean => {
      const hitPath = String(hit.sitecorePath || "")
        .replace(/\\/g, "/")
        .replace(/\/$/, "")
        .toLowerCase();
      const hitParent = hitPath.includes("/")
        ? hitPath.slice(0, hitPath.lastIndexOf("/"))
        : "";
      return Boolean(parentNorm) && hitParent === parentNorm;
    };
    for (const urlKey of normalizeLinkUrlKeys(options.linkUrl)) {
      const scoped = this.byUrl.get(`${parentRel}::${nameKey}::${urlKey}`);
      if (scoped && !scoped.isGroup && hitUnderParent(scoped)) {
        return this.toHit(scoped, "link-url");
      }
      const hit = this.byUrl.get(`${nameKey}::${urlKey}`);
      if (hit && !hit.isGroup && hitUnderParent(hit)) {
        return this.toHit(hit, "link-url");
      }
    }
    return undefined;
  }

  async registerEmitted(options: {
    id: string;
    yamlPath: string;
    sitecorePath: string;
    parentId: string;
    isGroup: boolean;
    titles?: string[];
    linkUrls?: string[];
  }): Promise<void> {
    await this.ensureSeeded();
    if (!this.folderSitecorePath && options.sitecorePath) {
      const m = options.sitecorePath.match(
        /^(.*\/Data\/(?:Icon |Image )?Link Lists)(?:\/|$)/i,
      );
      if (m?.[1]) this.folderSitecorePath = m[1];
    }
    const relPathKey = relPathKeyFromSitecorePath(
      options.sitecorePath,
      this.folderSitecorePath ||
        options.sitecorePath.replace(/\/[^/]+$/, ""),
    );
    const nameKey = normalizeLinkListText(
      relPathKey.includes("/")
        ? relPathKey.slice(relPathKey.lastIndexOf("/") + 1)
        : relPathKey,
    );
    const item: IndexedItem = {
      id: options.id.toLowerCase(),
      yamlPath: options.yamlPath,
      sitecorePath: options.sitecorePath,
      parentId: options.parentId.toLowerCase(),
      relPathKey,
      nameKey,
      isGroup: options.isGroup,
    };
    this.registerItem(item, {
      titles: options.titles ?? [],
      urls: options.linkUrls ?? [],
    });
  }

  private toHit(
    item: IndexedItem,
    reason: LinkListReuseHit["reason"],
  ): LinkListReuseHit {
    return {
      id: item.id,
      yamlPath: item.yamlPath,
      sitecorePath: item.sitecorePath,
      parentId: item.parentId,
      reason,
    };
  }
}
