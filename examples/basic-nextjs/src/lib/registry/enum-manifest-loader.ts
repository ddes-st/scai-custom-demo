import { registerDroplistValues } from "components/lib/registry/with-sitecore";
import manifest from "../../../.sitecore/enum-manifest.json";

registerDroplistValues(manifest as Record<string, string>);
