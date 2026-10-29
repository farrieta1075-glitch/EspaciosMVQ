import { loadImage } from "@/lib/load-image";
import { resolveAssetUrl } from "@/lib/storage/resolve-asset-url";
import type { FloorMap } from "@/types/space";

const imageCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement | null>>();

async function loadMapBackgroundImage(
  assetUrl: string,
  backgroundType: FloorMap["backgroundType"],
): Promise<HTMLImageElement | null> {
  if (backgroundType === "blank" || !assetUrl) return null;

  const cacheKey = `${backgroundType}:${assetUrl}`;
  const cached = imageCache.get(cacheKey);
  if (cached) return cached;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      if (backgroundType === "pdf") {
        const { renderPdfFirstPage } = await import("@/lib/pdf-render");
        const rendered = await renderPdfFirstPage(assetUrl);
        const img = await loadImage(rendered.dataUrl);
        imageCache.set(cacheKey, img);
        return img;
      }
      const img = await loadImage(assetUrl);
      imageCache.set(cacheKey, img);
      return img;
    } catch {
      return null;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}

export async function getCachedMapBackground(
  map: Pick<FloorMap, "backgroundType" | "backgroundUrl">,
): Promise<HTMLImageElement | null> {
  if (map.backgroundType === "blank" || !map.backgroundUrl) return null;
  const assetUrl = resolveAssetUrl(map.backgroundUrl);
  return loadMapBackgroundImage(assetUrl, map.backgroundType);
}

export function preloadMapBackgrounds(
  maps: Pick<FloorMap, "id" | "backgroundType" | "backgroundUrl">[],
): void {
  if (typeof window === "undefined") return;
  for (const map of maps) {
    void getCachedMapBackground(map);
  }
}
