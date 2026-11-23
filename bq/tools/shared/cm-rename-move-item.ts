/**
 * Rename / move CM items via Authoring GraphQL (`renameItem` / `moveItem`).
 * Used on --force component rename to preserve GUIDs while updating Path leaves.
 */
import {
  formatAuthoringItemId,
  resolveAuthoringGraphqlAuth,
} from "./cm-delete-item";

export const CM_RENAME_VIA_AUTHORING_API =
  "CM rename via Authoring API";
export const CM_MOVE_VIA_AUTHORING_API = "CM move via Authoring API";

export type CmRenameMoveResult = {
  itemId: string;
  ok: boolean;
  error?: string;
  path?: string;
  name?: string;
};

async function authoringGql(
  host: string,
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(
    `${host.replace(/\/$/, "")}/sitecore/api/authoring/graphql/v1`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || json.errors?.length) {
    const msg =
      json.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data || {};
}

/**
 * Rename a CM item (Path leaf) while keeping the same GUID.
 */
export async function renameCmItem(options: {
  itemId: string;
  newName: string;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
}): Promise<CmRenameMoveResult> {
  const braced = formatAuthoringItemId(options.itemId);
  const newName = String(options.newName || "").trim();
  if (!newName) {
    return { itemId: braced, ok: false, error: "newName required" };
  }
  try {
    const auth =
      options.auth ||
      (await resolveAuthoringGraphqlAuth({
        endpointName: options.endpointName,
      }));
    const data = await authoringGql(
      auth.host,
      auth.token,
      `mutation($input: RenameItemInput!) {
          renameItem(input: $input) {
            item { itemId name path }
          }
        }`,
      {
        input: {
          itemId: braced,
          newName,
          database: "master",
        },
      },
      options.fetchImpl,
    );
    const payload = data.renameItem as
      | { item?: { itemId?: string; name?: string; path?: string } }
      | undefined;
    return {
      itemId: braced,
      ok: true,
      name: payload?.item?.name,
      path: payload?.item?.path,
    };
  } catch (err) {
    return {
      itemId: braced,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** @deprecated Prefer {@link renameCmItem}. */
export const renameCmItemById = renameCmItem;

/**
 * Move a CM item under a new parent (keeps GUID).
 */
export async function moveCmItem(options: {
  itemId: string;
  targetParentId: string;
  endpointName?: string;
  auth?: { host: string; token: string };
  fetchImpl?: typeof fetch;
}): Promise<CmRenameMoveResult> {
  const braced = formatAuthoringItemId(options.itemId);
  const parent = formatAuthoringItemId(options.targetParentId);
  if (!parent) {
    return { itemId: braced, ok: false, error: "targetParentId required" };
  }
  try {
    const auth =
      options.auth ||
      (await resolveAuthoringGraphqlAuth({
        endpointName: options.endpointName,
      }));
    const data = await authoringGql(
      auth.host,
      auth.token,
      `mutation($input: MoveItemInput!) {
          moveItem(input: $input) {
            item { itemId name path }
          }
        }`,
      {
        input: {
          itemId: braced,
          targetParentId: parent,
          database: "master",
        },
      },
      options.fetchImpl,
    );
    const payload = data.moveItem as
      | { item?: { itemId?: string; name?: string; path?: string } }
      | undefined;
    return {
      itemId: braced,
      ok: true,
      name: payload?.item?.name,
      path: payload?.item?.path,
    };
  } catch (err) {
    return {
      itemId: braced,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** @deprecated Prefer {@link moveCmItem}. */
export const moveCmItemById = moveCmItem;
