/**
 * Unit tests for AppPlaceholder carousel / media-tabs helpers (no bare-PH flex/grid CONTRACT).
 * Run: node --import tsx --test tools/create-section-components/ai-source-fixup.placeholder-layout.test.mjs
 */
import './force-mutating-fixups-for-tests.mjs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  carouselAppPlaceholderHasTrack,
  collectTsxEmitContractDiagnostics,
  normalizeComponentTsx,
  unwrapNestedPlaceholderCarousel,
  normalizeCarouselCardWidths,
  setSkipAiSourceFixups,
  shouldSkipAiSourceFixups,
  stripMediaTabsBuriedChildTabChrome,
} from './ai-source-fixup.mjs';

describe('carouselAppPlaceholderHasTrack / carousel CONTRACT', () => {
  const clientTrack = `
'use client';
export default function Chrome({ children }) {
  return <div className="flex snap-x overflow-x-auto">{children}</div>;
}
`;

  it('passes when PH is inside imported Chrome (not only *Chrome names)', () => {
    const src = `
import Chrome from './sitecore-trust-badge-carousel.client';
export const Default = (props) => (
  <section className="w-full">
    <Chrome>
      <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
    </Chrome>
  </section>
);
`;
    assert.equal(carouselAppPlaceholderHasTrack(src, clientTrack), true);
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
      clientTsx: clientTrack,
    });
    assert.ok(
      !diags.some((d) => /no snap-x \/ overflow-x track/.test(d)),
      diags.join('\n'),
    );
  });

  it('passes when PH is inside AwardsCarouselChrome', () => {
    const src = `
import AwardsCarouselChrome from './awards.client';
export const Default = (props) => (
  <AwardsCarouselChrome>
    <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </AwardsCarouselChrome>
);
`;
    assert.equal(carouselAppPlaceholderHasTrack(src), true);
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
    });
    assert.ok(!diags.some((d) => /no snap-x \/ overflow-x track/.test(d)));
  });

  it('fails for bare AppPlaceholder under section without track', () => {
    const src = `
export const Default = (props) => (
  <section className="w-full">
    <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </section>
);
`;
    assert.equal(carouselAppPlaceholderHasTrack(src), false);
    const diags = collectTsxEmitContractDiagnostics(src, {
      layoutMode: 'carousel',
    });
    assert.ok(diags.some((d) => /no snap-x \/ overflow-x track/.test(d)));
  });

  it('passes when server TSX itself has snap-x track', () => {
    const src = `
export const Default = (props) => (
  <div className="flex snap-x overflow-x-auto">
    <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </div>
);
`;
    assert.equal(carouselAppPlaceholderHasTrack(src), true);
  });
});

describe('bare AppPlaceholder flex/grid CONTRACT removed', () => {
  it('does not emit flex/grid parent CONTRACT for bare AppPlaceholder', () => {
    const src = `
export const Default = (props) => (
  <section className="w-full border-b">
    <AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
  </section>
);
`;
    const diags = collectTsxEmitContractDiagnostics(src);
    assert.ok(
      !diags.some((d) => /AppPlaceholder needs flex\/grid/.test(d)),
      diags.join('\n'),
    );
  });
});

describe('normalizeComponentTsx carousel safety net', () => {
  it('does not invent snap-x wrap around bare AppPlaceholder when layoutMode=carousel', () => {
    const src = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

export const Default = (props: ComponentWithContextProps) => {
  return (
    <section className="w-full">
      <AppPlaceholder name="cards" rendering={props.rendering} page={props.page} componentMap={componentMap} />
    </section>
  );
};
`;
    const out = normalizeComponentTsx(src, { layoutMode: 'carousel' });
    assert.doesNotMatch(out, /snap-x/);
    assert.match(out, /<AppPlaceholder name="cards"/);
  });
});

describe('unwrapNestedPlaceholderCarousel', () => {
  it('unwraps snap-x nested inside md:[&>*]:w-1/3 column strip', () => {
    const src = `
        <div className="flex flex-col md:flex-row md:[&>*]:w-1/3 md:[&>*]:px-5">
                    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto lg:flex lg:justify-center lg:gap-8 lg:overflow-visible [&>*]:shrink-0 [&>*]:snap-center">
            <AppPlaceholder name={placeholderName} rendering={props.rendering} page={props.page} componentMap={componentMap} />
          </div>
        </div>
`;
    const out = unwrapNestedPlaceholderCarousel(src);
    assert.equal((out.match(/snap-x/g) || []).length, 0);
    assert.match(out, /md:\[&>\*\]:w-1\/3/);
    assert.match(out, /<AppPlaceholder/);
  });
});

describe('normalizeComponentTsx does not wrap bare AppPlaceholder', () => {
  it('leaves bare AppPlaceholder without inventing flex wrap', () => {
    const src = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

export const Default = (props: ComponentWithContextProps) => {
  return (
    <section className="w-full">
      <AppPlaceholder name="cards" rendering={props.rendering} page={props.page} componentMap={componentMap} />
    </section>
  );
};
`;
    const out = normalizeComponentTsx(src);
    assert.doesNotMatch(out, /flex flex-wrap items-stretch/);
    assert.doesNotMatch(out, /snap-x/);
    assert.match(out, /<AppPlaceholder name="cards"/);
  });

  it('media-tabs does not invent snap-x around AppPlaceholder inside Chrome', () => {
    const src = `
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './sitecore-customer-story-slider.client';

export const Default = (props: ComponentWithContextProps) => {
  return (
    <section className="w-full">
      <Chrome>
        <AppPlaceholder name="stories" rendering={props.rendering} page={props.page} componentMap={componentMap} />
      </Chrome>
    </section>
  );
};
`;
    const out = normalizeComponentTsx(src, { layoutMode: 'media-tabs' });
    assert.doesNotMatch(out, /snap-x/);
    assert.match(out, /<AppPlaceholder name="stories"/);
  });

  it('media-tabs strips buried child data-story-tab chrome and sets data-story-title', () => {
    const src = `
export const Default = (props) => {
  const { fields } = props;
  return (
    <article data-story-item className="relative">
      <div data-story-tab className="hidden lg:flex">
        <Text field={fields.Title} tag="h3" />
      </div>
      <div data-story-logo className="lg:hidden">
        <Image field={fields.Logo} />
      </div>
      <div data-story-panel className="aspect-video">
        <Image field={fields.Thumbnail} />
        <div className="absolute bottom-0 right-0 hidden lg:flex">
          <Image field={fields.Logo} />
        </div>
      </div>
    </article>
  );
};
`;
    const out = normalizeComponentTsx(src, { layoutMode: 'media-tabs' });
    assert.doesNotMatch(out, /data-story-tab/);
    assert.match(out, /data-story-title=\{String\(fields\.Title\?\.value \?\? ''\)\}/);
    assert.match(out, /data-story-panel/);
    assert.match(out, /data-story-logo/);
    assert.match(out, /hidden lg:flex/); // corner badge kept
  });
});

describe('stripMediaTabsBuriedChildTabChrome', () => {
  it('no-ops when there is no buried tab chrome', () => {
    const src = `<article data-story-item data-story-title="A"><div data-story-panel /></article>`;
    assert.equal(stripMediaTabsBuriedChildTabChrome(src), src);
  });

  it('strips preferred data-media-tab-tab chrome and sets data-media-tab-title', () => {
    const src = `
<article data-media-tab-item className="relative">
  <div data-media-tab-tab className="hidden lg:flex">
    <Text field={fields.Title} tag="h3" />
  </div>
  <div data-media-tab-logo className="lg:hidden"><Image field={fields.Logo} /></div>
  <div data-media-tab-panel className="aspect-video"><Image field={fields.Thumbnail} /></div>
</article>
`;
    const out = stripMediaTabsBuriedChildTabChrome(src);
    assert.doesNotMatch(out, /data-media-tab-tab/);
    assert.match(out, /data-media-tab-title=\{String\(fields\.Title\?\.value \?\? ''\)\}/);
    assert.match(out, /data-media-tab-panel/);
    assert.match(out, /data-media-tab-logo/);
  });
});

describe('normalizeCarouselCardWidths', () => {
  it('rewrites w-full + lg:w-[350px] card roots', () => {
    const src = `<article className="flex w-full min-w-0 shrink-0 flex-col lg:w-[350px] lg:flex-none md:w-[calc(50%-15px)]" />`;
    const out = normalizeCarouselCardWidths(src);
    assert.match(out, /w-\[min\(90%,350px\)\]/);
    assert.doesNotMatch(out, /\bw-full\b/);
  });
});

describe('BQ_SKIP_AI_SOURCE_FIXUPS', () => {
  it('skips TSX warn-pass but leaves source intact', () => {
    setSkipAiSourceFixups(true);
    assert.equal(shouldSkipAiSourceFixups(), true);
    const src = `
export const Default = () => (
  <section className="w-full">
    <AppPlaceholder name="x" rendering={r} page={p} componentMap={m} />
  </section>
);
`;
    try {
      const out = normalizeComponentTsx(src);
      assert.match(out, /<AppPlaceholder/);
    } finally {
      setSkipAiSourceFixups(false);
    }
  });

  it('still runs definition mutate path when --skip-fixups + V2_FIXUPS (escape hatch)', async () => {
    const { normalizeDefinitionTs } = await import('./ai-source-fixup.mjs');
    // This file forces V2_FIXUPS via force-mutating-fixups-for-tests.mjs.
    // --skip-fixups alone skips TSX; with V2_FIXUPS, definition salvage still runs.
    setSkipAiSourceFixups(true);
    try {
      const src = `
export const FooDefinition = {
  kind: "component",
  definitionKey: "foo",
  name: "Foo",
  displayName: "Foo",
  componentName: "Foo",
  icon: "Office/32x32/window_dialog.png",
  datasourceLocation: { root: "data", folder: ["Foos"] },
  model: {
    folderTemplate: { name: "Foos" },
    itemTemplate: { name: "Foo", sections: [{ name: "Data", fields: [{ name: "Title", type: "Single-Line Text" }] }] },
  },
  variants: [{ name: "Default" }],
  content: { location: { root: "data", folder: ["Foos"] }, culture: "en", items: [{ name: "Item", fields: { Title: "Hi" } }] },
};
`;
      const out = normalizeDefinitionTs(src, { definitionKey: 'foo' });
      assert.match(out, /scope:\s*["']site["']/);
    } finally {
      setSkipAiSourceFixups(false);
    }
  });
});
