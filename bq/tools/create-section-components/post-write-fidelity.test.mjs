/**
 * Post-write: capture-only vs full visual fidelity path.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { runPostWriteFidelity } from './post-write-fidelity.mjs';

const ENV_KEYS = [
  'BQ_VISUAL_FIDELITY',
  'BQ_VISUAL_FIDELITY_MAX_ITERS',
  'BQ_SOURCE_FIDELITY',
  'BQ_SOURCE_FIDELITY_MAX_ITERS',
  'BQ_VISUAL_CAPTURE_ONLY',
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  mock.restoreAll();
});

function baseOpts(overrides = {}) {
  return {
    role: 'section',
    plan: { mode: 'single', section: { placeholderKey: 'main' } },
    pageDir: '/tmp/page',
    sectionFolder: 'section-01',
    info: {},
    hostSlug: 'crelan-be',
    componentName: 'CrelanHero',
    childComponentNames: [],
    tsxPath: '/tmp/x.tsx',
    definitionPath: '/tmp/x.definition.ts',
    ...overrides,
  };
}

describe('runPostWriteFidelity capture-only', () => {
  it('calls capture helper when fidelity off and capture on; does not score', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    process.env.BQ_SOURCE_FIDELITY = 'false';
    delete process.env.BQ_VISUAL_CAPTURE_ONLY;

    let captureCalls = 0;
    const captureRenderedPreview = async () => {
      captureCalls += 1;
      return {
        ok: true,
        outDir: '/tmp/page/sections/section-01/visual-fidelity/attempt-1/shots',
        captureResults: { desktop: {} },
        notes: 'captured 1 viewport(s)',
      };
    };

    const result = await runPostWriteFidelity({
      ...baseOpts(),
      captureRenderedPreview,
    });

    assert.equal(captureCalls, 1);
    assert.equal(result.applied, false);
    assert.match(result.notes, /visual capture only/);
    assert.equal(result.capture?.ok, true);
  });

  it('skips capture helper when BQ_VISUAL_CAPTURE_ONLY=false', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    process.env.BQ_SOURCE_FIDELITY = 'false';
    process.env.BQ_VISUAL_CAPTURE_ONLY = 'false';

    let captureCalls = 0;
    const result = await runPostWriteFidelity({
      ...baseOpts(),
      captureRenderedPreview: async () => {
        captureCalls += 1;
        return { ok: true, outDir: '', captureResults: {}, notes: '' };
      },
    });

    assert.equal(captureCalls, 0);
    assert.equal(result.notes, 'no fidelity mode enabled');
    assert.equal(result.capture, null);
  });

  it('skips capture-only for composite children', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    process.env.BQ_SOURCE_FIDELITY = 'false';

    let captureCalls = 0;
    const result = await runPostWriteFidelity({
      ...baseOpts({
        role: 'child',
        plan: { mode: 'composite', section: {} },
      }),
      captureRenderedPreview: async () => {
        captureCalls += 1;
        return { ok: true, outDir: '', captureResults: {}, notes: '' };
      },
    });

    assert.equal(captureCalls, 0);
    assert.match(result.notes, /no fidelity mode enabled|skip source fidelity/);
  });

  it('does not call capture-only when visual fidelity is on (loop owns capture)', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'true';
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = '1';

    let captureCalls = 0;
    let loopCalls = 0;
    const result = await runPostWriteFidelity({
      ...baseOpts(),
      captureRenderedPreview: async () => {
        captureCalls += 1;
        throw new Error('capture-only must not run when fidelity on');
      },
      runVisualFidelityLoop: async () => {
        loopCalls += 1;
        return {
          applied: false,
          iterations: 0,
          score: 100,
          notes: 'stub loop',
          pass: true,
        };
      },
    });

    assert.equal(captureCalls, 0);
    assert.equal(loopCalls, 1);
    assert.equal(result.notes, 'stub loop');
  });

  it('visualFidelityHandled + VF on: scores composed packages under sitecoreize-proof', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'true';
    process.env.BQ_VISUAL_FIDELITY_MAX_ITERS = '1';
    process.env.BQ_SOURCE_FIDELITY = 'false';
    delete process.env.BQ_VISUAL_CAPTURE_ONLY;

    let captureCalls = 0;
    let loopCalls = 0;
    /** @type {object|null} */
    let lastLoopOpts = null;
    const result = await runPostWriteFidelity({
      ...baseOpts({ visualFidelityHandled: true }),
      captureRenderedPreview: async () => {
        captureCalls += 1;
        throw new Error('capture-only must not run when VF scores proof');
      },
      runVisualFidelityLoop: async (loopOpts) => {
        loopCalls += 1;
        lastLoopOpts = loopOpts;
        return {
          applied: true,
          iterations: 1,
          score: 96,
          notes: 'proof scored',
          pass: true,
        };
      },
    });

    assert.equal(captureCalls, 0);
    assert.equal(loopCalls, 1);
    assert.match(String(lastLoopOpts?.outRoot || ''), /sitecoreize-proof/);
    assert.equal(result.pass, true);
    assert.equal(result.proofSubdir, 'sitecoreize-proof');
  });

  it('visualFidelityHandled + capture-only: proof capture without chrome CONTRACT', async () => {
    process.env.BQ_VISUAL_FIDELITY = 'false';
    process.env.BQ_SOURCE_FIDELITY = 'false';
    delete process.env.BQ_VISUAL_CAPTURE_ONLY;

    let captureCalls = 0;
    const result = await runPostWriteFidelity({
      ...baseOpts({
        visualFidelityHandled: true,
        visualTsx: `
          export default function V() {
            return <div className="bg-[#d7f4ed]"><img /><a className="border px-4 py-2 inline-flex">Go</a></div>;
          }
        `,
        packages: [
          {
            role: 'section',
            componentName: 'Host',
            tsx: '<div className="bg-[#d7f4ed]"><Image /><Link className="border px-4 py-2 inline-flex" /></div>',
            definitionTs: '',
          },
        ],
      }),
      captureRenderedPreview: async (captureOpts) => {
        captureCalls += 1;
        assert.equal(captureOpts.outSubdir, 'sitecoreize-proof');
        return {
          ok: true,
          outDir:
            '/tmp/page/sections/section-01/visual-fidelity/sitecoreize-proof/shots',
          captureResults: { desktop: {} },
          notes: 'captured 1 viewport(s)',
        };
      },
    });

    assert.equal(captureCalls, 1);
    assert.equal(result.applied, false);
    assert.match(result.notes, /visual capture only/);
  });

});
