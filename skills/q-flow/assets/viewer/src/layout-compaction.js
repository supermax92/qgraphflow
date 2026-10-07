import { groupHeadingBoxes, occupiedBox, visibleEdgeLabel } from './edge-routing.js';
import { diagramTypeOf, getDiagram } from './diagrams/registry.js';
import { layoutLimits, layoutTargets } from './layout-spacing.js';
import { groupHeadingLayout, estimateLabelSize } from './text-layout.js';

// Tighten actual ownership subtrees bottom-up; never infer ownership from containment.
export function tightenGroups(graph) {
  const groups=graph.groups??[], limits=layoutLimits(getDiagram(diagramTypeOf(graph))), done=new Set();
  const fit=group=>{
    if(done.has(group.id))return; done.add(group.id);
    const children=groups.filter(g=>g.parentId===group.id); children.forEach(fit);
    const members=[...children,...graph.nodes.filter(n=>n.groupId===group.id)]; if(!members.length)return;
    const heading=groupHeadingLayout(group), top=heading.height+limits.groupHeadingGap;
    const x=Math.max(0,Math.min(...members.map(n=>n.position.x))-limits.groupInset), y=Math.max(0,Math.min(...members.map(n=>n.position.y))-top);
    const right=Math.max(...members.map(n=>n.position.x+n.size.width))+limits.groupInset, bottom=Math.max(...members.map(n=>n.position.y+n.size.height))+limits.groupInset;
    group.position={x,y}; group.size={width:Math.max(right-x,heading.width+2*limits.groupInset),height:bottom-y};
  };
  groups.forEach(fit);return graph;
}

// Sweep genuinely empty horizontal/vertical slabs. A subtree moves intact when the cut is outside it;
// a boundary spanning the cut shrinks with its members. Routing validates the reclaimed channel.
export function* compactCandidates(input) {
  const type=diagramTypeOf(input); if(type==='sequence')return;
  const diagram=getDiagram(type), limits=layoutLimits(diagram), target=layoutTargets(diagram);
  yield* compactChannels(input,type,limits,target);
  if (['architecture','deployment','er','dataflow'].includes(type)) {
    const groups=input.groups??[];
    const descendants=id=>{const ids=new Set([id]);for(let size=0;size!==ids.size;){size=ids.size;for(const group of groups)if(ids.has(group.parentId))ids.add(group.id);}return ids;};
    // Ownership frames can occupy unused space beside a connected frame while their subtree remains rigid.
    // Authored ranks/order and type-specific partitions are retained; the caller rechecks semantic geometry.
    if (type === 'architecture' && !input.layout?.primaryPath?.length) {
      const roots = groups.filter(g=>!g.parentId).map(item=>{const ids=descendants(item.id);return {item,groups:groups.filter(g=>ids.has(g.id)),nodes:input.nodes.filter(n=>ids.has(n.groupId))};});
      const owner = new Map(roots.flatMap(unit=>unit.nodes.map(node=>[node.id,unit]))), proposals=[];
      const estimate = graph => {
        const all=[...graph.nodes,...(graph.groups??[])], byId=new Map(graph.nodes.map(n=>[n.id,n]));
        const area=(Math.max(...all.map(n=>n.position.x+n.size.width))-Math.min(...all.map(n=>n.position.x)))*(Math.max(...all.map(n=>n.position.y+n.size.height))-Math.min(...all.map(n=>n.position.y)));
        const nodeArea=graph.nodes.reduce((sum,n)=>sum+n.size.width*n.size.height,0),unit=Math.sqrt(nodeArea/graph.nodes.length);
        const length=graph.edges.reduce((sum,e)=>{const a=byId.get(e.source),b=byId.get(e.target);return sum+Math.abs(a.position.x+a.size.width/2-b.position.x-b.size.width/2)+Math.abs(a.position.y+a.size.height/2-b.position.y-b.size.height/2);},0);
        return area/nodeArea+length/(Math.max(1,graph.edges.length)*unit);
      };
      for (const unit of roots) {
        if(unit.nodes.some(n=>n.layout?.order!==undefined||n.layout?.rank!==undefined))continue;
        const peers=new Set(input.edges.flatMap(e=>owner.get(e.source)===unit?[owner.get(e.target)]:owner.get(e.target)===unit?[owner.get(e.source)]:[]).filter(p=>p&&p!==unit));
        for(const peer of peers) for(const axis of ['x','y']) for(const after of [false,true]) {
          const across=axis==='x'?'y':'x',extent=axis==='x'?'width':'height', gap=target.nodeGap;
          const position={...peer.item.position,[axis]:after?peer.item.position[axis]+peer.item.size[extent]+gap:peer.item.position[axis]-unit.item.size[extent]-gap};
          if(position.x<0||position.y<0)continue;
          const rect={...position,...unit.item.size};
          if(roots.some(other=>other!==unit&&rect.x<other.item.position.x+other.item.size.width+limits.groupGap&&other.item.position.x<rect.x+rect.width+limits.groupGap&&rect.y<other.item.position.y+other.item.size.height+limits.groupGap&&other.item.position.y<rect.y+rect.height+limits.groupGap))continue;
          const ids=new Set([...unit.groups,...unit.nodes].map(n=>n.id)),dx=position.x-unit.item.position.x,dy=position.y-unit.item.position.y;
          const geometry=items=>items.map(n=>({id:n.id,size:n.size,position:ids.has(n.id)?{x:n.position.x+dx,y:n.position.y+dy}:n.position}));
          const score=estimate({...input,nodes:geometry(input.nodes),groups:geometry(groups)});
          if(score<estimate(input)-.001)proposals.push({ids,dx,dy,score,id:unit.item.id+':'+peer.item.id+':'+axis+':'+after});
        }
      }
      proposals.sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id));
      for(const proposal of proposals.slice(0,12)) {
        const graph=structuredClone(input);
        for(const member of [...graph.nodes,...graph.groups])if(proposal.ids.has(member.id)){member.position.x+=proposal.dx;member.position.y+=proposal.dy;}
        yield graph;
      }
    }
    const rows=new Map();
    for(const item of [...groups,...input.nodes].sort((a,b)=>a.id.localeCompare(b.id))) {
      const group=groups.includes(item), scope=group?item.parentId:item.groupId;
      const key=`${scope??''}:${item.position.y}`;
      const ids=group?descendants(item.id):new Set();
      const nodes=group?input.nodes.filter(n=>ids.has(n.groupId)):[item];
      const unit={item,groups:group?groups.filter(g=>ids.has(g.id)):[],nodes};
      rows.set(key,[...(rows.get(key)??[]),unit]);
    }
    for(const [,items] of [...rows].sort(([a],[b])=>a.localeCompare(b))) {
      if(items.length<2 || items.some(unit=>unit.nodes.some(n=>n.layout?.order!==undefined)))continue;
      const row=items.sort((a,b)=>a.item.position.x-b.item.position.x||a.item.id.localeCompare(b.item.id));
      for(let i=0;i<row.length;i++)for(let j=i+1;j<row.length;j++) {
        const graph=structuredClone(input), byId=new Map([...graph.nodes,...(graph.groups??[])].map(n=>[n.id,n]));
        const order=[...row];[order[i],order[j]]=[order[j],order[i]];
        let x=row[0].item.position.x;
        for(let k=0;k<order.length;k++) {
          const unit=order[k],dx=x-unit.item.position.x;
          for(const member of [...unit.groups,...unit.nodes])byId.get(member.id).position.x+=dx;
          const gap=k<row.length-1?Math.max(target.nodeGap,row[k+1].item.position.x-row[k].item.position.x-row[k].item.size.width):0;
          x+=unit.item.size.width+gap;
        }
        yield graph;
      }
    }
  }
}

function* compactChannels(input,type,limits,target) {
  const tight=tightenGroups(structuredClone(input));
  if(JSON.stringify(tight.groups)!==JSON.stringify(input.groups))yield tight;
  const boxes=[...input.nodes.map(n=>occupiedBox(n,type)),...(input.groups??[]).flatMap(groupHeadingBoxes)];
  const gaps=[];
  for(const [axis,extent] of [['x','width'],['y','height']]) {
    const labelSpan=Math.max(0,...input.edges.map(e=>estimateLabelSize(visibleEdgeLabel(e,type,input.meta.locale))[extent]));
    const layerGap = axis === 'y' && ['class', 'state', 'flowchart'].includes(type) ? target.layerGap : target.nodeGap;
    const keep=Math.max(layerGap,labelSpan+2*limits.labelGap);
    const intervals=boxes.map(r=>[r[axis],r[axis]+r[extent]]).sort((a,b)=>a[0]-b[0]);
    let end=intervals[0]?.[1]??0;
    for(const [start,last] of intervals) {
      if(start-end>keep+1)gaps.push({axis,extent,cut:start,remove:start-end-keep});
      end=Math.max(end,last);
    }
  }
  gaps.sort((a,b)=>b.remove-a.remove||a.axis.localeCompare(b.axis)||a.cut-b.cut);
  for(const gap of gaps) for(const fraction of [1,.5]) {
    const graph=structuredClone(input), delta=gap.remove*fraction;
    const follow = value => value >= gap.cut ? value-delta : value > gap.cut-delta ? gap.cut-delta : value;
    for(const node of graph.nodes)if(node.position[gap.axis]>=gap.cut)node.position[gap.axis]-=delta;
    for(const edge of graph.edges) {
      if(edge.route?.via) edge.route.via=edge.route.via.map(point=>({...point,[gap.axis]:follow(point[gap.axis])}));
      if(edge.route?.labelAt) edge.route.labelAt={...edge.route.labelAt,[gap.axis]:follow(edge.route.labelAt[gap.axis])};
    }
    for(const group of graph.groups??[]) {
      if(group.position[gap.axis]>=gap.cut)group.position[gap.axis]-=delta;
      else if(group.position[gap.axis]+group.size[gap.extent]>=gap.cut)group.size[gap.extent]-=delta;
    }
    yield graph;
  }
}
