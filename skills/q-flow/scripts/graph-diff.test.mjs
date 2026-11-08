import assert from 'node:assert/strict';
import test from 'node:test';
import { compareGraphs, elementName, updateCount } from '../assets/viewer/src/graph-diff.js';
import { pageWithComparison, pageWithGraph } from '../assets/viewer/src/session-graph.js';

const view = (viewId, extra = {}) => ({
  meta: { title: 'Orders', diagramType: 'state', viewId, notes: ['n'] },
  nodes: [{ id: 'a', label: 'Open', position: { x: 0, y: 0 }, size: { width: 90, height: 40 }, source: { file: 'A.java', lineStart: 3, lineEnd: 9, symbol: 'open' } }, { id: 'b', label: 'Paid' }],
  edges: [{ id: 'e', source: 'a', target: 'b', label: 'pay', route: { points: [{ x: 1, y: 2 }] }, site: { file: 'A.java', lineStart: 5, symbol: 'pay' } }],
  ...extra
});

test('moved geometry and realigned anchor lines are not changes', () => {
  const after = structuredClone(view('v'));
  after.nodes[0].position = { x: 300, y: 80 }; after.nodes[0].source.lineStart = 13; after.edges[0].route = { points: [] }; after.edges[0].site.lineStart = 15;
  const diff = compareGraphs(view('v'), after).views.v;
  assert.deepEqual(diff, { added: [], changed: [], removed: [], meta: false });
  assert.equal(updateCount(diff), 0);
});

test('content changes, additions and removals are found per element, with readable names for removed ones', () => {
  const after = structuredClone(view('v'));
  after.nodes[1].label = 'Paid in full'; after.nodes.push({ id: 'c', label: 'Cancelled' }); after.edges = [{ id: 'f', source: 'a', target: 'c', label: 'cancel' }]; after.meta.notes = ['changed'];
  const diff = compareGraphs(view('v'), after).views.v;
  assert.deepEqual(diff.added.sort(), ['c', 'f']);
  assert.deepEqual(diff.changed, ['b']);
  assert.deepEqual(diff.removed, [{ id: 'e', label: 'Open → Paid: pay' }]);
  assert.equal(diff.meta, true);
  assert.equal(elementName(after, 'f'), 'Open → Cancelled: cancel');
});

test('views pair by view id: a new view is all added, a dropped view is reported', () => {
  const result = compareGraphs({ diagrams: [view('v1'), view('v2')] }, { diagrams: [view('v2'), view('v3')] });
  assert.deepEqual(result.views.v2.added, []);
  assert.deepEqual(result.views.v3.added.sort(), ['a', 'b', 'e']);
  assert.deepEqual(result.removedViews, ['v1']);
});

test('the comparison sits in its own page element and survives rewriting the graph data', () => {
  const shell = '<html><script id="graph-data" type="application/json">null</script></html>';
  const page = pageWithComparison(pageWithGraph(shell, view('v')), { views: { v: { added: ['a'], changed: [], removed: [], meta: false } } });
  assert.match(page, /<script id="graph-compare" type="application\/json">\{"views"/);
  const saved = pageWithGraph(page, view('v'));
  assert.match(saved, /id="graph-compare"/, 'saving from the page keeps the comparison');
  assert.equal(pageWithComparison(saved, { views: {} }).match(/graph-compare/g).length, 1, 'a new comparison replaces the old one');
});
