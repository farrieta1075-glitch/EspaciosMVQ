"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  releaseRadixBodyScrollLock,
  releaseRadixBodyScrollLockIfIdle,
} from "@/lib/radix-body-lock";

/** Restores body interactivity if a Radix sheet/dialog leaves scroll lock behind. */
export function ModalBodyCleanup() {
  const pathname = usePathname();

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      releaseRadixBodyScrollLock();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      releaseRadixBodyScrollLockIfIdle();
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state", "data-scroll-locked", "style"],
    });

    releaseRadixBodyScrollLockIfIdle();

    return () => observer.disconnect();
  }, []);

  return null;
}
