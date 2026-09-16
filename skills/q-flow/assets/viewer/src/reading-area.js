const TOOLBAR = 52, SIDE = 304, GUTTER = 12, BREATH = 12;

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

export function readingViewport(bounds, area, current, priority = bounds, minZoom = .08) {
  const screen = {
    left: bounds.x * current.zoom + current.x,
    right: (bounds.x + bounds.width) * current.zoom + current.x,
    top: bounds.y * current.zoom + current.y,
    bottom: (bounds.y + bounds.height) * current.zoom + current.y
  };
  if (screen.left >= area.left && screen.right <= area.right && screen.top >= area.top && screen.bottom <= area.bottom) return current;

  const fit = Math.min(area.width / Math.max(bounds.width, 1), area.height / Math.max(bounds.height, 1), current.zoom);
  if (fit === current.zoom) {
    const dx = screen.left < area.left ? area.left - screen.left : screen.right > area.right ? area.right - screen.right : 0;
    const dy = screen.top < area.top ? area.top - screen.top : screen.bottom > area.bottom ? area.bottom - screen.bottom : 0;
    return { ...current, x: current.x + dx, y: current.y + dy };
  }

  const zoom = Math.max(minZoom, fit);
  const target = fit >= minZoom ? bounds : priority;
  return {
    zoom,
    x: area.left + area.width / 2 - (target.x + target.width / 2) * zoom,
    y: area.top + area.height / 2 - (target.y + target.height / 2) * zoom
  };
}
