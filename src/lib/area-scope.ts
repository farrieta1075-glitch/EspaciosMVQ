import type { AreaEventPreset } from "@/types/area-event-preset";
import {
  parseAreaEventPresets,
  serializeAreaEventPresets,
} from "@/lib/event-preset-utils";
import type { Area } from "@/types/area";
import type { AppUser } from "@/types/user";

export function parseEventPresets(raw: string | undefined | null): AreaEventPreset[] {
  return parseAreaEventPresets(raw);
}

export function serializeEventPresets(presets: AreaEventPreset[]): string {
  return serializeAreaEventPresets(presets);
}

export function resolveUserAreaScopeIds(user: Pick<AppUser, "areaId" | "areaScopeIds">): string[] {
  const scoped = (user.areaScopeIds ?? []).filter(Boolean);
  if (scoped.length > 0) return [...new Set(scoped)];
  if (user.areaId) return [user.areaId];
  return [];
}

export function userHasAreaScope(
  user: Pick<AppUser, "areaId" | "areaScopeIds">,
  areaId: string,
): boolean {
  if (!areaId) return false;
  const scopes = resolveUserAreaScopeIds(user);
  return scopes.includes(areaId);
}

export function buildAreaTree(areas: Area[]): Area[] {
  return [...areas].sort((a, b) => {
    const aParent = a.parentId ?? "";
    const bParent = b.parentId ?? "";
    if (aParent !== bParent) return aParent.localeCompare(bParent);
    return a.name.localeCompare(b.name, "es");
  });
}

export function buildAreaHierarchy(areas: Area[]) {
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const childrenByParent = new Map<string, Area[]>();

  for (const area of areas) {
    if (!area.parentId) continue;
    const list = childrenByParent.get(area.parentId) ?? [];
    list.push(area);
    childrenByParent.set(area.parentId, list);
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  const roots = areas
    .filter((area) => !area.parentId || !areasById.has(area.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { areasById, childrenByParent, roots };
}

/** Prefijo visual para `<option>` (subáreas indentadas). */
export function areaSelectOptionLabel(area: Area, depth = 0): string {
  const prefix = depth > 0 ? `${"\u2003".repeat(depth)}↳ ` : "";
  return `${prefix}${area.name}`;
}

export function getAreaLabel(area: Area, areasById: Map<string, Area>): string {
  if (!area.parentId) return area.name;
  const parent = areasById.get(area.parentId);
  return parent ? `${parent.name} · ${area.name}` : area.name;
}

export function getDescendantAreaIds(rootId: string, areas: Area[]): string[] {
  const childrenByParent = new Map<string, Area[]>();
  for (const area of areas) {
    if (!area.parentId) continue;
    const list = childrenByParent.get(area.parentId) ?? [];
    list.push(area);
    childrenByParent.set(area.parentId, list);
  }
  const result: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    for (const child of childrenByParent.get(id) ?? []) {
      queue.push(child.id);
    }
  }
  return result;
}

/** Eventos del área + todas sus subáreas (herencia hacia arriba). */
export function collectInheritedEventPresets(
  areaId: string,
  areas: Area[],
): AreaEventPreset[] {
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const byName = new Map<string, AreaEventPreset>();
  for (const id of getDescendantAreaIds(areaId, areas)) {
    for (const preset of areasById.get(id)?.eventPresets ?? []) {
      const name = preset.name.trim();
      if (!name || byName.has(name)) continue;
      byName.set(name, preset);
    }
  }
  return [...byName.values()];
}

export function buildEventPresetAreaOptions(
  areas: Area[],
  scopeIds: string[],
): { id: string; label: string; depth: number }[] {
  const allowed = new Set(scopeIds.filter(Boolean));
  const { roots, childrenByParent } = buildAreaHierarchy(areas);
  const options: { id: string; label: string; depth: number }[] = [];

  function walk(area: Area, depth: number) {
    if (allowed.has(area.id)) {
      options.push({
        id: area.id,
        label: areaSelectOptionLabel(area, depth),
        depth,
      });
    }
    for (const child of childrenByParent.get(area.id) ?? []) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots) {
    walk(root, 0);
  }

  for (const scopeId of scopeIds) {
    if (!options.some((item) => item.id === scopeId)) {
      const area = areas.find((item) => item.id === scopeId);
      if (area) {
        options.push({
          id: area.id,
          label: areaSelectOptionLabel(area, 0),
          depth: 0,
        });
      }
    }
  }

  return options;
}

export function buildPresetsByAreaId(
  areas: Area[],
  scopeIds: string[],
): Record<string, AreaEventPreset[]> {
  const map: Record<string, AreaEventPreset[]> = {};
  for (const scopeId of scopeIds) {
    const presets = collectInheritedEventPresets(scopeId, areas);
    if (presets.length > 0) {
      map[scopeId] = presets;
    }
  }
  return map;
}

/** @deprecated Prefer buildEventPresetAreaOptions + buildPresetsByAreaId */
export function collectEventPresetGroups(
  areas: Area[],
  scopeIds: string[],
): {
  id: string;
  label: string;
  parentLabel: string | null;
  colorHex: string;
  events: AreaEventPreset[];
}[] {
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const groups: {
    id: string;
    label: string;
    parentLabel: string | null;
    colorHex: string;
    events: AreaEventPreset[];
  }[] = [];

  for (const scopeId of scopeIds) {
    const area = areasById.get(scopeId);
    if (!area) continue;
    const events = collectInheritedEventPresets(scopeId, areas);
    if (events.length === 0) continue;
    const parent = area.parentId ? areasById.get(area.parentId) : null;
    groups.push({
      id: area.id,
      label: area.name,
      parentLabel: parent?.name ?? null,
      colorHex: area.colorHex || "",
      events,
    });
  }

  return groups;
}
