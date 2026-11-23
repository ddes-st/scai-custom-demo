/**
 * Run: node --import tsx --test tools/shared/sitecore-auth.endpoint.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  isRetryableCliLoginFailure,
  lookupSitecoreEndpoint,
  requireSitecoreEndpointName,
  resolveAutomationClient,
  runWithCliLoginRetries,
} from './sitecore-auth.ts';
import { parseSitecoreEndpoint } from './generate-scope.ts';

const DISCOVERY_FAILURE =
  'Error discovering identity provider. Perhaps the authority hostname, https://auth.sitecorecloud.io/, is not valid or it is not serving OpenID metadata (/.well-known/openid-configuration).';

const ENV_KEY = 'BQ_SITECORE_ENDPOINT';
const AUTH_ID = 'SITECORE_AUTH_CLIENT_ID';
const AUTH_SECRET = 'SITECORE_AUTH_CLIENT_SECRET';

describe('requireSitecoreEndpointName', () => {
  /** @type {string | undefined} */
  let prev;

  beforeEach(() => {
    prev = process.env[ENV_KEY];
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  });

  it('throws when unset and no arg', () => {
    assert.throws(
      () => requireSitecoreEndpointName(),
      (err) =>
        err instanceof Error &&
        /BQ_SITECORE_ENDPOINT/.test(err.message) &&
        /--endpoint/.test(err.message),
    );
  });

  it('uses env when set', () => {
    process.env[ENV_KEY] = 'bqAuthoring';
    assert.equal(requireSitecoreEndpointName(), 'bqAuthoring');
  });

  it('explicit endpointName wins over env', () => {
    process.env[ENV_KEY] = 'fromEnv';
    assert.equal(requireSitecoreEndpointName('fromCli'), 'fromCli');
  });
});

describe('parseSitecoreEndpoint', () => {
  it('reads --endpoint', () => {
    assert.equal(
      parseSitecoreEndpoint(['--endpoint', 'bqAuthoring']),
      'bqAuthoring',
    );
  });

  it('reads --endpointName', () => {
    assert.equal(
      parseSitecoreEndpoint(['--endpointName', 'other']),
      'other',
    );
  });

  it('returns undefined when omitted', () => {
    assert.equal(parseSitecoreEndpoint(['--url', 'https://example.com']), undefined);
  });
});

describe('resolveAutomationClient', () => {
  /** @type {Record<string, string | undefined>} */
  let prev = {};

  beforeEach(() => {
    for (const k of [AUTH_ID, AUTH_SECRET]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of [AUTH_ID, AUTH_SECRET]) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('returns undefined when SITECORE_AUTH_* unset', () => {
    assert.equal(
      resolveAutomationClient({ name: 'bqAuthoring' }),
      undefined,
    );
  });

  it('uses SITECORE_AUTH_*', () => {
    process.env[AUTH_ID] = 'auth-id';
    process.env[AUTH_SECRET] = 'auth-secret';
    assert.deepEqual(resolveAutomationClient({ name: 'bqAuthoring' }), {
      clientId: 'auth-id',
      clientSecret: 'auth-secret',
    });
  });

  it('prefers explicit credentials over env', () => {
    process.env[AUTH_ID] = 'env-id';
    process.env[AUTH_SECRET] = 'env-secret';
    assert.deepEqual(
      resolveAutomationClient(
        { name: 'bqAuthoring' },
        { clientId: 'explicit-id', clientSecret: 'explicit-secret' },
      ),
      { clientId: 'explicit-id', clientSecret: 'explicit-secret' },
    );
  });
});

describe('lookupSitecoreEndpoint', () => {
  const user = {
    endpoints: {
      bqAuthoring: {
        host: 'https://example.sitecorecloud.io',
        allowWrite: true,
      },
      xmCloud: {
        host: 'https://xmcloud.example',
        allowWrite: false,
      },
    },
  };

  it('resolves a known endpoint name', () => {
    const ep = lookupSitecoreEndpoint(user, 'bqAuthoring');
    assert.equal(ep.name, 'bqAuthoring');
    assert.equal(ep.host, 'https://example.sitecorecloud.io');
  });

  it('throws listing available keys when name missing', () => {
    assert.throws(
      () => lookupSitecoreEndpoint(user, 'missing'),
      (err) =>
        err instanceof Error &&
        /Endpoint "missing" not found/.test(err.message) &&
        /bqAuthoring/.test(err.message) &&
        /xmCloud/.test(err.message),
    );
  });
});

describe('isRetryableCliLoginFailure', () => {
  it('matches identity provider discovery failures', () => {
    assert.equal(isRetryableCliLoginFailure(DISCOVERY_FAILURE), true);
  });

  it('matches common connectivity errors', () => {
    assert.equal(isRetryableCliLoginFailure('connect ETIMEDOUT'), true);
    assert.equal(isRetryableCliLoginFailure('getaddrinfo ENOTFOUND'), true);
    assert.equal(isRetryableCliLoginFailure('read ECONNRESET'), true);
  });

  it('ignores credential / config failures', () => {
    assert.equal(
      isRetryableCliLoginFailure(
        'Token request failed (401). SITECORE_AUTH_CLIENT_ID/SECRET were rejected',
      ),
      false,
    );
    assert.equal(isRetryableCliLoginFailure('invalid_client'), false);
    assert.equal(isRetryableCliLoginFailure(''), false);
  });
});

describe('runWithCliLoginRetries', () => {
  it('retries discovery failure then succeeds', async () => {
    let calls = 0;
    const sleeps = [];
    const result = await runWithCliLoginRetries(
      async () => {
        calls += 1;
        if (calls === 1) {
          return { exitCode: 1, output: DISCOVERY_FAILURE };
        }
        return { exitCode: 0, output: 'ok' };
      },
      {
        delayMs: 10,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(calls, 2);
    assert.deepEqual(sleeps, [10]);
  });

  it('does not retry credential failures', async () => {
    let calls = 0;
    const result = await runWithCliLoginRetries(
      async () => {
        calls += 1;
        return {
          exitCode: 1,
          output:
            'Token request failed (401). SITECORE_AUTH_CLIENT_ID/SECRET were rejected',
        };
      },
      { delayMs: 10, sleep: async () => {} },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(calls, 1);
  });
});
