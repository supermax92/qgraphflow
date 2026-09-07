import { translate } from '../i18n.js';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getViewportForBounds, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import { initialNodes, initialEdges } from '../DiagramCanvas.jsx';
import { auditGraphLayout, graphBounds } from '../edge-routing.js';
import { nudgeGraphLayout } from '../layout-nudge.js';
import { isCore } from '../visual-style.js';

export function useGraphLayout(graph, reduceMotion, setStatus) {
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const diagramType = graph.meta.diagramType ?? 'architecture';
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes(graph, diagramType));
  const [edges, setEdges] = useEdgesState(initialEdges(graph, diagramType));
  const [locked, setLocked] = useState(true);
  const canvasRef = useRef(null);
  const { fitBounds, setCenter, setViewport } = useReactFlow();
  const currentGraph = useMemo(() => {
    const positions = new Map(nodes.filter(node => node.type === 'diagram').map(node => [node.id, node.position]));
    return { ...graph, nodes: graph.nodes.map(node => ({ ...node, position: positions.get(node.id) ?? node.position })) };
  }, [graph, nodes]);
  const fitGraph = (targetGraph, duration = reduceMotion ? 0 : 320) => fitBounds(graphBounds(targetGraph), { padding: .06, duration });
  const readGraph = (targetGraph, duration = reduceMotion ? 0 : 320) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const viewport = getViewportForBounds(graphBounds(targetGraph), canvas.clientWidth, canvas.clientHeight, .08, 2, .06);
    const anchor = targetGraph.nodes.find(isCore) ?? targetGraph.nodes[0];
    if (viewport.zoom >= .9 || !anchor) return setViewport(viewport, { duration });
    const x = anchor.position.x + Math.min(anchor.size.width / 2, (canvas.clientWidth / 2 - 24) / .9);
    const y = anchor.position.y + Math.min(anchor.size.height / 2, (canvas.clientHeight / 2 - 24) / .9);
    return setCenter(x, y, { zoom: .9, duration });
  };
  const focusNode = useCallback(id => {
    const node = currentGraph.nodes.find(item => item.id === id);
    if (node) setCenter(node.position.x + node.size.width / 2, node.position.y + node.size.height / 2, { zoom: 1.1, duration: reduceMotion ? 0 : 420 });
  }, [currentGraph, reduceMotion, setCenter]);
  const resetLayout = () => { setNodes(initialNodes(graph, diagramType)); setEdges(initialEdges(graph, diagramType)); requestAnimationFrame(() => readGraph(graph)); };
  const nudgeLayout = selectedId => {
    if (locked) { setStatus('请先解除布局锁定，再整理间距'); return; }
    const result = nudgeGraphLayout(currentGraph, selectedId);
    const positions = new Map(result.graph.nodes.map(node => [node.id, node.position]));
    setNodes(current => current.map(node => node.type === 'diagram' ? { ...node, position: positions.get(node.id) } : node));
    const audit = auditGraphLayout(result.graph), unresolved = audit.errors.length + audit.warnings.length;
    const movement = result.movedNodeIds.length, scope = t(selectedId ? '局部' : '全图');
    const message = movement ? t('{scope}间距已整理：移动 {count} 个节点', { scope, count: movement }) : t(unresolved ? '当前约束下无法继续整理' : '当前间距无需调整');
    setStatus(message + (unresolved ? t('；仍有 {count} 个布局问题，请手动调整', { count: unresolved }) : ''));
  };
  return { nodes, edges, onNodesChange, locked, setLocked, canvasRef, currentGraph, fitGraph, readGraph, focusNode, resetLayout, nudgeLayout, focusDiagram: () => fitGraph(currentGraph) };
}
