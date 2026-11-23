/**

 * Build and write per-section implementation plans (section-plan.json).

 * Reviewable before TSX + Sitecore YAML authoring.

 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';

import path from 'node:path';

import { decomposeSectionEntry, getChromeBlueprint } from './decompose-sections.mjs';

import { readOriginalSectionHtml } from './section-html-files.mjs';

import {

  analyzeSectionHtml,

  analyzeImageFieldGuidance,

  buildNarrativeSummary,

  buildReviewNotes,

  REVIEW_NEXT_STEPS,

} from './analyze-section-html.mjs';



const CHROME_TYPES = new Set(['header', 'nav', 'navigation', 'footer', 'cookie-banner', 'topbar', 'top-bar']);



function toKebabCase(name) {

  return name

    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')

    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')

    .toLowerCase();

}



function buildTsxPlan(cmsName, variants) {

  const folder = toKebabCase(cmsName);

  return {

    componentMapKey: cmsName,

    directory: `src/components/${folder}/`,

    mainFile: `src/components/${folder}/${cmsName}.tsx`,

    variantExports: variants,

    componentMapRegistration: `.sitecore/component-map.ts → '${cmsName}': () => import('@/components/${folder}/${cmsName}')`,

  };

}



function buildYamlPlan(cmsName, blueprint) {

  const hasPlaceholders = (blueprint.placeholders ?? []).length > 0;

  const artifacts = [

    {

      kind: 'template-branch',

      description: 'Sitecore template branch (Template, Data section, field items)',

      pathPattern: `/sitecore/templates/Project/{project}/${cmsName}/`,

    },

    {

      kind: 'rendering',

      description: 'Json rendering definition',

      pathPattern: `/sitecore/layout/Renderings/Project/{project}/${cmsName}`,

    },

    {

      kind: 'headless-variants-folder',

      description: 'Headless Variants folder for Experience Editor',

      pathPattern: `{siteContentPath}/Presentation/Headless Variants/${cmsName}`,

    },

    ...(blueprint.variants ?? []).map((variant) => ({

      kind: 'headless-variant',

      description: `${variant} variant definition`,

      pathPattern: `{siteContentPath}/Presentation/Headless Variants/${cmsName}/${variant}.yml`,

    })),

    {

      kind: 'data-folder',

      description: 'Datasource folder for authored content',

      pathPattern: `{siteContentPath}/Data/${cmsName}s`,

    },

    {

      kind: 'default-datasource',

      description: 'Default datasource item with field values from design',

      pathPattern: `{siteContentPath}/Data/${cmsName}s/Default ${cmsName}.yml`,

    },

  ];



  if (hasPlaceholders) {

    for (const ph of blueprint.placeholders) {

      const phKey = ph.key.replace('-{DynamicPlaceholderId}', '');

      artifacts.push({

        kind: 'placeholder-setting',

        description: `Placeholder setting for ${ph.key}`,

        pathPattern: `/sitecore/layout/Placeholder Settings/Project/{project}/${phKey}`,

        placeholderKey: ph.key,

        allowedRenderings: ph.allowedRenderings,

      });

    }

  }



  return {

    sitecoreProjectPath: `authoring/items/{ProjectName}/serialized-content/`,

    artifacts,

    fields: blueprint.fields ?? [],

  };

}



function buildComponentPlan(blueprint, role, extra = {}) {

  return {

    role,

    cmsName: blueprint.cmsName,

    componentType: blueprint.componentType,

    description: blueprint.description,

    confidence: blueprint.confidence ?? 'medium',

    fields: blueprint.fields ?? [],

    placeholders: blueprint.placeholders ?? [],

    variants: blueprint.variants ?? [],

    parentComponents: blueprint.parentComponents ?? [],

    tsx: buildTsxPlan(blueprint.cmsName, blueprint.variants ?? []),

    yaml: buildYamlPlan(blueprint.cmsName, blueprint),

    ...extra,

  };

}



function buildImplementationSummary(components, layoutAnalysis) {

  if (components.length === 0) return 'No Sitecore components planned for this entry.';



  if (layoutAnalysis?.pattern === 'responsive-grid-carousel') {

    const parent = components.find((c) => c.role === 'parent')?.cmsName;

    const child = components.find((c) => c.role === 'child')?.cmsName;

    return `Build ${components.length} components: ${parent} + ${child} (responsive grid → carousel).`;

  }



  if (components.length === 1) {

    return `Build 1 Sitecore component: ${components[0].cmsName}.`;

  }



  return `Build ${components.length} Sitecore components: ${components.map((c) => c.cmsName).join(' + ')} (parent/child placeholder pattern).`;

}



function annotateFieldsWithImageGuidance(fields, imageFieldGuidance) {

  if (!imageFieldGuidance?.imageFields?.length) return fields ?? [];

  return (fields ?? []).map((field) => {

    const guidance = imageFieldGuidance.imageFields.find((g) => g.fieldName === field.name);

    if (!guidance) return field;

    return {

      ...field,

      contentGuidance: {

        visibleTextInScreenshot: guidance.visibleTextInScreenshot,

        authorAsSeparateFields: guidance.authorAsSeparateFields,

        note: guidance.note,

      },

    };

  });

}



function applyImageFieldGuidanceToComponents(components, imageFieldGuidance) {

  if (!imageFieldGuidance?.imageFields?.length) return components;

  return components.map((comp) => {

    const fields = annotateFieldsWithImageGuidance(comp.fields, imageFieldGuidance);

    return {

      ...comp,

      fields,

      yaml: comp.yaml

        ? {

            ...comp.yaml,

            fields: annotateFieldsWithImageGuidance(comp.yaml.fields, imageFieldGuidance),

          }

        : comp.yaml,

    };

  });

}



/**

 * Build a reviewable implementation plan for one manifest section entry.

 * @param {object} entry — manifest.components[cmsName]

 * @param {object} [options]

 * @param {string} [options.sectionsRoot]

 * @param {string | null} [options.sectionHtml]

 */

export function buildSectionPlan(entry, options = {}) {

  const sectionsRoot = options.sectionsRoot ?? null;

  const layoutAnalysis = analyzeSectionHtml(options.sectionHtml ?? null);

  const imageFieldGuidance = analyzeImageFieldGuidance(options.sectionHtml ?? null);

  const enrichedEntry = layoutAnalysis ? { ...entry, layoutAnalysis } : entry;

  const isChrome = CHROME_TYPES.has(entry.type) || entry.isStickyOverlay || entry.scope === 'site';



  /** @type {object[]} */

  const components = [];

  let confidence = 'medium';

  let placeholderKey = null;

  let repeatCount = entry.repeatCount ?? layoutAnalysis?.cardCount ?? 0;



  if (isChrome && getChromeBlueprint(entry.cmsName)) {

    const chrome = getChromeBlueprint(entry.cmsName);

    components.push(buildComponentPlan({ ...chrome, confidence: 'high' }, 'standalone'));

    confidence = 'high';

  } else if (entry.type === 'card' && entry.metadataOnly) {

    // Card metadata rows don't get their own plan file unless captured

  } else {

    const decomposed = decomposeSectionEntry(enrichedEntry);

    confidence = decomposed.parent.confidence ?? 'medium';

    placeholderKey = decomposed.placeholderKey;

    repeatCount = decomposed.repeatCount ?? repeatCount;



    components.push(

      buildComponentPlan(decomposed.parent, decomposed.child ? 'parent' : 'standalone', {

        placeholderKey: decomposed.placeholderKey,

      })

    );



    if (decomposed.child) {

      components.push(

        buildComponentPlan(decomposed.child, 'child', {

          inPlaceholder: decomposed.placeholderKey,

          repeatCount: decomposed.repeatCount,

        })

      );

    }

  }



  const componentsWithGuidance = applyImageFieldGuidanceToComponents(components, imageFieldGuidance);



  const outputs = entry.outputs ?? {};

  const screenshotFiles = Object.fromEntries(

    Object.entries(outputs).map(([device, relPath]) => [

      device,

      relPath ? path.basename(String(relPath)) : null,

    ])

  );



  const notes = buildReviewNotes(entry, layoutAnalysis, componentsWithGuidance, imageFieldGuidance);

  const narrativeSummary = buildNarrativeSummary(entry, componentsWithGuidance, layoutAnalysis, {
    repeatCount,
    placeholderKey,
    imageFieldGuidance,
  });



  const responsiveLayout = layoutAnalysis

    ? {

        pattern: layoutAnalysis.pattern,

        differsByViewport: layoutAnalysis.differsByViewport ?? false,

        cardCount: layoutAnalysis.cardCount ?? null,

        cardPattern: layoutAnalysis.cardPattern ?? null,

        desktop: layoutAnalysis.desktop ?? null,

        tablet: layoutAnalysis.tablet ?? null,

        mobile: layoutAnalysis.mobile ?? null,

      }

    : null;



  return {

    version: 1,

    generatedAt: new Date().toISOString(),

    reviewStatus: 'pending',

    sectionFolder: entry.folderName,

    review: {

      narrativeSummary,

      notes,

      contentGuidance: imageFieldGuidance ?? null,

      nextSteps: REVIEW_NEXT_STEPS,

    },

    responsiveLayout,

    detection: {

      cmsName: entry.cmsName,

      folderName: entry.folderName,

      type: entry.type,

      componentType: entry.componentType ?? null,

      scope: entry.scope ?? 'page',

      selector: entry.selector ?? null,

      anchorWebid: entry.anchorWebid ?? null,

      heading: entry.heading ?? null,

      reason: entry.reason ?? null,

      captureMode: entry.captureMode ?? (entry.isStickyOverlay ? 'overlay' : 'clean'),

      isStickyOverlay: !!entry.isStickyOverlay,

      order: entry.order ?? null,

      repeatCount: entry.repeatCount ?? layoutAnalysis?.cardCount ?? null,

      placeholderFor: entry.placeholderFor ?? null,

      parentSection: entry.parentSection ?? null,

      includesSectionTitle: entry.includesSectionTitle ?? false,

      detectedFields: entry.fields ?? [],

      source: entry.source ?? 'visual-dom',

    },

    assets: {

      screenshots: screenshotFiles,

      sectionHtml: entry.sectionHtml ? path.basename(entry.sectionHtml) : 'section.html',

      outputDir: sectionsRoot ? path.relative(sectionsRoot, entry.outputDir ?? '').replace(/\\/g, '/') : entry.folderName,

    },

    implementationPlan: {

      confidence,

      summary: buildImplementationSummary(components, layoutAnalysis),

      placeholderKey,

      repeatCount,

      components: componentsWithGuidance,

    },

  };

}



/**

 * Write section-plan.json for every component in the global manifest.

 * @param {string} projectRoot — design-screenshots/{domain}

 * @param {object} manifest — parsed sections/manifest.json

 */

export async function writeSectionPlans(projectRoot, manifest, options = {}) {

  const sectionsRoot =
    options.sectionsRoot ?? path.join(projectRoot, 'section-registry');

  let written = 0;



  for (const entry of Object.values(manifest.components ?? {})) {

    if (!entry?.folderName) continue;

    if (entry.type === 'card' && entry.metadataOnly && !entry.captureScreenshot) continue;



    const sectionDir = entry.outputDir ?? path.join(sectionsRoot, entry.folderName);

    await mkdir(sectionDir, { recursive: true });



    let sectionHtml = null;

    const canonicalSlug =

      entry.canonicalPageSlug ||

      entry.instances?.[0]?.pageSlug ||

      entry.seenOnPages?.[0];

    if (canonicalSlug) {
      const fromInstance = await readOriginalSectionHtml(
        path.join(sectionDir, 'instances', canonicalSlug),
      );
      sectionHtml = fromInstance?.html || '';
    }

    if (!sectionHtml) {
      const fromRoot = await readOriginalSectionHtml(sectionDir);
      sectionHtml = fromRoot?.html || '';
    }



    const plan = buildSectionPlan(entry, { sectionsRoot, sectionHtml });

    const planPath = path.join(sectionDir, 'section-plan.json');

    await writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

    written += 1;

  }



  return { written, sectionsRoot };

}


