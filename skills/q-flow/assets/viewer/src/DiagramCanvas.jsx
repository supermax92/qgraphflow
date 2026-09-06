import React from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, MarkerType, Position } from '@xyflow/react';
import SelectionOutline from './SelectionOutline.jsx';
import { renderNode } from './node-svg.js';
import { getDiagram, hasArrow, edgeMarkers } from './diagrams/registry.js';
import { cardinalityMarks } from './edge-routing.js';
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
  const markup = renderNode({ ...data, position: { x: 0, y: 0 } }, data.diagramType, 0, 0, data.palette);
  return <article className={`diagram-node diagram-${data.diagramType} kind-${data.kind} ${compact ? 'is-compact' : ''} ${isCore(data) ? 'is-core' : ''} ${data.dimmed ? 'is-dimmed' : ''} ${selected ? 'is-selected' : ''} ${data.playbackCurrent ? 'is-current' : ''} ${data.playbackComplete ? 'is-complete' : ''}`} title={data.label}>
    <NodeHandles sequence={getDiagram(data.diagramType).sequence} />
    <svg className="node-visual" viewBox={`0 0 ${data.size.width} ${data.size.height}`} aria-label={data.label} dangerouslySetInnerHTML={{ __html: markup }} />
    {selected && <SelectionOutline key={data.selectionPulse} data={data} pulse={data.selectionPulse} />}
    {!selected && data.playbackCurrent && <SelectionOutline key={`playback-${data.playbackPulse}`} data={data} pulse={data.playbackPulse} playback />}
  </article>;
}

function BoundaryNode({ data }) {
  return <section className={`boundary boundary-${data.kind}`}><span>{data.label}</span>{['alt', 'opt', 'loop'].includes(data.kind) && <small>{data.kind}</small>}</section>;
}

function Cardinality({ value, point, neighbor, color }) {
  const marks = cardinalityMarks(value, point, neighbor);
  return <g className="cardinality-mark" stroke={color} strokeWidth="1.5" fill="none"><path d={marks.path} />{marks.circle && <circle {...marks.circle} fill="var(--canvas)" />}</g>;
}

function RoutedEdge({ id, markerEnd, style, data }) {
  const { route } = data;
  const flowing = data.directed && data.flowRunning;
  const er = getDiagram(data.diagramType).cardinalities;
  const markers = edgeMarkers(data, data.diagramType);
  const end = markers.end === 'arrow' ? markerEnd : markers.end ? `url(#codegraph-${markers.end})` : undefined;
  const start = markers.start ? `url(#codegraph-${markers.start})` : undefined;
  return <>
    {data.selectionLinked && <g key={`${data.selectionId}:${data.selectionPulse}`} className={`selection-feedback ${flowing ? 'has-flow' : ''} ${data.selectionPulse > 0 ? 'is-animated' : ''}`} data-selection-pulse={data.selectionPulse} style={{ stroke: data.selectionColor }}>
      <path className="selection-edge-halo" d={route.path} />
      <path className="selection-edge-shine" d={route.path} />
    </g>}
    <BaseEdge id={id} path={route.path} markerEnd={end} markerStart={start} style={{ ...style, strokeOpacity: flowing ? 0.35 : data.selectionLinked ? 1 : data.directed ? 0.55 : 1 }} />
    {data.directed && <path className="edge-flow" d={route.path} style={{ stroke: style.stroke, animationPlayState: data.flowRunning ? 'running' : 'paused' }} />}
    {er && <><Cardinality value={data.sourceCardinality} point={route.points[0]} neighbor={route.points[1]} color={data.relationColor} /><Cardinality value={data.targetCardinality} point={route.points.at(-1)} neighbor={route.points.at(-2)} color={data.relationColor} /></>}
    {route.label && <EdgeLabelRenderer><span className="edge-label" style={{ width: route.labelBox.width, height: route.labelBox.height, color: data.labelColor, fontWeight: data.selectionLinked || data.playbackCurrent ? 650 : 500, transform: `translate(-50%, -50%) translate(${route.labelPoint.x}px, ${route.labelPoint.y}px)` }}>{route.labelLines.map((line, index) => <span key={index}>{line}</span>)}</span></EdgeLabelRenderer>}
  </>;
}

export const nodeTypes = { diagram: DiagramNode, boundary: BoundaryNode };
export const edgeTypes = { routed: RoutedEdge };

export function initialNodes(graph, diagramType) {
  const boundaries = (graph.groups ?? []).map(group => ({
    id: group.id,
    type: 'boundary',
    position: group.position,
    data: { label: group.label, kind: group.kind },
    style: { width: group.size.width, height: group.size.height },
    selectable: false,
    draggable: false,
    connectable: false,
    zIndex: -1
  }));
  return [...boundaries, ...graph.nodes.map(node => ({
    id: node.id,
    type: 'diagram',
    position: node.position,
    data: { ...node, diagramType },
    style: { width: node.size.width, height: node.size.height },
    zIndex: 2
  }))];
}

export function initialEdges(graph, diagramType) {
  return graph.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'routed',
    markerEnd: hasArrow(edge, diagramType) ? { type: MarkerType.ArrowClosed } : undefined,
    data: { ...edge, diagramType }
  }));
}
