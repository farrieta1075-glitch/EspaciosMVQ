export type ShapeType = "rect" | "polygon";

export interface SpaceGeometry {
  type: ShapeType;
  points: number[];
  color?: string;
}

export interface Space {
  id: string;
  name: string;
  floor: string;
  capacity: number;
  minCapacity: number;
  geometry: SpaceGeometry | null;
  mapId: string;
  active: boolean;
}

export type BackgroundType = "blank" | "image" | "pdf";

/** "1" = planta principal (backgroundUrl); "2" = segundo piso (secondary*). */
export type MapFloorId = "1" | "2";

export interface FloorMap {
  id: string;
  name: string;
  backgroundType: BackgroundType;
  backgroundUrl: string;
  width: number;
  height: number;
  secondaryBackgroundType?: BackgroundType;
  secondaryBackgroundUrl?: string;
  secondaryWidth?: number;
  secondaryHeight?: number;
  /** Planta que se muestra primero al abrir el mapa. */
  primaryFloor?: MapFloorId;
  floor1Label?: string;
  floor2Label?: string;
}
