import "server-only";
import webpush, { type RequestOptions } from "web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || "mailto:soporte@mvqro.local";

  if (!publicKey || !privateKey) {
    console.warn(
      "[web-push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en el servidor.",
    );
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPlatform = "apple" | "fcm" | "mozilla" | "other";

export function pushPlatformFromEndpoint(endpoint: string): PushPlatform {
  if (endpoint.includes("web.push.apple.com")) return "apple";
  if (endpoint.includes("fcm.googleapis.com")) return "fcm";
  if (endpoint.includes("mozilla.com")) return "mozilla";
  return "other";
}

function buildRequestOptions(
  endpoint: string,
  tag?: string,
): RequestOptions {
  const isApple = pushPlatformFromEndpoint(endpoint) === "apple";

  if (isApple) {
    // Apple Push Notification service rechaza varios headers Web Push de FCM/Mozilla.
    return { TTL: 60 * 60 * 24 };
  }

  const options: RequestOptions = {
    TTL: 60 * 60 * 24,
    urgency: "high",
  };
  if (tag) {
    options.topic = tag.slice(0, 32);
  }
  return options;
}

function extractPushError(error: unknown): {
  statusCode?: number;
  message: string;
} {
  const statusCode = (error as { statusCode?: number }).statusCode;
  const body = (error as { body?: string }).body;
  const message =
    typeof body === "string" && body.trim()
      ? body.slice(0, 240)
      : error instanceof Error
        ? error.message
        : "Error desconocido";
  return { statusCode, message };
}

export type WebPushDeliveryDetail = {
  subscriptionId: string;
  platform: PushPlatform;
  endpointHost: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
};

export type WebPushUserError = {
  host: string;
  platform: PushPlatform;
  statusCode?: number;
  hint: string;
};

function userHintForFailure(detail: WebPushDeliveryDetail): string {
  if (detail.platform === "apple") {
    if (detail.statusCode === 403) {
      return "iOS rechazó VAPID. En Vercel usa WEB_PUSH_VAPID_SUBJECT=mailto:correo@tudominio.com y el mismo par de claves VAPID que al activar push.";
    }
    if (detail.statusCode === 410 || detail.statusCode === 404) {
      return "Suscripción iOS expirada. Pulsa «Sincronizar dispositivo» de nuevo.";
    }
    return `iOS (${detail.statusCode ?? "—"}): ${detail.error ?? "error al enviar"}. Minimiza la app e intenta otra vez.`;
  }
  return `${detail.endpointHost}: ${detail.error ?? "error al enviar"}`;
}

export async function sendWebPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  },
  options?: { deviceId?: string },
): Promise<{
  sent: number;
  failed: number;
  details: WebPushDeliveryDetail[];
  errors: WebPushUserError[];
}> {
  const details: WebPushDeliveryDetail[] = [];

  if (!userId) {
    return { sent: 0, failed: 0, details, errors: [] };
  }
  if (!ensureVapid()) {
    console.warn("[web-push] Envío omitido: VAPID no configurado en el servidor.");
    return { sent: 0, failed: 0, details, errors: [] };
  }

  let subscriptions = await getPushSubscriptionsForUser(userId);
  if (options?.deviceId) {
    subscriptions = subscriptions.filter(
      (item) => item.deviceId === options.deviceId,
    );
  }
  if (subscriptions.length === 0) {
    console.info(
      `[web-push] Usuario ${userId} sin dispositivos registrados en PushSubscriptions.`,
    );
    return { sent: 0, failed: 0, details, errors: [] };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/reservas",
    tag: payload.tag ?? "mvqro-notification",
  });

  let sent = 0;
  let failed = 0;

  for (const record of subscriptions) {
    const platform = pushPlatformFromEndpoint(record.endpoint);
    let endpointHost = "—";
    try {
      endpointHost = new URL(record.endpoint).host;
    } catch {
      /* ignore */
    }
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
        buildRequestOptions(record.endpoint, payload.tag),
      );
      sent += 1;
      details.push({
        subscriptionId: record.id,
        platform,
        endpointHost,
        ok: true,
      });
    } catch (error) {
      failed += 1;
      const { statusCode, message } = extractPushError(error);
      details.push({
        subscriptionId: record.id,
        platform,
        endpointHost,
        ok: false,
        statusCode,
        error: message,
      });
      if (statusCode === 404 || statusCode === 410) {
        const { removePushSubscriptionByEndpoint } = await import(
          "@/lib/sheets/push-subscriptions"
        );
        await removePushSubscriptionByEndpoint(record.endpoint).catch(() => {});
      }
      console.warn(
        "[web-push] Error enviando a suscripción:",
        record.id,
        platform,
        statusCode,
        message,
      );
    }
  }

  const errors: WebPushUserError[] = details
    .filter((item) => !item.ok)
    .map((item) => ({
      host: item.endpointHost,
      platform: item.platform,
      statusCode: item.statusCode,
      hint: userHintForFailure(item),
    }));

  return { sent, failed, details, errors };
}
