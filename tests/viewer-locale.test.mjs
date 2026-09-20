import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGraph } from '../skills/q-flow/scripts/validate-graph.mjs';
import { createDiagramSvg } from '../skills/q-flow/assets/viewer/src/export-svg.js';
import { graphLegend } from '../skills/q-flow/assets/viewer/src/legend.js';
import { PALETTES } from '../skills/q-flow/assets/viewer/src/visual-style.js';
import { translate } from '../skills/q-flow/assets/viewer/src/i18n.js';
import messages from '../skills/q-flow/assets/viewer/src/i18n-messages.json' with { type: 'json' };

const graph = {
  meta: { title: 'Order system', sourceRef: 'Fictional example', diagramType: 'architecture', locale: 'en' },
  nodes: [
    { id: 'api', label: 'Order API', kind: 'service', tags: ['core'], position: { x: 0, y: 0 }, size: { width: 240, height: 140 } },
    { id: 'db', label: '订单数据库', kind: 'database', position: { x: 520, y: 0 }, size: { width: 240, height: 140 } }
  ],
  edges: [{ id: 'save', source: 'api', target: 'db', kind: 'data', label: 'INSERT orders', evidence: 'document' }]
};

test('English UI labels reach SVG and legend without translating authored content', () => {
  assert.deepEqual(validateGraph(graph), []);
  const svg = createDiagramSvg(graph);
  assert.match(svg, />Service<\/text>/);
  assert.match(svg, />Database<\/text>/);
  assert.match(svg, /订单数据库/);
  assert.match(svg, /INSERT orders/);
  assert.equal(graphLegend(graph, PALETTES.light).find(item => item.role === 'core').label, 'Core component');
});

test('omitting locale preserves the existing Chinese rendering', () => {
  const legacy = structuredClone(graph);
  delete legacy.meta.locale;
  assert.deepEqual(validateGraph(legacy), []);
  assert.match(createDiagramSvg(legacy), />服务<\/text>/);
});

test('unsupported locale is rejected before generation', () => {
  for (const locale of ['invalid', '', null, 42]) {
    assert.ok(validateGraph({ ...graph, meta: { ...graph.meta, locale } }).includes('meta.locale is unsupported'));
  }
});

test('every locale has the same UI messages and preserves substitution parameters', () => {
  assert.equal(messages.en, undefined, 'English is the source language, not a catalog');
  const keys = Object.keys(messages['zh-CN']).sort();
  const parameters = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [locale, catalog] of Object.entries(messages)) {
    assert.deepEqual(Object.keys(catalog).sort(), keys, locale);
    for (const key of keys) {
      assert.ok(catalog[key].trim(), `${locale}: ${key}`);
      assert.deepEqual(parameters(catalog[key]), parameters(key), `${locale}: ${key}`);
    }
  }
});

test('all README and legacy languages reach exports and formatted interface messages', () => {
  const serviceLabels = { en: 'Service', 'zh-CN': '服务', ja: 'サービス', ru: 'Сервис', pt: 'Serviço', de: 'Dienst', es: 'Servicio', ko: '서비스', fr: 'Service' };
  for (const [locale, service] of Object.entries(serviceLabels)) {
    const localized = { ...graph, meta: { ...graph.meta, locale } };
    assert.deepEqual(validateGraph(localized), [], locale);
    assert.ok(createDiagramSvg(localized).includes(`>${service}</text>`), locale);
    assert.ok(createDiagramSvg(localized).includes('订单数据库'), 'authored identifiers are preserved');
    const status = translate(locale, 'Matches · {count}', { count: 6 });
    assert.ok(status.includes('6') && !status.includes('{'), locale);
    if (locale !== 'en') assert.notEqual(translate(locale, 'Search nodes'), 'Search nodes', locale);
  }
});

test('a missing locale means zh-CN and interface strings never contain Chinese at the source', () => {
  assert.equal(translate(undefined, 'Search nodes'), '搜索节点');
  assert.equal(translate('en', 'Search nodes'), 'Search nodes');
  assert.equal(translate('zh-CN', 'Legend'), '图例');
  for (const key of Object.keys(messages['zh-CN'])) assert.doesNotMatch(key, /[\u4e00-\u9fff]/, key);
});
