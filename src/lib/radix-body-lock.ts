/** Restores page interactivity when Radix dialog/sheet leaves scroll lock on body (common on iOS Safari). */
export function releaseRadixBodyScrollLock(): void {
  if (typeof document === "undefined") return;

  document.body.style.removeProperty("pointer-events");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.body.removeAttribute("data-scroll-locked");

  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("padding-right");
  document.documentElement.removeAttribute("data-scroll-locked");
}

export function hasOpenRadixOverlay(): boolean {
  if (typeof document === "undefined") return false;

  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-radix-dialog-overlay][data-state="open"]',
    ),
  );
}

function dismissClosedRadixOverlays(): void {
  if (typeof document === "undefined") return;

  document
    .querySelectorAll('[data-radix-dialog-overlay][data-state="closed"]')
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.pointerEvents = "none";
        node.style.visibility = "hidden";
      }
    });
}

export function releaseRadixBodyScrollLockIfIdle(): void {
  dismissClosedRadixOverlays();
  if (!hasOpenRadixOverlay()) {
    releaseRadixBodyScrollLock();
  }
}
