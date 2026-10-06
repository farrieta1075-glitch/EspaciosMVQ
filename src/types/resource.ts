export type ResourceType = "TECNICO" | "CONSUMIBLE" | "OTRO";

export type ResourceScope = "GLOBAL" | "RESTRICTED";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  totalQty: number;
  imageUrl: string;
  scope: ResourceScope;
  active: boolean;
  restrictedSpaceIds: string[];
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  TECNICO: "Técnico",
  CONSUMIBLE: "Consumible",
  OTRO: "Otro",
};

export const RESOURCE_SCOPE_LABELS: Record<ResourceScope, string> = {
  GLOBAL: "Global",
  RESTRICTED: "Restringido a espacios",
};
