export interface Area {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  colorHex: string;
  eventPresets: string[];
}
