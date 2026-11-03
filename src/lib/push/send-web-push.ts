import "server-only";
import webpush, { type RequestOptions } from "web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";
import {
  getVapidPrivateKeyFromEnv,
  getVapidPublicKeyFromEnv,
  getVapidServerDiagnostics,
  getVapidSubjectFromEnv,
} from "@/lib/push/vapid-config";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  const subject = getVapidSubjectFromEnv();

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

  // FCM (Android): no usar header `topic` con tags arbitrarios; rompe el envío.
  // El tag de colapso va en el JSON del payload y en showNotification del SW.
  return {
    TTL: 60 * 60 * 24,
    urgency: "high",
  };
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

function appleVapid403Hint(): string {
  const diag = getVapidServerDiagnostics();
  if (!diag.keysMatch) {
    return "iOS rechazó VAPID: la clave privada en Vercel no coincide con NEXT_PUBLIC_VAPID_PUBLIC_KEY. Genera un par (npm run generate:vapid), pon las dos claves en Vercel, redeploy y sincroniza de nuevo.";
  }
  if (!diag.subjectAcceptable) {
    return "iOS rechazó VAPID: falta WEB_PUSH_VAPID_SUBJECT en Vercel. Añade mailto:tu-correo@tudominio.com (correo real), redeploy, luego «Sincronizar dispositivo» en el iPhone.";
  }
  return "iOS rechazó VAPID tras el envío. En Vercel confirma el par de claves y WEB_PUSH_VAPID_SUBJECT, redeploy, sincroniza el iPhone y vuelve a probar con la app en segundo plano.";
}

function userHintForFailure(detail: WebPushDeliveryDetail): string {
  if (detail.platform === "apple") {
    if (detail.statusCode === 403) {
      const base = appleVapid403Hint();
      if (detail.error?.trim()) {
        return `${base} (Apple: ${detail.error.trim()})`;
      }
      return base;
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
