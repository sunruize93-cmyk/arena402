import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

function loadTypeScriptModule(path, dependencies = {}) {
  const filePath = path instanceof URL ? fileURLToPath(path) : path;
  const source = readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  Function('require', 'module', 'exports', compiled)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Hosted credential creation obtains CSRF from the authenticated API session', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;

  globalThis.document = undefined;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse({
        user: {
          user_id: 'user_123',
          username: 'octo-cat',
          temporary: false,
          auth_provider: 'github',
        },
        csrf_token: 'session-csrf-token',
      });
    }
    if (String(url).endsWith('/api/model-credentials')) {
      assert.equal(
        new Headers(init.headers).get('X-CSRF-Token'),
        'session-csrf-token',
      );
      return jsonResponse({
        credentialId: 'credential_123',
        providerId: 'deepseek',
        status: 'stored',
        fingerprintHint: 'abcd',
        createdAt: '2026-07-25T00:00:00Z',
        updatedAt: '2026-07-25T00:00:00Z',
        schemaVersion: 'arena.model-credential.v1',
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const hostedAgentApi = loadTypeScriptModule(
      new URL('../src/lib/hosted-agent-api.ts', import.meta.url),
      { '@/lib/connector-api': connectorApi },
    );

    const credential = await hostedAgentApi.createModelCredential(
      { providerId: 'deepseek', apiKey: 'test-provider-key' },
      'hosted-credential-test',
    );

    assert.equal(credential.credentialId, 'credential_123');
    assert.deepEqual(
      calls.map(({ url }) => new URL(url, 'https://www.arena402.com').pathname),
      ['/api/auth/session', '/api/model-credentials'],
    );
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.document = previousDocument;
  }
});

test('Hosted Agent reconfiguration uses the owner-scoped PATCH route with CSRF', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;

  globalThis.document = undefined;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse({
        user: {
          user_id: 'user_123',
          username: 'octo-cat',
          temporary: false,
          auth_provider: 'github',
        },
        csrf_token: 'session-csrf-token',
      });
    }
    if (String(url).endsWith('/api/hosted-agents/agent-test222')) {
      assert.equal(init.method, 'PATCH');
      assert.equal(
        new Headers(init.headers).get('X-CSRF-Token'),
        'session-csrf-token',
      );
      assert.equal(
        new Headers(init.headers).get('Idempotency-Key'),
        'hosted-update-test222',
      );
      return jsonResponse({
        agentId: 'agent-test222',
        displayName: 'test222',
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        thinkingEnabled: false,
        provisioningStatus: 'provisioning',
        routeStatus: 'provisioning',
        createdAt: '2026-07-28T00:00:00Z',
        updatedAt: '2026-07-28T01:00:00Z',
        schemaVersion: 'arena.hosted-control-plane.v1',
      }, 202);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const hostedAgentApi = loadTypeScriptModule(
      new URL('../src/lib/hosted-agent-api.ts', import.meta.url),
      { '@/lib/connector-api': connectorApi },
    );

    const updated = await hostedAgentApi.updateHostedAgent(
      'agent-test222',
      {
        providerId: 'deepseek',
        modelId: 'deepseek-chat',
        thinkingEnabled: false,
        strategyInstructions: 'Counter when the opening spread is wide.',
      },
      'hosted-update-test222',
    );

    assert.equal(updated.agentId, 'agent-test222');
    assert.deepEqual(
      calls.map(({ url }) => new URL(url, 'https://www.arena402.com').pathname),
      ['/api/auth/session', '/api/hosted-agents/agent-test222'],
    );
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.document = previousDocument;
  }
});

test('Current Game mutations obtain CSRF from the cross-origin API session', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousDocument = globalThis.document;
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

  process.env.NEXT_PUBLIC_API_URL = 'https://api.arena402.test';
  globalThis.document = {
    get cookie() {
      throw new Error('Cross-origin API cookies are not readable from the app origin.');
    },
  };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse({
        user: {
          user_id: 'user_123',
          username: 'octo-cat',
          temporary: false,
          auth_provider: 'github',
        },
        csrf_token: 'session-csrf-token',
      });
    }
    if (String(url).endsWith('/api/v1/games/game-current/join-preflight')) {
      assert.equal(
        new Headers(init.headers).get('X-CSRF-Token'),
        'session-csrf-token',
      );
      assert.equal(
        new Headers(init.headers).get('Idempotency-Key'),
        'join-preflight-key',
      );
      return jsonResponse({
        gameId: 'game-current',
        agentId: 'agent-current',
        joinAuthorizationId: 'join-authorization',
        checks: {},
        mandateRequirements: {},
        safeErrorCode: null,
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const platformApi = loadTypeScriptModule(
      new URL('../src/lib/platform-api.ts', import.meta.url),
    );
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': platformApi,
        '@/lib/connector-api': connectorApi,
      },
    );

    await gameApi.getJoinPreflight(
      'game-current',
      'agent-current',
      'join-preflight-key',
    );

    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname),
      ['/api/auth/session', '/api/v1/games/game-current/join-preflight'],
    );
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[1].init.credentials, 'include');
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.document = previousDocument;
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  }
});

test('Current Game mutations surface an expired API session as authentication_required', async () => {
  const previousFetch = globalThis.fetch;
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;

  process.env.NEXT_PUBLIC_API_URL = 'https://api.arena402.test';
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse({ detail: 'Invalid or expired session' }, 401);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const platformApi = loadTypeScriptModule(
      new URL('../src/lib/platform-api.ts', import.meta.url),
    );
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': platformApi,
        '@/lib/connector-api': connectorApi,
      },
    );

    await assert.rejects(
      gameApi.getJoinPreflight(
        'game-current',
        'agent-current',
        'join-preflight-key',
      ),
      (error) => (
        error instanceof platformApi.ArenaApiError
        && error.status === 401
        && error.code === 'authentication_required'
      ),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  }
});

test('Current Game mutations retry one transient CSRF session network failure', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let sessionAttempts = 0;

  process.env.NEXT_PUBLIC_API_URL = 'https://api.arena402.test';
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/api/auth/session')) {
      sessionAttempts += 1;
      if (sessionAttempts === 1) {
        throw new TypeError('temporary session network failure');
      }
      return jsonResponse({
        user: {
          user_id: 'user_123',
          username: 'octo-cat',
          temporary: false,
          auth_provider: 'github',
        },
        csrf_token: 'session-csrf-token',
      });
    }
    if (String(url).endsWith('/api/v1/games/game-current/join-preflight')) {
      return jsonResponse({
        gameId: 'game-current',
        agentId: 'agent-current',
        joinAuthorizationId: 'join-authorization',
        checks: {},
        mandateRequirements: {},
        safeErrorCode: null,
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const platformApi = loadTypeScriptModule(
      new URL('../src/lib/platform-api.ts', import.meta.url),
    );
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const gameApi = loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      {
        '@/lib/platform-api': platformApi,
        '@/lib/connector-api': connectorApi,
      },
    );

    await gameApi.getJoinPreflight(
      'game-current',
      'agent-current',
      'join-preflight-key',
    );

    assert.equal(sessionAttempts, 2);
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
    }
  }
});

test('Public Connector pairing remains available without an auth session', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/connectors/pairings')) {
      assert.equal(new Headers(init.headers).get('X-CSRF-Token'), null);
      return jsonResponse(
        {
          pairing_id: 'pairing_123',
          user_code: 'ABCD-EFGH',
          expires_at: '2026-07-25T01:00:00Z',
          status: 'pending',
        },
        201,
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const connectorApi = loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
    );
    const pairing = await connectorApi.createPairing({
      device_name: 'Local connector',
    });

    assert.equal(pairing.pairing_id, 'pairing_123');
    assert.deepEqual(
      calls.map(({ url }) => new URL(url, 'https://www.arena402.com').pathname),
      ['/api/connectors/pairings'],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
