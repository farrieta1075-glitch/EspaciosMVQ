import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { upsertPushSubscription } from "@/lib/sheets/push-subscriptions";

export const runtime = "nodejs";

const bodySchema = z.object({
  deviceId: z.string().min(8).max(128),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) {
    return NextResponse.json(
      { error: "Push no configurado en el servidor" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? "";

  const record = await upsertPushSubscription({
    userId: session.user.id,
    deviceId: parsed.data.deviceId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    id: record.id,
    userId: record.userId,
  });
}
