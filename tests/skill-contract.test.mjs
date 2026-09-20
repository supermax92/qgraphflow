import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateGraph } from '../skills/q-flow/scripts/validate-graph.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillDir = path.join(root, 'skills/q-flow');
const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const section = name => {
  const start = skill.indexOf(`## ${name}\n`);
  assert.notEqual(start, -1, `Missing section ${name}`);
  const next = skill.indexOf('\n## ', start + 1);
  return skill.slice(start, next === -1 ? undefined : next);
};

test('the skill declares an argument hint for slash-command completion', () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)[1];
  assert.match(frontmatter, /^argument-hint: ".+"$/m);
});

test('intake precedes evidence and links an existing reference', () => {
  assert.ok(skill.indexOf('## Intake\n') < skill.indexOf('## Evidence\n'));
  const intake = section('Intake');
  const link = intake.match(/\[guided-intake\.md\]\((references\/guided-intake\.md)\)/);
  assert.ok(link, 'Intake must link guided-intake.md');
  assert.ok(fs.existsSync(path.join(skillDir, link[1])));
});

test('intake ends the turn after asking and writes nothing before the round completes', () => {
  const intake = section('Intake');
  assert.match(intake, /wait for the (user's )?reply|end the turn/i);
  assert.match(intake, /never assume an answer/i);
  assert.match(intake, /no output files before the round completes/i);
});

test('authoring keeps requested collections evidence-consistent and validates every view', () => {
  const author = section('Author');
  const acceptance = fs.readFileSync(path.join(skillDir, 'references/acceptance.md'), 'utf8');
  assert.match(author, /explicitly requests multiple views/);
  assert.match(author, /same non-empty `module` value/);
  assert.match(author, /ER keys\/cardinalities/);
  assert.match(acceptance, /inspect every requested diagram type/);
});

test('authoring reads the common contract plus one type page and nothing else', () => {
  const author = section('Author');
  assert.match(author, /\[graph-common\.md\]\(references\/graph-common\.md\)/);
  assert.match(author, /references\/types\//);
  assert.doesNotMatch(author, /\]\(references\/graph-schema\.md\)/, 'the full contract is for maintainers');
  assert.match(author, /Do not read `graph-schema\.md`/);
  assert.ok(fs.existsSync(path.join(skillDir, 'references/graph-common.md')));
  for (const type of ['architecture', 'flowchart', 'sequence', 'er', 'deployment', 'class', 'state', 'usecase', 'dataflow']) {
    const file = path.join(skillDir, 'references/types', `${type}.md`);
    assert.ok(fs.existsSync(file), `${type}.md`);
    assert.ok(fs.statSync(file).size <= 6 * 1024, `${type}.md must stay within 6KB`);
  }
  assert.ok(fs.statSync(path.join(skillDir, 'references/graph-common.md')).size <= 6 * 1024);
});

test('ordinary delivery stops at the three commands; browser acceptance is a separate on-request section', () => {
  const verification = section('Generate and verify');
  const acceptance = section('Acceptance on request');
  const reference = fs.readFileSync(path.join(skillDir, 'references/acceptance.md'), 'utf8');
  assert.ok(skill.indexOf('## Generate and verify\n') < skill.indexOf('## Acceptance on request\n'));
  assert.doesNotMatch(verification, /screenshot|1440×900|browser tooling|Playwright/i);
  assert.match(verification, /Browser acceptance: not performed/);
  assert.match(verification, /--fix/);
  assert.match(verification, /do not read them/);
  // The checks themselves live in a reference read only when acceptance is triggered, so the skill text stays short.
  assert.match(acceptance, /only when/);
  assert.match(acceptance, /\[acceptance\.md\]\(references\/acceptance\.md\)/);
  assert.doesNotMatch(acceptance, /1440×900|screenshot/i);
  assert.match(reference, /1440×900/);
  assert.match(reference, /activation bars/);
  assert.ok(fs.statSync(path.join(skillDir, 'SKILL.md')).size <= 10 * 1024, 'SKILL.md is loaded on every invocation; keep it within 10KB');
});

test('every type page carries a minimal skeleton that passes input validation as written', () => {
  for (const type of ['architecture', 'flowchart', 'sequence', 'er', 'deployment', 'class', 'state', 'usecase', 'dataflow']) {
    const page = fs.readFileSync(path.join(skillDir, 'references/types', `${type}.md`), 'utf8');
    assert.match(page, /^## Minimal valid skeleton$/m, `${type}: skeleton section`);
    assert.match(page, /^## Frequent validation errors$/m, `${type}: error section`);
    const block = page.match(/## Minimal valid skeleton\n\n```json\n([\s\S]*?)\n```/);
    assert.ok(block, `${type}: json skeleton`);
    const graph = JSON.parse(block[1]);
    assert.equal(graph.meta.diagramType, type);
    assert.deepEqual(validateGraph(graph, { inputOnly: true }), [], `${type}: skeleton validates`);
    assert.doesNotMatch(block[1], /"position"|"size"|"route"/, `${type}: skeleton has no geometry`);
  }
});
