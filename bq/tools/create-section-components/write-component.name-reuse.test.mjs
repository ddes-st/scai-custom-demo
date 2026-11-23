/**
 * sectionDir-first component name reuse (section + child sticky).
 * Run: node --test tools/create-section-components/write-component.name-reuse.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { bqRoot } from '../capture/paths.mjs';
import { ensureDefinitionComponentIdentity } from './ai-source-fixup.mjs';
import {
  extractMediaFoldersFromDefinition,
  qualifySectionDir,
  resolveComponentName,
  retireSiblingKebabFilesInDir,
  sectionIdentityMatches,
  sectionNameIndexPath,
} from './write-component.mjs';
import { namesDifferOnlyByCase, toKebabCase } from './naming.mjs';

const HOST = '__test-name-reuse-host__';
const SECTION = 'sections/section-99';

async function writeCaptureMeta(componentName, meta) {
  const dir = path.join(bqRoot, 'src', 'components', HOST, componentName);
  await mkdir(dir, { recursive: true });
  const kebab = toKebabCase(componentName);
  await writeFile(
    path.join(dir, `${kebab}.capture-meta.json`),
    `${JSON.stringify(meta, null, 2)}\n`,
  );
}

describe('resolveComponentName sectionDir reuse', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const existingName = 'SitecoreLegacyFooter';
  const existingDir = path.join(hostDir, existingName);

  before(async () => {
    await mkdir(existingDir, { recursive: true });
    await writeFile(
      path.join(existingDir, 'sitecore-legacy-footer.capture-meta.json'),
      `${JSON.stringify(
        {
          sectionDir: SECTION,
          contentHash: 'abc',
          role: 'section',
          definitionKey: 'sitecore-legacy-footer',
          componentName: existingName,
          mediaFolders: ['Global Footer'],
        },
        null,
        2,
      )}\n`,
    );
  });

  after(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('reuses existing package when preferred is renamed', async () => {
    const resolved = await resolveComponentName({
      preferred: 'SitecoreBrandNewFooter',
      alternatives: ['SiteFooter'],
      hostSlug: HOST,
      sectionDir: SECTION,
      contentHash: 'abc',
      force: true,
      role: 'section',
    });
    assert.equal(resolved.componentName, existingName);
    assert.equal(resolved.overwrite, true);
    assert.equal(resolved.reusedBySectionDir, true);
  });

  it('extractMediaFoldersFromDefinition reads folder arrays', () => {
    const folders = extractMediaFoldersFromDefinition(`
      datasourceLocation: { folder: ["Global Footer"] },
      content: { location: { folder: ["Global Footer"] } },
    `);
    assert.deepEqual(folders, ['Global Footer']);
  });
});

describe('resolveComponentName child sticky / rename reuse', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const childSection = 'sections/section-child-reuse';

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('reuses sole child package when preferred is renamed (force)', async () => {
    await writeCaptureMeta('SitecoreEventCard', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-event-card',
      componentName: 'SitecoreEventCard',
      parentComponentName: 'SitecoreEventCarousel',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreEventResourceCard',
      hostSlug: HOST,
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'child',
    });
    assert.equal(resolved.componentName, 'SitecoreEventCard');
    assert.equal(resolved.reusedBySectionDir, true);
  });

  it('stickyName wins over preferred when both packages exist (no force)', async () => {
    await writeCaptureMeta('SitecoreEventCard', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-event-card',
      componentName: 'SitecoreEventCard',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    await writeCaptureMeta('SitecoreEventResourceCard', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-event-resource-card',
      componentName: 'SitecoreEventResourceCard',
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreEventBrandNewCard',
      hostSlug: HOST,
      sectionDir: childSection,
      contentHash: 'hash1',
      force: false,
      role: 'child',
      stickyName: 'SitecoreEventResourceCard',
    });
    assert.equal(resolved.componentName, 'SitecoreEventResourceCard');
    assert.equal(resolved.reusedBySectionDir, true);
  });

  it('--force unlocks sticky when AI preferred differs', async () => {
    await writeCaptureMeta('SitecoreEventResourceCard', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-event-resource-card',
      componentName: 'SitecoreEventResourceCard',
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreEventBrandNewCard',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'child',
      stickyName: 'SitecoreEventResourceCard',
    });
    assert.equal(resolved.componentName, 'SitecoreEventBrandNewCard');
    assert.equal(resolved.forceRenamedFrom, 'SitecoreEventResourceCard');
    assert.equal(resolved.nameLocked, false);
  });

  it('when preferred is taken, uses free alternatives (never Preferred2)', async () => {
    await writeCaptureMeta('SitecoreLocalServicesAndNavigation', {
      sectionDir: 'sections/section-other',
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'other',
      role: 'section',
      definitionKey: 'sitecore-local-services-and-navigation',
      componentName: 'SitecoreLocalServicesAndNavigation',
    });
    await writeCaptureMeta('SitecoreLegacyHeader', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'section',
      definitionKey: 'sitecore-legacy-header',
      componentName: 'SitecoreLegacyHeader',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreLocalServicesAndNavigation',
      alternatives: ['SitecoreGlobalNavigation', 'SiteHeader'],
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'section',
      stickyName: 'SitecoreLegacyHeader',
    });
    assert.equal(resolved.componentName, 'SitecoreGlobalNavigation');
    assert.equal(resolved.forceRenamedFrom, 'SitecoreLegacyHeader');
    assert.equal(
      resolved.preferredRejectedAsTaken,
      'SitecoreLocalServicesAndNavigation',
    );
  });

  it('when preferred and alternatives are taken, uses role-derived stem', async () => {
    await writeCaptureMeta('SitecoreLocalServicesAndNavigation', {
      sectionDir: 'sections/section-other',
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'other',
      role: 'section',
      definitionKey: 'sitecore-local-services-and-navigation',
      componentName: 'SitecoreLocalServicesAndNavigation',
    });
    await writeCaptureMeta('SitecoreGlobalNavigation', {
      sectionDir: 'sections/section-nav',
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'nav',
      role: 'section',
      definitionKey: 'sitecore-global-navigation',
      componentName: 'SitecoreGlobalNavigation',
    });
    await writeCaptureMeta('SitecoreLegacyHeader', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'section',
      definitionKey: 'sitecore-legacy-header',
      componentName: 'SitecoreLegacyHeader',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreLocalServicesAndNavigation',
      alternatives: ['SitecoreGlobalNavigation'],
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'section',
      stickyName: 'SitecoreLegacyHeader',
      presentationRole: 'partial-header',
      chromeKind: 'header-stack',
      track: 'header',
    });
    assert.equal(resolved.componentName, 'SitecoreSiteHeader');
    assert.doesNotMatch(resolved.componentName, /\d$/);
  });

  it('fails when preferred, alternatives, and role stems are all taken (no Preferred2)', async () => {
    const taken = [
      'SitecoreLocalServicesAndNavigation',
      'SitecoreGlobalNavigation',
      'SitecoreSiteHeader',
      'SitecoreMainNavigation',
      'SitecoreSiteNavigation',
    ];
    for (const name of taken) {
      await writeCaptureMeta(name, {
        sectionDir: `sections/section-${name}`,
        pageSlug: 'www-sitecore-com--home',
        contentHash: name,
        role: 'section',
        definitionKey: toKebabCase(name),
        componentName: name,
      });
    }
    await writeCaptureMeta('SitecoreLegacyHeader', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'section',
      definitionKey: 'sitecore-legacy-header',
      componentName: 'SitecoreLegacyHeader',
    });

    await assert.rejects(
      () =>
        resolveComponentName({
          preferred: 'SitecoreLocalServicesAndNavigation',
          alternatives: ['SitecoreGlobalNavigation'],
          hostSlug: HOST,
          codePrefix: 'Sitecore',
          sectionDir: childSection,
          contentHash: 'hash1',
          force: true,
          role: 'section',
          stickyName: 'SitecoreLegacyHeader',
          presentationRole: 'partial-header',
          chromeKind: 'header-stack',
          track: 'header',
        }),
      /no free semantic candidate|Preferred2 invent is disabled/,
    );
  });

  it('excludeNames prevents second child from stealing first package', async () => {
    await writeCaptureMeta('SitecoreChildA', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-child-a',
      componentName: 'SitecoreChildA',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    await writeCaptureMeta('SitecoreChildB', {
      sectionDir: childSection,
      contentHash: 'hash1',
      role: 'child',
      definitionKey: 'sitecore-child-b',
      componentName: 'SitecoreChildB',
      generatedAt: '2026-02-01T00:00:00.000Z',
    });

    const first = await resolveComponentName({
      preferred: 'SitecoreRenamedA',
      hostSlug: HOST,
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'child',
      stickyName: 'SitecoreChildA',
    });
    assert.equal(first.componentName, 'SitecoreRenamedA');
    assert.equal(first.forceRenamedFrom, 'SitecoreChildA');
    const second = await resolveComponentName({
      preferred: 'SitecoreRenamedB',
      hostSlug: HOST,
      sectionDir: childSection,
      contentHash: 'hash1',
      force: true,
      role: 'child',
      stickyName: 'SitecoreChildB',
      excludeNames: new Set([first.componentName]),
    });
    assert.equal(second.componentName, 'SitecoreRenamedB');
    assert.equal(second.forceRenamedFrom, 'SitecoreChildB');
    assert.notEqual(second.componentName, first.componentName);
  });
});

describe('page-scoped sectionDir (cross-page clobber)', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('qualifySectionDir prefixes pageSlug', () => {
    assert.equal(
      qualifySectionDir('www-sitecore-com--home', 'sections/section-10'),
      'www-sitecore-com--home/sections/section-10',
    );
    assert.equal(
      qualifySectionDir(
        'www-sitecore-com--home',
        'www-sitecore-com--home/sections/section-10',
      ),
      'www-sitecore-com--home/sections/section-10',
    );
  });

  it('sectionIdentityMatches does not equate home and platform section-10', () => {
    const homeMeta = {
      sectionDir: 'www-sitecore-com--home/sections/section-10',
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'homehash',
      role: 'child',
    };
    assert.equal(
      sectionIdentityMatches(
        homeMeta,
        'www-sitecore-com--platform/sections/section-10',
        'www-sitecore-com--platform',
      ),
      false,
    );
    assert.equal(
      sectionIdentityMatches(
        homeMeta,
        'www-sitecore-com--home/sections/section-10',
        'www-sitecore-com--home',
      ),
      true,
    );
  });

  it('legacy bare sectionDir matches only when pageSlug/url agrees', () => {
    const legacyHome = {
      sectionDir: 'sections/section-10',
      url: 'https://www.sitecore.com/',
      role: 'child',
    };
    assert.equal(
      sectionIdentityMatches(
        legacyHome,
        'sections/section-10',
        'www-sitecore-com--home',
      ),
      true,
    );
    assert.equal(
      sectionIdentityMatches(
        legacyHome,
        'sections/section-10',
        'www-sitecore-com--platform',
      ),
      false,
    );
  });

  it('does not overwrite home child when resolving platform section-10', async () => {
    const homeSection = qualifySectionDir(
      'www-sitecore-com--home',
      'sections/section-10',
    );
    const platformSection = qualifySectionDir(
      'www-sitecore-com--platform',
      'sections/section-10',
    );
    await writeCaptureMeta('SitecoreCustomerStory', {
      sectionDir: homeSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'homehash',
      role: 'child',
      definitionKey: 'sitecore-customer-story',
      componentName: 'SitecoreCustomerStory',
      url: 'https://www.sitecore.com/',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreCustomerStory',
      alternatives: ['PlatformCustomerStory', 'CustomerStoryCard'],
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: platformSection,
      contentHash: 'platformhash',
      force: true,
      role: 'child',
      pageSlug: 'www-sitecore-com--platform',
    });
    assert.notEqual(resolved.componentName, 'SitecoreCustomerStory');
    assert.equal(resolved.overwrite, false);
    assert.equal(resolved.componentName, 'SitecorePlatformCustomerStory');
    assert.doesNotMatch(resolved.componentName, /\d$/);
  });

  it('same pageSlug + force may overwrite even when contentHash differs', async () => {
    const section = qualifySectionDir(
      'www-sitecore-com--home',
      'sections/section-10',
    );
    await writeCaptureMeta('SitecoreCustomerStory', {
      sectionDir: section,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'oldhash',
      role: 'child',
      definitionKey: 'sitecore-customer-story',
      componentName: 'SitecoreCustomerStory',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreCustomerStory',
      hostSlug: HOST,
      sectionDir: section,
      contentHash: 'newhash',
      force: true,
      role: 'child',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreCustomerStory');
    assert.equal(resolved.overwrite, true);
  });
});

describe('name lock + brand prefix + spaced displayName', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const lockSection = 'www-sitecore-com--home/sections/section-lock';

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('index lock beats new AI preferred without --force (parent)', async () => {
    await writeCaptureMeta('SitecoreCapabilityCarousel', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'section',
      definitionKey: 'sitecore-capability-carousel',
      componentName: 'SitecoreCapabilityCarousel',
    });
    await mkdir(hostDir, { recursive: true });
    await writeFile(
      sectionNameIndexPath(HOST),
      `${JSON.stringify(
        {
          [lockSection]: {
            componentName: 'SitecoreCapabilityCarousel',
            role: 'section',
            children: ['SitecoreCapabilityCard'],
            definitionKey: 'sitecore-capability-carousel',
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveComponentName({
      preferred: 'SitecoreFeatureShowcase',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h1',
      force: false,
      role: 'section',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreCapabilityCarousel');
    assert.equal(resolved.definitionKey, 'sitecore-capability-carousel');
    assert.equal(resolved.nameLocked, true);
  });

  it('--force unlocks index when AI preferred differs (parent)', async () => {
    await writeCaptureMeta('SitecoreCapabilityCarousel', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'section',
      definitionKey: 'sitecore-capability-carousel',
      componentName: 'SitecoreCapabilityCarousel',
    });
    await mkdir(hostDir, { recursive: true });
    await writeFile(
      sectionNameIndexPath(HOST),
      `${JSON.stringify(
        {
          [lockSection]: {
            componentName: 'SitecoreCapabilityCarousel',
            role: 'section',
            children: ['SitecoreCapabilityCard'],
            definitionKey: 'sitecore-capability-carousel',
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveComponentName({
      preferred: 'SitecoreFeatureShowcase',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h1',
      force: true,
      role: 'section',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreFeatureShowcase');
    assert.equal(resolved.definitionKey, 'sitecore-feature-showcase');
    assert.equal(resolved.forceRenamedFrom, 'SitecoreCapabilityCarousel');
    assert.equal(resolved.previousDefinitionKey, 'sitecore-capability-carousel');
    assert.equal(resolved.nameLocked, false);
  });

  it('index children[i] lock beats AI preferred without --force (child)', async () => {
    await writeCaptureMeta('SitecoreCapabilityCard', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'child',
      definitionKey: 'sitecore-capability-card',
      componentName: 'SitecoreCapabilityCard',
    });
    await mkdir(hostDir, { recursive: true });
    await writeFile(
      sectionNameIndexPath(HOST),
      `${JSON.stringify(
        {
          [lockSection]: {
            componentName: 'SitecoreCapabilityCarousel',
            role: 'section',
            children: ['SitecoreCapabilityCard'],
            definitionKey: 'sitecore-capability-carousel',
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveComponentName({
      preferred: 'SitecoreFeatureTile',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h1',
      force: false,
      role: 'child',
      childIndex: 0,
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreCapabilityCard');
    assert.equal(resolved.nameLocked, true);
  });

  it('sticky conversion name beats AI preferred without --force when index missing', async () => {
    await writeCaptureMeta('SitecoreLegacyCard', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'child',
      definitionKey: 'sitecore-legacy-card',
      componentName: 'SitecoreLegacyCard',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreBrandNewCard',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h1',
      force: false,
      role: 'child',
      stickyName: 'SitecoreLegacyCard',
      childIndex: 0,
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreLegacyCard');
  });

  it('unprefixed preferred becomes brand-prefixed on first invent', async () => {
    const resolved = await resolveComponentName({
      preferred: 'CapabilityCarousel',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'fresh',
      force: true,
      role: 'section',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreCapabilityCarousel');
    assert.equal(resolved.definitionKey, 'sitecore-capability-carousel');
    assert.equal(resolved.overwrite, false);
  });

  it('falls back to bare sections/section-NN index key; --force unlocks preferred', async () => {
    await writeCaptureMeta('SitecoreMainHeader', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'section',
      definitionKey: 'sitecore-main-header',
      componentName: 'SitecoreMainHeader',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    const indexPath = sectionNameIndexPath(HOST);
    await mkdir(path.dirname(indexPath), { recursive: true });
    await writeFile(
      indexPath,
      `${JSON.stringify(
        {
          [lockSection]: {
            componentName: 'SitecoreMainHeader',
            role: 'section',
            children: [],
            definitionKey: 'sitecore-main-header',
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveComponentName({
      preferred: 'SitecoreMainNav',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h2',
      force: true,
      role: 'section',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreMainNav');
    assert.equal(resolved.forceRenamedFrom, 'SitecoreMainHeader');
    assert.equal(resolved.nameLocked, false);
  });

  it('when multiple section packages share sectionDir, keeps oldest not AI preferred', async () => {
    await writeCaptureMeta('SitecoreMainHeader', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h1',
      role: 'section',
      definitionKey: 'sitecore-main-header',
      componentName: 'SitecoreMainHeader',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    await writeCaptureMeta('SitecoreMainNav', {
      sectionDir: lockSection,
      pageSlug: 'www-sitecore-com--home',
      contentHash: 'h2',
      role: 'section',
      definitionKey: 'sitecore-main-nav',
      componentName: 'SitecoreMainNav',
      generatedAt: '2026-06-01T00:00:00.000Z',
    });

    const resolved = await resolveComponentName({
      preferred: 'SitecoreBrandNewHeader',
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: lockSection,
      contentHash: 'h3',
      force: true,
      role: 'section',
      pageSlug: 'www-sitecore-com--home',
    });
    assert.equal(resolved.componentName, 'SitecoreMainHeader');
    assert.equal(resolved.reusedBySectionDir, true);
  });

  it('ensureDefinitionComponentIdentity sets spaced displayName without brand', () => {
    const src = `
export const d = {
  kind: "component",
  definitionKey: "capability-carousel",
  name: "capability-carousel",
  displayName: "Sitecore Capability Carousel",
  componentName: "CapabilityCarousel",
  model: {
    folderTemplate: { name: "Capability Carousel Folder" },
    itemTemplate: { name: "Capability Carousel", sections: [] },
  },
  content: {
    items: [{ name: "Card One", displayName: "Card One", fields: {} }],
  },
};
`;
    const out = ensureDefinitionComponentIdentity(src, {
      componentName: 'SitecoreCapabilityCarousel',
      definitionKey: 'sitecore-capability-carousel',
      codePrefix: 'Sitecore',
    });
    assert.match(out, /componentName:\s*"SitecoreCapabilityCarousel"/);
    assert.match(out, /definitionKey:\s*"sitecore-capability-carousel"/);
    assert.match(out, /name:\s*"sitecore-capability-carousel"/);
    assert.match(out, /displayName:\s*"Capability Carousel"/);
    assert.doesNotMatch(out, /displayName:\s*"Sitecore Capability Carousel"/);
    // Content item displayName untouched
    assert.match(out, /name:\s*"Card One",\s*displayName:\s*"Card One"/);
  });
});

describe('casing-only remint (Ai vs AI)', () => {
  const hostDir = path.join(bqRoot, 'src', 'components', HOST);
  const lockName = 'SitecoreAiAssistedHeroBanner';
  const aiPreferred = 'SitecoreAIAssistedHeroBanner';
  const section = 'sections/section-casing';

  beforeEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
    await writeCaptureMeta(lockName, {
      sectionDir: section,
      contentHash: 'hero-hash',
      role: 'section',
      definitionKey: 'sitecore-ai-assisted-hero-banner',
      componentName: lockName,
    });
    // Stale sibling kebab from a prior casing remint (same Windows folder).
    const dir = path.join(hostDir, lockName);
    await writeFile(
      path.join(dir, 'sitecore-aiassisted-hero-banner.definition.ts'),
      'export const stale = true;\n',
    );
    await writeFile(
      path.join(dir, 'sitecore-aiassisted-hero-banner.capture-meta.json'),
      `${JSON.stringify({
        sectionDir: section,
        definitionKey: 'sitecore-aiassisted-hero-banner',
        componentName: aiPreferred,
      })}\n`,
    );
  });

  afterEach(async () => {
    await rm(hostDir, { recursive: true, force: true });
  });

  it('namesDifferOnlyByCase detects Ai vs AI', () => {
    assert.equal(namesDifferOnlyByCase(lockName, aiPreferred), true);
    assert.equal(namesDifferOnlyByCase(lockName, lockName), false);
    assert.equal(
      namesDifferOnlyByCase(lockName, 'SitecorePlatformHero'),
      false,
    );
  });

  it('keeps lock identity and flags sibling retire (even with --force)', async () => {
    const resolved = await resolveComponentName({
      preferred: aiPreferred,
      hostSlug: HOST,
      codePrefix: 'Sitecore',
      sectionDir: section,
      contentHash: 'hero-hash',
      force: true,
      role: 'section',
      stickyName: lockName,
    });
    assert.equal(resolved.componentName, lockName);
    assert.equal(resolved.definitionKey, 'sitecore-ai-assisted-hero-banner');
    assert.equal(resolved.retireCasingSiblingFrom, aiPreferred);
    assert.equal(resolved.forceRenamedFrom, undefined);
  });

  it('retireSiblingKebabFilesInDir removes wrong kebab only', async () => {
    const dir = path.join(hostDir, lockName);
    const removed = await retireSiblingKebabFilesInDir(
      dir,
      'sitecore-ai-assisted-hero-banner',
    );
    assert.ok(removed.length >= 1);
    const { access } = await import('node:fs/promises');
    await assert.rejects(() =>
      access(path.join(dir, 'sitecore-aiassisted-hero-banner.definition.ts')),
    );
    await access(
      path.join(dir, 'sitecore-ai-assisted-hero-banner.capture-meta.json'),
    );
  });
});
