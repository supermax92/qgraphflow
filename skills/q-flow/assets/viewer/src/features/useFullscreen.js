import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

export function useFullscreen(setStatus, fitCanvas) {
  const boardRef = useRef(null), fullscreenButtonRef = useRef(null);
  const active = useRef(false), pending = useRef(false);
  const [isFullscreen, setFullscreen] = useState(false);
  const [fullscreenPending, setPending] = useState(false);
  const fitOnEnter = useEffectEvent(fitCanvas);
  const fullscreenSupported = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen && document.exitFullscreen);
  const toggleFullscreen = useCallback(async () => {
    const board = boardRef.current;
    if (!board || pending.current) return;
    const exiting = document.fullscreenElement === board;
    if (!exiting && !fullscreenSupported) {
      setStatus('Fullscreen is not available in this browser or page');
      return;
    }
    pending.current = true; setPending(true); setStatus('');
    try {
      if (exiting) await document.exitFullscreen();
      else await board.requestFullscreen();
      return true;
    } catch {
      if (board.isConnected) setStatus(exiting ? 'Could not exit fullscreen. Press Esc to try again.' : 'Could not enter fullscreen. Check browser or page permissions and try again.');
    } finally {
      pending.current = false;
      if (board.isConnected) setPending(false);
    }
  }, [fullscreenSupported, setStatus]);
  useEffect(() => {
    let frame;
    const sync = () => {
      const next = Boolean(boardRef.current && document.fullscreenElement === boardRef.current);
      const entered = !active.current && next;
      const exited = active.current && !next;
      active.current = next; setFullscreen(next);
      if (entered) {
        // Let React Flow's ResizeObserver record the fullscreen dimensions before fitting.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => { if (active.current) fitOnEnter(); });
        });
      }
      if (exited) { cancelAnimationFrame(frame); fullscreenButtonRef.current?.focus({ preventScroll: true }); }
    };
    document.addEventListener('fullscreenchange', sync);
    sync();
    return () => { document.removeEventListener('fullscreenchange', sync); cancelAnimationFrame(frame); };
  }, []);
  return { boardRef, fullscreenButtonRef, isFullscreen, fullscreenPending, fullscreenSupported, toggleFullscreen };
}
