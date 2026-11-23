import fs from 'node:fs';

const t = fs.readFileSync('bq/.sitecore/component-map.ts', 'utf8');
for (const l of t.split(/\n/)) {
  if (/SiteFooter|ConsentBanner|site-footer|consent-banner|RecommendationCard/.test(l)) {
    console.log(l);
  }
}
console.log('--- sample map entries ---');
const m = t.match(/\[['`'][^'`']+['`'],\s*\w+/g) || [];
console.log(m.slice(0, 30).join('\n'));

const components = fs.readFileSync(
  'bq/node_modules/@sitecore-content-sdk/content/dist/cjs/tools/templating/components.js',
  'utf8',
);
const i = components.indexOf('componentName');
console.log('\n--- components.js around componentName ---');
console.log(components.slice(Math.max(0, i - 200), i + 1200));
