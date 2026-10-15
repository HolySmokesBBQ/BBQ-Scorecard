import { useRef } from 'react';

// Long-press hook. Returns handlers to spread onto an element.
// Fires callback after `ms` if the pointer hasn't moved more than
// `moveTolerance` pixels. If the user taps quickly, the tap goes
// through normally — the child's onClick still fires.
//
// Also fires on right-click (or long-press mouse hold) so the wheel
// is testable in a desktop browser preview.

export default function useLongPress(onLongPress, { ms = 400, moveTolerance = 12 } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  };

  const start = (x, y) => {
    firedRef.current = false;
    startRef.current = { x, y };
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, ms);
  };

  const move = (x, y) => {
    const s = startRef.current;
    if (!s) return;
    if (Math.hypot(x - s.x, y - s.y) > moveTolerance) clear();
  };

  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      if (t) start(t.clientX, t.clientY);
    },
    onTouchMove: (e) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    },
    onTouchEnd: clear,
    onTouchCancel: clear,
    onMouseDown: (e) => start(e.clientX, e.clientY),
    onMouseMove: (e) => move(e.clientX, e.clientY),
    onMouseUp: clear,
    onMouseLeave: clear,
    onContextMenu: (e) => {
      e.preventDefault();
      if (!firedRef.current) onLongPress();
    },
  };
}
