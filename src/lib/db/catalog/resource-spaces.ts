import "server-only";
import { getPrisma } from "@/lib/db/prisma";

export interface ResourceSpaceLink {
  resourceId: string;
  spaceId: string;
}

export async function getResourceSpaceLinks(): Promise<ResourceSpaceLink[]> {
  const rows = await getPrisma().resourceSpace.findMany();
  return rows.map((row) => ({
    resourceId: row.resourceId,
    spaceId: row.spaceId,
  }));
}

export async function getSpaceIdsForResource(resourceId: string): Promise<string[]> {
  const rows = await getPrisma().resourceSpace.findMany({ where: { resourceId } });
  return rows.map((row) => row.spaceId);
}

export async function setResourceSpaceLinks(
  resourceId: string,
  spaceIds: string[],
): Promise<void> {
  const unique = [...new Set(spaceIds.filter(Boolean))];
  await getPrisma().resourceSpace.deleteMany({ where: { resourceId } });
  if (unique.length === 0) return;
  await getPrisma().resourceSpace.createMany({
    data: unique.map((spaceId) => ({ resourceId, spaceId })),
  });
}
