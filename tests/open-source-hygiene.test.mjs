import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = file => JSON.parse(read(file));

test('the root package is publishable', () => {
  assert.equal(Object.hasOwn(readJson('package.json'), 'private'), false);
});

test('the client distribution guide exists and names every manifest', () => {
  const guide = read('docs/clients.md');
  for (const manifest of [
    '.codex-plugin/plugin.json',
    '.claude-plugin/plugin.json',
    '.qoder-plugin/plugin.json',
    '.cursor-plugin/plugin.json'
  ]) assert.match(guide, new RegExp(manifest.replaceAll('.', '\\.').replaceAll('/', '\\/')));
});

test('public metadata uses the approved author name', () => {
  for (const file of [
    '.codex-plugin/plugin.json',
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    '.qoder-plugin/plugin.json',
    '.cursor-plugin/plugin.json'
  ]) {
    const metadata = read(file);
    assert.doesNotMatch(metadata, /Local developer/, file);
    assert.match(metadata, /Max Zheng/, file);
  }
});

test('IDE metadata is ignored', () => {
  assert.match(read('.gitignore'), /^\.idea\/$/m);
});

test('the README identifies QGraphFlow as an independent project', () => {
  const readme = read('README.md');
  assert.match(readme, /independent MIT-licensed project/);
  assert.match(readme, /no affiliation, sponsorship or endorsement is implied/);
});
