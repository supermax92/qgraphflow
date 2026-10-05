import { OVERVIEW_ZOOM, READABLE_ZOOM } from './layout-spacing.js';
import { isCore } from './visual-style.js';

// LEGEND is the float button under the toolbar's left edge (.float-btn height in styles.css).
export const TOOLBAR = 52, SIDE = 304, GUTTER = 12, BREATH = 12, LEGEND = 28;

// cubic-bezier(.32,.72,0,1) as an easing function, so viewport moves share the chrome's curve (--ease in styles.css):
// bisect the x curve for the progress that reaches t, then read the y curve there.
const bezier = (s, p1, p2) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3;
export function appleEase(t) {
  let low = 0, high = 1;
  for (let i = 0; i < 20; i++) { const mid = (low + high) / 2; if (bezier(mid, .32, 0) < t) low = mid; else high = mid; }
  return bezier((low + high) / 2, .72, 1);
}

export function readingRect(canvas, navOpen, drawerOpen) {
  const width = canvas?.clientWidth ?? 0, height = canvas?.clientHeight ?? 0;
  const fullscreen = Boolean(globalThis.document?.fullscreenElement?.contains(canvas));
  const panelsMatter = width > 700 && !fullscreen;
  const left = (panelsMatter && navOpen ? GUTTER + SIDE : GUTTER) + BREATH;
  const right = width - ((panelsMatter && drawerOpen ? GUTTER + SIDE : GUTTER) + BREATH);
  const top = TOOLBAR + GUTTER + BREATH;
  // Controls are vertical and the minimap has its own height. Read the visible DOM instead of assuming a control row.
  const canvasTop = canvas?.getBoundingClientRect().top ?? 0;
  const controls = [...(canvas?.querySelectorAll('.react-flow__controls,.react-flow__minimap') ?? [])]
    .map(element => element.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
  const bottom = Math.min(height - GUTTER - BREATH, ...controls.map(box => box.top - canvasTop - BREATH));
  return { left, right, top, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function readingPadding(canvas, navOpen, drawerOpen) {
  const area = readingRect(canvas, navOpen, drawerOpen), px = value => `${value}px`;
  return { top: px(area.top), right: px(canvas.clientWidth - area.right), bottom: px(canvas.clientHeight - area.bottom), left: px(area.left) };
}

export function readingViewport(bounds, area, current) {
  const screen = {
    left: bounds.x * current.zoom + current.x,
    right: (bounds.x + bounds.width) * current.zoom + current.x,
    top: bounds.y * current.zoom + current.y,
    bottom: (bounds.y + bounds.height) * current.zoom + current.y
  };
  if (screen.left >= area.left && screen.right <= area.right && screen.top >= area.top && screen.bottom <= area.bottom) return current;

  const dx = bounds.width * current.zoom > area.width ? area.left + area.width / 2 - (screen.left + screen.right) / 2
    : screen.left < area.left ? area.left - screen.left : screen.right > area.right ? area.right - screen.right : 0;
  const dy = screen.top < area.top || bounds.height * current.zoom > area.height ? area.top - screen.top : screen.bottom > area.bottom ? area.bottom - screen.bottom : 0;
  return { ...current, x: current.x + dx, y: current.y + dy };
}

export function locateViewport(bounds, area, current) {
  const zoom = Math.min(2, Math.max(READABLE_ZOOM, current.zoom));
  return { zoom, x: area.left + area.width / 2 - (bounds.x + bounds.width / 2) * zoom, y: area.top - bounds.y * zoom };
}

// Where reading begins: the primary path, else the start / initial node. A view without either begins at its business center
// (core) or else at the node that comes first in reading order, so the readable window never opens on empty canvas; sequence
// views keep their top-left corner, the first participant's head.
export const readingStart = graph => graph.nodes.find(node => node.id === graph.layout?.primaryPath?.[0]) ?? graph.nodes.find(node => ['start', 'initial'].includes(node.kind))
  ?? (graph.meta?.diagramType === 'sequence' || !graph.nodes.every(node => node.position) ? undefined
    : graph.nodes.find(isCore) ?? [...graph.nodes].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)[0]);

// Opening view. Fit-all stays the default while the whole view reads at OVERVIEW_ZOOM or more; a larger view opens at the
// readable floor on a window that begins at the reading start instead: clamped to the graph, centred on an axis the graph
// does not fill, and below the legend button. null means fit-all.
export function readableViewport(bounds, start, area, floor = READABLE_ZOOM, overview = OVERVIEW_ZOOM) {
  if (Math.min(area.width / bounds.width, area.height / bounds.height) >= overview) return null;
  const origin = (from, extent, center, length) => {
    const span = length / floor;
    return extent <= span ? from + (extent - span) / 2 : Math.min(from + extent - span, Math.max(from, center - span / 2));
  };
  const cx = start ? start.position.x + start.size.width / 2 : bounds.x, cy = start ? start.position.y + start.size.height / 2 : bounds.y;
  return { zoom: floor, x: area.left - origin(bounds.x, bounds.width, cx, area.width) * floor, y: area.top + LEGEND - origin(bounds.y, bounds.height, cy, area.height - LEGEND) * floor };
}
