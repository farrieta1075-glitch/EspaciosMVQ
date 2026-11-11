import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/** Elimina todas las suscripciones push del usuario (tras rotar VAPID o cambiar de dominio). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const prisma = getPrisma();
  const result = await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    ok: true,
    deleted: result.count,
    hint: "Pulsa «Sincronizar dispositivo» en cada celular.",
  });
}
