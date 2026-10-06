"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** Restores body interactivity if a Radix sheet/dialog leaves scroll lock behind. */
export function ModalBodyCleanup() {
  const pathname = usePathname();

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.body.style.removeProperty("pointer-events");
      document.body.style.removeProperty("overflow");
      document.body.removeAttribute("data-scroll-locked");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
