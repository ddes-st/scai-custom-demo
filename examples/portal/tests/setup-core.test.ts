import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ctaLinkXml, isBrokenInternalLink, itemName, LANGUAGE_CODE, translationFor, UI_STRINGS } from "../src/lib/portal/setup/core.mjs";
import { MORE_TRANSLATIONS } from "../src/lib/portal/setup/translations.mjs";

describe("itemName", () => {
  test("transliterates to ASCII", () => {
    assert.equal(itemName("Jardins Lumière"), "Jardins Lumiere");
    assert.equal(itemName("Müller & Söhne"), "Muller Sohne");
    assert.equal(itemName("Straße"), "Strasse");
    assert.equal(itemName("Bjørn Æsir Œuvre"), "Bjorn AEsir OEuvre");
  });
  test("invalid characters become spaces; - _ $ kept", () => {
    assert.equal(itemName("a/b.c:d"), "a b c d");
    assert.equal(itemName("my-item_1 $x"), "my-item_1 $x");
    assert.equal(itemName("  --lead"), "lead");
  });
  test("caps length at 100", () => {
    assert.equal(itemName("x".repeat(150)).length, 100);
  });
  test("fallback", () => {
    assert.equal(itemName(""), "item");
    assert.equal(itemName(null), "item");
    assert.equal(itemName("日本語", "brand"), "brand");
    assert.equal(itemName("!!!", "x"), "x");
  });
});

describe("LANGUAGE_CODE", () => {
  test("valid codes", () => {
    for (const c of ["en", "de-DE", "fr-CA", "zh-Hans-CN", "fil"]) assert.ok(LANGUAGE_CODE.test(c), c);
  });
  test("invalid codes", () => {
    for (const c of ["", "e", "EN", "de_DE", "de-", "en-US;drop", "abcd"]) assert.ok(!LANGUAGE_CODE.test(c), c);
  });
});

describe("translationFor", () => {
  test("de-DE uses the German column", () => {
    const t = translationFor("de-DE");
    assert.equal(t?.ui.download, "Herunterladen");
    assert.ok(t?.pages.Home);
  });
  test("fr-CA falls back to fr", () => {
    assert.equal(translationFor("fr-CA"), MORE_TRANSLATIONS.fr);
  });
  test("no → nb", () => {
    assert.equal(translationFor("no"), MORE_TRANSLATIONS.nb);
    assert.equal(translationFor("nn-NO"), MORE_TRANSLATIONS.nb);
  });
  test("unknown language → null", () => {
    assert.equal(translationFor("ja"), null);
    assert.equal(translationFor("ja-JP"), null);
  });
});

describe("built-in translations", () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const keys = Object.keys(UI_STRINGS).filter((k) => k !== "poweredBy");

  test("German column complete with matching placeholders", () => {
    for (const k of keys) {
      const [en, de] = (UI_STRINGS as Record<string, string[]>)[k];
      assert.ok(de && de.trim(), `de: ${k}`);
      assert.deepEqual(placeholders(de), placeholders(en), `de: ${k}`);
    }
  });

  for (const [lang, t] of Object.entries(MORE_TRANSLATIONS as Record<string, { ui: Record<string, string> }>)) {
    test(`${lang}: every UI string translated with matching placeholders`, () => {
      const missing = keys.filter((k) => typeof t.ui?.[k] !== "string" || !t.ui[k].trim());
      assert.deepEqual(missing, [], `${lang} missing`);
      const wrong = keys.filter((k) => placeholders(t.ui[k]).join() !== placeholders((UI_STRINGS as Record<string, string[]>)[k][0]).join());
      assert.deepEqual(wrong, [], `${lang} placeholder mismatch`);
    });
  }
});

describe("program picks texts", () => {
  test("every language with products picks also has the university's programs picks", () => {
    for (const lang of ["de-DE", ...Object.keys(MORE_TRANSLATIONS)]) {
      const pages = translationFor(lang)?.pages ?? {};
      const products = pages["Data/Portal Picks/Featured products"], programs = pages["Data/Portal Picks/Featured programs"];
      if (!products) continue;
      assert.ok(programs?.Heading && programs?.Intro, `${lang}: programs picks missing`);
      assert.notEqual(programs.Heading, products.Heading, `${lang}: programs heading equals products`);
    }
  });
});

describe("banner call to action", () => {
  test("a site path with its page is an internal link with the page id", () => {
    const x = ctaLinkXml("Explore our programs", "/programs", "62e49e8454ef445a9f2b5bca1e0c67f4");
    assert.equal(x, '<link text="Explore our programs" linktype="internal" id="{62E49E8454EF445A9F2B5BCA1E0C67F4}" />');
    assert.equal(isBrokenInternalLink(x), false);
    assert.match(ctaLinkXml("Go", "/events?type=open#top", "{AB}"), /querystring="type=open" anchor="top"/);
  });
  test("without a page or for other sites an external link", () => {
    assert.equal(ctaLinkXml("Programs", "/programs"), '<link text="Programs" linktype="external" url="/programs" />');
    assert.equal(ctaLinkXml("Apply <now>", "https://apply.example.edu/x?a=1&b=2"), '<link text="Apply &lt;now>" linktype="external" url="https://apply.example.edu/x?a=1&amp;b=2" target="_blank" />');
  });
  test("an internal link without an id is broken", () => {
    assert.equal(isBrokenInternalLink('<link text="Explore our programs" linktype="internal" url="/programs" />'), true);
    assert.equal(isBrokenInternalLink('<link linktype="external" url="/programs" />'), false);
  });
});

describe("collection fast path", () => {
  // what a microsite run skips in an up-to-date collection: phases [1]–[3] and [5] of the setup core
  const RECORDED = { version: "1", hash: "9eead894b91b1ff5d3446c3407190e88f8d70ba6157b5fe42f4d8414cd2eec41" };
  test("the collection phases change only together with COLLECTION_VERSION", async () => {
    const { readFileSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const { COLLECTION_VERSION } = await import("../src/lib/portal/setup/core.mjs");
    const s = readFileSync(new URL("../src/lib/portal/setup/core.mjs", import.meta.url), "utf8");
    const part = (from: string, to: string) => s.slice(s.indexOf(from), s.indexOf(to));
    const hash = createHash("sha256").update(part('log("\\n[1] folders");', 'log("\\n[4] datasources') + "\n----\n" + part('log("\\n[5] template standard values', 'log("\\n[6] page tree")')).digest("hex");
    assert.equal(
      `${COLLECTION_VERSION} ${hash}`, `${RECORDED.version} ${RECORDED.hash}`,
      "The setup's collection phases (templates, parameters, renderings, standard values) changed: bump COLLECTION_VERSION in core.mjs, then record the new version and hash here — otherwise a quick microsite run would skip the change.",
    );
  });
});
