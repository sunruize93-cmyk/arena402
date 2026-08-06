import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('local runtime binding freezes a non-empty managed workspace', () => {
  const api = readFileSync(
    new URL('../src/lib/connector-api.ts', import.meta.url),
    'utf8',
  );
  const consoleSource = readFileSync(
    new URL('../src/components/ConnectorConsole.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    api,
    /input:\s*\{[^}]*working_directory:\s*string/s,
    'the connector binding API must require working_directory',
  );
  assert.match(
    consoleSource,
    /working_directory:\s*workspaceDraft\.trim\(\)/,
    'the UI must freeze the selected workspace while creating the binding',
  );
  assert.match(
    consoleSource,
    /disabled=\{[^}]*!workspaceDraft\.trim\(\)[^}]*\}/s,
    'binding must stay disabled until a workspace is provided',
  );
});
