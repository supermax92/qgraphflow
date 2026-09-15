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
const guides = ['docs/clients.md', ...['zh-CN', 'ru', 'pt', 'ja', 'de', 'es'].map(locale => `docs/clients.${locale}.md`)];

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
  assert.equal(claudeMarket.name, 'qgraphflow-local');
  assert.equal(claudeMarket.plugins.length, 1);
  assert.equal(claudeMarket.plugins[0].name, pkg.name);
  assert.equal(claudeMarket.plugins[0].version, pkg.version);
  assert.equal(claudeMarket.plugins[0].source, './');

  // A clean source checkout has no ignored local marketplace or installed dependencies.
  const source = path.join(temp, 'source');
  const [preview] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--dry-run', '--json']));
  for (const file of [...preview.files.map(file => file.path), 'scripts/package.mjs']) {
    if (file.startsWith('.agents/')) continue;
    fs.mkdirSync(path.dirname(path.join(source, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(source, file));
  }
  assert.ok(!fs.existsSync(path.join(source, '.agents')));
  const packed = JSON.parse(run(process.execPath, ['scripts/package.mjs', temp], source));
  assert.ok(!fs.existsSync(path.join(source, '.agents')), 'Packaging must not create local configuration');
  const archiveBefore = fs.readFileSync(path.join(temp, packed.filename));
  const repack = spawnSync(process.execPath, ['scripts/package.mjs', temp], { cwd: source, encoding: 'utf8' });
  assert.notEqual(repack.status, 0);
  assert.match(repack.stderr, /Refusing to overwrite/);
  assert.deepEqual(fs.readFileSync(path.join(temp, packed.filename)), archiveBefore);
  const files = new Set(packed.files.map(file => file.path));
  for (const required of [
    ...manifests.map(directory => `${directory}/plugin.json`),
    '.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json',
    'skills/q-flow/SKILL.md', 'skills/q-flow/agents/openai.yaml',
    'skills/q-flow/references/graph-schema.md', 'skills/q-flow/references/guided-intake.md',
    'skills/q-flow/assets/viewer-dist/index.html',
    'skills/q-flow/scripts/generate-viewer.mjs', 'skills/q-flow/scripts/validate-graph.mjs',
    'skills/q-flow/assets/viewer/src/radix-colors.js',
    'skills/q-flow/assets/viewer/src/edge-routing.js', 'skills/q-flow/assets/viewer/src/diagrams/registry.js',
    'README.md', ...guides, 'examples/order-flow.graph.json', 'docs/images/order-flow.svg'
  ]) assert.ok(files.has(required), `Missing packaged file: ${required}`);
  assert.ok(files.has('examples/showcase/kafka.en.graph.json'));
  assert.ok(packed.unpackedSize < 2_000_000, `Unexpected install size: ${packed.unpackedSize}`);
  for (const locale of ['zh-CN', 'ja', 'ko', 'de', 'fr', 'es']) {
    assert.ok(!files.has(`examples/showcase/kafka.${locale}.graph.json`));
  }
  for (const locale of ['zh-CN', 'ru', 'pt', 'ja', 'de', 'es']) {
    assert.ok(files.has(`docs/readme/README.${locale}.md`));
    for (const name of ['evidence-sources', 'graph-schema', 'guided-intake', 'viewer-development', 'visual-contract']) {
      assert.ok(files.has(`docs/references/${locale}/${name}.md`));
      assert.ok(!files.has(`skills/q-flow/references/${locale}/${name}.md`));
    }
  }
  for (const locale of ['ko', 'fr']) assert.ok(!files.has(`docs/readme/README.${locale}.md`));
  for (const file of files) {
    assert.ok(!/(^|\/)(node_modules|\.git|\.idea|\.DS_Store)(\/|$)/.test(file), file);
    assert.ok(!/^(tests|openspec|docs\/(qa|qgraphflow|superpowers))\//.test(file), file);
    assert.ok(!/\.(tgz|zip)$/.test(file), file);
    assert.ok(!/\.(gif|mp4|test\.mjs|jsx)$/.test(file), file);
    assert.ok(!file.endsWith('browser-interactions.mjs'), file);
  }

  const installed = path.join(temp, '安装目录 with spaces');
  fs.mkdirSync(installed);
  run('tar', ['-xzf', path.join(temp, packed.filename), '-C', installed]);
  const plugin = path.join(installed, 'package');
  const codexMarket = readJson(path.join(plugin, '.agents/plugins/marketplace.json'));
  assert.deepEqual(codexMarket, {
    name: 'qgraphflow-local', interface: { displayName: 'QGraphFlow Local' },
    plugins: [{ name: pkg.name, source: { source: 'local', path: './' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }]
  });
  const chineseReadme = fs.readFileSync(path.join(plugin, 'docs/readme/README.zh-CN.md'), 'utf8');
  assert.match(chineseReadme, /\[客户端安装\]\(\.\.\/clients\.zh-CN\.md\)/);
  assert.match(chineseReadme, /\[安装指南\]\(\.\.\/clients\.zh-CN\.md\)/);
  for (const guide of guides) {
    assert.deepEqual(fs.readFileSync(path.join(plugin, guide)), fs.readFileSync(path.join(root, guide)), guide);
  }
  for (const locale of ['ru', 'pt', 'ja', 'de', 'es']) {
    assert.ok(fs.readFileSync(path.join(plugin, `docs/readme/README.${locale}.md`), 'utf8').includes(`](../clients.${locale}.md)`));
  }
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
  run(process.execPath, [path.join(scripts, 'generate-viewer.mjs'), path.join(plugin, 'examples/showcase/kafka.en.graph.json'), path.join(temp, 'kafka')], temp);
  assert.equal(readJson(path.join(temp, 'kafka/graph.json')).diagrams.length, 9);
  const before = fs.readdirSync(output).map(file => fs.readFileSync(path.join(output, file)));
  const again = spawnSync(process.execPath, args, { cwd: temp, encoding: 'utf8', timeout: 30_000 });
  assert.equal(again.status, 1, again.stderr);
  assert.match(again.stderr, /exist|overwrite|force/i);
  fs.readdirSync(output).forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(output, file)), before[index]));

  const zip = path.join(temp, packed.zip);
  const zippedFiles = run('unzip', ['-Z1', zip]).split('\n');
  assert.deepEqual(zippedFiles.filter(file => file && !file.endsWith('/')).sort(), [...files].sort(), 'ZIP and TGZ must contain the same files');
  assert.deepEqual(JSON.parse(run('unzip', ['-p', zip, '.agents/plugins/marketplace.json'])), codexMarket);
  for (const directory of manifests) assert.ok(zippedFiles.includes(`${directory}/plugin.json`));
  for (const guide of guides) assert.ok(zippedFiles.includes(guide), guide);
  assert.ok(!zippedFiles.some(file => file.startsWith('package/')), 'ZIP must start at the plugin root');

  const localConfig = path.join(source, '.agents/plugins/marketplace.json');
  fs.mkdirSync(path.dirname(localConfig), { recursive: true });
  fs.writeFileSync(localConfig, '{"name":"private-developer-marketplace"}');
  fs.writeFileSync(path.join(source, '.agents/plugins/private.json'), '{"private":true}');
  const dirtyOutput = path.join(temp, 'with-local-config');
  const dirty = JSON.parse(run(process.execPath, ['scripts/package.mjs', dirtyOutput], source));
  assert.equal(fs.readFileSync(localConfig, 'utf8'), '{"name":"private-developer-marketplace"}');
  assert.deepEqual(dirty.files.map(file => file.path), packed.files.map(file => file.path));
  assert.deepEqual(JSON.parse(run('tar', ['-xOf', path.join(dirtyOutput, dirty.filename), 'package/.agents/plugins/marketplace.json'])), codexMarket);
  assert.deepEqual(JSON.parse(run('unzip', ['-p', path.join(dirtyOutput, dirty.zip), '.agents/plugins/marketplace.json'])), codexMarket);

  const prepare = path.join(root, 'scripts/prepare-github-npm.mjs');
  const originalRuntime = new Map([...files].map(file => [file, fs.readFileSync(path.join(plugin, file))]));
  const manifestBefore = fs.readFileSync(path.join(plugin, 'package.json'));
  for (const version of ['wrong-version', '999.999.999']) {
    const invalid = spawnSync(process.execPath, [prepare, plugin, version], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.deepEqual(fs.readFileSync(path.join(plugin, 'package.json')), manifestBefore);
  }
  const sourceBefore = fs.readFileSync(path.join(root, 'package.json'));
  const wrongDirectory = spawnSync(process.execPath, [prepare, root, pkg.version], { encoding: 'utf8' });
  assert.notEqual(wrongDirectory.status, 0);
  assert.deepEqual(fs.readFileSync(path.join(root, 'package.json')), sourceBefore);
  run(process.execPath, [prepare, plugin, pkg.version]);
  const expectedNpm = { ...pkg, name: '@supermax92/qgraphflow', publishConfig: { registry: 'https://npm.pkg.github.com' } };
  delete expectedNpm.scripts;
  assert.deepEqual(readJson(path.join(plugin, 'package.json')), expectedNpm);
  const [scoped] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temp], plugin));
  assert.deepEqual(scoped.files.map(file => file.path).sort(), [...files].sort(), 'npm must retain every runtime file, including hidden client metadata');
  const publishCommand = fs.readFileSync(path.join(root, '.github/workflows/publish-github-npm.yml'), 'utf8').match(/^\s+run: (npm publish .+)$/m)?.[1];
  assert.ok(publishCommand, 'The workflow must expose its explicit npm publish command');
  fs.mkdirSync(path.join(temp, 'publish'));
  fs.copyFileSync(path.join(temp, scoped.filename), path.join(temp, 'publish', scoped.filename));
  const published = JSON.parse(run('env', [`VERSION=${pkg.version}`, 'bash', '-e', '-c', `${publishCommand} --dry-run --json`], temp));
  assert.equal(published.name, '@supermax92/qgraphflow');
  assert.equal(published.version, pkg.version);
  assert.deepEqual(published.files.map(file => file.path).sort(), [...files].sort());
  const npmInstall = path.join(temp, 'npm-installed');
  run('npm', ['install', '--prefix', npmInstall, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', path.join(temp, scoped.filename)], temp);
  const npmPlugin = path.join(npmInstall, 'node_modules/@supermax92/qgraphflow');
  for (const file of files) {
    assert.deepEqual(fs.readFileSync(path.join(npmPlugin, file)), fs.readFileSync(path.join(plugin, file)), file);
    if (file !== 'package.json') assert.deepEqual(fs.readFileSync(path.join(npmPlugin, file)), originalRuntime.get(file), file);
  }
  run(process.execPath, [path.join(npmPlugin, 'skills/q-flow/scripts/generate-viewer.mjs'), path.join(npmPlugin, 'examples/order-flow.graph.json'), path.join(temp, 'npm-graph')], temp);
  assert.deepEqual(fs.readdirSync(path.join(temp, 'npm-graph')).sort(), ['graph.json', 'index.html']);
});
