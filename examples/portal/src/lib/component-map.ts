import generated from ".sitecore/component-map";
import type { NextjsContentSdkComponent } from "@sitecore-content-sdk/nextjs";

/**
 * The server component map plus aliases: this environment's OOTB partial-design rendering
 * publishes the componentName "PartialDesign Dynamic Placeholder" (with spaces), while the
 * starter registers the file name "PartialDesignDynamicPlaceholder". Both resolve here.
 */
const ALIASES: Record<string, string> = {
  "PartialDesign Dynamic Placeholder": "PartialDesignDynamicPlaceholder",
};

const componentMap = new Map<string, NextjsContentSdkComponent>(generated);
for (const [alias, name] of Object.entries(ALIASES)) {
  const c = generated.get(name);
  if (c && !componentMap.has(alias)) componentMap.set(alias, c);
}

export default componentMap;
