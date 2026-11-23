import { loadLocalEnvFiles } from "../shared/load-local-env";
import {
  ensureSitecoreCliLogin,
  requireSitecoreEndpointName,
} from "../shared/sitecore-auth";
import { findItemByPath, listCmChildren } from "../shared/cm-sibling-lookup";
import { readItemFieldValue } from "../shared/authoring-items";

async function main(): Promise<void> {
  loadLocalEnvFiles();
  const endpointName = requireSitecoreEndpointName();
  await ensureSitecoreCliLogin(endpointName);
  const parent =
    "/sitecore/content/domsecurity/domsecurity-com/Home/newsroom/local-news";
  const page = `${parent}/den-dam-tapkey`;
  const parentItem = await findItemByPath({ path: parent, endpointName });
  console.log(`parent ${parentItem?.itemId || "missing"} ${parentItem?.name}`);
  if (parentItem?.itemId) {
    const kids = await listCmChildren({
      parentId: parentItem.itemId,
      endpointName,
    });
    console.log(`children ${kids.length}`);
    for (const kid of kids) console.log(` - ${kid.name} ${kid.path}`);
  }
  const item = await findItemByPath({ path: page, endpointName });
  console.log(`page ${item?.itemId || "missing"} ${item?.path}`);
  if (item?.itemId) {
    const template = await readItemFieldValue({
      path: page,
      fieldName: "__Template",
      endpointName,
    });
    const renderings = await readItemFieldValue({
      path: page,
      fieldName: "__Renderings",
      language: "en",
      endpointName,
    });
    const title = await readItemFieldValue({
      path: page,
      fieldName: "Title",
      language: "en",
      endpointName,
    });
    console.log(`template ${template}`);
    console.log(`title ${title}`);
    console.log(`renderings ${(renderings || "").length} chars`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
