import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/index";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const vapidPublic = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim(),
  );
  const vapidPrivate = Boolean(process.env.VAPID_PRIVATE_KEY?.trim());
  const subscriptions = await getPushSubscriptionsForUser(session.user.id);

  return NextResponse.json({
    serverConfigured: vapidPublic && vapidPrivate,
    vapidPublic,
    vapidPrivate,
    subscriptionCount: subscriptions.length,
    subscriptions: subscriptions.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt,
      endpointHost: (() => {
        try {
          return new URL(item.endpoint).host;
        } catch {
          return "—";
        }
      })(),
    })),
  });
}
