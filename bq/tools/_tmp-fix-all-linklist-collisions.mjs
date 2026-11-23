import fs from "node:fs";
import path from "node:path";
const REPO = path.resolve("..");
const u = JSON.parse(fs.readFileSync(path.join(REPO, ".sitecore/user.json"), "utf8"));
const ep = u.endpoints["jbe-showcase"];
const host = (ep.host || "").replace(/\/$/, "");
let token = "";
for (const v of Object.values(u.endpoints || {})) {
  token = v.accessToken || v.variables?.accessToken || "";
  if (token) break;
}
async function gql(query, variables) {
  const res = await fetch(host + "/sitecore/api/authoring/graphql/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
function formatGuid(id) {
  const hex = String(id).replace(/[{}-]/g, "").toLowerCase();
  return `{${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}}`;
}
const ROOT = "/sitecore/content/axa/axa-be/Data/Link Lists";
const diskRoot = path.resolve(
  REPO,
  "authoring/items/bq-demo/sai/sites/content/axa/axa-be/Data/Link Lists",
);

/** nameLower -> preferred item id hex from disk YAML */
function loadKeepIdsForGroup(groupName) {
  const map = new Map();
  const dir = path.join(diskRoot, groupName);
  // Windows case-insensitive: try exact
  let actual = dir;
  if (!fs.existsSync(actual)) {
    try {
      const match = fs.readdirSync(diskRoot).find(
        (d) => d.toLowerCase() === groupName.toLowerCase(),
      );
      if (match) actual = path.join(diskRoot, match);
    } catch { /* ignore */ }
  }
  if (!fs.existsSync(actual) || !fs.statSync(actual).isDirectory()) return map;
  for (const f of fs.readdirSync(actual)) {
    if (!f.endsWith(".yml")) continue;
    const text = fs.readFileSync(path.join(actual, f), "utf8");
    const id = text.match(/^ID:\s*"([^"]+)"/m)?.[1]?.replace(/-/g, "").toLowerCase();
    if (id) map.set(f.replace(/\.yml$/i, "").toLowerCase(), id);
  }
  return map;
}

const root = await gql(
  `query($path: String!) {
    item(where: { path: $path, database: "master" }) {
      children { nodes { itemId name path } }
    }
  }`,
  { path: ROOT },
);
const groups = root?.data?.item?.children?.nodes || [];
console.log("groups", groups.length);

let renamed = 0;
for (const group of groups) {
  const keepMap = loadKeepIdsForGroup(group.name);
  const kids = await gql(
    `query($path: String!) {
      item(where: { path: $path, database: "master" }) {
        children { nodes { itemId name } }
      }
    }`,
    { path: group.path },
  );
  const nodes = kids?.data?.item?.children?.nodes || [];
  const byName = new Map();
  for (const n of nodes) {
    const key = n.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(n);
  }
  for (const [name, groupItems] of byName) {
    if (groupItems.length < 2) continue;
    console.log(`collision under ${group.name}: ${name} x${groupItems.length}`);
    const keepId = keepMap.get(name);
    let keep = keepId
      ? groupItems.find(
          (g) => g.itemId.replace(/[{}-]/g, "").toLowerCase() === keepId,
        )
      : null;
    if (!keep) keep = groupItems[0];
    for (const g of groupItems) {
      if (g.itemId === keep.itemId) continue;
      const newName = `${g.name}-orphan-${g.itemId.slice(0, 8)}`;
      const ren = await gql(
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
      if (ren.errors) {
        console.log("  FAIL", g.itemId, JSON.stringify(ren.errors));
      } else {
        console.log("  renamed", g.itemId, "->", newName);
        renamed += 1;
      }
    }
  }
}
console.log("done renamed=", renamed);
