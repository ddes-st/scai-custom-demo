/**
 * Emit completeness guard for site-presentation Home layouts.
 * Run: npx tsx --test tools/definitions/apply/site-presentation.completeness.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertResolvedPageRenderingsComplete,
  buildHomeRenderingsXml,
  bumpPageDesignItemRevisions,
  flattenResolvedChildrenToRows,
  formatSitecoreUtcTimestamp,
  hasOrphanScsYamlMapValues,
  layoutXmlContainsOotbNavigation,
  reconcilePageDesignPartialIds,
  stripOotbNavigationChromeIds,
} from "./site-presentation";
import { FIELD_IDS } from "../../shared/system-ids";

describe("stripOotbNavigationChromeIds", () => {
  it("removes Navigation + Link list scaffold ids", () => {
    const out = stripOotbNavigationChromeIds([
      "{1DEB067F-0BB1-405E-94F5-2ABB537A6160}",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "{4956263D-1195-4D6E-931B-800EA625FF6F}",
    ]);
    assert.deepEqual(out, ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
  });
});

describe("layoutXmlContainsOotbNavigation", () => {
  it("detects OOTB Navigation uid in layout XML", () => {
    assert.equal(
      layoutXmlContainsOotbNavigation(
        '<r uid="{1DEB067F-0BB1-405E-94F5-2ABB537A6160}" />',
      ),
      true,
    );
    assert.equal(layoutXmlContainsOotbNavigation("<r uid=\"{AAAA}\" />"), false);
  });
});

describe("assertResolvedPageRenderingsComplete", () => {
  it("throws when a parent renderingId is missing", () => {
    assert.throws(
      () =>
        assertResolvedPageRenderingsComplete(
          "home",
          "sitecore",
          [
            {
              definitionKey: "sitecore-platform-hero",
              renderingId: null,
            },
          ],
          1,
        ),
      /no rendering item id/,
    );
  });

  it("throws when a nested child renderingId is missing", () => {
    assert.throws(
      () =>
        assertResolvedPageRenderingsComplete(
          "home",
          "sitecore",
          [
            {
              definitionKey: "sitecore-card-grid",
              renderingId: "{AAA}",
              resolvedChildren: [
                {
                  definitionKey: "sitecore-benefit-card",
                  renderingId: null,
                },
              ],
            },
          ],
          1,
        ),
      /nested child rendering/,
    );
  });

  it("throws when a grandchild renderingId is missing", () => {
    assert.throws(
      () =>
        assertResolvedPageRenderingsComplete(
          "home",
          "sitecore",
          [
            {
              definitionKey: "sitecore-outer",
              renderingId: "{AAA}",
              resolvedChildren: [
                {
                  definitionKey: "sitecore-mid",
                  renderingId: "{BBB}",
                  resolvedChildren: [
                    {
                      definitionKey: "sitecore-leaf",
                      renderingId: null,
                    },
                  ],
                },
              ],
            },
          ],
          1,
        ),
      /sitecore-outer → sitecore-mid → sitecore-leaf/,
    );
  });

  it("passes when all ids resolve and counts match", () => {
    assert.doesNotThrow(() =>
      assertResolvedPageRenderingsComplete(
        "home",
        "sitecore",
        [
          {
            definitionKey: "sitecore-platform-hero",
            renderingId: "{AAA}",
            resolvedChildren: [],
          },
        ],
        1,
      ),
    );
  });
});

describe("flattenResolvedChildrenToRows / buildHomeRenderingsXml", () => {
  it("chains s:ph for depth-2 nested composites", () => {
    const rows = flattenResolvedChildrenToRows(
      [
        {
          definitionKey: "mid-composite",
          renderingId: "11111111-1111-1111-1111-111111111111",
          datasourceId: "22222222-2222-2222-2222-222222222222",
          uid: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}",
          placeholder: "footer-navigation",
          dynamicPlaceholderId: 2,
          childPlaceholderKey: "column-links",
          resolvedChildren: [
            {
              definitionKey: "leaf",
              renderingId: "33333333-3333-3333-3333-333333333333",
              datasourceId: null,
              uid: "{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}",
              placeholder: "column-links",
            },
          ],
        },
      ],
      "/headless-footer",
      1,
      "footer-navigation",
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.placeholder, "/headless-footer/footer-navigation-1");
    assert.match(rows[0]!.params, /DynamicPlaceholderId=2/);
    assert.equal(
      rows[1]!.placeholder,
      "/headless-footer/footer-navigation-1/column-links-2",
    );
  });

  it("emits DynamicPlaceholderId on nested composite parents in XML", () => {
    const xml = buildHomeRenderingsXml([
      {
        definitionKey: "sitecore-global-footer",
        placeholder: "headless-footer",
        renderingId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        datasourceId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        uid: "{CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC}",
        dynamicPlaceholderId: 1,
        childPlaceholderKey: "footer-navigation",
        resolvedChildren: [
          {
            definitionKey: "nav-group",
            renderingId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
            datasourceId: null,
            uid: "{DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD}",
            placeholder: "footer-navigation",
          },
        ],
      },
    ]);
    assert.match(xml, /s:ph="headless-footer"/);
    assert.match(xml, /DynamicPlaceholderId=1/);
    assert.match(xml, /s:ph="\/headless-footer\/footer-navigation-1"/);
  });
});

describe("reconcilePageDesignPartialIds", () => {
  const cookie = "77fe5bd7-68c8-517d-9675-352acaeba105";
  const header = "d1d805eb-2f03-482c-a121-16818b93364d";
  const footer = "0dc1d2c8-ccde-4fdd-b44f-ed54e409ba98";
  const metadata = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const emitted = [cookie, header, footer];

  it("rewrites Footer|Header|Cookie disk order to cookie→header→footer emit order", () => {
    const out = reconcilePageDesignPartialIds(emitted, [
      footer,
      header,
      cookie,
    ]);
    assert.equal(out.changed, true);
    assert.deepEqual(out.ids, emitted);
  });

  it("rewrites CM Cookie|Footer|Header to cookie→header→footer", () => {
    const out = reconcilePageDesignPartialIds(emitted, [
      cookie,
      footer,
      header,
    ]);
    assert.equal(out.changed, true);
    assert.deepEqual(out.ids, emitted);
  });

  it("is unchanged when disk already matches emit order", () => {
    const out = reconcilePageDesignPartialIds(emitted, emitted);
    assert.equal(out.changed, false);
    assert.deepEqual(out.ids, emitted);
  });

  it("preserves non-emitted PartialDesigns (e.g. Metadata) after emit order", () => {
    const out = reconcilePageDesignPartialIds(emitted, [
      footer,
      metadata,
      header,
      cookie,
    ]);
    assert.equal(out.changed, true);
    assert.deepEqual(out.ids, [...emitted, metadata]);
  });
});

const PARTIAL_DESIGNS_VALUE =
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const DEFAULT_PAGE_DESIGN_FIXTURE = `---
ID: "c7b78d59-a11a-4fef-aba0-080ebaa42ce9"
Parent: "2b0d0d1d-def4-4f42-b40b-b89cd9209328"
Template: "1105b8f8-1e00-426b-bf1f-c840742d827b"
Path: "/sitecore/content/crelan/crelan-be/Presentation/Page Designs/Default"
SharedFields:
- ID: "0966b999-0d0e-4278-acc9-9da69d461fe6"
  Hint: PartialDesigns
  Value: "${PARTIAL_DESIGNS_VALUE}"
- ID: "${FIELD_IDS.SharedRevision}"
  Hint: __Shared revision
  Value: "11111111-1111-1111-1111-111111111111"
Languages:
- Language: en
  Versions:
  - Version: 1
    Fields:
    - ID: "${FIELD_IDS.Revision}"
      Hint: __Revision
      Value: "22222222-2222-2222-2222-222222222222"
    - ID: "${FIELD_IDS.Updated}"
      Hint: __Updated
      Value: 20260101T000000Z
- Language: nl-BE
  Versions:
  - Version: 1
    Fields:
    - ID: "${FIELD_IDS.Revision}"
      Hint: __Revision
      Value: "33333333-3333-3333-3333-333333333333"
    - ID: "${FIELD_IDS.Updated}"
      Hint: __Updated
      Value: 20260101T000000Z
`;

function extractQuotedField(yaml: string, fieldId: string): string[] {
  const re = new RegExp(
    `ID:\\s*"${fieldId}"[\\s\\S]*?Value:\\s*"([^"]*)"`,
    "gi",
  );
  const values: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(yaml))) values.push(m[1]);
  return values;
}

function extractPlainField(yaml: string, fieldId: string): string[] {
  const re = new RegExp(
    `ID:\\s*"${fieldId}"[\\s\\S]*?Value:\\s*([^\\r\\n]+)`,
    "gi",
  );
  const values: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(yaml))) values.push(m[1].trim());
  return values;
}

describe("bumpPageDesignItemRevisions", () => {
  it("refreshes SharedRevision, per-lang Revision, and Updated; keeps PartialDesigns", () => {
    let n = 0;
    const now = new Date(Date.UTC(2026, 10, 2, 15, 30, 45));
    const out = bumpPageDesignItemRevisions(DEFAULT_PAGE_DESIGN_FIXTURE, {
      now,
      newGuid: () => {
        n += 1;
        return `aaaaaaaa-bbbb-cccc-dddd-${String(n).padStart(12, "0")}`;
      },
    });

    assert.match(
      out,
      /PartialDesigns\s*\n\s*Value:\s*"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"/,
    );
    assert.equal(
      extractQuotedField(out, FIELD_IDS.SharedRevision)[0],
      "aaaaaaaa-bbbb-cccc-dddd-000000000001",
    );
    const revisions = extractQuotedField(out, FIELD_IDS.Revision);
    assert.equal(revisions.length, 2);
    assert.equal(revisions[0], "aaaaaaaa-bbbb-cccc-dddd-000000000002");
    assert.equal(revisions[1], "aaaaaaaa-bbbb-cccc-dddd-000000000003");
    assert.notEqual(revisions[0], revisions[1]);
    const stamp = formatSitecoreUtcTimestamp(now);
    assert.deepEqual(extractPlainField(out, FIELD_IDS.Updated), [stamp, stamp]);
  });

  it("yields different revision GUIDs on successive bumps", () => {
    const first = bumpPageDesignItemRevisions(DEFAULT_PAGE_DESIGN_FIXTURE);
    const second = bumpPageDesignItemRevisions(first);
    assert.notEqual(
      extractQuotedField(first, FIELD_IDS.SharedRevision)[0],
      extractQuotedField(second, FIELD_IDS.SharedRevision)[0],
    );
    assert.notEqual(
      extractQuotedField(first, FIELD_IDS.Revision)[0],
      extractQuotedField(second, FIELD_IDS.Revision)[0],
    );
  });

  it("does not leave orphan quoted GUIDs or timestamps after Value:", () => {
    const out = bumpPageDesignItemRevisions(DEFAULT_PAGE_DESIGN_FIXTURE, {
      now: new Date(Date.UTC(2026, 10, 2, 16, 0, 0)),
      newGuid: () => "aaaaaaaa-bbbb-cccc-dddd-000000000099",
    });
    assert.equal(hasOrphanScsYamlMapValues(out), false);
    // Regression: old Value:.*?\r?\n? stopped after "Value:" and left leftovers like:
    //   Value: "new"
    //  "old-guid"
    assert.doesNotMatch(out, /\n[ \t]+"[0-9a-f-]{36}"\s*(?:\n|$)/i);
    assert.doesNotMatch(out, /\n[ \t]+\d{8}T\d{6}Z\s*(?:\n|$)/);
    assert.match(
      out,
      new RegExp(
        `ID: "${FIELD_IDS.Revision}"\\n\\s+Hint: __Revision\\n\\s+Value: "aaaaaaaa-bbbb-cccc-dddd-000000000099"`,
      ),
    );
  });
});

describe("hasOrphanScsYamlMapValues", () => {
  it("detects the corrupt Default.yml pattern from revision-bump leftovers", () => {
    const corrupt = `---
Languages:
- Language: en
  Versions:
  - Version: 1
    Fields:
    - ID: "${FIELD_IDS.Revision}"
      Hint: __Revision
      Value: "13910389-bf51-4be3-97d3-3bc35be3946b"
 "e3e34c5e-bd6e-4571-8c52-c16f4557576d"
    - ID: "${FIELD_IDS.Updated}"
      Hint: __Updated
      Value: 20261102T153246Z
 20261102T142512Z
`;
    assert.equal(hasOrphanScsYamlMapValues(corrupt), true);
    assert.equal(hasOrphanScsYamlMapValues(DEFAULT_PAGE_DESIGN_FIXTURE), false);
  });
});
