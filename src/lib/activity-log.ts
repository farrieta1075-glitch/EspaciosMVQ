import "server-only";
import { isSqlDatabaseEnabled } from "@/lib/db/config";
import type { SessionUser, UserRole } from "@/types/user";

export type GeneralUserActivityAction =
  | "LOGIN"
  | "APP_ACTIVE"
  | "NAVIGATION"
  | "CREATE_RESERVATION"
  | "UPDATE_RESERVATION"
  | "CANCEL_RESERVATION";

const ACTION_LABELS: Record<GeneralUserActivityAction, string> = {
  LOGIN: "Inicio de sesión",
  APP_ACTIVE: "Actividad en la app",
  NAVIGATION: "Navegación",
  CREATE_RESERVATION: "Creó reserva",
  UPDATE_RESERVATION: "Modificó reserva",
  CANCEL_RESERVATION: "Canceló reserva",
};

function normalizeRole(role: UserRole | string | undefined): UserRole | null {
  const value = String(role ?? "").trim().toUpperCase();
  if (value === "GENERAL") return "GENERAL";
  return null;
}

function userLabelFromSession(user: {
  email?: string | null;
  name?: string | null;
  id: string;
}): string {
  return (
    user.email?.trim() ||
    user.name?.trim() ||
    user.id
  ).slice(0, 256);
}

export function isGeneralUserRole(role: UserRole | string | undefined): boolean {
  return normalizeRole(role) === "GENERAL";
}

export async function recordGeneralUserActivity(input: {
  user: Pick<SessionUser, "id" | "role" | "areaId" | "email" | "name">;
  action: GeneralUserActivityAction;
  summary?: string;
  path?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!isGeneralUserRole(input.user.role)) return;
  if (!isSqlDatabaseEnabled()) return;

  const { createId } = await import("@/lib/id");
  const { insertUserActivityLogSql } = await import("@/lib/db/activity-logs");

  const summary =
    input.summary?.trim() ||
    ACTION_LABELS[input.action] ||
    input.action;

  try {
    await insertUserActivityLogSql({
      id: createId("log"),
      userId: input.user.id,
      userLabel: userLabelFromSession(input.user),
      areaId: input.user.areaId?.trim() ?? "",
      action: input.action,
      summary: summary.slice(0, 512),
      path: input.path?.trim() ?? "",
      meta: input.meta ? JSON.stringify(input.meta).slice(0, 8000) : "",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(
      "[activity-log] No se pudo registrar actividad:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function activityActionLabel(action: string): string {
  const key = action as GeneralUserActivityAction;
  return ACTION_LABELS[key] ?? action;
}
