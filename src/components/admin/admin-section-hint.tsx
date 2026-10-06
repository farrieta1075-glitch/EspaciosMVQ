"use client";

import { cn } from "@/lib/utils";

export function AdminSectionHint({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "group/hint relative inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border border-muted-foreground/40 text-[11px] font-semibold leading-none text-muted-foreground",
        className,
      )}
      tabIndex={0}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      ?
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-xs font-normal normal-case text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
