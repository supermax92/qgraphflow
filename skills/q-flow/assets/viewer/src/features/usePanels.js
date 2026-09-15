import { useCallback, useEffect, useRef, useState } from 'react';

export const mobileQuery = '(max-width: 700px)';
const isMobile = () => window.matchMedia(mobileQuery).matches;

// Both panels are floating surfaces over a full-height canvas, so they start collapsed at every width.
export function usePanels() {
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toolbarButtonRef = useRef(null), drawerButtonRef = useRef(null), searchInputRef = useRef(null), inspectorRef = useRef(null), panelRef = useRef(null);
  const focusFrame = useRef(null);
  const cancelFocus = useCallback(() => cancelAnimationFrame(focusFrame.current), []);
  const focus = useCallback(ref => {
    cancelFocus();
    const origin = document.activeElement;
    focusFrame.current = requestAnimationFrame(() => {
      // A later user focus action takes precedence over a panel's deferred focus.
      if (document.activeElement === origin || !origin?.isConnected) ref.current?.focus({ preventScroll: true });
    });
  }, [cancelFocus]);
  useEffect(() => cancelFocus, [cancelFocus]);
  const openDetails = useCallback(() => { setDrawerOpen(true); if (isMobile()) setToolbarOpen(false); focus(inspectorRef); }, [focus]);
  // Closing a floating panel hands focus back to the toolbar toggle that owns it.
  const closeDetails = useCallback((restoreFocus = false) => { cancelFocus(); setDrawerOpen(false); if (restoreFocus) focus(drawerButtonRef); }, [cancelFocus, focus]);
  const closeMobile = useCallback(() => { if (isMobile()) { setDrawerOpen(false); setToolbarOpen(false); } }, []);
  const closeNav = useCallback((restoreFocus = false) => { cancelFocus(); setToolbarOpen(false); if (restoreFocus) focus(toolbarButtonRef); }, [cancelFocus, focus]);
  const toggleToolbar = () => { cancelFocus(); setToolbarOpen(!toolbarOpen); if (isMobile()) setDrawerOpen(false); if (!toolbarOpen) focus(panelRef); };
  const toggleDrawer = () => { cancelFocus(); setDrawerOpen(!drawerOpen); if (isMobile()) setToolbarOpen(false); if (!drawerOpen) focus(inspectorRef); };
  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const collapse = event => { if (event.matches) { setToolbarOpen(false); setDrawerOpen(false); } };
    collapse(media); media.addEventListener('change', collapse);
    return () => media.removeEventListener('change', collapse);
  }, []);
  return { toolbarOpen, drawerOpen, toolbarButtonRef, drawerButtonRef, searchInputRef, inspectorRef, panelRef, openDetails, closeDetails, closeMobile, closeNav, toggleToolbar, toggleDrawer };
}
