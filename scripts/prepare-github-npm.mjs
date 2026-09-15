#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const [directory, version] = process.argv.slice(2);
assert.ok(directory && /^\d+\.\d+\.\d+$/.test(version), 'Usage: prepare-github-npm.mjs <extracted-runtime> <version>');
const root = path.resolve(directory);
assert.ok(!fs.existsSync(path.join(root, 'scripts/package.mjs')), 'Use an extracted runtime, not the development checkout');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const pkg = read('package.json');
assert.equal(pkg.name, 'qgraphflow');
assert.equal(pkg.version, version);
assert.equal(pkg.repository?.url, 'https://github.com/supermax92/qgraphflow.git');
for (const client of ['.codex-plugin', '.claude-plugin', '.qoder-plugin', '.cursor-plugin']) {
  const manifest = read(`${client}/plugin.json`);
  assert.equal(manifest.name, 'qgraphflow', client);
  assert.equal(manifest.version, version, client);
}
assert.equal(read('.agents/plugins/marketplace.json').plugins[0].name, 'qgraphflow');
assert.equal(read('.claude-plugin/marketplace.json').plugins[0].name, 'qgraphflow');

// Only the registry envelope changes; client plugin identities and runtime stay intact.
pkg.name = '@supermax92/qgraphflow';
pkg.publishConfig = { registry: 'https://npm.pkg.github.com' };
delete pkg.scripts; // Development-only packaging scripts are absent from the runtime.
fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log(`${pkg.name}@${pkg.version} prepared for GitHub Packages`);
