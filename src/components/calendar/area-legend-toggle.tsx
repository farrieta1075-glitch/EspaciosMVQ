"use client";

import type { Area } from "@/types/area";
import { getAreaColor } from "@/lib/area-colors";
import { AreaTag } from "@/components/calendar/area-tag";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AreaLegendToggleProps {
  areas: Area[];
  /** Catálogo completo para heredar color del padre. */
  allAreas?: Area[];
  show: boolean;
  onToggle: () => void;
  className?: string;
}

export function AreaLegendToggle({
  areas,
  allAreas,
  show,
  onToggle,
  className,
}: AreaLegendToggleProps) {
  const colorCatalog = allAreas && allAreas.length > 0 ? allAreas : areas;
  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        size="sm"
        variant={show ? "default" : "outline"}
        className="h-8 text-xs"
        disabled={areas.length === 0}
        onClick={onToggle}
      >
        {show ? "Ocultar áreas" : "Ver áreas"}
      </Button>
      {show && areas.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {areas.map((area) => (
            <AreaTag
              key={area.id}
              name={area.name}
              color={getAreaColor(area, colorCatalog)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
