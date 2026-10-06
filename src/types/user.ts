export type UserRole = "ADMIN" | "GENERAL" | "VISUALIZACION";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  GENERAL: "General",
  VISUALIZACION: "Visualización",
};

export interface AppUser {
  id: string;
  email: string | null;
  username: string | null;
  passwordHash: string | null;
  role: UserRole;
  areaId: string | null;
  areaName?: string | null;
  active: boolean;
}

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: UserRole;
  areaId?: string | null;
  areaName?: string | null;
}

export type PublicUser = Omit<AppUser, "passwordHash">;
