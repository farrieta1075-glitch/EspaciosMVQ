"use client";

import type { Area } from "@/types/area";
import { areaCardStyle, getAreaColor } from "@/lib/area-colors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AreaLegendToggleProps {
  areas: Area[];
  show: boolean;
  onToggle: () => void;
  className?: string;
}

export function AreaLegendToggle({
  areas,
  show,
  onToggle,
  className,
}: AreaLegendToggleProps) {
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
          {areas.map((area) => {
            const color = getAreaColor(area);
            return (
              <span
                key={area.id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                style={areaCardStyle(color)}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color.hex }}
                />
                {area.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
