import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { nextSignedInRedirectState } from '../src/lib/signed-in-redirect-policy.mjs';

function createSignedInRedirectHarness() {
  const sourcePath = fileURLToPath(
    new URL('../src/components/SignedInRedirect.tsx', import.meta.url),
  );
  const compiled = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText;

  const redirects = [];
  const router = {
    replace(destination) {
      redirects.push(destination);
    },
  };
  let sessionState = { loading: true, session: null };
  let hookIndex = 0;
  const refs = [];
  const react = {
    useEffect(callback) {
      hookIndex += 1;
      callback();
    },
    useRef(initialValue) {
      const index = hookIndex;
      hookIndex += 1;
      refs[index] ||= { current: initialValue };
      return refs[index];
    },
  };
  const module = { exports: {} };

  Function('require', 'module', 'exports', compiled)(
    (specifier) => {
      if (specifier === 'next/navigation') return { useRouter: () => router };
      if (specifier === 'react') return react;
      if (specifier === '@/components/AuthSessionProvider') {
        return { useAuthSession: () => sessionState };
      }
      if (specifier === '@/lib/signed-in-redirect-policy.mjs') {
        return { nextSignedInRedirectState };
      }
      throw new Error(`Unexpected SignedInRedirect dependency: ${specifier}`);
    },
    module,
    module.exports,
  );

  return {
    redirects,
    router,
    render(nextState, returnTo = '/play') {
      sessionState = nextState;
      hookIndex = 0;
      module.exports.default({ returnTo });
    },
  };
}

test('a session created after an unauthenticated render does not override registration routing', () => {
  const unauthenticated = nextSignedInRedirectState({
    loading: false,
    hasSession: false,
    sawUnauthenticated: false,
  });

  assert.deepEqual(unauthenticated, {
    redirect: false,
    sawUnauthenticated: true,
  });

  assert.deepEqual(
    nextSignedInRedirectState({
      loading: false,
      hasSession: true,
      sawUnauthenticated: unauthenticated.sawUnauthenticated,
    }),
    {
      redirect: false,
      sawUnauthenticated: true,
    },
  );
});

test('a session present on the initial resolved render still redirects', () => {
  assert.deepEqual(
    nextSignedInRedirectState({
      loading: false,
      hasSession: true,
      sawUnauthenticated: false,
    }),
    {
      redirect: true,
      sawUnauthenticated: false,
    },
  );
});

test('the real redirect component does not race registration form navigation', () => {
  const harness = createSignedInRedirectHarness();

  harness.render({ loading: false, session: null });
  harness.render({
    loading: false,
    session: { user: { id: 'new-user', username: 'new-user' } },
  });
  // CredentialAuthForm performs this navigation after registerArenaUser has
  // published the session to AuthSessionProvider.
  harness.router.replace('/founding402/claim');

  assert.deepEqual(harness.redirects, ['/founding402/claim']);
});

test('the real redirect component still moves an initially authenticated user', () => {
  const harness = createSignedInRedirectHarness();

  harness.render({
    loading: false,
    session: { user: { id: 'existing-user', username: 'existing-user' } },
  }, '/agents');

  assert.deepEqual(harness.redirects, ['/agents']);
});
