"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MapFloorId } from "@/types/space";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MapFloorSwitcherProps {
  floors: MapFloorId[];
  labels: Record<MapFloorId, string>;
  activeFloor: MapFloorId;
  onChange: (floor: MapFloorId) => void;
  className?: string;
}

export function MapFloorSwitcher({
  floors,
  labels,
  activeFloor,
  onChange,
  className,
}: MapFloorSwitcherProps) {
  if (floors.length <= 1) return null;

  const index = floors.indexOf(activeFloor);
  const safeIndex = index >= 0 ? index : 0;

  function go(direction: -1 | 1) {
    const next = floors[safeIndex + direction];
    if (next) onChange(next);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={safeIndex <= 0}
        onClick={() => go(-1)}
        aria-label="Planta anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">
        {labels[activeFloor] ?? activeFloor}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        disabled={safeIndex >= floors.length - 1}
        onClick={() => go(1)}
        aria-label="Planta siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
