#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'dist/showcase'));
const manifestFile = path.join(root, 'docs/showcase-media.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.ok(!fs.existsSync(destination), 'Choose a new media output directory; existing files are never overwritten.');
assert.equal(sha(path.join(root, 'skills/q-flow/assets/viewer-dist/index.html')), manifest.viewerSha256, 'Viewer changed: re-record the media.');
const assets = manifest.locales.flatMap(entry => {
  assert.equal(sha(path.join(root, entry.graph)), entry.graphSha256, `${entry.locale}: graph changed`);
  return entry.assets;
});
assert.ok(assets.length > 0, 'No media assets declared.');
assert.equal(new Set(assets.map(asset => asset.name)).size, assets.length, 'Duplicate media asset names.');
for (const asset of assets) {
  assert.match(asset.name, /^ecommerce\.[\w-]+\.[\w-]+\.(gif|png)$/);
  const file = path.join(root, manifest.directory, asset.name);
  assert.equal(fs.statSync(file).size, asset.bytes, `${asset.name}: size mismatch`);
  assert.equal(sha(file), asset.sha256, `${asset.name}: checksum mismatch`);
}
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.mkdirSync(destination);
for (const asset of assets) fs.copyFileSync(path.join(root, manifest.directory, asset.name), path.join(destination, asset.name), fs.constants.COPYFILE_EXCL);
fs.copyFileSync(manifestFile, path.join(destination, 'showcase-media.json'), fs.constants.COPYFILE_EXCL);
fs.writeFileSync(path.join(destination, 'SHA256SUMS'), [
  ...assets.map(asset => `${asset.sha256}  ${asset.name}`), `${sha(manifestFile)}  showcase-media.json`
].join('\n') + '\n', { flag: 'wx' });
console.log(JSON.stringify({ destination, assets: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) }));
