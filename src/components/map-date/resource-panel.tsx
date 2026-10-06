"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import type { ResourceAvailability } from "@/types/reservation";
import type { ResourceType } from "@/types/resource";
import { RESOURCE_TYPE_LABELS } from "@/types/resource";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ResourceFilter = "ALL" | ResourceType;

interface ResourcePanelProps {
  resources: ResourceAvailability[];
  selectedResources: Record<string, number>;
  onQuantityChange: (resourceId: string, quantity: number) => void;
  readOnly?: boolean;
  mobileAsSheet?: boolean;
  className?: string;
}

export function ResourcePanel({
  resources,
  selectedResources,
  onQuantityChange,
  readOnly = false,
  mobileAsSheet = false,
  className,
}: ResourcePanelProps) {
  const [filter, setFilter] = React.useState<ResourceFilter>("ALL");
  const [collapsed, setCollapsed] = React.useState(false);

  const filtered = resources.filter(
    (resource) => filter === "ALL" || resource.type === filter,
  );

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
                  <Image
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
                {!readOnly && (() => {
                  const selectedQty = selectedResources[resource.id] ?? 0;
                  const maxQty = Math.max(resource.availableQty, selectedQty);
                  return (
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`qty-${resource.id}`}
                      className="sr-only"
                    >
                      Cantidad
                    </Label>
                    <Input
                      id={`qty-${resource.id}`}
                      type="number"
                      min={0}
                      max={maxQty}
                      value={selectedQty}
                      onChange={(event) => {
                        const value = Math.min(
                          Math.max(Number(event.target.value) || 0, 0),
                          maxQty,
                        );
                        onQuantityChange(resource.id, value);
                      }}
                      className="h-8 w-20"
                      disabled={maxQty === 0}
                    />
                  </div>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

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
