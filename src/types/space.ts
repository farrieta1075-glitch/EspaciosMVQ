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
  geometry: SpaceGeometry | null;
  mapId: string;
  active: boolean;
}

export type BackgroundType = "blank" | "image" | "pdf";

export interface FloorMap {
  id: string;
  name: string;
  backgroundType: BackgroundType;
  backgroundUrl: string;
  width: number;
  height: number;
}
