import "server-only";
import webpush from "web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:soporte@mvqro.local";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendWebPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  },
): Promise<{ sent: number; failed: number }> {
  if (!userId || !ensureVapid()) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await getPushSubscriptionsForUser(userId);
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/reservas",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;

  for (const record of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: record.endpoint,
          keys: {
            p256dh: record.p256dh,
            auth: record.auth,
          },
        },
        body,
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        const { removePushSubscriptionByEndpoint } = await import(
          "@/lib/sheets/push-subscriptions"
        );
        await removePushSubscriptionByEndpoint(record.endpoint).catch(() => {});
      }
      console.warn("[web-push] Error enviando a suscripción:", record.id, error);
    }
  }

  return { sent, failed };
}
