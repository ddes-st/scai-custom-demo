/**
 * Run: node --test tools/create-section-components/composed-tree-diagnostics.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectComposedTreeDiagnostics,
  extractDefaultExportRootClassName,
  parentOwnsCarouselSlideSizing,
  rootIsFullBleedSlideWithoutSizing,
} from './composed-tree-diagnostics.mjs';

const carouselPlan = {
  mode: 'composite',
  section: { componentName: 'SitecoreResourceCarousel' },
  children: [{ componentName: 'SitecoreResourceCard' }],
};

const carouselInfo = {
  cmsName: 'ResourceCarousel',
  componentName: 'SitecoreResourceCarousel',
};

const childWithNestedWFull = {
  role: 'child',
  componentName: 'SitecoreResourceCard',
  definitionKey: 'sitecore-resource-card',
  tsx: `
export const Default = (props) => {
  return (
    <article className="group h-full overflow-hidden rounded-lg">
      <div className="aspect-[1.91/1] w-full overflow-hidden">
        <img className="h-full w-full object-cover" />
      </div>
    </article>
  );
};
`,
};

const childRootWFull = {
  role: 'child',
  componentName: 'SitecoreResourceCard',
  definitionKey: 'sitecore-resource-card',
  tsx: `
export const Default = (props) => {
  return (
    <article className="w-full overflow-hidden rounded-lg">
      <div className="p-4">card</div>
    </article>
  );
};
`,
};

const childRootSlideSized = {
  role: 'child',
  componentName: 'SitecoreResourceCard',
  definitionKey: 'sitecore-resource-card',
  tsx: `
export const Default = (props) => {
  return (
    <article className="w-full shrink-0 w-[min(90%,350px)] overflow-hidden rounded-lg">
      <div className="p-4">card</div>
    </article>
  );
};
`,
};

describe('extractDefaultExportRootClassName', () => {
  it('reads outermost Default return className only', () => {
    const cls = extractDefaultExportRootClassName(childWithNestedWFull.tsx);
    assert.equal(cls, 'group h-full overflow-hidden rounded-lg');
  });
});

describe('parentOwnsCarouselSlideSizing / rootIsFullBleedSlideWithoutSizing', () => {
  it('detects parent track child selectors', () => {
    assert.equal(
      parentOwnsCarouselSlideSizing(
        '',
        'className="flex snap-x [&>*]:shrink-0 [&>*]:basis-1/2"',
      ),
      true,
    );
    assert.equal(parentOwnsCarouselSlideSizing('<div className="flex flex-col" />'), false);
  });

  it('flags full-bleed root without slide sizing', () => {
    assert.equal(rootIsFullBleedSlideWithoutSizing('w-full rounded-lg'), true);
    assert.equal(
      rootIsFullBleedSlideWithoutSizing('shrink-0 w-[min(90%,350px)]'),
      false,
    );
    assert.equal(rootIsFullBleedSlideWithoutSizing('group h-full'), false);
  });
});

describe('collectComposedTreeDiagnostics', () => {
  it('flags multi-slot parent missing AppPlaceholder bases', () => {
    const childPackages = [
      { componentName: 'SitecoreFooterSignpost', placeholder: 'footer-signposts' },
      { componentName: 'SitecoreFooterNavigationGroup', placeholder: 'footer-navigation' },
      { componentName: 'SitecoreFooterBrandingSocial', placeholder: 'footer-social' },
      { componentName: 'SitecoreFooterLegal', placeholder: 'footer-legal' },
    ];
    const diags = collectComposedTreeDiagnostics({
      parentDefinitionKey: 'sitecore-global-footer2',
      parentTsx: `
const placeholderBase = 'footer-signposts';
const phName = placeholderBase;
<AppPlaceholder name={phName} rendering={r} page={p} componentMap={m} />
`,
      childPackages,
    });
    assert.ok(diags.some((d) => /missing/.test(d) && /footer-legal/.test(d)));
  });

  it('passes when all multi-slot bases are mounted', () => {
    const childPackages = [
      { componentName: 'A', placeholder: 'footer-signposts' },
      { componentName: 'B', placeholder: 'footer-navigation' },
      { componentName: 'C', placeholder: 'footer-social' },
      { componentName: 'D', placeholder: 'footer-legal' },
    ];
    const diags = collectComposedTreeDiagnostics({
      parentDefinitionKey: 'sitecore-global-footer2',
      parentTsx: `
const footerSignpostsPhBase = 'footer-signposts';
const footerNavigationPhBase = 'footer-navigation';
const footerSocialPhBase = 'footer-social';
const footerLegalPhBase = 'footer-legal';
const dynId = props.params?.DynamicPlaceholderId;
const footerSignpostsPh = dynId ? \`\${footerSignpostsPhBase}-\${dynId}\` : footerSignpostsPhBase;
const footerNavigationPh = dynId ? \`\${footerNavigationPhBase}-\${dynId}\` : footerNavigationPhBase;
const footerSocialPh = dynId ? \`\${footerSocialPhBase}-\${dynId}\` : footerSocialPhBase;
const footerLegalPh = dynId ? \`\${footerLegalPhBase}-\${dynId}\` : footerLegalPhBase;
<AppPlaceholder name={footerSignpostsPh} />
<AppPlaceholder name={footerNavigationPh} />
<AppPlaceholder name={footerSocialPh} />
<AppPlaceholder name={footerLegalPh} />
`,
      childPackages,
    });
    assert.ok(!diags.some((d) => /missing/.test(d)));
  });

  it('ignores nested w-full when parent client owns slide track sizing', () => {
    const diags = collectComposedTreeDiagnostics({
      plan: carouselPlan,
      parentDefinitionKey: 'sitecore-resource-carousel',
      parentTsx: `<CarouselChrome><AppPlaceholder name={ph} /></CarouselChrome>`,
      parentClientTsx: `
<div className="flex snap-x overflow-x-auto [&>*]:shrink-0 [&>*]:basis-1/3">{children}</div>
`,
      sectionInfo: carouselInfo,
      childPackages: [childWithNestedWFull],
    });
    assert.ok(!diags.some((d) => /slide \(shrink-0/.test(d)));
  });

  it('flags child root w-full when parent track lacks slide sizing', () => {
    const diags = collectComposedTreeDiagnostics({
      plan: carouselPlan,
      parentDefinitionKey: 'sitecore-resource-carousel',
      parentTsx: `<div className="flex flex-col"><AppPlaceholder name={ph} /></div>`,
      parentClientTsx: '',
      sectionInfo: carouselInfo,
      childPackages: [childRootWFull],
    });
    assert.ok(diags.some((d) => /SitecoreResourceCard/.test(d) && /slide \(shrink-0/.test(d)));
  });

  it('passes when child root already has slide sizing', () => {
    const diags = collectComposedTreeDiagnostics({
      plan: carouselPlan,
      parentDefinitionKey: 'sitecore-resource-carousel',
      parentTsx: `<div className="flex flex-col"><AppPlaceholder name={ph} /></div>`,
      sectionInfo: carouselInfo,
      childPackages: [childRootSlideSized],
    });
    assert.ok(!diags.some((d) => /slide \(shrink-0/.test(d)));
  });

  it('auto-strips buried media-tabs child tab chrome during composed validate', () => {
    const badInline = {
      role: 'child',
      componentName: 'SitecoreCustomerStory',
      definitionKey: 'sitecore-customer-story',
      tsx: `
export const Default = (props) => {
  const { fields } = props;
  return (
    <article data-story-item className="relative">
      <div data-story-tab className="hidden lg:flex">
        <Text field={fields.Title} tag="h3" />
      </div>
      <div data-story-logo className="lg:hidden"><Image field={fields.Logo} /></div>
      <div data-story-panel className="aspect-video"><Image field={fields.Thumbnail} /></div>
    </article>
  );
};
`,
    };
    const diags = collectComposedTreeDiagnostics({
      plan: {
        mode: 'composite',
        section: { componentName: 'SitecoreCustomerStorySlider' },
        children: [{ componentName: 'SitecoreCustomerStory' }],
      },
      parentDefinitionKey: 'sitecore-customer-story-slider',
      parentTsx: `
import Chrome from './sitecore-customer-story-slider.client';
<Chrome><AppPlaceholder name={ph} /></Chrome>
`,
      parentClientTsx: `
<div data-story-desktop-navigation role="tablist" />
<div data-story-logo-navigation />
{children}
`,
      sectionInfo: { cmsName: 'CustomerStorySlider' },
      childPackages: [badInline],
    });
    assert.ok(!diags.some((d) => /bury desktop tab chrome/.test(d)));
    assert.match(String(badInline.tsx), /data-story-title=/);
    assert.doesNotMatch(String(badInline.tsx), /data-story-tab/);
  });

  it('flags media-tabs child when data-story-tab remains with desktop-hidden chrome elsewhere', () => {
    // Strip only removes data-story-tab nodes that themselves have hidden lg:flex.
    const stillBad = {
      role: 'child',
      componentName: 'SitecoreCustomerStory',
      definitionKey: 'sitecore-customer-story',
      tsx: `
export const Default = (props) => {
  const { fields } = props;
  return (
    <article data-story-item className="relative">
      <div data-story-tab className="sr-only"><Text field={fields.Title} /></div>
      <div data-story-panel className="aspect-video">
        <Image field={fields.Thumbnail} />
        <div className="hidden lg:flex"><Image field={fields.Logo} /></div>
      </div>
    </article>
  );
};
`,
    };
    const diags = collectComposedTreeDiagnostics({
      plan: {
        mode: 'composite',
        section: { componentName: 'SitecoreCustomerStorySlider' },
        children: [{ componentName: 'SitecoreCustomerStory' }],
      },
      parentDefinitionKey: 'sitecore-customer-story-slider',
      parentTsx: `<Chrome><AppPlaceholder name={ph} /></Chrome>`,
      sectionInfo: { cmsName: 'CustomerStorySlider' },
      childPackages: [stillBad],
    });
    assert.ok(diags.some((d) => /bury desktop tab chrome/.test(d)));
  });

  it('passes media-tabs child that exposes part bag only', () => {
    const good = {
      role: 'child',
      componentName: 'SitecoreCustomerStory',
      definitionKey: 'sitecore-customer-story',
      tsx: `
export const Default = (props) => {
  const { fields } = props;
  return (
    <article data-story-item data-story-title={String(fields.Title?.value ?? '')} className="relative">
      <div data-story-logo className="lg:hidden"><Image field={fields.Logo} /></div>
      <div data-story-panel className="aspect-video">
        <Image field={fields.Thumbnail} />
        <div className="absolute bottom-0 right-0 hidden lg:flex"><Image field={fields.Logo} /></div>
      </div>
    </article>
  );
};
`,
    };
    const diags = collectComposedTreeDiagnostics({
      plan: {
        mode: 'composite',
        section: { componentName: 'SitecoreCustomerStorySlider' },
        children: [{ componentName: 'SitecoreCustomerStory' }],
      },
      parentDefinitionKey: 'sitecore-customer-story-slider',
      parentTsx: `<Chrome><AppPlaceholder name={ph} /></Chrome>`,
      parentClientTsx: `<div data-story-desktop-navigation role="tablist" />{children}`,
      sectionInfo: { cmsName: 'CustomerStorySlider' },
      childPackages: [good],
    });
    assert.ok(!diags.some((d) => /bury desktop tab chrome/.test(d)));
  });

  it('auto-strips preferred data-media-tab-tab buried chrome', () => {
    const badInline = {
      role: 'child',
      componentName: 'SitecoreMediaTabItem',
      definitionKey: 'sitecore-media-tab-item',
      tsx: `
export const Default = (props) => {
  const { fields } = props;
  return (
    <article data-media-tab-item className="relative">
      <div data-media-tab-tab className="hidden lg:flex">
        <Text field={fields.Title} tag="h3" />
      </div>
      <div data-media-tab-logo className="lg:hidden"><Image field={fields.Logo} /></div>
      <div data-media-tab-panel className="aspect-video"><Image field={fields.Thumbnail} /></div>
    </article>
  );
};
`,
    };
    const diags = collectComposedTreeDiagnostics({
      plan: {
        mode: 'composite',
        section: { componentName: 'SitecoreTabbedMedia' },
        children: [{ componentName: 'SitecoreMediaTabItem' }],
      },
      parentDefinitionKey: 'sitecore-tabbed-media',
      parentTsx: `<Chrome><AppPlaceholder name={ph} /></Chrome>`,
      parentClientTsx: `<div data-media-tab-desktop-nav role="tablist" />{children}`,
      sectionInfo: {
        purpose: 'video left with side selectors that swap media',
      },
      sectionHtml: `
        <section>
          <div role="tabpanel"><video></video></div>
          <nav role="tablist"><button role="tab">A</button></nav>
        </section>
      `,
      childPackages: [badInline],
    });
    assert.ok(!diags.some((d) => /bury desktop tab chrome/.test(d)));
    assert.match(String(badInline.tsx), /data-media-tab-title=/);
    assert.doesNotMatch(String(badInline.tsx), /data-media-tab-tab/);
  });
});
