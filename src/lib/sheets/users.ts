import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  appendSheetRow,
  getSheetRowsCanonical,
  updateSheetRowById,
} from "@/lib/sheets/repository";
import { SHEET_TABS } from "@/lib/sheets/tabs";
import type { AppUser, UserRole } from "@/types/user";

const userRowSchema = z.object({
  id: z.string().min(1),
  email: z.string().optional().default(""),
  username: z.string().optional().default(""),
  passwordHash: z.string().optional().default(""),
  role: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.enum(["ADMIN", "GENERAL", "VISUALIZACION"]),
  ),
  areaId: z.string().optional().default(""),
  active: z
    .string()
    .optional()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
});

export function mapRowToUser(row: Record<string, string>): AppUser {
  const parsed = userRowSchema.parse(row);
  return {
    id: parsed.id,
    email: parsed.email || null,
    username: parsed.username || null,
    passwordHash: parsed.passwordHash?.trim() || null,
    role: parsed.role as UserRole,
    areaId: parsed.areaId || null,
    active: parsed.active,
  };
}

function userToRow(user: AppUser): string[] {
  return [
    user.id,
    user.email ?? "",
    user.username ?? "",
    user.passwordHash ?? "",
    user.role,
    user.areaId ?? "",
    user.active ? "true" : "false",
  ];
}

export async function getAllUserRecords(): Promise<AppUser[]> {
  const { rows } = await getSheetRowsCanonical(SHEET_TABS.USUARIOS);
  const users: AppUser[] = [];

  for (const row of rows) {
    if (!row.id?.trim()) continue;
    const parsed = userRowSchema.safeParse(row);
    if (!parsed.success) {
      console.warn(
        `[sheets] Fila de usuario ignorada (${row.id}):`,
        parsed.error.flatten().fieldErrors,
      );
      continue;
    }
    users.push(mapRowToUser(row));
  }

  return users;
}

export async function getActiveUsers(): Promise<AppUser[]> {
  return (await getAllUserRecords()).filter((user) => user.active);
}

export async function getUserById(id: string): Promise<AppUser | null> {
  return (await getAllUserRecords()).find((user) => user.id === id) ?? null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || null;
}

function normalizeUsername(username: string | null | undefined): string | null {
  const trimmed = username?.trim();
  return trimmed || null;
}

async function assertUniqueCredentials(
  input: { email?: string | null; username?: string | null },
  excludeId?: string,
): Promise<void> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);

  if (!email && !username) {
    throw new Error("Indica al menos un correo o nombre de usuario.");
  }

  const users = await getAllUserRecords();
  for (const user of users) {
    if (excludeId && user.id === excludeId) continue;
    if (email && user.email?.trim().toLowerCase() === email) {
      throw new Error("Ya existe un usuario con ese correo.");
    }
    if (username && user.username?.trim().toLowerCase() === username.toLowerCase()) {
      throw new Error("Ya existe un usuario con ese nombre de usuario.");
    }
  }
}

export async function createUser(input: {
  email?: string | null;
  username?: string | null;
  password: string;
  role: UserRole;
  areaId?: string | null;
  active?: boolean;
}): Promise<AppUser> {
  await assertUniqueCredentials(input);

  const { createId } = await import("@/lib/id");
  const user: AppUser = {
    id: createId("user"),
    email: normalizeEmail(input.email),
    username: normalizeUsername(input.username),
    passwordHash: await bcrypt.hash(input.password, 10),
    role: input.role,
    areaId: input.areaId?.trim() || null,
    active: input.active ?? true,
  };

  await appendSheetRow(SHEET_TABS.USUARIOS, userToRow(user));
  return user;
}

export async function updateUser(
  id: string,
  input: Partial<{
    email: string | null;
    username: string | null;
    password: string;
    role: UserRole;
    areaId: string | null;
    active: boolean;
  }>,
): Promise<AppUser | null> {
  const existing = await getUserById(id);
  if (!existing) return null;

  const nextEmail =
    input.email !== undefined ? normalizeEmail(input.email) : existing.email;
  const nextUsername =
    input.username !== undefined
      ? normalizeUsername(input.username)
      : existing.username;

  await assertUniqueCredentials(
    { email: nextEmail, username: nextUsername },
    id,
  );

  const updated: AppUser = {
    ...existing,
    email: nextEmail,
    username: nextUsername,
    role: input.role ?? existing.role,
    areaId:
      input.areaId !== undefined
        ? input.areaId?.trim() || null
        : existing.areaId,
    active: input.active ?? existing.active,
    passwordHash:
      input.password && input.password.trim()
        ? await bcrypt.hash(input.password, 10)
        : existing.passwordHash,
  };

  const ok = await updateSheetRowById(SHEET_TABS.USUARIOS, id, userToRow(updated));
  return ok ? updated : null;
}

export async function deactivateUser(id: string): Promise<boolean> {
  const updated = await updateUser(id, { active: false });
  return updated !== null;
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  const users = await getActiveUsers();
  return users.filter(
    (user) => user.role === "ADMIN" && user.id !== excludeId,
  ).length;
}
