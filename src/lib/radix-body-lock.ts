/** Restores page interactivity when Radix dialog/sheet leaves scroll lock on body (common on iOS Safari). */
export function releaseRadixBodyScrollLock(): void {
  if (typeof document === "undefined") return;

  document.body.style.removeProperty("pointer-events");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
  document.body.removeAttribute("data-scroll-locked");

  document.documentElement.style.removeProperty("overflow");
  document.documentElement.removeProperty("padding-right");
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

export function releaseRadixBodyScrollLockIfIdle(): void {
  if (!hasOpenRadixOverlay()) {
    releaseRadixBodyScrollLock();
  }
}
