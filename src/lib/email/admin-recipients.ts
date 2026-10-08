import "server-only";
import { z } from "zod";
import { getSheetRowsCanonical } from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { AppUser } from "@/types/user";
import { mapRowToUser } from "@/lib/sheets/users";

const emailSchema = z.string().email();

function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim()).success;
}

function extraRecipientsFromEnv(): string[] {
  const raw = process.env.EMAIL_NOTIFY_ADMINS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => isValidEmail(item));
}

export async function listActiveAdminUsers(): Promise<AppUser[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.USUARIOS);
  const admins: AppUser[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    try {
      const user = mapRowToUser(row);
      if (user.role === "ADMIN" && user.active) {
        admins.push(user);
      }
    } catch (error) {
      console.warn(
        `[email] Fila de usuario ignorada (${row.id ?? "?"}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return admins;
}

export async function getAdminNotificationEmails(): Promise<{
  emails: string[];
  skipped: { id: string; reason: string }[];
}> {
  const admins = await listActiveAdminUsers();
  const emails: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const admin of admins) {
    const email = admin.email?.trim().toLowerCase() ?? "";
    if (!email) {
      skipped.push({
        id: admin.id,
        reason: "sin correo en columna email (revisa hoja Usuarios)",
      });
      continue;
    }
    if (!isValidEmail(email)) {
      skipped.push({
        id: admin.id,
        reason: `correo inválido: ${email}`,
      });
      continue;
    }
    if (!admin.receiveApprovalEmails) {
      skipped.push({
        id: admin.id,
        reason: "notificaciones de autorización desactivadas",
      });
      continue;
    }
    emails.push(email);
  }

  for (const email of extraRecipientsFromEnv()) {
    emails.push(email);
  }

  return {
    emails: [...new Set(emails)],
    skipped,
  };
}
