import { useMemo } from 'react';
import { MarkerType } from '@xyflow/react';
import { createEdgeRoutes } from '../edge-routing.js';
import { getDiagram, isDashed } from '../diagrams/registry.js';
import { edgeColor } from '../visual-style.js';
import { searchRank } from '../search.js';

export function usePresentation(graph, layout, selection, playback, palette) {
  const diagramType = graph.meta.diagramType ?? 'architecture';
  const { nodes, edges, locked, currentGraph } = layout;
  const { selectedId, selectionPulse, normalizedQuery } = selection;
  const { completedNodeIds, playbackEdge, completedEdgeIds, playbackNodeId, playbackPulse, flowRunning } = playback;
  const visibleNodes = useMemo(() => nodes.map(node => node.type === 'boundary' ? node : ({
    ...node,
    selected: node.id === selectedId,
    draggable: !locked,
    data: {
      ...node.data,
      selectionPulse,
      palette,
      playbackCurrent: node.id === playbackNodeId,
      playbackPulse,
      playbackComplete: completedNodeIds.has(node.id),
      dimmed: Boolean(normalizedQuery) && searchRank(node.data, normalizedQuery) === 0
    }
  })), [completedNodeIds, locked, nodes, normalizedQuery, playbackNodeId, playbackPulse, selectedId, selectionPulse, palette]);

  const visibleEdges = useMemo(() => {
    const routes = createEdgeRoutes(currentGraph);
    return edges.map(edge => {
      const playbackCurrent = edge.id === playbackEdge?.id;
      const playbackComplete = completedEdgeIds.has(edge.id);
      const failure = edge.data.kind === 'failure';
      const selectionLinked = edge.source === selectedId || edge.target === selectedId;
      const selectionColor = failure ? palette.warn : palette.accent;
      const dashed = isDashed(edge.data, diagramType);
      const target = graph.nodes.find(node => node.id === edge.target);
      const color = failure ? palette.warn : playbackCurrent ? palette.flow : edgeColor(edge.data, target, palette);
      return {
        ...edge,
        sourceHandle: getDiagram(diagramType).sequence ? 'source-right' : `source-${routes.get(edge.id).sourceSide}`,
        targetHandle: getDiagram(diagramType).sequence ? 'target-left' : `target-${routes.get(edge.id).targetSide}`,
        className: dashed ? 'flow-edge--dashed' : '',
        style: { stroke: color, strokeWidth: 1.6 },
        markerEnd: edge.markerEnd ? { type: MarkerType.ArrowClosed, color } : undefined,
        data: { ...edge.data, selectionLinked, selectionId: selectedId, selectionPulse, selectionColor, route: routes.get(edge.id), relationColor: palette.accent, directed: Boolean(edge.markerEnd), flowRunning, playbackCurrent, labelColor: selectionLinked ? selectionColor : playbackCurrent || playbackComplete || failure ? color : palette.ink3 }
      };
    });
  }, [completedEdgeIds, diagramType, edges, graph, currentGraph, palette, playbackEdge, flowRunning, selectedId, selectionPulse]);

  return { visibleNodes, visibleEdges };
}
