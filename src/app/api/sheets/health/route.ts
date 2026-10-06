import { NextResponse } from "next/server";
import { testSheetsConnection } from "@/lib/sheets/repository";
import { getActiveUsers } from "@/lib/sheets/users";

export async function GET() {
  const authSecretConfigured = Boolean(process.env.AUTH_SECRET?.trim());
  const googleConfigured = Boolean(
    process.env.GOOGLE_SHEETS_ID?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_PRIVATE_KEY?.trim(),
  );

  const result = await testSheetsConnection();

  let activeUsers: number | undefined;
  let usersLoadError: string | undefined;

  if (result.ok) {
    try {
      activeUsers = (await getActiveUsers()).length;
    } catch (error) {
      usersLoadError =
        error instanceof Error ? error.message : "No se pudieron leer usuarios";
    }
  }

  const payload = {
    ...result,
    authSecretConfigured,
    googleConfigured,
    activeUsers,
    usersLoadError,
    sheetsIdSuffix: process.env.GOOGLE_SHEETS_ID?.trim().slice(-6) ?? null,
  };

  if (!result.ok) {
    return NextResponse.json(payload, { status: 500 });
  }

  return NextResponse.json(payload);
}
