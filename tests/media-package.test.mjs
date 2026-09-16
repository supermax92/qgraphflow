import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('media packaging ships only verified receipts and refuses missing, stale or overwritten assets', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-media-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
    fs.writeFileSync(path.join(temp, file), value);
  };
  const hash = value => createHash('sha256').update(value).digest('hex');
  const asset = 'ecommerce.zh-CN.core-three.gif';
  write('scripts/package-media.mjs', fs.readFileSync(new URL('../scripts/package-media.mjs', import.meta.url)));
  write('skills/q-flow/assets/viewer-dist/index.html', 'viewer');
  write('examples/graph.json', '{}');
  write(`docs/images/showcase/${asset}`, 'GIF89a');
  write('docs/images/showcase/old-private-recording.gif', 'excluded');
  write('docs/showcase-media.json', JSON.stringify({
    status: 'published', directory: 'docs/images/showcase', viewerSha256: hash('viewer'),
    locales: [{ locale: 'zh-CN', graph: 'examples/graph.json', graphSha256: hash('{}'),
      assets: [{ name: asset, bytes: 6, sha256: hash('GIF89a') }] }]
  }));
  const run = output => spawnSync(process.execPath, ['scripts/package-media.mjs', output], { cwd: temp, encoding: 'utf8' });
  assert.equal(run('ready').status, 0);
  assert.deepEqual(fs.readdirSync(path.join(temp, 'ready')).sort(), ['SHA256SUMS', asset, 'showcase-media.json'].sort());
  assert.ok(fs.readFileSync(path.join(temp, 'ready/SHA256SUMS'), 'utf8').includes(`${hash('GIF89a')}  ${asset}\n`));
  assert.notEqual(run('ready').status, 0);
  assert.equal(fs.readFileSync(path.join(temp, 'ready', asset), 'utf8'), 'GIF89a');
  write(`docs/images/showcase/${asset}`, 'GIF89b');
  assert.match(run('bad-hash').stderr, /checksum mismatch/);
  assert.ok(!fs.existsSync(path.join(temp, 'bad-hash')));
  fs.unlinkSync(path.join(temp, 'docs/images/showcase', asset));
  assert.notEqual(run('missing').status, 0);
  assert.ok(!fs.existsSync(path.join(temp, 'missing')));
  write(`docs/images/showcase/${asset}`, 'GIF89a');
  write('examples/graph.json', '{"changed":true}');
  assert.match(run('bad-graph').stderr, /graph changed/);
  assert.ok(!fs.existsSync(path.join(temp, 'bad-graph')));
  write('examples/graph.json', '{}');
  write('skills/q-flow/assets/viewer-dist/index.html', 'new viewer');
  const stale = run('bad-viewer');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /Viewer changed/);
  assert.ok(!fs.existsSync(path.join(temp, 'bad-viewer')));
});
