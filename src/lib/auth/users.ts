import "server-only";
import bcrypt from "bcryptjs";
import { getActiveUsers } from "@/lib/sheets/users";
import type { AppUser } from "@/types/user";

export async function getAllUsers(): Promise<AppUser[]> {
  return getActiveUsers();
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await getAllUsers();
  return (
    users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    ) ?? null
  );
}

export async function findUserByUsername(
  username: string,
): Promise<AppUser | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const users = await getAllUsers();
  return (
    users.find(
      (user) => user.username?.trim().toLowerCase() === normalizedUsername,
    ) ?? null
  );
}

export async function verifyUserPassword(
  user: AppUser,
  password: string,
): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export function toSessionUser(user: AppUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.username ?? user.email,
    role: user.role,
    areaId: user.areaId,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
