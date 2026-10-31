import { parseEventPresets, serializeEventPresets } from "@/lib/area-scope";
import type { Area } from "@/types/area";
import type { Resource, ResourceScope, ResourceType } from "@/types/resource";
import type { BackgroundType, FloorMap, Space, SpaceGeometry } from "@/types/space";
import type { AppUser, UserRole } from "@/types/user";
import type {
  Area as DbArea,
  FloorMap as DbMap,
  Resource as DbResource,
  Space as DbSpace,
  User as DbUser,
} from "@prisma/client";

function parseAreaScopeIds(raw: string): string[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((item) => String(item).trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function mapDbUser(row: DbUser): AppUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.passwordHash,
    role: row.role as UserRole,
    areaId: row.areaId,
    active: row.active,
    receiveApprovalEmails: row.receiveApprovalEmails,
    areaScopeIds: parseAreaScopeIds(row.areaScopeIds),
  };
}

export function mapDbArea(row: DbArea): Area {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parentId: row.parentId,
    colorHex: row.colorHex,
    eventPresets: parseEventPresets(row.eventPresets),
  };
}

export function mapDbMap(row: DbMap): FloorMap {
  return {
    id: row.id,
    name: row.name,
    backgroundType: row.backgroundType as BackgroundType,
    backgroundUrl: row.backgroundUrl,
    width: row.width,
    height: row.height,
    secondaryBackgroundType: (row.secondaryBackgroundType ||
      undefined) as BackgroundType | undefined,
    secondaryBackgroundUrl: row.secondaryBackgroundUrl || undefined,
    secondaryWidth: row.secondaryWidth || undefined,
    secondaryHeight: row.secondaryHeight || undefined,
    primaryFloor: row.primaryFloor === "2" ? "2" : "1",
    floor1Label: row.floor1Label || undefined,
    floor2Label: row.floor2Label || undefined,
  };
}

function parseGeometry(raw: string): SpaceGeometry | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as SpaceGeometry;
  } catch {
    return null;
  }
}

export function mapDbSpace(row: DbSpace): Space {
  return {
    id: row.id,
    name: row.name,
    floor: row.floor || "1",
    capacity: row.capacity,
    minCapacity: row.minCapacity > 0 ? row.minCapacity : 1,
    geometry: parseGeometry(row.geometryJson),
    mapId: row.mapId,
    active: row.active,
  };
}

export function mapDbResource(row: DbResource): Omit<Resource, "restrictedSpaceIds"> {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ResourceType,
    totalQty: row.totalQty,
    imageUrl: row.imageUrl,
    scope: row.scope as ResourceScope,
    active: row.active,
  };
}

export function serializeAreaScopeIds(ids: string[]): string {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  return JSON.stringify(unique);
}

export { serializeEventPresets };
