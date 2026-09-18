import { useMemo } from 'react';
import { MarkerType } from '@xyflow/react';
import { createEdgeRoutes } from '../edge-routing.js';
import { getDiagram, isDashed } from '../diagrams/registry.js';
import { sequencePairs, sequenceExecutions } from '../sequence-executions.js';
import { edgeColor, sequenceGroupColor, groupAppearanceMap } from '../visual-style.js';
import { searchRank } from '../search.js';
import { sequenceFragment } from '../sequence-fragments.js';

export function usePresentation(graph, layout, selection, flowRunning, palette, moduleColors) {
  const diagramType = graph.meta.diagramType ?? 'architecture';
  const { nodes, edges, locked, currentGraph } = layout;
  const { selectedId, selectedEdgeId, selectEdge, selectionPulse, normalizedQuery } = selection;
  const routes = useMemo(() => createEdgeRoutes(currentGraph), [currentGraph]);
  const pairs = useMemo(() => sequencePairs(currentGraph), [currentGraph]);
  const executions = useMemo(() => sequenceExecutions(currentGraph), [currentGraph]);
  const groupAppearances = useMemo(() => groupAppearanceMap(currentGraph.groups ?? [], palette), [currentGraph, palette]);
  const visibleNodes = useMemo(() => nodes.map(node => node.type === 'boundary' ? { ...node, data: { ...node.data, appearance: groupAppearances.get(node.id), fragment: diagramType === 'sequence' ? sequenceFragment(node.data, routes, graph.meta.locale, currentGraph.groups ?? [], executions) : null } } : ({
    ...node,
    selected: node.id === selectedId,
    draggable: !locked,
    data: {
      ...node.data,
      executionRects: executions.filter(item => item.participantId === node.id).map(item => ({ ...item, x: item.x - node.position.x, y: item.y - node.position.y, color: sequenceGroupColor(pairs.get(item.start.edgeId), palette) ?? palette.edge })),
      selectionPulse,
      palette,
      moduleColors,
      dimmed: Boolean(normalizedQuery) && searchRank(node.data, normalizedQuery) === 0
    }
  })), [locked, nodes, normalizedQuery, selectedId, selectionPulse, palette, moduleColors, routes, diagramType, graph.meta.locale, currentGraph, executions, pairs, groupAppearances]);

  const visibleEdges = useMemo(() => {
    const sequence = getDiagram(diagramType).sequence;
    return edges.map(edge => {
      const route = routes.get(edge.id);
      const failure = edge.data.kind === 'failure';
      const selectionLinked = edge.id === selectedEdgeId || edge.source === selectedId || edge.target === selectedId;
      const pair = pairs.get(edge.id);
      const dashed = isDashed(edge.data, diagramType);
      const target = currentGraph.nodes.find(node => node.id === edge.target);
      const source = currentGraph.nodes.find(node => node.id === edge.source);
      const color = edgeColor(edge.data, target, palette, moduleColors, source, pair);
      const selectionColor = pair ? color : failure ? palette.warn : palette.accent;
      return {
        ...edge,
        sourceHandle: getDiagram(diagramType).sequence ? 'source-right' : `source-${routes.get(edge.id).sourceSide}`,
        targetHandle: getDiagram(diagramType).sequence ? 'target-left' : `target-${routes.get(edge.id).targetSide}`,
        className: [sequence ? 'flow-edge--sequence' : '', dashed ? 'flow-edge--dashed' : ''].filter(Boolean).join(' '),
        style: { stroke: color, strokeWidth: 1.6 },
        ariaLabel: route.label || `${source.label} → ${target.label}`,
        markerEnd: edge.markerEnd ? { type: MarkerType.ArrowClosed, color } : undefined,
        selected: edge.id === selectedEdgeId,
        data: { ...edge.data, pair, selectionLinked, selectionId: selectedEdgeId ?? selectedId, selectionPulse, selectionColor, route, relationColor: palette.accent, directed: Boolean(edge.markerEnd), flowRunning, dashed, labelColor: palette.ink3, onSelect: () => selectEdge(edge.data) }
      };
    });
  }, [diagramType, edges, graph, currentGraph, palette, moduleColors, flowRunning, selectEdge, selectedEdgeId, selectedId, selectionPulse, routes, pairs]);

  return { visibleNodes, visibleEdges };
}
