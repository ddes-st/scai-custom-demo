import fs from 'node:fs';

for (const f of [
  'src/components/sites/axa-be-presentation.definition.ts',
  'src/components/sites/domsecurity-com-presentation.definition.ts',
]) {
  const t = fs.readFileSync(f, 'utf8');
  console.log(f, {
    collectionSystem: t.match(/collectionSystem:\s*"([^"]+)/)?.[1],
    siteSystem: t.match(/siteSystem:\s*"([^"]+)/)?.[1],
  });
}

// Fix corrupted collectionSystem on dom presentation
const domPath = 'src/components/sites/domsecurity-com-presentation.definition.ts';
let dom = fs.readFileSync(domPath, 'utf8');
dom = dom.replace(
  /collectionSystem:\s*"[^"]+"/,
  'collectionSystem: "domsecurity"',
);
fs.writeFileSync(domPath, dom);
console.log('fixed dom collectionSystem');

// Verify map has no duplicate aliases
const map = fs.readFileSync('.sitecore/component-map.ts', 'utf8');
const re = /import \* as (\w+) from/g;
const counts = {};
let m;
while ((m = re.exec(map))) counts[m[1]] = (counts[m[1]] || 0) + 1;
const dups = Object.entries(counts).filter(([, n]) => n > 1);
console.log('duplicate import aliases:', dups);
const keyRe = /\['([^']+)'/g;
const keyCounts = {};
while ((m = keyRe.exec(map))) keyCounts[m[1]] = (keyCounts[m[1]] || 0) + 1;
const keyDups = Object.entries(keyCounts).filter(([, n]) => n > 1);
console.log('duplicate map keys:', keyDups.slice(0, 20));
