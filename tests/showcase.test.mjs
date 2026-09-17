import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { validateGraph } from '../skills/q-flow/scripts/validate-graph.mjs';
import { auditGraphLayout } from '../skills/q-flow/assets/viewer/src/edge-routing.js';
import { renderNode } from '../skills/q-flow/assets/viewer/src/node-svg.js';
import { PALETTES } from '../skills/q-flow/assets/viewer/src/visual-style.js';
import { createHash } from 'node:crypto';

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
  ], [11, 10, 15, 15, 8, 14], 'The three core views retain the reviewed demo content.');
  assert.ok(byType.sequence.groups?.some(group => group.kind === 'alt'), 'The sequence view retains its inventory alt fragment.');
  assert.ok(byType.er.nodes.every(node => node.fields.every(field => typeof field.nullable === 'boolean')));
  assert.ok(byType.class.nodes.every(node => node.attributes?.length || node.methods?.length));
  assert.deepEqual(byType.sequence.edges.filter(edge => edge.kind === 'return').map(edge => [edge.source, edge.target]), [
    ['pricing', 'checkout'], ['inventory', 'checkout'], ['inventory', 'checkout'], ['risk', 'checkout'],
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

test('each README links to its inline installation guide, English references and localized media', () => {
  const documents = readmeLocales.map(locale => locale === 'en' ? 'README.md' : `docs/readme/README.${locale}.md`);
  const installationHeadings = {
    en: 'Installation guide', 'zh-CN': '安装指南', ru: 'Установка', pt: 'Guia de instalação',
    ja: 'インストールガイド', de: 'Installationsanleitung', es: 'Guía de instalación'
  };
  const media = JSON.parse(read('docs/showcase-media.json'));
  const assets = new Set(media.locales.flatMap(entry => entry.assets.map(asset => asset.name)));
  const prefix = 'https://github.com/supermax92/qgraphflow/releases/download/showcase-v1/';
  assert.equal(media.status, 'published');
  assert.equal(media.release.tag, 'showcase-v1');
  assert.equal(media.release.assetBaseUrl, prefix);
  documents.forEach((file, index) => {
    const locale = readmeLocales[index];
    const markdown = read(file);
    const links = [...markdown.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)/g)].map(match => match[1]);
    const local = links.filter(link => !/^(https?:|#)/.test(link)).map(link => path.resolve(root, path.dirname(file), link));
    for (const target of local) {
      if (target.startsWith(path.join(root, 'docs/images/showcase/'))) assert.ok(assets.has(path.basename(target)), `${file}: undeclared media ${target}`);
      else assert.ok(fs.existsSync(target), `${file}: ${target}`);
    }
    for (const document of documents) assert.ok(local.includes(path.join(root, document)), `${file}: ${document}`);
    const heading = installationHeadings[locale];
    assert.ok(links.includes(`#${heading.toLowerCase().replaceAll(' ', '-')}`), `${file}: installation link`);
    const installation = markdown.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0];
    assert.ok(installation, `${file}: inline installation guide`);
    for (const client of ['Codex App / CLI', 'Claude Code', 'Qoder CLI', 'Qoder IDE', 'Cursor']) {
      assert.ok(installation.includes(`#### ${client}\n`), `${file}: ${client}`);
    }
    for (const command of [
      'codex plugin marketplace add .', 'codex plugin add qgraphflow@supermax92',
      'claude plugin marketplace add supermax92/qgraphflow',
      'claude plugin marketplace add .', 'claude plugin install qgraphflow@supermax92 --scope user',
      'qodercli plugins install .', '~/.cursor/plugins/local/qgraphflow/'
    ]) assert.ok(installation.includes(`\n${command}\n`), `${file}: ${command}`);
    for (const reference of ['evidence-sources', 'graph-schema', 'guided-intake', 'viewer-development', 'visual-contract']) {
      assert.ok(local.includes(path.join(root, 'skills/q-flow/references', `${reference}.md`)));
    }
    const images = links.filter(link => link.endsWith('.gif'));
    assert.deepEqual(images, ['core-three', 'explore', 'verify', 'edit', 'share'].map(name => `${prefix}ecommerce.${locale}.${name}.gif`));
    assert.deepEqual(links.filter(link => link.endsWith('.png')), types.map(type => `${prefix}ecommerce.${locale}.${type}.png`));
    for (const link of links.filter(link => /\.(gif|png)$/.test(link))) assert.ok(assets.has(path.basename(new URL(link).pathname)), `${file}: undeclared media ${link}`);
    assert.doesNotMatch(markdown, /README\.(ko|fr)\.md|kafka\.[\w-]+\.(gif|graph\.json)/);
  });
  for (const locale of ['ko', 'fr']) assert.ok(!fs.existsSync(path.join(root, `docs/readme/README.${locale}.md`)));
});

test('published media receipts retain Viewer provenance and match source graphs and local files when present', t => {
  const sha = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const media = JSON.parse(read('docs/showcase-media.json'));
  assert.equal(media.status, 'published');
  assert.match(media.viewerSha256, /^[a-f0-9]{64}$/);
  // Published receipts describe the recording's Viewer, not later runtime builds.
  // package-media.mjs separately rejects stale media before creating a new package.
  if (media.viewerSha256 !== sha('skills/q-flow/assets/viewer-dist/index.html')) {
    t.diagnostic('Published media use a historical Viewer; package:media requires re-recording for the current Viewer.');
  }
  assert.deepEqual(media.locales.map(entry => entry.locale), readmeLocales);
  for (const entry of media.locales) {
    assert.match(entry.graphSha256, /^[a-f0-9]{64}$/);
    if (entry.graphSha256 !== sha(entry.graph)) t.diagnostic(`${entry.locale}: published media use a historical graph; package:media requires re-recording.`);
    assert.equal(entry.assets.length, 14);
    for (const asset of entry.assets) {
      assert.ok(asset.name.startsWith(`ecommerce.${entry.locale}.`));
      assert.ok(asset.width > 0 && asset.height > 0 && asset.bytes > 0);
      assert.match(asset.sha256, /^[a-f0-9]{64}$/, asset.name);
      if (asset.name.endsWith('.gif')) assert.ok(asset.frames > 1 && asset.durationMs > 0);
      if (asset.name.endsWith('.core-three.gif')) assert.equal(asset.durationMs, 2400);
      const file = `${media.directory}/${asset.name}`;
      if (fs.existsSync(path.join(root, file))) {
        assert.equal(fs.statSync(path.join(root, file)).size, asset.bytes, file);
        assert.equal(asset.sha256, sha(file), file);
      }
    }
  }
});

test('Git installations exclude showcase media from branch/tag history and new files', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(tracked, /\.(gif|mp4)$/m);
  // Codex stores local turn snapshots under refs/codex; normal Git pushes/clones do not include them.
  const history = execFileSync('git', ['rev-list', '--objects', '--branches', '--remotes', '--tags'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(history, /\.(gif|mp4)$/m);
});
