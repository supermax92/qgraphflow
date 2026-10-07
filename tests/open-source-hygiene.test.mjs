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

test('seven installation guides preserve the Chinese commands and working links', () => {
  const guides = ['docs/clients.md', ...['zh-CN', 'ru', 'pt', 'ja', 'de', 'es'].map(locale => `docs/clients.${locale}.md`)];
  const commands = markdown => [...markdown.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1]);
  const expected = commands(read('docs/clients.zh-CN.md'));
  assert.equal(expected.length, 5);
  assert.equal(expected[0], 'npx skills add supermax92/qgraphflow\n', 'the verified one-line install comes first');
  assert.match(expected[1], /\nnpm install qgraphflow --ignore-scripts\n/, 'the plugin root comes from npmjs');
  assert.match(expected[2], /^codex plugin marketplace add \.\n/);
  assert.match(expected[3], /^claude plugin marketplace add \.\/\n/);
  assert.match(expected[4], /^qodercli plugins install \.\n/);
  for (const file of guides) {
    const markdown = read(file);
    assert.deepEqual(commands(markdown), expected, file);
    assert.equal((markdown.match(/^```/gm) ?? []).length, 10, `${file}: code fences`);
    assert.ok(markdown.includes('`skills` 1.7.0'), `${file}: tested skills version`);
    assert.doesNotMatch(markdown, /Node\.js 22(?!\s*(or later|及以上|или новее|ou posterior|以降|oder neuer|o posterior))/, `${file}: Node.js 22 or later`);
    for (const client of ['Codex App / CLI', 'Claude Code', 'Qoder CLI', 'Qoder Desktop', 'Cursor']) {
      assert.ok(markdown.includes(`### ${client}`), `${file}: ${client}`);
    }
    for (const guide of guides) assert.ok(markdown.includes(`](${path.basename(guide)})`), `${file}: ${guide}`);
    for (const [, link] of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^https?:/.test(link)) continue;
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), link)), `${file}: ${link}`);
    }
  }
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

test('the READMEs identify project independence and the conceptual example boundary', () => {
  const readme = read('README.md');
  assert.match(readme, /independent MIT-licensed project/);
  assert.match(readme, /conceptual examples and do not represent any real company's production architecture/);
  const chinese = read('docs/readme/README.zh-CN.md');
  assert.match(chinese, /独立项目/);
  assert.match(chinese, /概念示例，不代表任何真实公司的生产架构/);
});
