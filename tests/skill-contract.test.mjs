import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
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

test('refreshing a drifted diagram runs the documented commands as written and keeps every output, SVG included', t => {
  const refresh = section('Refresh an existing diagram');
  assert.match(section('Generate and verify'), /diagram\.svg/);
  assert.match(refresh, /SVG/); assert.match(refresh, /ask before `--layout auto`/); assert.match(refresh, /approves `--force`/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-refresh-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo'), dir = path.join(temp, 'docs', 'agent desk');
  fs.cpSync(path.join(root, 'examples/showcase/agent-desk'), repo, { recursive: true });
  const generated = spawnSync(process.execPath, ['scripts/generate-viewer.mjs', path.join(root, 'examples/showcase/agent-desk-graphs/en/architecture.graph.json'), dir, '--repo-root', repo], { cwd: skillDir, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr);
  const positions = () => JSON.parse(fs.readFileSync(path.join(dir, 'graph.json'), 'utf8')).nodes.map(node => [node.id, node.position]);
  const before = positions();
  // The gateway factory moves well below its recorded lines.
  const gateway = path.join(repo, 'src/gateway/chat-gateway.js');
  fs.writeFileSync(gateway, fs.readFileSync(gateway, 'utf8').replace('export function createChatGateway', `${'// moved\n'.repeat(20)}export function createChatGateway`));
  const shell = command => spawnSync('bash', ['-c', command.replaceAll('<dir>', dir).replaceAll('<root>', repo)], { cwd: skillDir, encoding: 'utf8' });
  const outputCheck = section('Generate and verify').match(/```bash\n([\s\S]*?)```/)[1].trim().split('\n').at(-1)
    .replace('<absolute-output-directory>', '<dir>').replace('<absolute-repository-root>', '<root>');
  assert.equal(shell(outputCheck).status, 1, 'the drift fails the output validation first');
  const commands = refresh.match(/```bash\n([\s\S]*?)```/)[1].trim().split('\n');
  assert.equal(commands.length, 2);
  for (const command of [...commands, outputCheck]) {
    const result = shell(command);
    assert.equal(result.status, 0, `${command}\n${result.stderr}`);
  }
  assert.deepEqual(fs.readdirSync(dir).sort(), ['diagram.svg', 'graph.json', 'index.html']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'graph.json'), 'utf8')).nodes.find(node => node.id === 'gateway').source.lineStart, 25);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'graph.json'), 'utf8')).edges.find(edge => edge.id === 'e3').site.lineStart, 31, 'the relationship site moves with the call it records');
  assert.deepEqual(positions(), before, 'the refresh keeps every position');
});

test('a relationship whose recorded call was removed fails validation and names the edge, not a node', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qgraphflow-relation-drift-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo'), gateway = path.join(repo, 'src/gateway/chat-gateway.js');
  fs.cpSync(path.join(root, 'examples/showcase/agent-desk'), repo, { recursive: true });
  fs.writeFileSync(gateway, fs.readFileSync(gateway, 'utf8').replace('orchestrator.handle(', 'orchestrator.dispatch('));
  const graph = path.join(root, 'examples/showcase/agent-desk-graphs/en/architecture.graph.json');
  const result = spawnSync(process.execPath, ['scripts/validate-graph.mjs', graph, '--input-only', '--repo-root', repo], { cwd: skillDir, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /edges\[\d+\]\.site \(src\/gateway\/chat-gateway\.js\): symbol "handle" is not in line 11; not found in the file/);
  assert.doesNotMatch(result.stderr, /nodes\[\d+\]\.source/, 'the definitions are intact; only the relationship drifted');
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
