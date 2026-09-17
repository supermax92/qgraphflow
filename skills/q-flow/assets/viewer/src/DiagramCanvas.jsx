import React, { useId } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position } from '@xyflow/react';
import SelectionOutline from './SelectionOutline.jsx';
import { renderNode } from './node-svg.js';
import { getDiagram, hasArrow, edgeMarkers } from './diagrams/registry.js';
import { cardinalityMarks } from './edge-routing.js';
import { renderFragment, fragmentDepth } from './sequence-fragments.js';
import { isCore, nodeMetrics, TYPOGRAPHY } from './visual-style.js';

function NodeHandles({ sequence = false }) {
  if (sequence) return <>
    <Handle id="target-left" type="target" position={Position.Left} style={{ top: TYPOGRAPHY.sequenceHeader, opacity: 0 }} />
    <Handle id="source-right" type="source" position={Position.Right} style={{ top: TYPOGRAPHY.sequenceHeader, opacity: 0 }} />
  </>;
  return <>
    <Handle id="target-left" type="target" position={Position.Left} />
    <Handle id="source-left" type="source" position={Position.Left} />
    <Handle id="target-right" type="target" position={Position.Right} />
    <Handle id="source-right" type="source" position={Position.Right} />
    <Handle id="target-top" type="target" position={Position.Top} />
    <Handle id="source-top" type="source" position={Position.Top} />
    <Handle id="target-bottom" type="target" position={Position.Bottom} />
    <Handle id="source-bottom" type="source" position={Position.Bottom} />
  </>;
}

function DiagramNode({ data, selected }) {
  const { compact } = nodeMetrics(data, data.diagramType);
  const moduleColor = data.moduleColors?.get(data.module);
  const markup = renderNode({ ...data, position: { x: 0, y: 0 } }, data.diagramType, 0, 0, data.palette, data.locale, data.moduleColors);
  return <article className={`diagram-node diagram-${data.diagramType} kind-${data.kind} ${moduleColor ? 'has-module' : ''} ${compact ? 'is-compact' : ''} ${isCore(data) ? 'is-core' : ''} ${data.dimmed ? 'is-dimmed' : ''} ${selected ? 'is-selected' : ''}`} style={moduleColor ? { '--node-module': moduleColor } : undefined} title={data.label}>
    <NodeHandles sequence={getDiagram(data.diagramType).sequence} />
    <svg className="node-visual" viewBox={`0 0 ${data.size.width} ${data.size.height}`} aria-label={data.label} dangerouslySetInnerHTML={{ __html: markup }} />
    {selected && <SelectionOutline key={data.selectionPulse} data={data} pulse={data.selectionPulse} />}
  </article>;
}

function BoundaryNode({ data }) {
  const fragment = data.fragment;
  const headingStyle = fragment?.heading ? { left: fragment.heading.x - data.position.x, maxWidth: fragment.heading.width } : undefined;
  return <><section className={`boundary boundary-${data.kind}`} aria-label={data.label}><span style={headingStyle}>{data.label}</span>{['alt', 'opt', 'loop', 'par'].includes(data.kind) && <small>{data.kind}</small>}{fragment && <svg className="fragment-visual" width="100%" height="100%" dangerouslySetInnerHTML={{ __html: renderFragment({ ...fragment, guards: [], bodies: [] }, data, -data.position.x, -data.position.y) }} />}</section>
    {fragment && <EdgeLabelRenderer><svg className="fragment-text" width={data.size.width} height={data.size.height} style={{ position: 'absolute', pointerEvents: 'none', transform: `translate(${data.position.x}px, ${data.position.y}px)` }} dangerouslySetInnerHTML={{ __html: renderFragment({ ...fragment, separators: [] }, data, -data.position.x, -data.position.y) }} /></EdgeLabelRenderer>}
  </>;
}

function Cardinality({ value, point, neighbor, color }) {
  const marks = cardinalityMarks(value, point, neighbor);
  return <g className="cardinality-mark" stroke={color} strokeWidth="1.5" fill="none"><path d={marks.path} />{marks.circle && <circle {...marks.circle} fill="var(--canvas)" />}</g>;
}

function RoutedEdge({ id, markerEnd, style, data }) {
  const { route } = data;
  const sequence = getDiagram(data.diagramType).sequence;
  const flowing = data.directed && data.flowRunning;
  const maskId = `sequence-flow-${useId().replaceAll(':', '')}`;
  const xs = route.points.map(point => point.x), ys = route.points.map(point => point.y);
  const maskBox = { x: Math.min(...xs) - 32, y: Math.min(...ys) - 32, width: Math.max(64, Math.max(...xs) - Math.min(...xs) + 64), height: Math.max(64, Math.max(...ys) - Math.min(...ys) + 64) };
  const er = getDiagram(data.diagramType).cardinalities;
  const markers = edgeMarkers(data, data.diagramType);
  const end = markers.end === 'arrow' ? markerEnd : markers.end ? `url(#codegraph-${markers.end})` : undefined;
  const start = markers.start ? `url(#codegraph-${markers.start})` : undefined;
  return <>
    {sequence && data.dashed && flowing && <defs><mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" {...maskBox}>
      <path d={route.path} fill="none" stroke="white" strokeWidth="3.2" strokeDasharray="5 5" />
    </mask></defs>}
    {data.selectionLinked && <g key={`${data.selectionId}:${data.selectionPulse}`} className={`selection-feedback ${flowing ? 'has-flow' : ''} ${data.selectionPulse > 0 ? 'is-animated' : ''}`} data-selection-pulse={data.selectionPulse} style={{ stroke: data.selectionColor }}>
      <path className="selection-edge-halo" d={route.path} />
      <path className="selection-edge-shine" d={route.path} />
    </g>}
    <BaseEdge id={id} path={route.path} markerEnd={end} markerStart={start} style={{ ...style, strokeOpacity: sequence ? 1 : flowing ? 0.35 : data.selectionLinked ? 1 : data.directed ? 0.55 : 1 }} />
    {data.directed && (!sequence || flowing) && <path className={`edge-flow ${sequence ? 'sequence-edge-flow' : ''}`} d={route.path} mask={sequence && data.dashed ? `url(#${maskId})` : undefined} style={{ stroke: sequence ? data.selectionColor : style.stroke, animationPlayState: data.flowRunning ? 'running' : 'paused' }} />}
    {er && <><Cardinality value={data.sourceCardinality} point={route.points[0]} neighbor={route.points[1]} color={data.relationColor} /><Cardinality value={data.targetCardinality} point={route.points.at(-1)} neighbor={route.points.at(-2)} color={data.relationColor} /></>}
    {(route.endpointLabels ?? []).map(label => <g key={label.role} className="edge-multiplicity" data-endpoint={label.role}>
      <rect {...label.labelBox} rx="4" fill="var(--canvas)" />
      <text x={label.labelPoint.x} y={label.labelBox.y + 3 + TYPOGRAPHY.body} fontSize={TYPOGRAPHY.body} fontWeight="500" textAnchor="middle" fill={data.labelColor}>{label.label}</text>
    </g>)}
    {route.label && <EdgeLabelRenderer><button type="button" className="edge-label nodrag nopan" data-edge-id={id} onClick={event => { event.stopPropagation(); data.onSelect(); }} onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.stopPropagation(); if (event.repeat) event.preventDefault(); } }} style={{ width: route.labelBox.width, height: route.labelBox.height, color: data.labelColor, fontWeight: data.selectionLinked ? 650 : 500, transform: `translate(-50%, -50%) translate(${route.labelPoint.x}px, ${route.labelPoint.y}px)` }}>{route.labelLines.map((line, index) => <span key={index}>{index === 0 && data.pair && line.startsWith(data.pair.label) ? <><b className="pair-label" style={{ borderColor: style.stroke }}>{data.pair.label}</b>{line.slice(data.pair.label.length)}</> : line}</span>)}</button></EdgeLabelRenderer>}
  </>;
}

export const nodeTypes = { diagram: DiagramNode, boundary: BoundaryNode };
export const edgeTypes = { routed: RoutedEdge };

export function initialNodes(graph, diagramType) {
  const boundaries = (graph.groups ?? []).map(group => ({
    id: group.id,
    type: 'boundary',
    position: group.position,
    data: { ...group },
    style: { width: group.size.width, height: group.size.height },
    selectable: false,
    draggable: false,
    connectable: false,
    zIndex: diagramType === 'sequence' ? -100 + fragmentDepth(group, graph.groups ?? []) : -1
  }));
  return [...boundaries, ...graph.nodes.map(node => ({
    id: node.id,
    type: 'diagram',
    className: diagramType === 'sequence' ? 'sequence-column' : undefined,
    position: node.position,
    data: { ...node, diagramType, locale: graph.meta.locale },
    style: { width: node.size.width, height: node.size.height, ...(diagramType === 'sequence' ? { pointerEvents: 'none' } : {}) },
    zIndex: 2
  }))];
}

export function initialEdges(graph, diagramType) {
  return graph.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'routed',
    zIndex: diagramType === 'sequence' ? 3 : 0,
    markerEnd: hasArrow(edge, diagramType) ? { type: MarkerType.ArrowClosed } : undefined,
    data: { ...edge, diagramType }
  }));
}
