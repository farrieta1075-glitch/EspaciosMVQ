import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { recordGeneralUserActivity } from "@/lib/activity-log";

const bodySchema = z.object({
  path: z.string().max(512).optional().default(""),
  kind: z.enum(["APP_ACTIVE", "NAVIGATION"]).optional().default("APP_ACTIVE"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let parsed = bodySchema.safeParse({});
  try {
    const json = await request.json();
    parsed = bodySchema.safeParse(json);
  } catch {
    /* body vacío */
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { path, kind } = parsed.data;
  await recordGeneralUserActivity({
    user: session.user,
    action: kind,
    path,
    summary:
      kind === "NAVIGATION"
        ? `Visitó ${path || "una página"}`
        : "Sigue usando la app (sesión abierta)",
  });

  return NextResponse.json({ ok: true });
}
