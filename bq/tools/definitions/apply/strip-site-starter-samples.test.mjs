import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shouldStripXmCloudSiteStarterSamples,
  stripXmCloudSiteStarterSamples,
} from './strip-site-starter-samples.ts';

describe('shouldStripXmCloudSiteStarterSamples', () => {
  it('runs on created or first local materialize', () => {
    assert.equal(
      shouldStripXmCloudSiteStarterSamples({
        action: 'created',
        localSiteMissingBeforePull: false,
      }),
      true,
    );
    assert.equal(
      shouldStripXmCloudSiteStarterSamples({
        action: 'unchanged',
        localSiteMissingBeforePull: true,
      }),
      true,
    );
    assert.equal(
      shouldStripXmCloudSiteStarterSamples({
        action: 'updated',
        localSiteMissingBeforePull: false,
      }),
      false,
    );
    assert.equal(
      shouldStripXmCloudSiteStarterSamples({
        action: 'created',
        localSiteMissingBeforePull: true,
        skipPull: true,
      }),
      false,
    );
  });
});

describe('stripXmCloudSiteStarterSamples', () => {
  it('is a logged no-op under Authoring apply (no YAML)', () => {
    const logs = [];
    const changed = stripXmCloudSiteStarterSamples({
      collectionSystem: 'demo',
      siteSystem: 'demo-site',
      log: (msg) => logs.push(msg),
    });
    assert.deepEqual(changed, []);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /skip strip starter samples/);
  });
});
