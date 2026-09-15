import { translate } from '../i18n.js';
import { useCallback, useMemo, useRef, useState } from 'react';
import { getViewportForBounds, useEdgesState, useNodesState, useReactFlow } from '@xyflow/react';
import { cubicBezier } from 'motion';
import { initialNodes, initialEdges } from '../DiagramCanvas.jsx';
import { auditGraphLayout, graphBounds } from '../edge-routing.js';
import { nudgeGraphLayout } from '../layout-nudge.js';
import { constrainNodeChanges, currentGraphFromFlow } from '../session-graph.js';

// cubic-bezier(.32,.72,0,1) as an easing function, so viewport moves share the chrome's curve (--ease in styles.css).
export const appleEase = cubicBezier(.32, .72, 0, 1);

export function useGraphLayout(graph, reduceMotion, setStatus, originalGraph = graph) {
  const t = (message, values) => translate(graph.meta.locale, message, values);
  const diagramType = graph.meta.diagramType ?? 'architecture';
  const [nodes, setNodes, applyNodeChanges] = useNodesState(initialNodes(graph, diagramType));
  const [edges, setEdges] = useEdgesState(initialEdges(graph, diagramType));
  const [locked, setLocked] = useState(true);
  const canvasRef = useRef(null);
  const { setCenter, setViewport } = useReactFlow();
  const currentGraph = useMemo(() => currentGraphFromFlow(originalGraph, nodes, edges), [originalGraph, nodes, edges]);
  const onNodesChange = useCallback(changes => applyNodeChanges(constrainNodeChanges(changes, nodes, diagramType)), [applyNodeChanges, diagramType, nodes]);
  const updateNodeText = useCallback((id, label, subtitle) => setNodes(current => current.map(node => node.id === id ? { ...node, data: { ...node.data, label, subtitle } } : node)), [setNodes]);
  const updateEdgeText = useCallback((id, label) => setEdges(current => current.map(edge => edge.id === id ? { ...edge, data: { ...edge.data, label } } : edge)), [setEdges]);
  // The canvas runs under the floating toolbar and beside any open panel, so fitting subtracts those layers instead of
  // centring on the whole window. Values mirror --tb-h, --side-w and --gutter in styles.css; px strings are required
  // because a bare number in this padding object is read by React Flow as a ratio of the canvas size.
  const readingPadding = () => {
    const insets = canvasRef.current?.dataset ?? {};
    const px = value => `${value}px`;
    return { top: px(52 + 12 + 12), bottom: px(12 + 40), left: px((insets.navOpen === 'true' ? 304 + 24 : 12) + 12), right: px((insets.drawerOpen === 'true' ? 304 + 24 : 12) + 12) };
  };
  // Whole-diagram reading view: every node, boundary and label fits whenever the Viewer opens, resets or switches diagram.
  const readGraph = (targetGraph, duration = reduceMotion ? 0 : 320) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const viewport = getViewportForBounds(graphBounds(targetGraph), canvas.clientWidth, canvas.clientHeight, .08, 2, readingPadding());
    return setViewport(viewport, { duration, ease: appleEase });
  };
  const focusNode = useCallback(id => {
    const node = currentGraph.nodes.find(item => item.id === id);
    if (node) setCenter(node.position.x + node.size.width / 2, node.position.y + node.size.height / 2, { zoom: 1.1, duration: reduceMotion ? 0 : 420, ease: appleEase });
  }, [currentGraph, reduceMotion, setCenter]);
  const resetLayout = () => { setNodes(initialNodes(originalGraph, diagramType)); setEdges(initialEdges(originalGraph, diagramType)); requestAnimationFrame(() => readGraph(originalGraph)); };
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
  return { nodes, edges, onNodesChange, updateNodeText, updateEdgeText, locked, setLocked, canvasRef, currentGraph, readGraph, focusNode, resetLayout, nudgeLayout, focusDiagram: () => readGraph(currentGraph) };
}
