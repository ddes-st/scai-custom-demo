/**
 * Carousel Chrome wrap on write: skip when already under import alias; wrap with alias only.
 * Run: node --import tsx --test tools/create-section-components/write-component.carousel-chrome.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import {
  _resetFixupSkipLogsForTests,
  setCodegenV2Fixups,
  shouldSkipMutatingTsxFixups,
} from './ai-source-fixup.mjs';
import { writeComponentPackage } from './write-component.mjs';

const HOST = '__test-carousel-chrome-host__';
const COMPONENT = 'SitecoreRecognitionBadgeCarousel';
const KEBAB = 'sitecore-recognition-badge-carousel';

const DEFINITION = `
import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";
export const sitecoreRecognitionBadgeCarouselDefinition = {
  kind: "component",
  collectionSystem: "sitecore",
  siteSystem: "sitecore-com",
  definitionKey: "sitecore-recognition-badge-carousel",
  name: "sitecore-recognition-badge-carousel",
  componentName: "SitecoreRecognitionBadgeCarousel",
  displayName: "Recognition Badge Carousel",
  datasourceLocation: { scope: 'site', root: 'data', folder: ['Recognition Badge Carousels'] },
  model: {
    folderTemplate: { name: 'Recognition Badge Carousel Folder' },
    itemTemplate: {
      name: 'Recognition Badge Carousel',
      sections: [{ name: 'Content', fields: [] }],
    },
  },
  placeholders: [{ name: 'logo-items', displayName: 'Logo Items' }],
  content: {
    location: { root: 'data', folder: ['Recognition Badge Carousels'] },
    culture: "en",
    items: [{ name: 'Recognition Badge Carousel', fields: {} }],
  },
} satisfies ComponentTemplateDefinition;
`;

const SECTION_INFO = {
  cmsName: 'RecognitionBadgeCarousel',
  componentName: 'RecognitionBadgeCarousel',
  layout: { pattern: 'responsive-grid-carousel', interactionNotes: 'horizontal carousel' },
};

function serverTsxAlreadyWrappedChrome() {
  return `import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-recognition-badge-carousel.client';

type Props = ComponentWithContextProps & { fields: Record<string, never> };

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  return (
    <section>
      <Chrome>
        <AppPlaceholder name="logo-items" rendering={rendering} page={page} componentMap={componentMap} />
      </Chrome>
    </section>
  );
};

export default Default;
`;
}

function serverTsxBarePlaceholder() {
  return `import React, { JSX } from 'react';
import { AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

type Props = ComponentWithContextProps & { fields: Record<string, never> };

export const Default = (props: Props): JSX.Element => {
  const { rendering, page } = props;
  return (
    <section>
      <AppPlaceholder name="logo-items" rendering={rendering} page={page} componentMap={componentMap} />
    </section>
  );
};

export default Default;
`;
}

describe('writeComponentPackage carousel Chrome wrap', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  /** @type {string|undefined} */
  let prevV2Fixups;

  before(async () => {
    prevV2Fixups = process.env.BQ_CODEGEN_V2_FIXUPS;
    delete process.env.BQ_CODEGEN_V2_FIXUPS;
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
    await rm(hostDir, { recursive: true, force: true });
    await mkdir(hostDir, { recursive: true });
  });

  after(async () => {
    await rm(hostDir, { recursive: true, force: true });
    if (prevV2Fixups === undefined) delete process.env.BQ_CODEGEN_V2_FIXUPS;
    else process.env.BQ_CODEGEN_V2_FIXUPS = prevV2Fixups;
    setCodegenV2Fixups(false);
    _resetFixupSkipLogsForTests();
  });

  it('does not nest Sitecore*Chrome when AppPlaceholder is already under imported Chrome', async () => {
    assert.equal(shouldSkipMutatingTsxFixups(), true);

    await writeComponentPackage({
      hostSlug: HOST,
      componentName: COMPONENT,
      kebab: KEBAB,
      tsx: serverTsxAlreadyWrappedChrome(),
      clientTsx: null,
      definitionTs: DEFINITION,
      definitionKey: KEBAB,
      planMode: 'composite',
      role: 'section',
      layoutMode: 'carousel',
      sectionInfo: SECTION_INFO,
      captureMeta: {
        codegenVersion: 'section',
        role: 'section',
        mode: 'composite',
      },
      dryRun: false,
      validateClean: false,
    });

    const written = await readFile(
      path.join(hostDir, COMPONENT, `${KEBAB}.tsx`),
      'utf8',
    );
    assert.match(written, /import\s+Chrome\s+from\s+['"]\.\/sitecore-recognition-badge-carousel\.client['"]/);
    assert.match(written, /<Chrome>[\s\S]*<AppPlaceholder\b/);
    assert.doesNotMatch(written, /SitecoreRecognitionBadgeCarouselChrome/);
    const chromeOpens = written.match(/<Chrome\b/g) || [];
    assert.equal(chromeOpens.length, 1);
  });

  it('wraps bare AppPlaceholder with the companion import alias only', async () => {
    await rm(path.join(hostDir, COMPONENT), { recursive: true, force: true });

    await writeComponentPackage({
      hostSlug: HOST,
      componentName: COMPONENT,
      kebab: KEBAB,
      tsx: serverTsxBarePlaceholder(),
      clientTsx: null,
      definitionTs: DEFINITION,
      definitionKey: KEBAB,
      planMode: 'composite',
      role: 'section',
      layoutMode: 'carousel',
      sectionInfo: SECTION_INFO,
      captureMeta: {
        codegenVersion: 'section',
        role: 'section',
        mode: 'composite',
      },
      dryRun: false,
      validateClean: false,
    });

    const written = await readFile(
      path.join(hostDir, COMPONENT, `${KEBAB}.tsx`),
      'utf8',
    );
    // Prefer alias from the import that write-component added (Sitecore*Chrome).
    assert.match(
      written,
      /import\s+SitecoreRecognitionBadgeCarouselChrome\s+from\s+['"]\.\/sitecore-recognition-badge-carousel\.client['"]/,
    );
    assert.match(
      written,
      /<SitecoreRecognitionBadgeCarouselChrome>[\s\S]*<AppPlaceholder\b[\s\S]*<\/SitecoreRecognitionBadgeCarouselChrome>/,
    );
    // No nested duplicate wrap
    const opens =
      written.match(/<SitecoreRecognitionBadgeCarouselChrome\b/g) || [];
    assert.equal(opens.length, 1);
  });
});
