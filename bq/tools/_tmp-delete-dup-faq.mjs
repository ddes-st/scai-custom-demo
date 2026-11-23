/**
 * One-shot CM cleanup: uniquify duplicate sibling names under site Link Lists.
 *
 * Prefer keeping IDs that match on-disk Belangrijke info / group YAML.
 * Duplicates are renamed to `{Name}-orphan-{id8}` (delete is unreliable here —
 * deleteItem can reconstitute the original name).
 *
 * Usage: SITECORE_ENV=jbe-showcase node tools/_tmp-delete-dup-faq.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEEP_FAQ_ID = "c6d5868a59b35cb48a1255ec90f954c0";
const LINK_LISTS_ROOT =
  "/sitecore/content/axa/axa-be/Data/Link Lists";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function loadUserJson() {
  const candidates = [
    path.join(REPO_ROOT, ".sitecore", "user.json"),
    path.join(REPO_ROOT, "bq", ".sitecore", "user.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  throw new Error(
    "No .sitecore/user.json found — run `dotnet sitecore login` first",
  );
}

function resolveAuth(user) {
  const preferred = process.env.SITECORE_ENV || user.defaultEnvironment || "";
  const endpoints = user.endpoints || {};
  const pickName = () => {
    if (preferred && endpoints[preferred]) return preferred;
    for (const [name, ep] of Object.entries(endpoints)) {
      const host = String(ep.host || ep.variables?.host || "");
      if (
        /sitecorecloud\.io/i.test(host) &&
        !/xmclouddeploy-api/i.test(host)
      ) {
        return name;
      }
    }
    return Object.keys(endpoints)[0];
  };
  const envName = pickName();
  const ep = endpoints[envName];
  if (!ep) throw new Error(`No Sitecore endpoint "${envName}"`);
  const host = (ep.host || ep.variables?.host || "").replace(/\/$/, "");
  let token = ep.accessToken || ep.variables?.accessToken || "";
  if (!token && ep.ref) {
    const refKey =
      Object.keys(endpoints).find(
        (k) => k.toLowerCase() === String(ep.ref).toLowerCase(),
      ) || ep.ref;
    const ref = endpoints[refKey];
    if (ref) token = ref.accessToken || ref.variables?.accessToken || "";
  }
  if (!token) {
    for (const other of Object.values(endpoints)) {
      token = other.accessToken || other.variables?.accessToken || "";
      if (token) break;
    }
  }
  if (!host || !token) {
    throw new Error(`Endpoint "${envName}" missing host or accessToken`);
  }
  console.log(`[cm-cleanup] Using environment "${envName}" host=${host}`);
  return { host, token };
}

async function gql(host, token, query, variables) {
  const res = await fetch(`${host}/sitecore/api/authoring/graphql/v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(
      json.errors?.map((e) => e.message).join("; ") ||
        `GraphQL ${res.status}`,
    );
  }
  return json.data;
}

function formatGuid(id) {
  const hex = String(id)
    .replace(/[{}-]/g, "")
    .toLowerCase();
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

function loadKeepIdsForGroup(groupName) {
  const map = new Map();
  if (groupName.toLowerCase() === "belangrijke info") {
    map.set("faq", KEEP_FAQ_ID);
  }
  const diskRoot = path.join(
    REPO_ROOT,
    "authoring/items/bq-demo/sai/sites/content/axa/axa-be/Data/Link Lists",
  );
  let dir = path.join(diskRoot, groupName);
  if (!fs.existsSync(dir)) {
    const match = fs.existsSync(diskRoot)
      ? fs
          .readdirSync(diskRoot)
          .find((d) => d.toLowerCase() === groupName.toLowerCase())
      : undefined;
    if (match) dir = path.join(diskRoot, match);
  }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return map;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".yml")) continue;
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const id = text
      .match(/^ID:\s*"([^"]+)"/m)?.[1]
      ?.replace(/-/g, "")
      .toLowerCase();
    if (id) map.set(f.replace(/\.yml$/i, "").toLowerCase(), id);
  }
  return map;
}

async function main() {
  const { host, token } = resolveAuth(loadUserJson());
  const root = await gql(
    host,
    token,
    `query($path: String!) {
      item(where: { path: $path, database: "master" }) {
        children { nodes { itemId name path } }
      }
    }`,
    { path: LINK_LISTS_ROOT },
  );
  const groups = root?.item?.children?.nodes || [];
  let renamed = 0;
  for (const group of groups) {
    const keepMap = loadKeepIdsForGroup(group.name);
    const kids = await gql(
      host,
      token,
      `query($path: String!) {
        item(where: { path: $path, database: "master" }) {
          children { nodes { itemId name } }
        }
      }`,
      { path: group.path },
    );
    const nodes = kids?.item?.children?.nodes || [];
    const byName = new Map();
    for (const n of nodes) {
      const key = n.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(n);
    }
    for (const [name, items] of byName) {
      if (items.length < 2) continue;
      console.log(`[cm-cleanup] collision under ${group.name}: ${name} x${items.length}`);
      const keepId = keepMap.get(name);
      let keep = keepId
        ? items.find(
            (g) =>
              g.itemId.replace(/[{}-]/g, "").toLowerCase() === keepId,
          )
        : null;
      if (!keep) keep = items[0];
      for (const g of items) {
        if (g.itemId === keep.itemId) {
          console.log(`  keep ${g.name} ${g.itemId}`);
          continue;
        }
        const newName = `${g.name}-orphan-${g.itemId.slice(0, 8)}`;
        await gql(
          host,
          token,
          `mutation($input: RenameItemInput!) {
            renameItem(input: $input) { item { itemId name } }
          }`,
          {
            input: {
              itemId: formatGuid(g.itemId),
              newName,
              database: "master",
            },
          },
        );
        console.log(`  renamed ${g.itemId} -> ${newName}`);
        renamed += 1;
      }
    }
  }
  console.log(`[cm-cleanup] Done. renamed=${renamed}`);
}

main().catch((err) => {
  console.error("[cm-cleanup] FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
