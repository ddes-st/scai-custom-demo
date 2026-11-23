/**
 * One-shot durable fix: move Card Grid/Data orphan OUT of the serialized
 * templates tree so ser push stops reconstituting Name=Data after a failed delete.
 *
 * Keeps local YAML ID 1399bc0c-… as the only Data under Card Grid.
 *
 * Usage (from bq/):
 *   BQ_SITECORE_ENDPOINT=bqAuthoring node tools/_tmp-delete-cardgrid-data-orphan.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const KEEP_HEX = "1399bc0cbf7653088395e0b262bc5f79";
const ORPHAN_HEX = "ec709ddf28945f35a670e191377b9a73";
const PARENT_PATH =
  "/sitecore/templates/Project/sitecore/SitecoreCardGrid/Card Grid";
/** Outside BQ module include (`/sitecore/templates/Project`). */
const QUARANTINE_PARENT = "/sitecore/system";
const QUARANTINE_NAME = "BQ-orphan-CardGrid-Data-ec709ddf";

function idHex(id) {
  return String(id).replace(/[{}-]/g, "").toLowerCase();
}

function formatGuid(id) {
  const h = idHex(id);
  return `{${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}}`;
}

function loadUserJson() {
  for (const p of [
    path.join(REPO_ROOT, ".sitecore", "user.json"),
    path.join(REPO_ROOT, "bq", ".sitecore", "user.json"),
  ]) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  throw new Error("No .sitecore/user.json — run dotnet sitecore login first");
}

function resolveAuth(user) {
  const preferred =
    process.env.BQ_SITECORE_ENDPOINT ||
    process.env.SITECORE_ENV ||
    user.defaultEnvironment ||
    "";
  const endpoints = user.endpoints || {};
  const envName =
    (preferred && endpoints[preferred] && preferred) ||
    Object.keys(endpoints).find((k) => {
      const ep = endpoints[k];
      const host = String(ep?.host || ep?.variables?.host || "");
      return /sitecorecloud\.io/i.test(host) && !/xmclouddeploy-api/i.test(host);
    }) ||
    Object.keys(endpoints)[0];
  const ep = endpoints[envName];
  if (!ep) throw new Error(`No endpoint "${envName}"`);
  const host = String(ep.host || ep.variables?.host || "").replace(/\/$/, "");
  let token = ep.accessToken || ep.variables?.accessToken || "";
  if (!token && ep.ref) {
    const refKey =
      Object.keys(endpoints).find(
        (k) => k.toLowerCase() === String(ep.ref).toLowerCase(),
      ) || ep.ref;
    const ref = endpoints[refKey];
    token = ref?.accessToken || ref?.variables?.accessToken || "";
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
  console.log(`[cm-cleanup] Using "${envName}" host=${host}`);
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
      json.errors?.map((e) => e.message).join("; ") || `GraphQL ${res.status}`,
    );
  }
  return json.data;
}

async function listChildren(host, token, parentPath) {
  const data = await gql(
    host,
    token,
    `query($path: String!) {
      item(where: { path: $path, database: "master" }) {
        itemId
        children { nodes { itemId name path } }
      }
    }`,
    { path: parentPath },
  );
  return { parentId: data?.item?.itemId, kids: data?.item?.children?.nodes || [] };
}

async function main() {
  const { host, token } = resolveAuth(loadUserJson());

  const { kids } = await listChildren(host, token, PARENT_PATH);
  console.log(
    "[cm-cleanup] Card Grid before:",
    kids.map((k) => `${k.name} ${idHex(k.itemId)}`).join(" | "),
  );

  const orphan =
    kids.find((k) => idHex(k.itemId) === ORPHAN_HEX) ||
    kids.find(
      (k) =>
        String(k.name || "").toLowerCase() === "data" &&
        idHex(k.itemId) !== KEEP_HEX,
    );

  if (!orphan) {
    console.log("[cm-cleanup] No orphan under Card Grid — already clean.");
  } else {
    // Rename first so parent+name path is unique during move.
    const renameTo = `Data-orphan-${idHex(orphan.itemId).slice(0, 8)}`;
    if (String(orphan.name) !== renameTo) {
      await gql(
        host,
        token,
        `mutation($input: RenameItemInput!) {
          renameItem(input: $input) { item { itemId name path } }
        }`,
        {
          input: {
            itemId: formatGuid(orphan.itemId),
            newName: renameTo,
            database: "master",
          },
        },
      );
      console.log(`[cm-cleanup] renamed → ${renameTo}`);
    }

    const quarantine = await gql(
      host,
      token,
      `query($path: String!) {
        item(where: { path: $path, database: "master" }) { itemId name path }
      }`,
      { path: QUARANTINE_PARENT },
    );
    const destParentId = quarantine?.item?.itemId;
    if (!destParentId) {
      throw new Error(`Quarantine parent missing: ${QUARANTINE_PARENT}`);
    }

    // Move out of /sitecore/templates/Project so ser push ignores it.
    try {
      const moved = await gql(
        host,
        token,
        `mutation($input: MoveItemInput!) {
          moveItem(input: $input) { item { itemId name path } }
        }`,
        {
          input: {
            itemId: formatGuid(orphan.itemId),
            targetParentId: formatGuid(destParentId),
            database: "master",
          },
        },
      );
      console.log("[cm-cleanup] moved →", JSON.stringify(moved?.moveItem?.item));
    } catch (err) {
      console.warn(
        "[cm-cleanup] moveItem failed, trying rename-only durable name under Card Grid:",
        err instanceof Error ? err.message.slice(0, 300) : err,
      );
    }

    // Ensure final name under new parent (or still under Card Grid if move failed).
    try {
      await gql(
        host,
        token,
        `mutation($input: RenameItemInput!) {
          renameItem(input: $input) { item { itemId name path } }
        }`,
        {
          input: {
            itemId: formatGuid(orphan.itemId),
            newName: QUARANTINE_NAME,
            database: "master",
          },
        },
      );
      console.log(`[cm-cleanup] final name → ${QUARANTINE_NAME}`);
    } catch (err) {
      console.warn(
        "[cm-cleanup] final rename failed:",
        err instanceof Error ? err.message.slice(0, 200) : err,
      );
    }
  }

  const after = await listChildren(host, token, PARENT_PATH);
  console.log(
    "[cm-cleanup] Card Grid after:",
    after.kids.map((k) => `${k.name} ${idHex(k.itemId)}`).join(" | "),
  );

  const dataNamed = after.kids.filter(
    (k) => String(k.name || "").toLowerCase() === "data",
  );
  if (dataNamed.length !== 1 || idHex(dataNamed[0].itemId) !== KEEP_HEX) {
    throw new Error(
      `Expected single Data=${KEEP_HEX}, got: ` +
        dataNamed.map((k) => `${k.name}/${idHex(k.itemId)}`).join(", "),
    );
  }

  // Confirm orphan is gone from Card Grid
  if (after.kids.some((k) => idHex(k.itemId) === ORPHAN_HEX)) {
    throw new Error("Orphan still under Card Grid after move/rename");
  }

  console.log("[cm-cleanup] Done — orphan removed from Card Grid.");
}

main().catch((err) => {
  console.error(
    "[cm-cleanup] FAILED:",
    err instanceof Error ? err.message : err,
  );
  process.exitCode = 1;
});
