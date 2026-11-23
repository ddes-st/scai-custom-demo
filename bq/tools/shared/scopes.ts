import path from "node:path";
import { REPO_ROOT } from "./paths";
import {
  SITE_DICTIONARY_ROOT_ID,
  SYSTEM_DICTIONARY_ROOT_ID,
  SYSTEM_SYSTEM_ROOT_ID,
} from "./dictionary-ids";

/**
 * Configurable authoring roots for definition `location.scope`.
 * Temporary hard-coded bq-demo paths — later owned by site.definition.ts.
 */
export type ScopeDefinition = {
  diskRoot: string;
  sitecorePath: string;
  /** Parent of the first folder segment (or include root for system enums). */
  rootItemId: string;
};

export type ScopeName = "site" | "shared" | "project";
export type DictionaryScopeName = "site" | "system";
export type EnumerationScopeName = DictionaryScopeName | "shared" | "project";

export type ContentRootDefinition = {
  folder: string[];
};

export type EnumerationsRootDefinition = ContentRootDefinition;

/**
 * Sitecore folder segments prepended to `location.folder`.
 * System scope uses an empty disk folder chain — `Enums.yml` is the SCS include root.
 */
export const ENUMERATIONS_ROOT: Partial<
  Record<EnumerationScopeName, EnumerationsRootDefinition>
> = {
  site: { folder: ["Enums"] },
  system: { folder: [] },
};

export const DICTIONARY_ROOT: Record<DictionaryScopeName, ContentRootDefinition> =
  {
    site: { folder: ["Dictionary"] },
    system: { folder: [] },
  };

export const SCOPES: Record<ScopeName, ScopeDefinition> = {
  site: {
    diskRoot: path.join(
      REPO_ROOT,
      "authoring",
      "items",
      "bq-demo",
      "sai",
      "sites",
      "content",
      "build-quick-demos-and-proof-of-concepts",
      "bq-demo",
    ),
    sitecorePath:
      "/sitecore/content/build-quick-demos-and-proof-of-concepts/bq-demo",
    rootItemId: "fc829bb3-3a32-4a28-a83f-04c01af8fbb3",
  },
  shared: {
    diskRoot: path.join(
      REPO_ROOT,
      "authoring",
      "items",
      "bq-demo",
      "sai",
      "shared",
    ),
    sitecorePath: "/sitecore/content/build-quick-demos-and-proof-of-concepts",
    rootItemId: "00000000-0000-0000-0000-000000000000",
  },
  project: {
    diskRoot: path.join(
      REPO_ROOT,
      "authoring",
      "items",
      "bq-demo",
      "sai",
      "project",
    ),
    sitecorePath: "/sitecore/content/build-quick-demos-and-proof-of-concepts",
    rootItemId: "00000000-0000-0000-0000-000000000000",
  },
};

const DICTIONARY_SYSTEM_SCOPE: ScopeDefinition = {
  diskRoot: path.join(
    REPO_ROOT,
    "authoring",
    "items",
    "bq-demo",
    "sai",
    "systemDictionary",
    "Dictionary",
  ),
  sitecorePath: "/sitecore/system/Dictionary",
  rootItemId: SYSTEM_DICTIONARY_ROOT_ID,
};

/** SCS include `systemEnums` — `Enums.yml` is the serialized include root; descendants live under `Enums/`. */
export const ENUMERATION_SYSTEM_DISK_ROOT = path.join(
  REPO_ROOT,
  "authoring",
  "items",
  "bq-demo",
  "sai",
  "systemEnums",
);

export const ENUMERATION_SYSTEM_SCOPE: ScopeDefinition = {
  diskRoot: path.join(ENUMERATION_SYSTEM_DISK_ROOT, "Enums"),
  sitecorePath: "/sitecore/system/Enums",
  rootItemId: SYSTEM_SYSTEM_ROOT_ID,
};

export function getScope(name: ScopeName): ScopeDefinition {
  const scope = SCOPES[name];
  if (!scope) {
    throw new Error(`Unknown location scope: ${name}`);
  }
  return scope;
}

export function getDictionaryScope(name: DictionaryScopeName): ScopeDefinition {
  if (name === "system") {
    return DICTIONARY_SYSTEM_SCOPE;
  }
  return getScope("site");
}

export function getEnumerationScope(
  name: EnumerationScopeName,
): ScopeDefinition {
  if (name === "system") {
    return ENUMERATION_SYSTEM_SCOPE;
  }
  return getScope(name);
}

export function getEnumerationsRoot(
  scopeName: EnumerationScopeName,
): EnumerationsRootDefinition {
  const root = ENUMERATIONS_ROOT[scopeName];
  if (root === undefined) {
    throw new Error(
      `No enumerationsRoot configured for scope "${scopeName}". Set ENUMERATIONS_ROOT.${scopeName}.folder.`,
    );
  }
  return root;
}

export function getDictionaryRoot(
  scopeName: DictionaryScopeName,
): ContentRootDefinition {
  return DICTIONARY_ROOT[scopeName];
}

export function resolveEnumerationFolder(
  scopeName: EnumerationScopeName,
  locationFolder: string[],
): string[] {
  const root = getEnumerationsRoot(scopeName);
  return [...root.folder, ...(locationFolder ?? [])];
}

export function resolveDictionaryFolder(
  scopeName: DictionaryScopeName,
  locationFolder: string[],
): string[] {
  const root = getDictionaryRoot(scopeName);
  return [...root.folder, ...(locationFolder ?? [])];
}

export function resolveDictionaryParentId(
  scopeName: DictionaryScopeName,
  folder: string[],
  folderChainParentId: string,
): string {
  if (scopeName === "site" && folder.length === 0) {
    return SITE_DICTIONARY_ROOT_ID;
  }
  return folderChainParentId;
}

export function resolveLocationPath(location: {
  scope: ScopeName;
  folder: string[];
}): {
  scope: ScopeDefinition;
  diskDir: string;
  parentSitecorePath: string;
  parentYamlPath: string | null;
  parentIsScopeRoot: boolean;
} {
  const scope = getScope(location.scope);
  const folder = location.folder ?? [];

  if (folder.length === 0) {
    return {
      scope,
      diskDir: scope.diskRoot,
      parentSitecorePath: scope.sitecorePath,
      parentYamlPath: null,
      parentIsScopeRoot: true,
    };
  }

  const parentName = folder[folder.length - 1]!;
  const parentRelDir = folder.slice(0, -1);
  const parentDir = path.join(scope.diskRoot, ...parentRelDir);
  const parentYamlPath = path.join(parentDir, `${parentName}.yml`);
  const diskDir = path.join(scope.diskRoot, ...folder);
  const parentSitecorePath = [scope.sitecorePath, ...folder].join("/");

  return {
    scope,
    diskDir,
    parentSitecorePath,
    parentYamlPath,
    parentIsScopeRoot: false,
  };
}
