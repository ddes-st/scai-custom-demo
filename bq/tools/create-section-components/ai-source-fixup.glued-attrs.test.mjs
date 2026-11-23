/**
 * Run: node --test tools/create-section-components/ai-source-fixup.glued-attrs.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fixGluedJsxTagAttributes } from './ai-source-fixup.mjs';
import { formatGeneratedSource } from './format-generated-source.mjs';

describe('fixGluedJsxTagAttributes', () => {
  it('inserts space between tag and className', () => {
    assert.equal(
      fixGluedJsxTagAttributes('<divclassName="x">'),
      '<div className="x">',
    );
  });

  it('inserts space for Link field and input name', () => {
    assert.match(
      fixGluedJsxTagAttributes('<Linkfield={fields.A} />'),
      /<Link field=\{/,
    );
    assert.match(
      fixGluedJsxTagAttributes('<inputname="term" type="search" />'),
      /<input name="term"/,
    );
  });

  it('inserts space between adjacent attributes', () => {
    const out = fixGluedJsxTagAttributes(
      '<button type="button"aria-expanded={open} onClick={fn}>',
    );
    assert.match(out, /type="button" aria-expanded=\{/);
  });

  it('leaves valid JSX alone', () => {
    const src = '<div className="x"><span id="y" /></div>';
    assert.equal(fixGluedJsxTagAttributes(src), src);
  });

  it('salvage enables Prettier on MenuBand-like glued dump', async () => {
    const broken = `export default function Chrome({ fields }: { fields: any }) {
  return <><div className="row"><button type="button"aria-expanded={true} className="x">menu</button><divclassName="panel">ok</div></div><form action="/zoek"method="get"><inputname="term" type="search" /></form></>;
}
`;
    const salvaged = fixGluedJsxTagAttributes(broken);
    const pretty = await formatGeneratedSource(salvaged, {
      filepath: 'menzis-header-menu-band.client.tsx',
    });
    assert.match(pretty, /div className=/);
    assert.match(pretty, /input name=/);
    assert.match(pretty, /\n/);
  });
});
