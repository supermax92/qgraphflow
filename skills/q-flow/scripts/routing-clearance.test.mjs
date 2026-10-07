import fs from 'node:fs';
import { templateDraft } from '../assets/viewer/src/layout-templates.js';
import { fitArchitectureOverview, maintainArchitectureOverview } from '../assets/viewer/src/architecture-overview.js';
import { refineDiagramLayout } from '../assets/viewer/src/layout-refinement.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLayoutQuality, requireDiagramQuality } from '../assets/viewer/src/layout-quality.js';
import { routeOrthogonal, simplifyCorridor, priorCost } from '../assets/viewer/src/orthogonal-routing.js';
import { createEdgeRoutes, segmentCrossesBox } from '../assets/viewer/src/edge-routing.js';
import { nodeClearance, boundaryClearance, affectedRouteIds } from '../assets/viewer/src/route-clearance.js';
import { compactCandidates } from '../assets/viewer/src/layout-compaction.js';
import { LAYOUT_VERSION } from '../assets/viewer/src/layout-policy.js';
import { compileGraphLayout } from './compile-layout.mjs';
import { diagramSvgFiles } from '../assets/viewer/src/export-svg.js';

const card=(id,x,y)=>({id,label:id,kind:'component',position:{x,y},size:{width:240,height:100}});
const relation=(id,source,target)=>({id,source,target,kind:'depends',evidence:'inference',label:''});
const graph=(nodes,edges)=>({meta:{title:'Clearance fixture',diagramType:'architecture',sourceRef:'conceptual:clearance'},nodes,edges});
const touching=()=>graph([card('a',40,100),card('obstacle',400,150),card('b',800,100)],[{...relation('ab','a','b'),route:{via:[{x:292,y:150},{x:788,y:150}]}}]);
const current=g=>({...g,layout:{...g.layout,version:LAYOUT_VERSION}});

test('legacy touching geometry stays readable/exportable while current layouts reject it',async()=>{
  const input=touching(),before=structuredClone(input),audit=auditLayoutQuality(input);
  assert.equal(audit.errors.length,0);
  assert.ok(audit.diagnostics.some(d=>d.ruleId==='route.node-clearance'&&d.severity==='warning'));
  const kept=await compileGraphLayout(input,{layout:'preserve'});
  assert.deepEqual(kept.graph,before); assert.equal(diagramSvgFiles(input).length,1);
  assert.throws(()=>requireDiagramQuality(current(input)),/route.node-clearance/);
  assert.deepEqual(input,before);
});
test('routing repairs a boundary-hugging relation without moving nodes or dropping facts',()=>{
  const input=current(touching()),output=routeOrthogonal(input,{accept:requireDiagramQuality}).graph;
  assert.deepEqual(output.nodes,input.nodes);requireDiagramQuality(output);
  const audit=auditLayoutQuality(output); assert.ok(audit.routeMetrics[0].minimumClearance>=12-.001);
  assert.ok(createEdgeRoutes(output).get('ab').points.length<=4);
});
test('strict local validation leaves unrelated legacy relations as warnings',()=>{
  const input=touching();
  assert.doesNotThrow(()=>requireDiagramQuality(input,{strictEdgeIds:new Set(['unrelated'])}));
  assert.throws(()=>requireDiagramQuality(input,{strictEdgeIds:new Set(['ab'])}),/route.node-clearance/);
});
test('boundary clearance permits perpendicular crossings and rejects parallel near misses',()=>{
  const group={position:{x:100,y:100},size:{width:300,height:200}};
  assert.equal(boundaryClearance({x:80,y:160},{x:120,y:160},group).distance,60);
  assert.equal(boundaryClearance({x:102,y:130},{x:102,y:250},group).distance,2);
});
test('diamond, circle and ellipse clearance follows the outline rather than its bounding box',()=>{
  const node={...card('shape',100,100),size:{width:100,height:100}};
  for(const [type,kind] of [['flowchart','decision'],['usecase','usecase']]) {
    const probe=nodeClearance({...node,kind},type);
    assert.ok(probe({x:100,y:100},{x:110,y:100})>12);
    assert.equal(probe({x:90,y:150},{x:100,y:150}),0);
  }
  const probe=nodeClearance({...node,kind:'initial'},'state');
  assert.ok(Math.abs(probe({x:100,y:100},{x:200,y:100})-38)<.001);
});
test('cylinders reserve their inset body and actor labels reserve their text',()=>{
  const cylinder=nodeClearance({...card('db',100,100),kind:'database'},'architecture');
  assert.equal(cylinder({x:100,y:120},{x:100,y:180}),12);
  const actor={...card('actor',100,100),kind:'actor',label:'Participant',size:{width:160,height:128}};
  const probe=nodeClearance(actor,'usecase');
  assert.equal(probe({x:130,y:196},{x:230,y:196}),0);
});
test('clearance cache follows edits to the same node object',()=>{
  const node=card('a',100,100),a={x:0,y:150},b={x:80,y:150};
  assert.equal(nodeClearance(node,'architecture')(a,b),20);
  node.position.x=120;
  assert.equal(nodeClearance(node,'architecture')(a,b),40);
});
test('empty-slab compaction moves complete ownership subtrees and retains explicit data',()=>{
  const input=graph([{...card('a',80,100),groupId:'left'},{...card('b',800,100),groupId:'right'}],[relation('ab','a','b')]);
  input.groups=[{id:'left',label:'Left',kind:'ownership',position:{x:56,y:42},size:{width:288,height:182}},{id:'right',label:'Right',kind:'ownership',position:{x:776,y:42},size:{width:288,height:182}}];
  const before=structuredClone(input),candidate=[...compactCandidates(input)].find(g=>g.nodes[1].position.x<input.nodes[1].position.x);
  assert.ok(candidate);assert.equal(candidate.nodes[1].position.x-candidate.groups[1].position.x,24);
  assert.deepEqual(candidate.edges,input.edges);assert.deepEqual(input,before);
});

test('a nearby edited component reserves full relationship label bounds',()=>{
  const input=graph([card('a',40,100),card('b',800,100),card('c',420,10)],[{...relation('ab','a','b'),label:'Calls',route:{via:[{x:292,y:150},{x:788,y:150}],labelAt:{x:540,y:150}}}]);
  requireDiagramQuality(input);const next=structuredClone(input);next.nodes[2].position.y+=20;
  assert.deepEqual([...affectedRouteIds(input,next)],['ab']);
  const output=refineDiagramLayout(next,{move:false,evaluations:1,edgeIds:['ab']}).graph;
  requireDiagramQuality(output);assert.deepEqual(output.nodes,next.nodes);
});
test('stair replacements restart safely and preserve a blocking corridor',()=>{
  const points=[[0,0],[20,0],[20,20],[40,20],[40,40],[60,40],[60,60],[80,60]].map(([x,y])=>({x,y}));
  const cost=p=>p.length*100+p.slice(1).reduce((s,b,i)=>s+Math.abs(b.x-p[i].x)+Math.abs(b.y-p[i].y),0);
  const simple=simplifyCorridor(points,cost);
  assert.ok(simple.length<points.length);assert.deepEqual(simple[0],points[0]);assert.deepEqual(simple.at(-1),points.at(-1));
  const blocked=p=>p.some((b,i)=>i&&segmentCrossesBox(p[i-1],b,{x:29,y:25,width:2,height:30}))?Infinity:cost(p);
  assert.ok(Number.isFinite(blocked(simplifyCorridor(points,blocked))));
});
test('local repair leaves a distant legacy touching route and version untouched',()=>{
  const input=touching();input.nodes.push(card('x',40,600),card('y',700,600));input.edges.push(relation('xy','x','y'));
  const old=structuredClone(input.edges[0]);input.nodes.find(n=>n.id==='x').size.width=650;
  const output=refineDiagramLayout(input,{focusId:'x',edgeIds:['xy'],move:true,evaluations:12}).graph;
  assert.deepEqual(output.edges[0],old);assert.equal(output.layout?.version,undefined);
  requireDiagramQuality(output,{strictEdgeIds:new Set(['xy'])});
});
test('parallel and bidirectional relations keep distinct clear lanes including a self loop',()=>{
  const input=current(graph([card('a',100,100),card('b',800,100)],[relation('forward','a','b'),relation('parallel','a','b'),relation('back','b','a'),relation('self','b','b')]));
  const output=routeOrthogonal(input,{accept:requireDiagramQuality}).graph;
  assert.equal(output.edges.length,4);requireDiagramQuality(output);
  assert.equal(new Set([...createEdgeRoutes(output).values()].map(r=>JSON.stringify(r.points))).size,4);
});

test('an unobstructed aligned corridor stays straight inside a narrow legal channel',()=>{
  const input=current(graph([card('a',40,100),card('b',800,100),card('upper',400,34),card('lower',400,166)],[relation('ab','a','b')]));
  const output=routeOrthogonal(input,{accept:requireDiagramQuality}).graph;
  assert.equal(createEdgeRoutes(output).get('ab').points.length,2);
  assert.equal(auditLayoutQuality(output).routeMetrics[0].minimumClearance,16);
});
test('template peer refinement is independent of input arrays',()=>{
  const input=graph([{...card('api-a',0,0),groupId:'front'},{...card('api-b',0,0),groupId:'front'},{...card('store-a',0,0),groupId:'back'},{...card('store-b',0,0),groupId:'back'}],[relation('save-a','api-a','store-b'),relation('save-b','api-b','store-a')]);
  input.groups=[{id:'front',kind:'runtime',label:'Front'},{id:'back',kind:'runtime',label:'Back'}];
  const reversed=structuredClone(input);for(const key of ['nodes','edges','groups'])reversed[key].reverse();
  const geometry=g=>g.nodes.map(({id,position,size})=>({id,position,size})).sort((a,b)=>a.id.localeCompare(b.id));
  for(const variant of [2,3])assert.deepEqual(geometry(templateDraft(input,variant)),geometry(templateDraft(reversed,variant)));
});
test('actual actor-arm ports align to an ellipse without a tiny staircase',()=>{
  const input=current({...graph([{...card('reader',100,100),kind:'actor',size:{width:160,height:128}},{...card('borrow',500,103),kind:'usecase',size:{width:240,height:160}}],[{...relation('use','reader','borrow'),kind:'association'}]),meta:{title:'Arm alignment',diagramType:'usecase',sourceRef:'conceptual:arm-alignment'}});
  const output=routeOrthogonal(input,{accept:requireDiagramQuality}).graph;
  assert.equal(createEdgeRoutes(output).get('use').points.length,2);requireDiagramQuality(output);
});

test('a database overview card uses its actual rounded outline and invalidates cached cylinder geometry',()=>{
 const node={...card('store',100,100),kind:'database',size:{width:300,height:100}};
 const a={x:100,y:125},b={x:100,y:175};
 assert.ok(nodeClearance(node,'architecture')(a,b)>0);
 node.overviewText=['Durable records'];
 assert.equal(nodeClearance(node,'architecture')(a,b),0);
});
test('growing an ownership boundary repairs newly affected nonincident legacy routes',()=>{
 const input=graph([card('a',280,40),card('b',280,800),{...card('c',100,400),groupId:'g'}],[{...relation('ab','a','b'),route:{via:[{x:400,y:152},{x:400,y:788}]}}]);
 input.groups=[{id:'g',kind:'ownership',label:'Group',position:{x:76,y:342},size:{width:288,height:182}}];
 requireDiagramQuality(input);
 const moved=structuredClone(input);moved.nodes.find(n=>n.id==='c').position.x=132;
 const result=refineDiagramLayout(moved,{move:false,growBoundaries:true,evaluations:1,passes:1,edgeIds:[]}).graph;
 assert.deepEqual(result.nodes,moved.nodes);
 assert.doesNotThrow(()=>requireDiagramQuality(result,{strictEdgeIds:new Set(['ab'])}));
});

test('regenerating a saved legacy horizontal flow retains the winning candidate semantics',async()=>{
 const input={meta:{title:'Saved two-step flow',diagramType:'flowchart',locale:'zh-CN',sourceRef:'conceptual:saved-flow'},nodes:[
  {id:'left',label:'流程改名',subtitle:'修改说明',kind:'process',position:{x:316.48,y:110.63},size:{width:240,height:160}},
  {id:'right',label:'right',kind:'process',position:{x:680.48,y:100},size:{width:240,height:160}}
 ],edges:[{id:'relation',source:'left',target:'right',label:'流程关系',kind:'flow',evidence:'inference'}]};
 const {graph:output}=await compileGraphLayout(input);
 requireDiagramQuality(output);
 const preserved=await compileGraphLayout(output,{layout:'preserve'});
 assert.deepEqual(preserved.graph,output);
});

test('A-star grid vertices never overcount the unique crossing used to prune candidates',()=>{
 const cost=priorCost([[{x:50,y:0},{x:50,y:100}]],{parallelGap:12,crossingCost:100,endpoint:12});
 const a={x:0,y:50},mid={x:50,y:50},b={x:100,y:50};
 assert.equal(cost(a,mid,50)+cost(mid,b,50),cost(a,b,100));
 assert.equal(cost(a,b,100),200);
 const bend=priorCost([[{x:50,y:0},{x:50,y:50},{x:80,y:50}]],{parallelGap:0,crossingCost:100,endpoint:12});
 assert.ok(bend({x:20,y:50},mid,30)+bend(mid,{x:50,y:80},30)<=160);
});
