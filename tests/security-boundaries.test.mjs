import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function sourceFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : [path];
    })
    .filter((path) => SOURCE_EXTENSIONS.has(extname(path)));
}

test('browser bundles do not contain backend service-role credentials', () => {
  const files = [
    ...sourceFiles(fileURLToPath(new URL('../src', import.meta.url))),
  ];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    assert.equal(
      source.includes('service' + '_role'),
      false,
      `${path} contains a forbidden backend credential marker`,
    );
  }
});

test('security headers retain the production browser baseline', () => {
  const config = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');
  for (const header of [
    'Content-Security-Policy-Report-Only',
    'Permissions-Policy',
    'Referrer-Policy',
    'X-Content-Type-Options',
    'X-Frame-Options',
  ]) {
    assert.equal(config.includes(header), true, `${header} is missing`);
  }
});
