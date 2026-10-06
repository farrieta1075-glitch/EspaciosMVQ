import type { SessionUser, UserRole } from "@/types/user";

type PermissionAction =
  | "view:calendar"
  | "view:reservations"
  | "create:reservation"
  | "modify:reservation"
  | "cancel:reservation"
  | "manage:spaces"
  | "manage:resources"
  | "manage:users"
  | "view:dashboard";

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  ADMIN: [
    "view:calendar",
    "view:reservations",
    "create:reservation",
    "modify:reservation",
    "cancel:reservation",
    "manage:spaces",
    "manage:resources",
    "manage:users",
    "view:dashboard",
  ],
  GENERAL: [
    "view:calendar",
    "view:reservations",
    "create:reservation",
    "modify:reservation",
    "cancel:reservation",
  ],
  VISUALIZACION: ["view:calendar"],
};

export function can(user: SessionUser | null, action: PermissionAction): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(action) ?? false;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}

export function canAccessAdminRoutes(user: SessionUser | null): boolean {
  return isAdmin(user);
}
