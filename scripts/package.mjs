#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const destination = path.resolve(process.argv[2] || path.join(root, 'dist'));
const archive = `qgraphflow-${version}`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-build-'));
const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd, encoding: 'utf8', timeout: 60_000,
  env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache'), npm_config_offline: 'true' }
});
try {
  fs.mkdirSync(destination, { recursive: true });
  for (const suffix of ['tgz', 'zip']) {
    if (fs.existsSync(path.join(destination, `${archive}.${suffix}`))) throw new Error(`Refusing to overwrite ${archive}.${suffix}; choose a new output directory`);
  }
  const staging = path.join(temporary, 'package');
  const [preview] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--dry-run', '--json']));
  for (const { path: file } of preview.files) {
    if (file.startsWith('.agents/')) continue;
    const target = path.join(staging, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
  }
  // Generate distribution metadata; never ship the developer's local marketplace.
  const manifest = JSON.parse(fs.readFileSync(path.join(staging, '.codex-plugin/plugin.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(staging, '.claude-plugin/marketplace.json'), 'utf8'));
  const catalog = {
    name: market.name,
    interface: { displayName: `${manifest.interface.displayName} Local` },
    plugins: [{
      name: manifest.name,
      source: { source: 'local', path: './' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: manifest.interface.category
    }]
  };
  fs.mkdirSync(path.join(staging, '.agents/plugins'), { recursive: true });
  fs.writeFileSync(path.join(staging, '.agents/plugins/marketplace.json'), JSON.stringify(catalog, null, 2) + '\n');
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], staging));
  run('zip', ['-q', '-r', path.join(temporary, `${archive}.zip`), '.'], staging);
  for (const suffix of ['tgz', 'zip']) fs.copyFileSync(path.join(temporary, `${archive}.${suffix}`), path.join(destination, `${archive}.${suffix}`), fs.constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ ...packed, zip: `${archive}.zip`, destination }));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
