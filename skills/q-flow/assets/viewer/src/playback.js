import { getDiagram } from './diagrams/registry.js';

// Reading order is deliberately not inferred to be execution order.
export function playbackPlan(graph) {
  const definition = getDiagram(graph.meta.diagramType);
  if (graph.playback?.edgeIds.length) return {
    mode: 'authored', description: '按已编排的演示顺序',
    steps: graph.playback.edgeIds.map(edgeId => ({ edgeId, nodeId: graph.edges.find(edge => edge.id === edgeId).target }))
  };
  if (definition.sequence && graph.edges.length) return {
    mode: 'sequence', description: '按消息序号演示',
    steps: [...graph.edges].sort((a, b) => a.order - b.order).map(edge => ({ edgeId: edge.id, nodeId: edge.target }))
  };
  return {
    mode: 'reading',
    description: definition.flowPlayback ? '未提供流程演示顺序，暂按节点目录阅读；不代表执行时序' : '按节点目录逐步阅读；不代表执行时序',
    steps: graph.nodes.map(node => ({ nodeId: node.id }))
  };
}
