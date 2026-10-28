const REFRESH_DISTANCE = 100;

/** The desktop shell is fixed, so the page cannot use native pull-to-refresh. */
export function installRemotePullToRefresh(
  element: HTMLElement,
  onProgress: (progress: number) => void,
  onRefresh: () => void,
) {
  let start: { x: number; y: number } | null = null;
  let distance = 0;
  const reset = () => { start = null; distance = 0; onProgress(0); };
  const begin = (event: TouchEvent) => {
    reset();
    if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
    if (event.target.closest("input,textarea,select,[contenteditable],[data-composer],[role=dialog],[role=menu],.xterm,[data-remote-browser]")) return;
    for (let node: Element | null = event.target; node && node !== element; node = node.parentElement) {
      // A pull inside a scrolled pane must scroll that pane back to its top first.
      if (node.scrollTop > 0) return;
    }
    const touch = event.touches[0]!;
    start = { x: touch.clientX, y: touch.clientY };
  };
  const move = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1) { reset(); return; }
    const touch = event.touches[0]!;
    const dy = touch.clientY - start.y;
    if (dy < -8 || Math.abs(touch.clientX - start.x) > Math.max(8, dy)) { reset(); return; }
    if (dy <= 8) { distance = 0; onProgress(0); return; }
    if (!event.cancelable) { reset(); return; }
    event.preventDefault();
    distance = dy;
    onProgress(Math.min(1, distance / REFRESH_DISTANCE));
  };
  const end = () => {
    const refresh = start !== null && distance >= REFRESH_DISTANCE;
    reset();
    if (refresh) onRefresh();
  };
  element.addEventListener("touchstart", begin, { passive: true });
  element.addEventListener("touchmove", move, { passive: false });
  element.addEventListener("touchend", end);
  element.addEventListener("touchcancel", reset);
  return () => {
    element.removeEventListener("touchstart", begin);
    element.removeEventListener("touchmove", move);
    element.removeEventListener("touchend", end);
    element.removeEventListener("touchcancel", reset);
  };
}
