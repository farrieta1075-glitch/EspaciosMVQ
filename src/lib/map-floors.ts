import type { BackgroundType, FloorMap, MapFloorId } from "@/types/space";

export interface MapFloorLayer {
  id: MapFloorId;
  label: string;
  backgroundType: BackgroundType;
  backgroundUrl: string;
  width: number;
  height: number;
}

export function normalizeMapFloorId(raw: string | null | undefined): MapFloorId {
  return raw?.trim() === "2" ? "2" : "1";
}

export function mapHasSecondFloor(map: FloorMap): boolean {
  const type = map.secondaryBackgroundType;
  const url = map.secondaryBackgroundUrl?.trim();
  if (url) return true;
  return Boolean(type && type !== "blank");
}

export function getMapFloorLayer(map: FloorMap, floor: MapFloorId): MapFloorLayer {
  if (floor === "2") {
    return {
      id: "2",
      label: map.floor2Label?.trim() || "Piso 2",
      backgroundType: (map.secondaryBackgroundType ?? "blank") as BackgroundType,
      backgroundUrl: map.secondaryBackgroundUrl ?? "",
      width: map.secondaryWidth && map.secondaryWidth > 0 ? map.secondaryWidth : map.width,
      height:
        map.secondaryHeight && map.secondaryHeight > 0
          ? map.secondaryHeight
          : map.height,
    };
  }
  return {
    id: "1",
    label: map.floor1Label?.trim() || "Planta baja",
    backgroundType: map.backgroundType,
    backgroundUrl: map.backgroundUrl,
    width: map.width,
    height: map.height,
  };
}

export function getMapFloorDisplayOrder(map: FloorMap): MapFloorId[] {
  if (!mapHasSecondFloor(map)) return ["1"];
  const primary = normalizeMapFloorId(map.primaryFloor);
  return primary === "2" ? ["2", "1"] : ["1", "2"];
}

export function spaceBelongsToFloor(spaceFloor: string, floor: MapFloorId): boolean {
  return normalizeMapFloorId(spaceFloor) === floor;
}
