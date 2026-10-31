import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import { mapDbResource } from "@/lib/db/catalog/mappers";
import { getResourceSpaceLinks, setResourceSpaceLinks } from "@/lib/db/catalog/resource-spaces";
import type { Resource, ResourceScope, ResourceType } from "@/types/resource";

async function buildResourcesWithRestrictions(): Promise<Resource[]> {
  const [rows, links] = await Promise.all([
    getPrisma().resource.findMany(),
    getResourceSpaceLinks(),
  ]);
  return rows.map((row) => {
    const base = mapDbResource(row);
    const restrictedSpaceIds = links
      .filter((link) => link.resourceId === row.id)
      .map((link) => link.spaceId);
    return { ...base, restrictedSpaceIds };
  });
}

export async function getAllResources(): Promise<Resource[]> {
  return buildResourcesWithRestrictions();
}

export async function getResourceById(id: string): Promise<Resource | null> {
  return (await getAllResources()).find((resource) => resource.id === id) ?? null;
}

export async function createResource(input: {
  name: string;
  type: ResourceType;
  totalQty: number;
  imageUrl?: string;
  scope?: ResourceScope;
  active?: boolean;
  restrictedSpaceIds?: string[];
}): Promise<Resource> {
  const { createId } = await import("@/lib/id");
  const id = createId("res");
  await getPrisma().resource.create({
    data: {
      id,
      name: input.name.trim(),
      type: input.type,
      totalQty: input.totalQty,
      imageUrl: input.imageUrl?.trim() ?? "",
      scope: input.scope ?? "GLOBAL",
      active: input.active ?? true,
    },
  });
  if (input.scope === "RESTRICTED" && input.restrictedSpaceIds) {
    await setResourceSpaceLinks(id, input.restrictedSpaceIds);
  }
  return (await getResourceById(id))!;
}

export async function updateResource(
  id: string,
  input: Partial<{
    name: string;
    type: ResourceType;
    totalQty: number;
    imageUrl: string;
    scope: ResourceScope;
    active: boolean;
    restrictedSpaceIds: string[];
  }>,
): Promise<Resource | null> {
  const existing = await getResourceById(id);
  if (!existing) return null;
  await getPrisma().resource.update({
    where: { id },
    data: {
      name: input.name?.trim() ?? existing.name,
      type: input.type ?? existing.type,
      totalQty: input.totalQty ?? existing.totalQty,
      imageUrl: input.imageUrl ?? existing.imageUrl,
      scope: input.scope ?? existing.scope,
      active: input.active ?? existing.active,
    },
  });
  if (input.restrictedSpaceIds !== undefined) {
    await setResourceSpaceLinks(id, input.restrictedSpaceIds);
  }
  return getResourceById(id);
}

export async function deleteResource(id: string): Promise<boolean> {
  await getPrisma().resourceSpace.deleteMany({ where: { resourceId: id } });
  try {
    await getPrisma().resource.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
