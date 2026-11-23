/**
 * Ensure PartialDesignDynamicPlaceholder exists under bq/src/components so the
 * editing/rendering host can resolve SXA partial wrappers (sxa-{Signature})
 * without depending on examples/basic-nextjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const bqRoot = path.resolve(toolDir, "../..");

export const PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_DIR = path.join(
  bqRoot,
  "src",
  "components",
  "partial-design-dynamic-placeholder",
);

export const PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX = path.join(
  PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_DIR,
  "PartialDesignDynamicPlaceholder.tsx",
);

const CANONICAL_TSX = `import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import { ComponentWithContextProps } from 'lib/component-props';

/**
 * SXA Partial Design wrapper - Layout Service nests partial chrome under
 * placeholder key sxa-{Signature}. Required on the editing/rendering host.
 */
const PartialDesignDynamicPlaceholder = (
  props: ComponentWithContextProps,
): JSX.Element => (
  <AppPlaceholder
    name={props.rendering?.params?.sig || ''}
    rendering={props.rendering}
    page={props.page}
    componentMap={componentMap}
  />
);

export default PartialDesignDynamicPlaceholder;
`;

/**
 * @returns {{ path: string, created: boolean, updated: boolean }}
 */
export function ensurePartialDesignDynamicPlaceholder() {
  fs.mkdirSync(PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_DIR, { recursive: true });

  const existed = fs.existsSync(PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX);
  const previous = existed
    ? fs.readFileSync(PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX, "utf8")
    : null;
  const next = CANONICAL_TSX.endsWith("\n")
    ? CANONICAL_TSX
    : `${CANONICAL_TSX}\n`;

  if (previous === next) {
    return {
      path: PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX,
      created: false,
      updated: false,
    };
  }

  fs.writeFileSync(PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX, next, "utf8");
  return {
    path: PARTIAL_DESIGN_DYNAMIC_PLACEHOLDER_TSX,
    created: !existed,
    updated: existed,
  };
}

function main() {
  const result = ensurePartialDesignDynamicPlaceholder();
  const rel = path.relative(bqRoot, result.path);
  if (result.created) {
    console.log(`[bq:ensure:host-components] created ${rel}`);
  } else if (result.updated) {
    console.log(`[bq:ensure:host-components] updated ${rel}`);
  } else {
    console.log(`[bq:ensure:host-components] unchanged ${rel}`);
  }
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
