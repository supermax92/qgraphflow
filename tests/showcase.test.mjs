import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { validateGraph, verifySourceEvidence } from '../skills/q-flow/scripts/validate-graph.mjs';
import { auditGraphLayout } from '../skills/q-flow/assets/viewer/src/edge-routing.js';
import { renderNode } from '../skills/q-flow/assets/viewer/src/node-svg.js';
import { PALETTES } from '../skills/q-flow/assets/viewer/src/visual-style.js';

const root = path.resolve(import.meta.dirname, '..');
const locales = ['en', 'zh-CN', 'ja', 'ko', 'de', 'fr', 'es'];
const readmeLocales = ['en', 'zh-CN', 'ru', 'pt', 'ja', 'de', 'es'];
const types = ['architecture', 'flowchart', 'sequence', 'er', 'deployment', 'class', 'state', 'usecase', 'dataflow'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const collection = locale => JSON.parse(read(`examples/showcase/kafka.${locale}.graph.json`)).diagrams;
const ecommerce = JSON.parse(read('examples/showcase/ecommerce.zh-CN.graph.json')).diagrams;
const topology = graph => ({
  nodes: graph.nodes.map(({ id, kind, source, position, size, fields, attributes, methods }) => ({ id, kind, source, position, size, fields, attributes, methods })),
  edges: graph.edges.map(({ id, source, target, kind, evidence, order, route }) => ({ id, source, target, kind, evidence, order, route }))
});

test('seven Kafka collections preserve all nine views and the same source evidence', () => {
  const english = collection('en');
  for (const locale of locales) {
    const graphs = collection(locale);
    assert.deepEqual(graphs.map(graph => graph.meta.diagramType), types, locale);
    graphs.forEach((graph, index) => {
      assert.equal(graph.meta.locale, locale);
      assert.deepEqual(validateGraph(graph), [], `${locale}: ${types[index]}`);
      assert.deepEqual(auditGraphLayout(graph).warnings, [], `${locale}: ${types[index]}`);
      assert.deepEqual(topology(graph), topology(english[index]), `${locale}: ${types[index]}`);
    });
  }
});

test('Chinese ecommerce showcase covers all nine views with clean layouts', () => {
  assert.deepEqual(ecommerce.map(graph => graph.meta.diagramType), types);
  ecommerce.forEach((graph, index) => {
    assert.equal(graph.meta.locale, 'zh-CN');
    assert.deepEqual(validateGraph(graph), [], types[index]);
    assert.deepEqual(auditGraphLayout(graph).warnings, [], types[index]);
  });
  const modules = ['渠道', '结算', '价格', '库存', '风控', '支付', '订单', '履约'];
  assert.deepEqual([...new Set(ecommerce.flatMap(graph => graph.nodes.map(node => node.module).filter(Boolean)))].sort(), [...modules].sort());
  for (const graph of ecommerce) {
    assert.ok(new Set(graph.nodes.map(node => node.module).filter(Boolean)).size >= 2, `${graph.meta.diagramType}: module accents`);
    assert.ok(graph.nodes.every(node => node.module === undefined || modules.includes(node.module)), `${graph.meta.diagramType}: module vocabulary`);
  }
  const byType = Object.fromEntries(ecommerce.map(graph => [graph.meta.diagramType, graph]));
  assert.deepEqual([
    byType.architecture.nodes.length, byType.architecture.edges.length,
    byType.flowchart.nodes.length, byType.flowchart.edges.length,
    byType.sequence.nodes.length, byType.sequence.edges.length
  ], [11, 10, 15, 15, 8, 13], 'The three core views retain the reviewed demo content.');
  assert.ok(byType.sequence.groups?.some(group => group.kind === 'opt' && group.operands[0].edgeIds.length === 7), 'The sequence view wraps the post-reservation path in its inventory opt fragment.');
  assert.ok(byType.sequence.edges.filter(edge => edge.kind === 'return').every(edge => edge.replyTo), 'Every return in the sequence view is paired with its call.');
  assert.deepEqual(byType.sequence.executions.map(bar => bar.participantId), ['checkout', 'pricing', 'inventory', 'risk', 'payment', 'order'], 'Each called participant shows its activation bar.');
  assert.ok(byType.er.nodes.every(node => node.fields.every(field => typeof field.nullable === 'boolean')));
  assert.ok(byType.class.nodes.every(node => node.attributes?.length || node.methods?.length));
  assert.deepEqual(byType.sequence.edges.filter(edge => edge.kind === 'return').map(edge => [edge.source, edge.target]), [
    ['pricing', 'checkout'], ['inventory', 'checkout'], ['risk', 'checkout'],
    ['payment', 'checkout'], ['order', 'checkout'], ['checkout', 'buyer']
  ]);
  assert.ok(byType.state.edges.some(edge => edge.guard) && byType.state.edges.some(edge => edge.action));
  assert.ok(byType.architecture.groups.length > 0 && byType.deployment.groups.length > 0);
});

test('localized ecommerce preserves domain structure and renders complete node text', () => {
  const structure = graph => ({
    nodes: graph.nodes.map(({ id, kind, source, fields, attributes, methods }) => ({ id, kind, source, fields, attributes, methods })),
    edges: graph.edges.map(({ id, source, target, kind, evidence, order, sourceCardinality, targetCardinality }) => ({ id, source, target, kind, evidence, order, sourceCardinality, targetCardinality }))
  });
  for (const locale of readmeLocales) {
    const graphs = JSON.parse(read(`examples/showcase/ecommerce.${locale}.graph.json`)).diagrams;
    assert.deepEqual(graphs.map(graph => graph.meta.diagramType), types, locale);
    graphs.forEach((graph, index) => {
      assert.equal(graph.meta.locale, locale);
      assert.deepEqual(validateGraph(graph), [], `${locale}/${types[index]}`);
      assert.deepEqual(auditGraphLayout(graph).warnings, [], `${locale}/${types[index]}`);
      assert.deepEqual(structure(graph), structure(ecommerce[index]));
      if (!['zh-CN', 'ja'].includes(locale)) assert.doesNotMatch(JSON.stringify(graph), /[\u4e00-\u9fff]/);
      for (const node of graph.nodes) {
        const rendered = renderNode(node, types[index], 0, 0, PALETTES.light, locale);
        if (types[index] === 'sequence' && node.subtitle) {
          assert.match(rendered, /class="body"[^>]*>[^<]+<\/text>/, 'sequence subtitle is drawn, with bounded ellipsis allowed');
          assert.ok(rendered.includes(node.subtitle.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')), 'full subtitle remains in description');
        } else assert.ok(!rendered.includes('…'), `${locale}/${types[index]}/${node.id}: truncated text`);
      }
    });
  }
});

test('every agent-desk graph in every locale keeps its source anchors and symbols on the example code', () => {
  for (const locale of readmeLocales) for (const type of ['architecture', 'sequence', 'er']) {
    const graph = JSON.parse(read(`examples/showcase/agent-desk-graphs/${locale}/${type}.graph.json`));
    const evidence = verifySourceEvidence(graph, path.join(root, 'examples/showcase/agent-desk'));
    assert.equal(evidence.status, 'passed', `${locale}/${type}`);
    assert.equal(evidence.symbols, graph.nodes.filter(node => node.source?.symbol).length, `${locale}/${type}`);
    assert.ok(evidence.symbols > 0, `${locale}/${type}`);
  }
  assert.deepEqual(fs.readdirSync(path.join(root, 'examples/showcase/agent-desk-graphs')).sort(), [...readmeLocales].sort());
});

test('the online demo builds every linked page from repository examples and its home page loads nothing else', () => {
  const workflow = read('.github/workflows/pages.yml'), home = read('docs/pages/index.html');
  const generated = [...workflow.matchAll(/generate-viewer\.mjs (\S+) site\/(\S+)(.*)$/gm)].map(([, input, output, options]) => ({ input, output, options }));
  assert.equal(generated.length, 8);
  for (const { input, output, options } of generated) {
    assert.ok(fs.existsSync(path.join(root, input)), input);
    if (output.startsWith('agent-desk/')) assert.match(options, /--repo-root examples\/showcase\/agent-desk$/, output);
  }
  const links = [...home.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  const demos = links.filter(link => !link.startsWith('https://github.com/supermax92/qgraphflow'));
  assert.deepEqual(demos.sort(), generated.map(item => `${item.output}/`).sort(), 'one link per generated page, and none without a page');
  assert.deepEqual([...home.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map(match => match[0]), ['https://github.com/supermax92/qgraphflow']);
  assert.doesNotMatch(home, /<(script|img|iframe|link)\b|@import|url\(/i, 'no external or extra resources');
  assert.match(workflow, /cp docs\/pages\/index\.html site\/index\.html/);
  assert.doesNotMatch(workflow, /npm (ci|run build)|vite/, 'the committed prebuilt Viewer is used as installed');
  assert.match(workflow.split('\n  deploy:\n')[1], /if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/);
});

test('each README links to its inline installation guide, English references and its own showcase-v2 media', () => {
  const documents = readmeLocales.map(locale => locale === 'en' ? 'README.md' : `docs/readme/README.${locale}.md`);
  const installationHeadings = {
    en: 'Installation guide', 'zh-CN': '安装指南', ru: 'Установка', pt: 'Guia de instalação',
    ja: 'インストールガイド', de: 'Installationsanleitung', es: 'Guía de instalación'
  };
  documents.forEach((file, index) => {
    const locale = readmeLocales[index];
    const markdown = read(file);
    const links = [...markdown.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)].map(match => match[1]);
    const local = links.filter(link => !/^(https?:|#)/.test(link)).map(link => path.resolve(root, path.dirname(file), link));
    for (const target of local) assert.ok(fs.existsSync(target), `${file}: ${target}`);
    for (const document of documents) assert.ok(local.includes(path.join(root, document)), `${file}: ${document}`);
    const heading = installationHeadings[locale];
    assert.ok(links.includes(`#${heading.toLowerCase().replaceAll(' ', '-')}`), `${file}: installation link`);
    const installation = markdown.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0];
    assert.ok(installation, `${file}: inline installation guide`);
    for (const client of ['Codex App / CLI', 'Claude Code', 'Qoder CLI', 'Qoder Desktop', 'Cursor']) {
      assert.ok(installation.includes(`#### ${client}\n`), `${file}: ${client}`);
    }
    for (const command of [
      'codex plugin marketplace add .', 'codex plugin add qgraphflow@supermax92',
      'claude plugin marketplace add supermax92/qgraphflow',
      'claude plugin marketplace add .', 'claude plugin install qgraphflow@supermax92 --scope user',
      'qodercli plugins install .', '~/.cursor/plugins/local/qgraphflow/'
    ]) assert.ok(installation.includes(`\n${command}\n`), `${file}: ${command}`);
    // First screen, before the installation guide: the live demo, the verified one-line install and the pitch.
    const firstScreen = markdown.split(`\n## ${heading}\n`)[0];
    assert.ok(firstScreen.includes('(https://supermax92.github.io/qgraphflow/)'), `${file}: live demo link`);
    assert.ok(firstScreen.includes('\nnpx skills add supermax92/qgraphflow\n'), `${file}: one-line install on the first screen`);
    const pitch = { en: 'What sets it apart:', 'zh-CN': '差异在哪：', ru: 'Чем отличается:', pt: 'O que o diferencia:', ja: 'ここが違う：', de: 'Was es auszeichnet:', es: 'Qué lo distingue:' }[locale];
    assert.ok(firstScreen.includes(`\n**${pitch}** `), `${file}: one-sentence differentiator on the first screen`);
    assert.ok(installation.indexOf('\nnpx skills add supermax92/qgraphflow\n') < installation.indexOf('#### Codex App / CLI\n'), `${file}: installation starts with it`);
    assert.ok(installation.includes('`skills` 1.7.0'), `${file}: tested skills version`);
    assert.ok(markdown.includes('npx -y qgraphflow validate "$graph" --input-only --repo-root . || { echo "::error file=$graph::$graph failed validation"; failed=1; }'), `${file}: CI drift check names the failing graph`);
    assert.ok(markdown.includes('\nnpm install qgraphflow --ignore-scripts\n'), `${file}: npmjs installation`);
    assert.doesNotMatch(markdown, /npm\.pkg\.github\.com|@supermax92\/qgraphflow|read:packages/, `${file}: no GitHub npm token login`);
    assert.doesNotMatch(markdown, /Node\.js 22(?!\s*(or later|及以上|или новее|ou posterior|以降|oder neuer|o posterior))/, `${file}: Node.js 22 or later`);
    const slugs = new Set([...markdown.matchAll(/^#+ (.+)$/gm)].map(match => match[1].trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-')));
    for (const anchor of links.filter(link => link.startsWith('#'))) assert.ok(slugs.has(decodeURIComponent(anchor.slice(1))), `${file}: ${anchor}`);
    for (const reference of ['evidence-sources', 'graph-schema', 'guided-intake', 'viewer-development', 'visual-contract']) {
      assert.ok(local.includes(path.join(root, 'skills/q-flow/references', `${reference}.md`)));
    }
    // Showcase media: five showcase-v2 GIFs in the README's own locale, recorded by scripts/showcase-record.mjs and
    // hosted as Release assets. The showcase-v1 recordings were removed on 2026-09-19 and nothing is embedded locally.
    const media = links.filter(link => /\.(gif|png|mp4)(\?|$)/.test(link));
    const clips = ['hero', 'explore', 'verify', 'edit', 'share'];
    assert.deepEqual(media, clips.map(clip => `https://github.com/supermax92/qgraphflow/releases/download/showcase-v2/agent-desk.${locale}.${clip}.gif`), `${file}: showcase media`);
    assert.ok(markdown.includes('https://github.com/supermax92/qgraphflow/releases/tag/showcase-v2'), `${file}: release link`);
    assert.doesNotMatch(markdown, /showcase-v1|images\/showcase/, `${file}: historical showcase media`);
    assert.doesNotMatch(markdown, /README\.(ko|fr)\.md|kafka\.[\w-]+\.(gif|graph\.json)/);
  });
  for (const locale of ['ko', 'fr']) assert.ok(!fs.existsSync(path.join(root, `docs/readme/README.${locale}.md`)));
});

test('Git installations exclude showcase media from branch/tag history and new files', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(tracked, /\.(gif|mp4)$/m);
  // Codex stores local turn snapshots under refs/codex; normal Git pushes/clones do not include them.
  const history = execFileSync('git', ['rev-list', '--objects', '--branches', '--remotes', '--tags'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(history, /\.(gif|mp4)$/m);
});
