import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Exercise the actual asynchronous hook with controllable Worker completion and React setters.
// No DOM/React package is needed; browser checks separately exercise the controls and view cache.
function harness(overview = false) {
  const original={meta:{diagramType:'architecture'},nodes:[{id:'a',label:'A',position:{x:0,y:0},size:{width:240,height:100}}],edges:[]};
  const accepted=structuredClone(original);accepted.nodes[0].position.x=100;
  const dragging=structuredClone(accepted);dragging.nodes[0].position.x=150;
  const writes=[],workers=[],cleanups=[];let stateIndex=0;
  const deps={
    useState:value=>{const index=stateIndex++;return [value,next=>{if(index===1)writes.push(next);}];},
    useMemo:fn=>fn(),useRef:value=>({current:value}),useCallback:fn=>fn,
    useEffect:fn=>{if(fn.toString().includes('cancelLayout'))cleanups.push(fn());},
    useNodesState:()=>[dragging.nodes,()=>{},()=>{}],useEdgesState:()=>[[],()=>{}],
    useReactFlow:()=>({getViewport(){},setViewport(){},setCenter(){}}),
    LayoutWorker:class {constructor(){workers.push(this);}postMessage(data){this.data=data;}terminate(){this.terminated=true;}},
    initialNodes:g=>g.nodes,initialEdges:g=>g.edges,currentGraphFromFlow:()=>dragging,
    affectedRouteIds:()=>new Set(),diagramTypeOf:()=> 'architecture',isArchitectureOverview:()=>overview,
    overviewSections:()=>[],requireDiagramQuality:()=>({diagnostics:[]}),translate:(_locale,text)=>text,
    requestAnimationFrame:()=>{},
  };
  const source=fs.readFileSync(new URL('../assets/viewer/src/features/useGraphLayout.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function useGraphLayout','function useGraphLayout');
  const useGraphLayout=new Function(...Object.keys(deps),source+'\nreturn useGraphLayout;')(...Object.values(deps));
  return {hook:useGraphLayout(accepted,true,()=>{},original),original,accepted,dragging,writes,workers,cleanups};
}
for(const overview of [false,true]) test(`cancelled drag cannot undo reset (${overview?'overview':'ordinary'})`,async()=>{
 const h=harness(overview),pending=h.hook.onNodeDragStop(null,{type:'diagram'});
 h.hook.resetLayout();await pending;
 assert.deepEqual(h.writes,[h.original]);assert.equal(h.workers[0].terminated,true);
});
test('explicit drag cancellation restores accepted geometry; view caching exposes only accepted geometry',async()=>{
 const h=harness(),pending=h.hook.onNodeDragStop(null,{type:'diagram'});
 assert.deepEqual(h.hook.acceptedGraph,h.accepted);assert.notDeepEqual(h.hook.acceptedGraph,h.hook.currentGraph);
 h.hook.cancelLayout();await pending;assert.deepEqual(h.writes,[h.accepted]);
});
test('a worker completion queued before reset cannot reinstall stale geometry',async()=>{
 const h=harness(),pending=h.hook.onNodeDragStop(null,{type:'diagram'});
 h.workers[0].onmessage({data:{result:{graph:h.dragging}}});h.hook.resetLayout();await pending;
 assert.deepEqual(h.writes,[h.original]);
});
test('a worker failure queued before reset cannot restore an older draft',async()=>{
 const h=harness(),pending=h.hook.onNodeDragStop(null,{type:'diagram'});
 h.workers[0].onmessage({data:{error:{message:'No corridor',diagnostics:[]}}});h.hook.resetLayout();await pending;
 assert.deepEqual(h.writes,[h.original]);
});
test('superseding an overview text save returns cancellation so its draft remains open',async()=>{
 const h=harness(true),text=h.hook.updateNodeText('a','Edited');
 const next=h.hook.updateEdgeText('absent','');
 assert.equal(await text,'Cancelled');h.hook.cancelLayout();assert.equal(await next,'Cancelled');
 assert.deepEqual(h.writes,[]);
});
