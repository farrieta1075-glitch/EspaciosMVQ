"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function HelpHint({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function closeIfOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Mostrar ayuda"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-[11px] font-semibold leading-none text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-xs font-normal normal-case text-popover-foreground shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}
