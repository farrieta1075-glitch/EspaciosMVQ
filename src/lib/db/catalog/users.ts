import "server-only";
import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db/prisma";
import {
  mapDbUser,
  serializeAreaScopeIds,
} from "@/lib/db/catalog/mappers";
import type { AppUser, UserRole } from "@/types/user";

export async function getAllUserRecords(): Promise<AppUser[]> {
  const rows = await getPrisma().user.findMany();
  return rows.map(mapDbUser);
}

export async function getActiveUsers(): Promise<AppUser[]> {
  return (await getAllUserRecords()).filter((user) => user.active);
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const row = await getPrisma().user.findUnique({ where: { id } });
  return row ? mapDbUser(row) : null;
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
  areaScopeIds?: string[];
  active?: boolean;
  receiveApprovalEmails?: boolean;
}): Promise<AppUser> {
  await assertUniqueCredentials(input);
  const { createId } = await import("@/lib/id");
  const row = await getPrisma().user.create({
    data: {
      id: createId("user"),
      email: normalizeEmail(input.email),
      username: normalizeUsername(input.username),
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      areaId: input.areaId?.trim() || null,
      areaScopeIds: serializeAreaScopeIds(input.areaScopeIds ?? []),
      active: input.active ?? true,
      receiveApprovalEmails:
        input.role === "ADMIN" ? (input.receiveApprovalEmails ?? true) : false,
    },
  });
  return mapDbUser(row);
}

export async function updateUser(
  id: string,
  input: Partial<{
    email: string | null;
    username: string | null;
    password: string;
    role: UserRole;
    areaId: string | null;
    areaScopeIds: string[];
    active: boolean;
    receiveApprovalEmails: boolean;
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
  await assertUniqueCredentials({ email: nextEmail, username: nextUsername }, id);
  const role = input.role ?? existing.role;
  const row = await getPrisma().user.update({
    where: { id },
    data: {
      email: nextEmail,
      username: nextUsername,
      role,
      areaId:
        input.areaId !== undefined
          ? input.areaId?.trim() || null
          : existing.areaId,
      areaScopeIds:
        input.areaScopeIds !== undefined
          ? serializeAreaScopeIds(input.areaScopeIds)
          : serializeAreaScopeIds(existing.areaScopeIds ?? []),
      active: input.active ?? existing.active,
      receiveApprovalEmails:
        role === "ADMIN"
          ? (input.receiveApprovalEmails ??
            (existing.role === "ADMIN" ? existing.receiveApprovalEmails : true))
          : false,
      passwordHash:
        input.password && input.password.trim()
          ? await bcrypt.hash(input.password, 10)
          : existing.passwordHash ?? "",
    },
  });
  return mapDbUser(row);
}

export async function deactivateUser(id: string): Promise<boolean> {
  const updated = await updateUser(id, { active: false });
  return updated !== null;
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  return (await getActiveUsers()).filter(
    (user) => user.role === "ADMIN" && user.id !== excludeId,
  ).length;
}
