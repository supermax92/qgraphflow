import { useCallback, useEffect, useState } from 'react';

// One transient surface at a time. Escape and outside clicks close it in the capture phase, before selection or
// panels react, so a popover never competes with the canvas for the same gesture.
export function usePopover() {
  const [open, setOpen] = useState(null);
  const toggle = useCallback(id => setOpen(current => current === id ? null : id), []);
  const close = useCallback(() => {
    const root = document.querySelector(`[data-popover-root="${open}"]`);
    if (root?.contains(document.activeElement)) root.querySelector('[aria-haspopup]')?.focus();
    setOpen(null);
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const away = event => { if (event.target.closest?.('[data-popover-root]')?.dataset.popoverRoot !== open) setOpen(null); };
    const leave = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      const root = event.target.closest?.('[data-popover-root]');
      if (root?.dataset.popoverRoot !== open) return;
      const radio = event.target.closest('[role="radiogroup"]');
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End', ...(radio ? ['ArrowLeft', 'ArrowRight'] : [])].includes(event.key)) return;
      const items = [...(radio ?? root).querySelectorAll(radio ? '[role="radio"]' : '[role="menu"] button')].filter(item => !item.disabled);
      if (!items.length) return;
      event.preventDefault(); event.stopPropagation();
      const index = items.indexOf(document.activeElement), forward = ['ArrowDown', 'ArrowRight'].includes(event.key);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (forward ? 0 : items.length - 1) : (index + (forward ? 1 : -1) + items.length) % items.length;
      items[next].focus(); if (radio) items[next].click();
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', leave, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', leave, true); };
  }, [open, close]);
  return { open, toggle, close };
}
