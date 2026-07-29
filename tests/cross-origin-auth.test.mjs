import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScriptModule } from './load-typescript.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function session(csrfToken = 'session-csrf-token') {
  return {
    user: {
      user_id: 'user_123',
      username: 'octo-cat',
      temporary: false,
      auth_provider: 'github',
    },
    csrf_token: csrfToken,
  };
}

function loadStack() {
  const arenaHttp = loadTypeScriptModule(
    new URL('../src/lib/arena-http.ts', import.meta.url),
  );
  const platformApi = loadTypeScriptModule(
    new URL('../src/lib/platform-api.ts', import.meta.url),
    { '@/lib/arena-http': arenaHttp },
  );
  return {
    arenaHttp,
    platformApi,
    connectorApi: loadTypeScriptModule(
      new URL('../src/lib/connector-api.ts', import.meta.url),
      { '@/lib/arena-http': arenaHttp },
    ),
    hostedAgentApi: loadTypeScriptModule(
      new URL('../src/lib/hosted-agent-api.ts', import.meta.url),
      { '@/lib/arena-http': arenaHttp },
    ),
    gameApi: loadTypeScriptModule(
      new URL('../src/lib/game-api.ts', import.meta.url),
      { '@/lib/platform-api': platformApi },
    ),
  };
}

test('shared transport obtains CSRF from the credentialed API session', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse(session());
    }
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
  };

  try {
    const { hostedAgentApi } = loadStack();
    const result = await hostedAgentApi.createModelCredential(
      { providerId: 'deepseek', apiKey: 'test-provider-key' },
      'credential-key',
    );
    assert.equal(result.credentialId, 'credential_123');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.credentials, 'include');
    assert.equal(calls[1].init.credentials, 'include');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('owner-scoped Hosted Agent PATCH uses shared CSRF and idempotency', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse(session());
    }
    assert.equal(String(url).endsWith('/api/hosted-agents/agent-test222'), true);
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
  };

  try {
    const { hostedAgentApi } = loadStack();
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
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Current Game mutation uses cross-origin credentials and shared CSRF', async () => {
  const calls = [];
  const previousFetch = globalThis.fetch;
  const previousApiUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'https://api.arena402.test';
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      return jsonResponse(session());
    }
    assert.equal(
      new Headers(init.headers).get('X-CSRF-Token'),
      'session-csrf-token',
    );
    return jsonResponse({
      gameId: 'game-current',
      agentId: 'agent-current',
      eligible: true,
      readyToJoin: true,
      joinAuthorizationId: 'join-authorization',
      checks: {},
      mandateRequirements: {},
      safeErrorCode: null,
    });
  };

  try {
    const { gameApi } = loadStack();
    await gameApi.getJoinPreflight(
      'game-current',
      'agent-current',
      'join-preflight-key',
    );
    assert.deepEqual(
      calls.map(({ url }) => new URL(url).pathname),
      ['/api/auth/session', '/api/v1/games/game-current/join-preflight'],
    );
    assert.equal(calls.every(({ init }) => init.credentials === 'include'), true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = previousApiUrl;
  }
});

test('stale CSRF refreshes the session and retries one idempotent mutation', async () => {
  const requests = [];
  const previousFetch = globalThis.fetch;
  let sessionCount = 0;
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith('/api/auth/session')) {
      sessionCount += 1;
      return jsonResponse(session(sessionCount === 1 ? 'stale-token' : 'fresh-token'));
    }
    const token = new Headers(init.headers).get('X-CSRF-Token');
    if (token === 'stale-token') return jsonResponse({ detail: 'csrf_required' }, 403);
    assert.equal(token, 'fresh-token');
    return jsonResponse({ ok: true });
  };

  try {
    const { arenaHttp } = loadStack();
    assert.deepEqual(
      await arenaHttp.arenaHttpRequest(
        '/api/idempotent',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': 'stable-key' },
          body: '{}',
        },
        { csrf: true },
      ),
      { ok: true },
    );
    assert.equal(sessionCount, 2);
    assert.equal(requests.length, 4);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('expired session becomes authentication_required', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({ detail: 'Invalid or expired session' }, 401);
  try {
    const { gameApi, platformApi } = loadStack();
    await assert.rejects(
      gameApi.getJoinPreflight('game', 'agent', 'key'),
      (error) =>
        error instanceof platformApi.ArenaApiError
        && error.status === 401
        && error.code === 'authentication_required',
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('public Connector pairing remains available without an auth session or owner id', async () => {
  const previousFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init = {}) => {
    body = JSON.parse(init.body);
    assert.equal(new Headers(init.headers).get('X-CSRF-Token'), null);
    return jsonResponse({
      pairing_id: 'pairing_123',
      user_code: 'ABCD-EFGH',
      expires_at: '2026-07-25T01:00:00Z',
      status: 'pending',
    }, 201);
  };

  try {
    const { connectorApi } = loadStack();
    const pairing = await connectorApi.createPairing({
      device_name: 'Local connector',
    });
    assert.equal(pairing.pairing_id, 'pairing_123');
    assert.deepEqual(body, { device_name: 'Local connector' });
    assert.equal(Object.hasOwn(body, 'owner_id'), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
