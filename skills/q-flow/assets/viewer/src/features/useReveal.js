import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { appleEase } from './useGraphLayout.js';

const TOOLBAR = 52, SIDE = 304, GUTTER = 12, BREATH = 12;

// When a floating panel opens over the selected node, pan just far enough to uncover it — never re-zoom, never move
// when nothing is hidden, and never on narrow screens where a panel is the whole width. Mirrors --tb-h, --side-w and
// --gutter in styles.css. Called explicitly by the panel toggles rather than from an effect, so it cannot fight the
// centring that directory and search selection already perform.
export function useReveal(canvasRef, nodes, reduceMotion) {
  const { getViewport, setViewport } = useReactFlow();
  return useCallback((selectedId, navOpen, drawerOpen) => {
    const box = canvasRef.current?.getBoundingClientRect();
    const node = nodes.find(item => item.id === selectedId && item.type === 'diagram');
    if (!box?.width || !node || box.width <= 700) return;
    const viewport = getViewport();
    const left = node.position.x * viewport.zoom + viewport.x;
    const right = left + (node.measured?.width ?? node.style.width) * viewport.zoom;
    const top = node.position.y * viewport.zoom + viewport.y;
    // A panel's inner edge is one gutter plus its width from the canvas edge; the node must clear it by BREATH.
    const navEdge = navOpen ? GUTTER + SIDE + BREATH : BREATH;
    const drawerEdge = box.width - (drawerOpen ? GUTTER + SIDE + BREATH : BREATH);
    let dx = 0, dy = 0;
    if (right > drawerEdge) dx = drawerEdge - right;
    if (left + dx < navEdge) dx = navEdge - left;
    if (top < TOOLBAR + BREATH) dy = TOOLBAR + BREATH - top;
    if (dx || dy) setViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy }, { duration: reduceMotion ? 0 : 360, ease: appleEase });
  }, [canvasRef, nodes, reduceMotion, getViewport, setViewport]);
}
