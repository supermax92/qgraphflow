import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const manifests = ['.codex-plugin', '.claude-plugin', '.qoder-plugin', '.cursor-plugin'];

test('the distributed package declares and ships its license notices', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-license-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  assert.equal(readJson(path.join(root, 'package.json')).license, 'MIT');
  const result = spawnSync('npm', ['pack', '--ignore-scripts', '--dry-run', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, npm_config_cache: path.join(temp, 'npm-cache'), npm_config_offline: 'true' }
  });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}\n${result.stdout}`);
  const [packed] = JSON.parse(result.stdout);
  assert.ok(packed.files.some(file => file.path === 'LICENSE'), 'Missing packaged file: LICENSE');
  assert.ok(packed.files.some(file => file.path === 'THIRD_PARTY_NOTICES.md'), 'Missing packaged file: THIRD_PARTY_NOTICES.md');
  const notices = fs.readFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8').trim();
  assert.match(notices, /Copyright \(c\) 2013-present Cole Bemis/, 'Missing Lucide upstream Feather MIT notice');
  const standaloneViewer = fs.readFileSync(path.join(root, 'skills/q-flow/assets/viewer-dist/index.html'), 'utf8');
  assert.ok(standaloneViewer.includes(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').trim()), 'Standalone viewer must embed the project license');
  assert.ok(standaloneViewer.includes(notices), 'Standalone viewer must embed the complete third-party notices');
});

test('the distributed plugin runs independently from its installed location', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-package-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const run = (command, args, cwd = root) => {
    const result = spawnSync(command, args, {
      cwd, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, npm_config_cache: path.join(temp, 'npm-cache'), npm_config_offline: 'true' }
    });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stderr}\n${result.stdout}`);
    return result.stdout;
  };
  const pkg = readJson(path.join(root, 'package.json'));
  const viewer = readJson(path.join(root, 'skills/q-flow/assets/viewer/package.json'));
  const viewerLock = readJson(path.join(root, 'skills/q-flow/assets/viewer/package-lock.json'));
  assert.equal(viewer.version, pkg.version);
  assert.equal(viewerLock.version, pkg.version);
  assert.equal(viewerLock.packages[''].version, pkg.version);
  for (const directory of manifests) {
    const manifest = readJson(path.join(root, directory, 'plugin.json'));
    assert.equal(manifest.name, pkg.name, directory);
    assert.equal(manifest.version, pkg.version, directory);
  }
  const claudeMarket = readJson(path.join(root, '.claude-plugin/marketplace.json'));
  const codexMarket = readJson(path.join(root, '.agents/plugins/marketplace.json'));
  for (const market of [claudeMarket, codexMarket]) {
    assert.equal(market.name, 'qgraphflow-local');
    assert.equal(market.plugins.length, 1);
    assert.equal(market.plugins[0].name, pkg.name);
  }
  assert.equal(claudeMarket.plugins[0].version, pkg.version);
  assert.equal(claudeMarket.plugins[0].source, './');
  assert.deepEqual(codexMarket.plugins[0].source, { source: 'local', path: './' });

  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp]));
  const files = new Set(packed.files.map(file => file.path));
  for (const required of [
    ...manifests.map(directory => `${directory}/plugin.json`),
    '.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json',
    'skills/q-flow/SKILL.md', 'skills/q-flow/agents/openai.yaml',
    'skills/q-flow/references/graph-schema.md', 'skills/q-flow/assets/viewer-dist/index.html',
    'skills/q-flow/scripts/generate-viewer.mjs', 'skills/q-flow/scripts/validate-graph.mjs',
    'skills/q-flow/assets/viewer/src/playback.js', 'skills/q-flow/assets/viewer/src/radix-colors.js',
    'skills/q-flow/assets/viewer/src/edge-routing.js', 'skills/q-flow/assets/viewer/src/diagrams/registry.js',
    'README.md', 'docs/clients.md', 'examples/order-flow.graph.json', 'docs/images/order-flow.svg'
  ]) assert.ok(files.has(required), `Missing packaged file: ${required}`);
  for (const file of files) {
    assert.ok(!/(^|\/)(node_modules|\.git|\.idea|\.DS_Store)(\/|$)/.test(file), file);
    assert.ok(!/^(tests|openspec|docs\/(qa|qgraphflow|superpowers))\//.test(file), file);
    assert.ok(!/\.(tgz|zip)$/.test(file), file);
  }

  const installed = path.join(temp, '安装目录 with spaces');
  fs.mkdirSync(installed);
  run('tar', ['-xzf', path.join(temp, packed.filename), '-C', installed]);
  const plugin = path.join(installed, 'package');
  // Compare the shared payload, including transitive JS imports, with the source being packaged.
  for (const file of files) {
    if (file.startsWith('skills/')) {
      assert.deepEqual(fs.readFileSync(path.join(plugin, file)), fs.readFileSync(path.join(root, file)), file);
    }
  }
  const graphPath = path.join(temp, '输入 graph.json');
  fs.copyFileSync(path.join(plugin, 'examples/order-flow.graph.json'), graphPath);
  const scripts = path.join(plugin, 'skills/q-flow/scripts');
  run(process.execPath, [path.join(scripts, 'validate-graph.mjs'), graphPath], temp);
  const output = path.join(temp, '项目输出');
  const args = [path.join(scripts, 'generate-viewer.mjs'), graphPath, output];
  run(process.execPath, args, temp);
  assert.deepEqual(fs.readdirSync(output).sort(), ['graph.json', 'index.html']);
  const before = fs.readdirSync(output).map(file => fs.readFileSync(path.join(output, file)));
  const again = spawnSync(process.execPath, args, { cwd: temp, encoding: 'utf8', timeout: 30_000 });
  assert.equal(again.status, 1, again.stderr);
  assert.match(again.stderr, /exist|overwrite|force/i);
  fs.readdirSync(output).forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(output, file)), before[index]));

  const zip = path.join(temp, 'qgraphflow.zip');
  run('zip', ['-q', '-r', zip, '.'], plugin);
  const zippedFiles = run('unzip', ['-Z1', zip]).split('\n');
  for (const directory of manifests) assert.ok(zippedFiles.includes(`${directory}/plugin.json`));
  assert.ok(!zippedFiles.some(file => file.startsWith('package/')), 'ZIP must start at the plugin root');
});
