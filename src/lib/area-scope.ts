import type { Area } from "@/types/area";
import type { AppUser } from "@/types/user";

export function parseEventPresets(raw: string | undefined | null): string[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => String(item).trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  return trimmed
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeEventPresets(presets: string[]): string {
  const unique = [...new Set(presets.map((item) => item.trim()).filter(Boolean))];
  return JSON.stringify(unique);
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

export function collectEventPresetGroups(
  areas: Area[],
  scopeIds: string[],
): {
  id: string;
  label: string;
  parentLabel: string | null;
  colorHex: string;
  events: string[];
}[] {
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const groups: {
    id: string;
    label: string;
    parentLabel: string | null;
    colorHex: string;
    events: string[];
  }[] = [];

  for (const scopeId of scopeIds) {
    const area = areasById.get(scopeId);
    if (!area) continue;
    const events = area.eventPresets ?? [];
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
