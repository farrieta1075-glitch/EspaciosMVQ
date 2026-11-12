"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpacesVisibilityToggleProps {
  showAllSpaces: boolean;
  onToggle: () => void;
  className?: string;
}

export function SpacesVisibilityToggle({
  showAllSpaces,
  onToggle,
  className,
}: SpacesVisibilityToggleProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        size="sm"
        variant={showAllSpaces ? "default" : "outline"}
        className="h-8 text-xs"
        onClick={onToggle}
      >
        {showAllSpaces ? "Todos los espacios" : "Solo espacios comunes"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {showAllSpaces
          ? "Incluye baños y zonas internas aunque no estén reservados."
          : "Los espacios internos solo aparecen si ya hay una reserva."}
      </p>
    </div>
  );
}
