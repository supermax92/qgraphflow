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
  const [packed] = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary]));
  run('tar', ['-xzf', path.join(temporary, packed.filename), '-C', temporary]);
  run('zip', ['-q', '-r', path.join(temporary, `${archive}.zip`), '.'], path.join(temporary, 'package'));
  for (const suffix of ['tgz', 'zip']) fs.copyFileSync(path.join(temporary, `${archive}.${suffix}`), path.join(destination, `${archive}.${suffix}`), fs.constants.COPYFILE_EXCL);
  console.log(JSON.stringify({ ...packed, zip: `${archive}.zip`, destination }));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
