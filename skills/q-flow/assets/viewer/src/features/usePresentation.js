import { useMemo } from 'react';
import { MarkerType } from '@xyflow/react';
import { createEdgeRoutes } from '../edge-routing.js';
import { getDiagram, isDashed } from '../diagrams/registry.js';
import { edgeColor } from '../visual-style.js';
import { searchRank } from '../search.js';

export function usePresentation(graph, layout, selection, flowRunning, palette, moduleColors) {
  const diagramType = graph.meta.diagramType ?? 'architecture';
  const { nodes, edges, locked, currentGraph } = layout;
  const { selectedId, selectedEdgeId, selectEdge, selectionPulse, normalizedQuery } = selection;
  const visibleNodes = useMemo(() => nodes.map(node => node.type === 'boundary' ? node : ({
    ...node,
    selected: node.id === selectedId,
    draggable: !locked,
    data: {
      ...node.data,
      selectionPulse,
      palette,
      moduleColors,
      dimmed: Boolean(normalizedQuery) && searchRank(node.data, normalizedQuery) === 0
    }
  })), [locked, nodes, normalizedQuery, selectedId, selectionPulse, palette, moduleColors]);

  const visibleEdges = useMemo(() => {
    const routes = createEdgeRoutes(currentGraph);
    return edges.map(edge => {
      const route = routes.get(edge.id);
      const failure = edge.data.kind === 'failure';
      const selectionLinked = edge.id === selectedEdgeId || edge.source === selectedId || edge.target === selectedId;
      const selectionColor = failure ? palette.warn : palette.accent;
      const dashed = isDashed(edge.data, diagramType);
      const target = currentGraph.nodes.find(node => node.id === edge.target);
      const source = currentGraph.nodes.find(node => node.id === edge.source);
      const color = edgeColor(edge.data, target, palette, moduleColors, source);
      return {
        ...edge,
        sourceHandle: getDiagram(diagramType).sequence ? 'source-right' : `source-${routes.get(edge.id).sourceSide}`,
        targetHandle: getDiagram(diagramType).sequence ? 'target-left' : `target-${routes.get(edge.id).targetSide}`,
        className: dashed ? 'flow-edge--dashed' : '',
        style: { stroke: color, strokeWidth: 1.6 },
        ariaLabel: route.label || `${source.label} → ${target.label}`,
        markerEnd: edge.markerEnd ? { type: MarkerType.ArrowClosed, color } : undefined,
        selected: edge.id === selectedEdgeId,
        data: { ...edge.data, selectionLinked, selectionId: selectedEdgeId ?? selectedId, selectionPulse, selectionColor, route, relationColor: palette.accent, directed: Boolean(edge.markerEnd), flowRunning, labelColor: selectionLinked ? selectionColor : failure ? color : palette.ink3, onSelect: () => selectEdge(edge.data) }
      };
    });
  }, [diagramType, edges, graph, currentGraph, palette, moduleColors, flowRunning, selectEdge, selectedEdgeId, selectedId, selectionPulse]);

  return { visibleNodes, visibleEdges };
}
