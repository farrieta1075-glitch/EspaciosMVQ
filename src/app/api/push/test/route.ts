import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { sendWebPushToUser } from "@/lib/push/send-web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const subscriptions = await getPushSubscriptionsForUser(userId);

  if (subscriptions.length === 0) {
    return NextResponse.json(
      {
        error:
          "No hay dispositivo registrado. Vuelve a tocar «Activar notificaciones».",
        subscriptionCount: 0,
        sent: 0,
        failed: 0,
      },
      { status: 400 },
    );
  }

  const result = await sendWebPushToUser(userId, {
    title: "MVQro Espacios — prueba",
    body: "Si ves este aviso fuera de la app, las notificaciones push están activas.",
    url: "/reservas",
    tag: `push-test-${Date.now()}`,
  });

  return NextResponse.json({
    ok: result.sent > 0,
    subscriptionCount: subscriptions.length,
    ...result,
  });
}
