import { useCallback, useEffect, useRef, useState } from 'react';

export const mobileQuery = '(max-width: 700px)';
const isMobile = () => window.matchMedia(mobileQuery).matches;

export function usePanels() {
  const [toolbarOpen, setToolbarOpen] = useState(() => !isMobile());
  const [drawerOpen, setDrawerOpen] = useState(() => !isMobile());
  const toolbarButtonRef = useRef(null), drawerButtonRef = useRef(null), searchInputRef = useRef(null), inspectorRef = useRef(null), originRef = useRef(null);
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
  const rememberOrigin = useCallback(() => { const origin = document.activeElement; originRef.current = origin?.closest('.toolbar') ? toolbarButtonRef.current : origin; }, []);
  const openDetails = useCallback(() => { setDrawerOpen(true); if (isMobile()) setToolbarOpen(false); focus(inspectorRef); }, [focus]);
  const closeDetails = useCallback((restoreFocus = false) => {
    cancelFocus();
    if (isMobile()) setDrawerOpen(false);
    if (restoreFocus) { const origin = originRef.current; focus({ current: origin?.isConnected && origin !== document.body ? origin : drawerButtonRef.current }); }
  }, [cancelFocus, focus]);
  const closeMobile = useCallback(() => { if (isMobile()) { setDrawerOpen(false); setToolbarOpen(false); } }, []);
  const focusToolbar = useCallback(() => focus(toolbarButtonRef), [focus]);
  const toggleToolbar = () => { cancelFocus(); setToolbarOpen(!toolbarOpen); if (isMobile()) setDrawerOpen(false); if (!toolbarOpen) focus(searchInputRef); };
  const toggleDrawer = () => { cancelFocus(); setDrawerOpen(!drawerOpen); if (isMobile()) setToolbarOpen(false); if (!drawerOpen) { originRef.current = drawerButtonRef.current; focus(inspectorRef); } };
  useEffect(() => {
    const media = window.matchMedia(mobileQuery);
    const collapse = event => { if (event.matches) { setToolbarOpen(false); setDrawerOpen(false); } };
    collapse(media); media.addEventListener('change', collapse);
    return () => media.removeEventListener('change', collapse);
  }, []);
  return { toolbarOpen, drawerOpen, toolbarButtonRef, drawerButtonRef, searchInputRef, inspectorRef, rememberOrigin, openDetails, closeDetails, closeMobile, focusToolbar, toggleToolbar, toggleDrawer };
}
