"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Package,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { ResourceAvailability } from "@/types/reservation";
import type { ResourceType } from "@/types/resource";
import { RESOURCE_TYPE_LABELS } from "@/types/resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/utils";

type ResourceFilter = "ALL" | ResourceType;

function ResourceQuantityControls({
  resource,
  selectedQty,
  maxQty,
  readOnly,
  estimatedAttendees,
  onQuantityChange,
}: {
  resource: ResourceAvailability;
  selectedQty: number;
  maxQty: number;
  readOnly: boolean;
  estimatedAttendees: number;
  onQuantityChange: (resourceId: string, quantity: number) => void;
}) {
  const scales = Boolean(resource.scalesWithAttendees);
  const [modePeople, setModePeople] = React.useState(scales);

  if (readOnly) {
    return <span className="text-sm">{selectedQty}</span>;
  }

  function setQty(next: number) {
    onQuantityChange(
      resource.id,
      Math.min(Math.max(next, 0), maxQty),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {scales && (
        <Button
          type="button"
          size="icon"
          variant={modePeople ? "default" : "outline"}
          className="h-8 w-8"
          title="Ligar a asistentes"
          onClick={() => {
            setModePeople(true);
            if (estimatedAttendees > 0) setQty(estimatedAttendees);
          }}
        >
          <Users className="h-4 w-4" />
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant={!scales || !modePeople ? "default" : "outline"}
        className="h-8 w-8"
        title="Contar unidades"
        onClick={() => setModePeople(false)}
      >
        <Package className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        disabled={selectedQty <= 0}
        onClick={() => setQty(selectedQty - 1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[2rem] text-center text-sm font-medium">
        {selectedQty}
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-8 w-8"
        disabled={selectedQty >= maxQty}
        onClick={() => {
          if (selectedQty === 0 && modePeople && estimatedAttendees > 0) {
            setQty(estimatedAttendees);
          } else {
            setQty(selectedQty + 1);
          }
        }}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Poner en cero"
        onClick={() => setQty(0)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface ResourcePanelProps {
  resources: ResourceAvailability[];
  selectedResources: Record<string, number>;
  onQuantityChange: (resourceId: string, quantity: number) => void;
  readOnly?: boolean;
  mobileAsSheet?: boolean;
  inline?: boolean;
  className?: string;
  reservationSheet?: boolean;
  estimatedAttendees?: number;
  onReservationConfirm?: () => void;
  onReservationCancel?: () => void;
}

export function ResourcePanel({
  resources,
  selectedResources,
  onQuantityChange,
  readOnly = false,
  mobileAsSheet = false,
  inline = false,
  className,
  reservationSheet = false,
  estimatedAttendees = 0,
  onReservationConfirm,
  onReservationCancel,
}: ResourcePanelProps) {
  const [filter, setFilter] = React.useState<ResourceFilter>("ALL");
  const [collapsed, setCollapsed] = React.useState(false);

  const filtered = resources.filter(
    (resource) => filter === "ALL" || resource.type === filter,
  );

  const selectedCount = Object.values(selectedResources).filter((q) => q > 0)
    .length;

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(["ALL", "TECNICO", "CONSUMIBLE", "OTRO"] as const).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={filter === type ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setFilter(type)}
          >
            {type === "ALL" ? "Todos" : RESOURCE_TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay recursos disponibles para los espacios seleccionados.
          </p>
        ) : (
          filtered.map((resource) => (
            <div
              key={resource.id}
              className="flex gap-3 rounded-lg border border-border p-3"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {resource.imageUrl ? (
                  <AssetImage
                    src={resource.imageUrl}
                    alt={resource.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="truncate text-sm font-medium">{resource.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {RESOURCE_TYPE_LABELS[resource.type as ResourceType] ??
                        resource.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Disp. {resource.availableQty}/{resource.totalQty}
                    </Badge>
                  </div>
                </div>
                <ResourceQuantityControls
                  resource={resource}
                  selectedQty={selectedResources[resource.id] ?? 0}
                  maxQty={Math.max(
                    resource.availableQty,
                    selectedResources[resource.id] ?? 0,
                  )}
                  readOnly={readOnly}
                  estimatedAttendees={estimatedAttendees}
                  onQuantityChange={onQuantityChange}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (inline && reservationSheet) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col", className)}>
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancelar"
            onClick={onReservationCancel}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Recursos</p>
            <p className="text-xs text-muted-foreground">
              {selectedCount} seleccionado(s)
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="default"
            aria-label="Confirmar recursos"
            onClick={onReservationConfirm}
          >
            <Check className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{content}</div>
      </div>
    );
  }

  if (inline) {
    return <div className={className}>{content}</div>;
  }

  if (mobileAsSheet) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full gap-2 lg:hidden">
            <Package className="h-4 w-4" />
            Recursos ({resources.length})
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(100%,360px)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Recursos</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        "rounded-xl border border-border bg-card",
        collapsed ? "p-3" : "p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Recursos</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 lg:inline-flex"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      {!collapsed && content}
    </aside>
  );
}
