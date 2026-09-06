import { useCallback, useEffect, useMemo, useState } from 'react';
import { isCore } from '../visual-style.js';
import { searchNodes } from '../search.js';

export function useSelection(graph, { pausePlayback, focusNode, panels, initialFollowPlayback = false, isFullscreen = false, toggleFullscreen }) {
  const [selectedId, setSelectedId] = useState(() => graph.nodes.find(isCore)?.id ?? null);
  const [selectionPulse, setSelectionPulse] = useState(0);
  const [query, setQuery] = useState('');
  const [followPlayback, setFollowPlayback] = useState(initialFollowPlayback);
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => normalizedQuery ? searchNodes(graph.nodes, normalizedQuery) : graph.nodes, [graph, normalizedQuery]);
  const selected = graph.nodes.find(node => node.id === selectedId);
  const { rememberOrigin, openDetails, closeDetails, closeMobile, focusToolbar, toolbarOpen, toolbarButtonRef } = panels;
  const selectNode = useCallback((node, focusDetails = true) => {
    setFollowPlayback(false);
    rememberOrigin(); pausePlayback(); setSelectedId(node.id); setSelectionPulse(value => value + 1); setQuery('');
    if (focusDetails) { if (!isFullscreen) openDetails(); focusNode(node.id); }
  }, [rememberOrigin, pausePlayback, openDetails, focusNode, isFullscreen]);
  const clearSelectedNode = useCallback((restoreFocus = false) => {
    setFollowPlayback(false); setSelectedId(null); closeDetails(restoreFocus);
  }, [closeDetails]);
  const resetSelection = (follow = false) => {
    setSelectedId(null); setSelectionPulse(0); setQuery(''); setFollowPlayback(follow);
  };
  const handleCanvasKeyDown = event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const nodeElement = event.target.closest('.react-flow__node-diagram');
    const edgeElement = event.target.closest('.react-flow__edge');
    if (!nodeElement && !edgeElement) return;
    event.preventDefault(); event.stopPropagation();
    if (event.repeat) return;
    if (nodeElement) { const node = graph.nodes.find(item => item.id === nodeElement.dataset.id); if (node) selectNode(node); }
    else pausePlayback();
  };
  useEffect(() => {
    const close = event => {
      if (event.key !== 'Escape') return;
      if (isFullscreen) {
        event.preventDefault();
        if (document.fullscreenElement) toggleFullscreen();
        return;
      }
      const inToolbar = document.activeElement?.closest('.toolbar') || (toolbarOpen && document.activeElement === toolbarButtonRef.current);
      clearSelectedNode(!inToolbar); closeMobile(); if (inToolbar) focusToolbar();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [clearSelectedNode, closeMobile, focusToolbar, toolbarOpen, toolbarButtonRef, isFullscreen, toggleFullscreen]);
  return { selectedId, selectionPulse, selected, followPlayback, setFollowPlayback, query, setQuery, normalizedQuery, results, selectNode, clearSelectedNode, handleCanvasKeyDown, resetSelection };
}
