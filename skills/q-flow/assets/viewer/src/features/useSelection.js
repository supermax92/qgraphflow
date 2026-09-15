import { useCallback, useEffect, useMemo, useState } from 'react';
import { isCore } from '../visual-style.js';
import { searchNodes } from '../search.js';

export function useSelection(graph, { focusNode, panels, isFullscreen = false, toggleFullscreen }) {
  const [selectedId, setSelectedId] = useState(() => graph.nodes.find(isCore)?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectionPulse, setSelectionPulse] = useState(0);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => normalizedQuery ? searchNodes(graph.nodes, normalizedQuery) : graph.nodes, [graph, normalizedQuery]);
  const selected = graph.nodes.find(node => node.id === selectedId);
  const selectedEdge = graph.edges.find(edge => edge.id === selectedEdgeId);
  const { drawerOpen, openDetails, closeDetails, closeMobile, closeNav } = panels;
  const selectNode = useCallback((node, focusDetails = true) => {
    setSelectedId(node.id); setSelectedEdgeId(null); setSelectionPulse(value => value + 1); setQuery('');
    if (focusDetails) { if (!isFullscreen && !drawerOpen) openDetails(); focusNode(node.id); }
  }, [drawerOpen, openDetails, focusNode, isFullscreen]);
  const selectEdge = useCallback((edge, focusDetails = false) => {
    setSelectedId(null); setSelectedEdgeId(edge.id); setSelectionPulse(value => value + 1); setQuery('');
    if (focusDetails && !isFullscreen && !drawerOpen) openDetails();
  }, [drawerOpen, isFullscreen, openDetails]);
  const clearSelectedNode = useCallback((restoreFocus = false) => {
    setSelectedId(null); setSelectedEdgeId(null); closeDetails(restoreFocus);
  }, [closeDetails]);
  const resetSelection = () => {
    setSelectedId(null); setSelectedEdgeId(null); setSelectionPulse(0); setQuery('');
  };
  const handleCanvasKeyDown = event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const edgeElement = event.target.closest('.react-flow__edge');
    if (edgeElement) {
      event.preventDefault(); event.stopPropagation();
      if (event.repeat) return;
      const edge = graph.edges.find(item => item.id === edgeElement.dataset.id); if (edge) selectEdge(edge);
      return;
    }
    const nodeElement = event.target.closest('.react-flow__node-diagram');
    if (!nodeElement) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat) return;
    const node = graph.nodes.find(item => item.id === nodeElement.dataset.id); if (node) selectNode(node);
  };
  useEffect(() => {
    const close = event => {
      if (event.key !== 'Escape') return;
      if (isFullscreen) {
        event.preventDefault();
        if (document.fullscreenElement) toggleFullscreen();
        return;
      }
      // Escape gives up the innermost floating surface first — the panel holding focus — then the selection.
      const active = document.activeElement;
      if (active?.closest('.nav')) { closeNav(true); return; }
      if (active?.closest('.inspector')) { closeDetails(true); return; }
      clearSelectedNode(false); closeMobile();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [clearSelectedNode, closeDetails, closeMobile, closeNav, isFullscreen, toggleFullscreen]);
  return { selectedId, selectedEdgeId, selectionPulse, selected, selectedEdge, query, setQuery, normalizedQuery, results, selectNode, selectEdge, clearSelectedNode, handleCanvasKeyDown, resetSelection };
}
