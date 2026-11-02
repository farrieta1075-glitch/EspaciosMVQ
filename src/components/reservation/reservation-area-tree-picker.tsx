"use client";

import type { Area } from "@/types/area";
import {
  buildReservationAreaTree,
  type ReservationAreaTreeNode,
} from "@/lib/reservation-area-tree";
import { getAreaHex } from "@/lib/area-colors";
import { cn } from "@/lib/utils";

interface ReservationAreaTreePickerProps {
  areas: Area[];
  isAdmin: boolean;
  selectableAreaIds: string[];
  value: string;
  onChange: (areaId: string) => void;
}

function TreeNode({
  node,
  areas,
  value,
  onChange,
}: {
  node: ReservationAreaTreeNode;
  areas: Area[];
  value: string;
  onChange: (areaId: string) => void;
}) {
  const hex = getAreaHex(node.area, areas);
  const paddingLeft = 8 + node.depth * 16;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-start gap-2 rounded-md py-1.5 pr-2",
          node.selectable && value === node.area.id && "bg-accent",
        )}
        style={{ paddingLeft }}
      >
        {node.selectable ? (
          <input
            type="radio"
            name="reservation-area-tree"
            id={`area-${node.area.id}`}
            checked={value === node.area.id}
            onChange={() => onChange(node.area.id)}
            className="mt-1 h-4 w-4 shrink-0"
          />
        ) : (
          <span className="mt-1 inline-block h-4 w-4 shrink-0" aria-hidden />
        )}
        <label
          htmlFor={node.selectable ? `area-${node.area.id}` : undefined}
          className={cn(
            "min-w-0 flex-1 cursor-default text-sm",
            node.selectable && "cursor-pointer",
            !node.selectable && "font-medium text-muted-foreground",
          )}
        >
          <span
            className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
            style={{ backgroundColor: hex }}
          />
          {node.area.name}
        </label>
      </div>
      {node.children.map((child) => (
        <TreeNode
          key={child.area.id}
          node={child}
          areas={areas}
          value={value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

export function ReservationAreaTreePicker({
  areas,
  isAdmin,
  selectableAreaIds,
  value,
  onChange,
}: ReservationAreaTreePickerProps) {
  const tree = buildReservationAreaTree(areas, {
    isAdmin,
    selectableAreaIds: new Set(selectableAreaIds),
  });

  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay áreas disponibles para reservar.
      </p>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-3">
      {tree.map((node) => (
        <TreeNode
          key={node.area.id}
          node={node}
          areas={areas}
          value={value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
