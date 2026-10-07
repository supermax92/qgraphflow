import { layoutLimits } from './layout-spacing.js';
import { getDiagram, diagramTypeOf } from './diagrams/registry.js';
import { routingBounds, groupBorders, groupHeadingBoxes, createEdgeRoutes, occupiedBox, segmentCrossesBox } from './edge-routing.js';
import { actorTop } from './diagrams/usecase.js';
import { layoutText } from './text-layout.js';
import { isArchitectureOverview } from './view-identity.js';

export const clearanceLimits = graph => ({ node: isArchitectureOverview(graph) ? 6 : 12, preferred: isArchitectureOverview(graph) ? 8 : 24, boundary: 6 });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pointDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
function segmentDistance(a, b, c, d) {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0
    && Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <= Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x))
    && Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <= Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y))) return 0;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b));
}
function boxDistance(a, b, r) {
  return Math.hypot(Math.max(r.x - Math.max(a.x, b.x), Math.min(a.x, b.x) - r.x - r.width, 0), Math.max(r.y - Math.max(a.y, b.y), Math.min(a.y, b.y) - r.y - r.height, 0));
}
function ellipseDistance(a, b, r) {
  const point = p => {
    const x = Math.abs(p.x - r.cx), y = Math.abs(p.y - r.cy);
    if ((x / r.rx) ** 2 + (y / r.ry) ** 2 <= 1+1e-12) return 0;
    if (x===0) return Math.max(0,y-r.ry);
    if (y===0) return Math.max(0,x-r.rx);
    const distance = t => Math.hypot(x - r.rx * Math.cos(t), y - r.ry * Math.sin(t));
    let lo = 0, hi = Math.PI / 2;
    for (let i = 0; i < 32; i++) { const l = lo + (hi - lo) / 3, h = hi - (hi - lo) / 3; if (distance(l) < distance(h)) hi = h; else lo = l; }
    return Math.min(distance(0), distance(Math.PI / 2), distance((lo + hi) / 2));
  };
  const h = a.y === b.y, fixed = h ? a.y - r.cy : a.x - r.cx, radius = h ? r.ry : r.rx, extent = h ? r.rx : r.ry, centre = h ? r.cx : r.cy;
  const lower = Math.min(h ? a.x : a.y, h ? b.x : b.y), upper = Math.max(h ? a.x : a.y, h ? b.x : b.y);
  if (Math.abs(fixed) <= radius) { const half = extent * Math.sqrt(1 - (fixed / radius) ** 2); if (lower <= centre + half && upper >= centre - half) return 0; }
  if (lower <= centre && upper >= centre) return Math.max(0,Math.abs(fixed)-radius);
  const first=point(a);return first===0?0:Math.min(first,point(b));
}
function cylinderDistance(a,b,node) {
  const left=node.position.x+12,right=node.position.x+node.size.width-12,top=node.position.y+2,bottom=node.position.y+node.size.height-2,rx=(right-left)/2,cx=(left+right)/2;
  const inside=p=>{if(p.x<left||p.x>right)return false;const inset=5*(1-Math.sqrt(Math.min(p.x-left,right-p.x)/rx))**2;return p.y>=top+inset&&p.y<=bottom-inset;};
  if(inside(a)||inside(b)||inside({x:clamp(cx,Math.min(a.x,b.x),Math.max(a.x,b.x)),y:clamp((top+bottom)/2,Math.min(a.y,b.y),Math.max(a.y,b.y))}))return 0;
  const curve=(x,y,sx,sy)=>{
    const distance=t=>pointDistance({x:x+sx*rx*t*t,y:y+sy*5*(1-t)**2},a,b);
    let lo=0,hi=1;
    for(let i=0;i<32;i++){const l=lo+(hi-lo)/3,h=hi-(hi-lo)/3;if(distance(l)<distance(h))hi=h;else lo=l;}
    return Math.min(distance(0),distance(1),distance((lo+hi)/2));
  };
  return Math.min(boxDistance(a,b,{x:left,y:top+5,width:right-left,height:bottom-top-10}),curve(left,top,1,1),curve(right,top,-1,1),curve(left,bottom,1,-1),curve(right,bottom,-1,-1));
}
function polygonDistance(a, b, points) {
  const inside = p => { let result = false; for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const c = points[i], d = points[j];
    if ((c.y > p.y) !== (d.y > p.y) && p.x < (d.x - c.x) * (p.y - c.y) / (d.y - c.y) + c.x) result = !result;
  } return result; };
  if (inside(a) || inside(b)) return 0;
  return Math.min(...points.map((p, i) => segmentDistance(a, b, p, points[(i + 1) % points.length])));
}
// Compile once per node: the router checks many grid segments against the same visible geometry.
const cache = new WeakMap();
export function nodeClearance(node, type) {
  const signature = JSON.stringify([type,node.position,node.size,node.kind,node.label,node.subtitle,node.overviewText,node.badges,node.overviewTone]);
  const cached = cache.get(node); if (cached?.signature === signature) return cached.probe;
  const diagram = getDiagram(type), { x, y } = node.position;
  const outline = diagram.outline?.(node, x, y) ?? [];
  const [tag, shape] = outline[0] ?? [];
  let probe;
  if (type === 'usecase' && node.kind === 'actor') {
    const top = y + actorTop(node), cx = x + node.size.width / 2;
    const body = [[{x:cx,y:top+24},{x:cx,y:top+53}],[{x:cx-20,y:top+35},{x:cx+20,y:top+35}],[{x:cx,y:top+53},{x:cx-17,y:top+76}],[{x:cx,y:top+53},{x:cx+17,y:top+76}]];
    const text = [[node.label, 20, top + 78, 26], ...(node.subtitle ? [[node.subtitle, 16, top + 106, 24]] : [])].map(([label, font, ty, height]) => {
      const width = Math.min(node.size.width, layoutText(label, Infinity, font).width * 1.15); return { x: cx - width / 2, y: ty, width, height };
    });
    probe = (a, b) => Math.min(Math.max(0, pointDistance({x:cx,y:top+13},a,b)-11), ...body.map(([c,d])=>segmentDistance(a,b,c,d)), ...text.map(r=>boxDistance(a,b,r)));
  } else if (tag === 'path' && ['architecture','deployment'].includes(type) && node.kind === 'database') {
    probe=(a,b)=>cylinderDistance(a,b,node);
  } else if (tag === 'polygon') {
    const points = shape.points.split(/\s+/).map(p => { const [x,y]=p.split(',').map(Number); return {x,y}; });
    probe = (a,b) => polygonDistance(a,b,points);
  } else if (tag === 'circle') probe = (a,b) => Math.max(0,pointDistance({x:shape.cx,y:shape.cy},a,b)-shape.r);
  else if (tag === 'ellipse') probe = (a,b) => ellipseDistance(a,b,shape);
  else {
    // Path-based cards (cylinders, documents and open stores) also reserve their full text body.
    const r = tag === 'rect' ? shape : routingBounds(node,type), radius = tag === 'rect' ? Math.min(shape.rx ?? 0,r.width/2,r.height/2) : 0;
    const inner = {x:r.x+radius,y:r.y+radius,width:r.width-2*radius,height:r.height-2*radius};
    probe = (a,b) => Math.max(0,boxDistance(a,b,inner)-radius);
  }
  if (type === 'state' && ['initial','final'].includes(node.kind) && node.subtitle) {
    const base=probe, area=diagram.textArea(node), text={...area,x:x+area.x,y:y+area.y};
    probe=(a,b)=>Math.min(base(a,b),boxDistance(a,b,text));
  }
  const geometryProbe=probe, points=new Map();
  probe=(a,b)=>{
    if(a.x!==b.x||a.y!==b.y)return geometryProbe(a,b);
    const key=a.x+','+a.y;if(points.has(key))return points.get(key);
    const distance=geometryProbe(a,b);if(points.size<1024)points.set(key,distance);return distance;
  };
  cache.set(node,{signature,probe}); return probe;
}

export function boundaryClearance(a,b,group) {
  const h=a.y===b.y, axis=h?'x':'y', across=h?'y':'x';
  return groupBorders(group).filter(([c,d])=>h===(c.y===d.y)).map(([c,d])=>({
    distance:Math.abs(a[across]-c[across]),
    length:Math.max(0,Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis])))
  })).filter(item=>item.length>.001).sort((a,b)=>a.distance-b.distance)[0] ?? {distance:Infinity,length:0};
}

// Only the terminal segment may enter its own node's clearance band.
export function clearanceProbe(graph, sourceId, targetId, sourcePoints = [], targetPoints = []) {
  const type=diagramTypeOf(graph), limits=clearanceLimits(graph);
  const entries=graph.nodes.map(node=>({node,probe:nodeClearance(node,type),bounds:routingBounds(node,type),terminals:[...(node.id===sourceId?sourcePoints:[]),...(node.id===targetId?targetPoints:[])]}));
  return (a,b) => entries.some(({node,probe,bounds,terminals})=> {
    if (boxDistance(a,b,bounds)>=limits.node && !(type==='usecase'&&node.kind==='actor') && !(type==='state'&&node.subtitle)) return false;
    const endpoint=p=>terminals.some(t=>Math.abs(t.x-p.x)<.001&&Math.abs(t.y-p.y)<.001);
    if (endpoint(a) && probe(b,b)+.001>=limits.node || endpoint(b) && probe(a,a)+.001>=limits.node) return false;
    return probe(a,b)+.001<limits.node;
  }) || (graph.groups??[]).some(group=>boundaryClearance(a,b,group).distance+.001<limits.boundary);
}

// Edits reserve a halo around changed visible geometry. A changed boundary affects only nearby lanes/headings.
export function affectedRouteIds(before, after, seed = []) {
  const ids = new Set(seed), type = diagramTypeOf(after), gap = clearanceLimits(after).node;
  const changed = after.nodes.filter(node => JSON.stringify(node) !== JSON.stringify(before.nodes.find(old => old.id === node.id)));
  const nodes = new Set(changed.map(node => node.id));
  const obstacles = changed.map(node => { const r = occupiedBox(node, type); return { x:r.x-gap, y:r.y-gap, width:r.width+2*gap, height:r.height+2*gap }; });
  const groups = (after.groups ?? []).filter(group => JSON.stringify(group) !== JSON.stringify(before.groups?.find(old => old.id === group.id)));
  const routes = createEdgeRoutes(before), labelGap = layoutLimits(getDiagram(type)).labelGap;
  const labelObstacles = [...changed.map(node => occupiedBox(node,type)), ...groups.flatMap(groupHeadingBoxes)];
  const rectDistance = (a,b) => Math.hypot(Math.max(a.x-b.x-b.width,b.x-a.x-a.width,0),Math.max(a.y-b.y-b.height,b.y-a.y-a.height,0));
  for (const edge of after.edges) {
    const old = before.edges.find(item => item.id === edge.id), route = routes.get(edge.id);
    if (nodes.has(edge.source) || nodes.has(edge.target) || JSON.stringify(edge) !== JSON.stringify(old)
      || route && [...(route.label ? [route.labelBox] : []), ...(route.endpointLabels ?? []).map(label=>label.labelBox)].some(label=>labelObstacles.some(box=>rectDistance(label,box)<labelGap))
      || route?.points.slice(1).some((b,i) => {
        const a = route.points[i];
        return obstacles.some(r => segmentCrossesBox(a,b,r)) || groups.some(group => boundaryClearance(a,b,group).distance < clearanceLimits(after).boundary
          || groupHeadingBoxes(group).some(r => segmentCrossesBox(a,b,r)));
      })) ids.add(edge.id);
  }
  return ids;
}
