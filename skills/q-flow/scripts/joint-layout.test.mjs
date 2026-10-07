import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeOrthogonal, nearestPortPairs } from '../assets/viewer/src/orthogonal-routing.js';
import { refineDiagramLayout, layoutMetrics } from '../assets/viewer/src/layout-refinement.js';
import { createEdgeRoutes, segmentCrossesBox } from '../assets/viewer/src/edge-routing.js';
import { requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { compileGraphLayout } from './compile-layout.mjs';

const graph = (nodes, edges, type = 'architecture') => ({ meta: { title: 'Joint layout', diagramType: type, sourceRef: 'conceptual:joint-layout' }, nodes, edges });
const card = (id, x, y) => ({ id, label: id, kind: 'component', position: { x, y }, size: { width: 240, height: 100 } });
const edge = (id, source, target, label = '') => ({ id, source, target, label, kind: 'depends', evidence: 'inference' });
const routed = input => routeOrthogonal(input, { accept: requireDiagramQuality }).graph;

test('closest clear facing outlines produce a direct Manhattan shortest route', () => {
  const input = graph([card('a', 40, 80), card('b', 480, 80)], [edge('ab', 'a', 'b')]);
  const pair = nearestPortPairs(input.nodes[0], input.nodes[1], input)[0];
  assert.equal(pair.sourceSide, 'right'); assert.equal(pair.targetSide, 'left');
  const r = createEdgeRoutes(routed(input)).get('ab');
  assert.equal(r.points.length, 2); assert.equal(r.points[1].x - r.points[0].x, 200);
});
test('all routes are orthogonal and bypass an intervening component', () => {
  const input = graph([card('a', 40, 80), card('obstacle', 400, 80), card('b', 760, 80)], [edge('ab', 'a', 'b')]);
  const output = routed(input), r = createEdgeRoutes(output).get('ab'), obstacle = { ...input.nodes[1].position, ...input.nodes[1].size };
  for (let i = 1; i < r.points.length; i++) {
    assert.ok(r.points[i].x === r.points[i - 1].x || r.points[i].y === r.points[i - 1].y);
    assert.equal(segmentCrossesBox(r.points[i - 1], r.points[i], obstacle), false);
  }
});
test('a full label stays on a clear direct relation', () => {
  const input = graph([card('a', 40, 120), card('b', 480, 120)], [edge('ab', 'a', 'b', '完整关系说明')]);
  const output = routed(input), r = createEdgeRoutes(output).get('ab');
  assert.equal(r.points.length, 2); assert.equal(r.label, '完整关系说明'); requireDiagramQuality(output);
});
test('edge permutation and repeated solves retain identical routes and semantic facts', () => {
  const input = graph([card('a', 40, 80), card('b', 480, 80), card('c', 480, 400)], [edge('ab', 'a', 'b'), edge('ac', 'a', 'c')]);
  const a = routed(input), b = routed({ ...input, edges: [...input.edges].reverse() }), c = routed(input);
  const geometry = g => [...g.edges].sort((a, b) => a.id.localeCompare(b.id)).map(e => [e.id, e.route]);
  assert.deepEqual(geometry(a), geometry(b)); assert.deepEqual(geometry(a), geometry(c));
  assert.deepEqual(input.edges.map(({ route, ...e }) => e), a.edges.map(({ route, ...e }) => e));
});
test('bidirectional, multiple and self relations remain individually traceable', () => {
  const input = graph([card('a', 80, 160), card('b', 680, 160)], [edge('ab', 'a', 'b'), edge('ba', 'b', 'a'), edge('ab2', 'a', 'b'), edge('self', 'a', 'a')]);
  const output = routed(input), routes = createEdgeRoutes(output);
  requireDiagramQuality(output); assert.equal(routes.size, 4);
  assert.notDeepEqual(routes.get('ab').points, routes.get('ab2').points);
  assert.equal(routes.get('self').sourceSide, routes.get('self').targetSide);
});
test('focused compaction is bounded, preserves ownership and freezes unrelated nodes', () => {
  const input = graph([card('a', 40, 80), card('b', 620, 80), card('unrelated', 1100.25, 500.75)], [edge('ab', 'a', 'b')]);
  const before = structuredClone(input), result = refineDiagramLayout(input, { focusId: 'a', evaluations: 8, passes: 1 });
  assert.deepEqual(input, before); assert.ok(result.report.evaluations <= 8); assert.equal(result.report.provenImpossible, false);
  assert.deepEqual(result.graph.nodes[2], input.nodes[2]);
  assert.ok(layoutMetrics(result.graph).cost <= layoutMetrics(input).cost);
  for (const n of result.graph.nodes) { const old = input.nodes.find(x => x.id === n.id); assert.ok(Math.abs(n.position.x - old.position.x) <= 156); assert.ok(Math.abs(n.position.y - old.position.y) <= 156); }
});
test('all nine types use shared refinement while keeping notation and full facts', async () => {
  const input = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json', import.meta.url)));
  for (const item of input.diagrams) {
    const result = await compileGraphLayout(item); requireDiagramQuality(result.graph);
    assert.equal(result.report.semantics.preserved, true, item.meta.diagramType);
    assert.ok(result.report.refinement); assert.ok(result.report.refinement.evaluations <= 60);
    if (item.meta.diagramType === 'sequence') assert.deepEqual(result.graph.edges.map(e => [e.id, e.order, e.replyTo]), item.edges.map(e => [e.id, e.order, e.replyTo]));
  }
});

test('a measured edit repairs both neighboring gaps together without changing facts', () => {
  const input = graph([card('a', 80, 80), { ...card('b', 80, 196), size: { width: 240, height: 180 } }, card('c', 80, 392), card('unrelated', 900, 600)], [edge('ab', 'a', 'b'), edge('bc', 'b', 'c')]);
  const result = refineDiagramLayout(input, { focusId: 'b', evaluations: 12, passes: 1 });
  requireDiagramQuality(result.graph); assert.ok(result.report.evaluations <= 12);
  assert.deepEqual(result.graph.nodes[3], input.nodes[3]);
  assert.deepEqual(result.graph.nodes.map(({position,...n})=>n),input.nodes.map(({position,...n})=>n));
  assert.ok(result.graph.nodes[1].position.y > input.nodes[1].position.y);
  assert.ok(result.graph.nodes[2].position.y > input.nodes[2].position.y);
});

test('a compact overview gap supports a straight relation with no artificial overlapping stubs', async () => {
  const { fitArchitectureOverview } = await import('../assets/viewer/src/architecture-overview.js');
  const input = { ...graph([{id:'a',kind:'component',label:'A'},{id:'b',kind:'component',label:'B'}],[edge('ab','a','b')]), meta:{title:'Narrow overview gap',diagramType:'architecture',architectureView:'capabilities',viewId:'gap',sourceRef:'conceptual:gap'},layout:{sections:[{id:'row',title:'Measured cards',mode:'grid',columns:2,items:[{nodeId:'a'},{nodeId:'b'}]}]} };
  const result = fitArchitectureOverview(input, requireDiagramQuality), route=createEdgeRoutes(result).get('ab');
  assert.equal(route.points.length,2);
  assert.equal(route.points[1].x-route.points[0].x,14);
});

test('a growing sequence actor header shifts messages and fragments together, retaining participant positions and event IDs', async () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json', import.meta.url))).diagrams.find(g=>g.meta.diagramType==='sequence');
  const input=(await compileGraphLayout(raw)).graph, actor=input.nodes.find(n=>n.kind==='actor');actor.subtitle='调用方说明';
  const output=routeOrthogonal(input,{accept:requireDiagramQuality}).graph, before=createEdgeRoutes(input), after=createEdgeRoutes(output);
  assert.deepEqual(output.nodes.map(n=>n.position),input.nodes.map(n=>n.position));
  assert.deepEqual(output.edges.map(e=>[e.id,e.order,e.replyTo]),input.edges.map(e=>[e.id,e.order,e.replyTo]));
  const shifts=output.edges.map(e=>after.get(e.id).points[0].y-before.get(e.id).points[0].y);assert.ok(shifts[0]>0);assert.ok(shifts.every(n=>n===shifts[0]));
  assert.deepEqual(output.executions,input.executions);
});

test('a wider sequence participant pushes later ones right within the bound, keeping order, events and fragments', async () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json', import.meta.url))).diagrams.find(g => g.meta.diagramType === 'sequence');
  const input = (await compileGraphLayout(raw)).graph, ordered = graph => [...graph.nodes].sort((a, b) => a.position.x - b.position.x).map(n => n.id);
  let repaired = 0;
  for (const { id } of input.nodes) {
    const wide = structuredClone(input); wide.nodes.find(n => n.id === id).size.width += 90;
    let result; try { refineDiagramLayout(wide, { move: false, evaluations: 1, passes: 2 }); continue; } catch { /* the page falls back to the local repair */ }
    result = refineDiagramLayout(wide, { move: true, focusId: id, evaluations: 12, passes: 1 }).graph; repaired++;
    assert.deepEqual(ordered(result), ordered(input)); requireDiagramQuality(result);
    assert.deepEqual(result.edges.map(e => [e.id, e.order, e.replyTo, e.route.messageY]), input.edges.map(e => [e.id, e.order, e.replyTo, e.route.messageY]));
    assert.deepEqual(result.executions, input.executions);
    for (const n of result.nodes) { const old = input.nodes.find(x => x.id === n.id); assert.ok(Math.abs(n.position.x - old.position.x) <= 156); assert.equal(n.position.y, old.position.y); }
    assert.deepEqual(result.groups.map(g => [g.id, g.operands]), input.groups.map(g => [g.id, g.operands]));
  }
  assert.ok(repaired, 'at least one widened participant needs the local repair');
});
test('a short vertical gap reroutes to keep the full label on its own line', () => {
  const input=graph([card('a',100,100),card('b',100,240)],[edge('ab','a','b','关系说明')]);
  const output=routed(input),route=createEdgeRoutes(output).get('ab');requireDiagramQuality(output);
  assert.ok(route.points.length > 2, 'A 40px gap cannot hold full text plus node clearances.');
  assert.ok(route.points.slice(1).some((b,i) => { const a=route.points[i],p=route.labelPoint; return a.x===b.x && p.x===a.x && p.y>=Math.min(a.y,b.y) && p.y<=Math.max(a.y,b.y); }), 'The label stays on the new vertical corridor.');
});

test('repeated-view failures retain independent bounded-routing reports', async () => {
  const {compileViews}=await import('./generate-viewer.mjs');
  const inputs=['first','second'].map(viewId=>({meta:{diagramType:'architecture',viewId}}));
  await assert.rejects(compileViews(inputs,async g=>{throw Object.assign(new Error('Budget for '+g.meta.viewId),{routingReport:{elementIds:[g.meta.viewId],termination:'evaluation-budget',provenImpossible:false}})}),e=>{assert.deepEqual(Object.keys(e.routingReports),['first','second']);assert.deepEqual(e.routingReports.second.elementIds,['second']);return true;});
});

test('editing a lifecycle endpoint description uses its real symbol ports and repairs the following gap', async () => {
  const raw=JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json',import.meta.url))).diagrams.find(g=>g.meta.diagramType==='state');
  const input=(await compileGraphLayout(raw)).graph, endpoint=input.nodes.find(n=>n.kind==='initial');
  endpoint.label='验收 <>&" 😀';endpoint.subtitle='第一行\nSecond line';
  const {minimumNodeSize}=await import('../assets/viewer/src/layout-measure.js');endpoint.size=minimumNodeSize(endpoint,'state',input.meta.locale);
  const output=refineDiagramLayout(input,{focusId:endpoint.id,evaluations:12,passes:1}).graph;requireDiagramQuality(output);
  const {routingBounds}=await import('../assets/viewer/src/edge-routing.js');const outline=routingBounds(output.nodes.find(n=>n.id===endpoint.id),'state');
  const point=createEdgeRoutes(output).get('create').points[0];assert.ok(point.x>=outline.x&&point.x<=outline.x+outline.width&&point.y>=outline.y&&point.y<=outline.y+outline.height);
  assert.deepEqual(output.edges.map(({route,...e})=>e),input.edges.map(({route,...e})=>e));assert.equal(output.nodes[0].subtitle,endpoint.subtitle);
});


test('an unrepairable candidate retains bounded attempts and diagnostics without claiming impossibility', () => {
  const input = graph([card('a', 40, 80), card('b', 40, 80)], [edge('ab', 'a', 'b')]), before = structuredClone(input);
  assert.throws(() => refineDiagramLayout(input, { move: false, evaluations: 1, passes: 1 }), error => {
    assert.equal(error.routingReport.provenImpossible, false); assert.equal(error.routingReport.termination, 'no-valid-candidate');
    assert.equal(error.routingReport.evaluations, 1); assert.equal(error.routingReport.attempts.length, 1);
    assert.ok(error.diagnostics.some(item => item.elementIds.includes('a') && item.elementIds.includes('b')));
    return true;
  });
  assert.deepEqual(input, before);
});


test('successive deployment card edits reroute clear of the owning group boundary', async () => {
  const { fitCard, placed } = await import('../assets/viewer/src/session-graph.js');
  const { compactCards } = await import('../assets/viewer/src/diagrams/registry.js');
  const raw = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json', import.meta.url))).diagrams.find(g => g.meta.diagramType === 'deployment');
  let current = (await compileGraphLayout(raw)).graph;
  for (const [label, subtitle] of [['normal submit', ''], ['client', ''], ['验收 <>&" 😀', '第一行\nSecond line']]) {
    const edited = { ...current, nodes: current.nodes.map(node => node.id === 'client' ? { ...node, label, subtitle } : node) };
    const measured = placed(edited, fitCard(edited, 'client', !compactCards(current)));
    try { current = refineDiagramLayout(measured, { move: false, evaluations: 1, passes: 2 }).graph; }
    catch { current = refineDiagramLayout(measured, { focusId: 'client', move: true, evaluations: 12, passes: 1 }).graph; }
    requireDiagramQuality(current);
    assert.equal(current.nodes.find(node => node.id === 'client').label, label);
    assert.equal(current.nodes.find(node => node.id === 'client').subtitle, subtitle);
  }
  assert.deepEqual(current.edges.map(({ route, ...edge }) => edge), raw.edges);
});


test('a valid manual move grows real ownership frames without moving the card back or reparenting it', async () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../../../tests/fixtures/semantic-layout.graph.json', import.meta.url))).diagrams.find(g => g.meta.diagramType === 'deployment');
  const baseline = (await compileGraphLayout(raw)).graph, input = structuredClone(baseline), card = input.nodes.find(node => node.id === 'api');
  card.position.x -= 12;
  const before = structuredClone(input), output = refineDiagramLayout(input, { growBoundaries: true, move: false, evaluations: 1, passes: 2 }).graph;
  requireDiagramQuality(output); assert.deepEqual(input, before);
  assert.deepEqual(output.nodes, input.nodes, 'The pointer position and every other node remain authored.');
  assert.ok(output.groups.find(group => group.id === 'host').size.width > baseline.groups.find(group => group.id === 'host').size.width);
  assert.deepEqual(output.groups.map(({ position, size, ...group }) => group), baseline.groups.map(({ position, size, ...group }) => group));
  assert.deepEqual(output.edges.map(({ route, ...edge }) => edge), raw.edges);
});
