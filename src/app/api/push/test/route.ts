import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/index";
import { sendWebPushToUser } from "@/lib/push/send-web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    deviceId: z.string().min(8).max(128).optional(),
  })
  .optional();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  let deviceId: string | undefined;
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (parsed.success && parsed.data?.deviceId) {
      deviceId = parsed.data.deviceId;
    }
  } catch {
    /* body vacío: prueba a todos los dispositivos del usuario */
  }

  const allSubscriptions = await getPushSubscriptionsForUser(userId);
  const targetSubscriptions = deviceId
    ? allSubscriptions.filter((item) => item.deviceId === deviceId)
    : allSubscriptions;

  if (targetSubscriptions.length === 0) {
    return NextResponse.json(
      {
        error: deviceId
          ? "Este dispositivo no está registrado. Pulsa «Sincronizar dispositivo»."
          : "No hay dispositivo registrado. Pulsa «Sincronizar dispositivo».",
        subscriptionCount: allSubscriptions.length,
        sent: 0,
        failed: 0,
        errors: [],
      },
      { status: 400 },
    );
  }

  const result = await sendWebPushToUser(
    userId,
    {
      title: "MVQro Espacios — prueba",
      body: "Si ves este aviso fuera de la app, las notificaciones push están activas.",
      url: "/reservas",
      tag: `push-test-${Date.now()}`,
    },
    { deviceId },
  );

  return NextResponse.json({
    ok: result.sent > 0,
    subscriptionCount: allSubscriptions.length,
    targetCount: targetSubscriptions.length,
    targets: targetSubscriptions.map((item) => ({
      host: (() => {
        try {
          return new URL(item.endpoint).host;
        } catch {
          return "—";
        }
      })(),
    })),
    ...result,
  });
}
