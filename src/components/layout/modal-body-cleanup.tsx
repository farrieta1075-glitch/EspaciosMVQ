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
    let timer: number | undefined;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => releaseRadixBodyScrollLockIfIdle(), 150);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
    });

    schedule();

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
