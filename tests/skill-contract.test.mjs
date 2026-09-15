import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
  const verification = section('Generate and verify');
  assert.match(author, /explicitly requests multiple views/);
  assert.match(author, /same non-empty `module` value/);
  assert.match(author, /ER keys\/cardinalities/);
  assert.match(verification, /inspect every requested diagram type/);
});
