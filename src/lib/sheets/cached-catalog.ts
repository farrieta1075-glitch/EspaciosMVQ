import "server-only";
import { unstable_cache } from "next/cache";
import { getAllAreas } from "@/lib/sheets/areas";
import { getAllMaps } from "@/lib/sheets/maps";
import { getAllSpaces } from "@/lib/sheets/spaces";

const REVALIDATE_SECONDS = 30;

export const getCachedCatalogMaps = unstable_cache(
  () => getAllMaps(),
  ["mvqro-catalog-maps"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalog-maps"] },
);

export const getCachedCatalogSpaces = unstable_cache(
  () => getAllSpaces(),
  ["mvqro-catalog-spaces"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalog-spaces"] },
);

export const getCachedCatalogAreas = unstable_cache(
  () => getAllAreas(),
  ["mvqro-catalog-areas"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalog-areas"] },
);

export async function getCachedCatalogBundle() {
  return Promise.all([
    getCachedCatalogMaps(),
    getCachedCatalogSpaces(),
    getCachedCatalogAreas(),
  ]);
}
