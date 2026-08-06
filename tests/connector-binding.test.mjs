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

test('agent readiness uses the authoritative reusable-binding policy', () => {
  const consoleSource = readFileSync(
    new URL('../src/components/ConnectorConsole.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    consoleSource,
    /bindings\.some\(isConnectorBindingJoinable\)/,
    'starting, degraded, and unowned bindings must not unlock game entry',
  );
});

test('production hides the entire browser-created demo pairing control', () => {
  const consoleSource = readFileSync(
    new URL('../src/components/ConnectorConsole.tsx', import.meta.url),
    'utf8',
  );
  const demoGuard = consoleSource.indexOf('{CONNECTOR_DEMO_ENABLED && (');
  const demoLabel = consoleSource.indexOf('Demo and API testing');
  const demoInput = consoleSource.indexOf('connector-device-name');
  const demoEnd = consoleSource.indexOf(')}', demoInput);

  assert.ok(demoGuard >= 0 && demoGuard < demoLabel);
  assert.ok(demoLabel < demoInput && demoInput < demoEnd);
});

test('local onboarding begins with real installers and keeps task permission explicit', () => {
  const consoleSource = readFileSync(
    new URL('../src/components/ConnectorConsole.tsx', import.meta.url),
    'utf8',
  );
  const installerSource = readFileSync(
    new URL('../src/components/ConnectorInstaller.tsx', import.meta.url),
    'utf8',
  );
  const approvalSource = readFileSync(
    new URL('../src/app/connect/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(consoleSource, /<ConnectorInstaller/);
  assert.match(installerSource, /Download \{platform === 'windows'/);
  assert.match(installerSource, /checked=\{enableCodexTasks\}/);
  assert.match(installerSource, /hasTaskReadyRuntime/);
  assert.match(installerSource, /A macOS installer is not available yet/);
  assert.match(approvalSource, /href="\/agents#connect"/);
});
