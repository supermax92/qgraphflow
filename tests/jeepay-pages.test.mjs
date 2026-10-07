import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { root } from './jeepay.mjs';

test('CI, Pages and release smoke tests use only Jeepay inputs', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/pages.yml', '.github/workflows/publish-github-npm.yml']) {
    const workflow = read(file);
    const inputs = [...workflow.matchAll(/examples\/[^\s"'`]+\.graph\.json/g)].map(match => match[0]);
    assert.ok(inputs.length > 0, file);
    assert.ok(inputs.every(input => input.startsWith('examples/jeepay/')), file);
  }
  // Recording inputs are separate from the real-source corpus used by workflows.
  assert.deepEqual(fs.readdirSync(path.join(root, 'examples')).sort(), ['jeepay', 'showcase']);
  assert.equal(fs.existsSync(path.join(root, 'tests/fixtures')), false);
  const workflow = read('.github/workflows/pages.yml'), home = read('docs/pages/index.html');
  assert.match(workflow, /--repo-root output\/jeepay-source/);
  assert.match(workflow, /uses: \.\/\.github\/actions\/jeepay-source/);
  assert.match(home, /href="jeepay\/zh-CN\/"/);
  assert.doesNotMatch(home, /ecommerce|agent-desk|kafka/);
});

test('all public README local links exist after replacing the old corpora', () => {
  for (const file of ['README.md', ...['zh-CN', 'ru', 'pt', 'ja', 'de', 'es'].map(locale => `docs/readme/README.${locale}.md`)]) {
    const markdown = fs.readFileSync(path.join(root, file), 'utf8');
    for (const [, target] of markdown.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|#)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), target)), `${file}: ${target}`);
    }
  }
});
