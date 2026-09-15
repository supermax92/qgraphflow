import { useCallback, useEffect, useState } from 'react';

// One transient surface at a time. Escape and outside clicks close it in the capture phase, before selection or
// panels react, so a popover never competes with the canvas for the same gesture.
export function usePopover() {
  const [open, setOpen] = useState(null);
  const toggle = useCallback(id => setOpen(current => current === id ? null : id), []);
  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (!open) return undefined;
    const away = event => { if (event.target.closest?.('[data-popover-root]')?.dataset.popoverRoot !== open) setOpen(null); };
    const leave = event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(null); } };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', leave, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', leave, true); };
  }, [open]);
  return { open, toggle, close };
}
