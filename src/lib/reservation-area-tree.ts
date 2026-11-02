import type { Area } from "@/types/area";

export interface ReservationAreaTreeNode {
  area: Area;
  children: ReservationAreaTreeNode[];
  /** Usuario puede elegir esta área/subárea para la reserva. */
  selectable: boolean;
  depth: number;
}

function sortByName(a: Area, b: Area) {
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

export function buildReservationAreaTree(
  areas: Area[],
  options: { isAdmin: boolean; selectableAreaIds: Set<string> },
): ReservationAreaTreeNode[] {
  const byParent = new Map<string | null, Area[]>();
  for (const area of areas) {
    const key = area.parentId?.trim() || null;
    const list = byParent.get(key) ?? [];
    list.push(area);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort(sortByName);
  }

  function build(parentId: string | null, depth: number): ReservationAreaTreeNode[] {
    const siblings = byParent.get(parentId) ?? [];
    return siblings.map((area) => {
      const children = build(area.id, depth + 1);
      const selfSelectable =
        options.isAdmin || options.selectableAreaIds.has(area.id);
      const childSelectable = children.some((child) => child.selectable);
      return {
        area,
        children,
        selectable: selfSelectable,
        depth,
        // Mostrar rama si el nodo es elegible o algún hijo lo es
      };
    }).filter((node) => {
      if (options.isAdmin) return true;
      if (node.selectable) return true;
      return node.children.length > 0;
    });
  }

  return build(null, 0);
}

export function flattenSelectableAreaIds(nodes: ReservationAreaTreeNode[]): string[] {
  const ids: string[] = [];
  function walk(list: ReservationAreaTreeNode[]) {
    for (const node of list) {
      if (node.selectable) ids.push(node.area.id);
      walk(node.children);
    }
  }
  walk(nodes);
  return ids;
}

export function getAreaLabel(area: Area, areas: Area[]): string {
  const parent = area.parentId
    ? areas.find((item) => item.id === area.parentId)
    : null;
  return parent ? `${parent.name} · ${area.name}` : area.name;
}
