import "server-only";
import webpush, { type RequestOptions } from "web-push";
import { getPushSubscriptionsForUser } from "@/lib/sheets/push-subscriptions";
import {
  getVapidPrivateKeyFromEnv,
  getVapidPublicKeyFromEnv,
  getVapidServerDiagnostics,
  getVapidSubjectFromEnv,
  isVapidSubjectAcceptableForApple,
} from "@/lib/push/vapid-config";

let vapidConfigured = false;
let vapidSubjectBound = "";

function ensureVapid(): boolean {
  const publicKey = getVapidPublicKeyFromEnv();
  const privateKey = getVapidPrivateKeyFromEnv();
  const subject = getVapidSubjectFromEnv();

  if (!publicKey || !privateKey) {
    console.warn(
      "[web-push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY en el servidor.",
    );
    return false;
  }

  if (!isVapidSubjectAcceptableForApple(subject)) {
    console.warn(
      "[web-push] WEB_PUSH_VAPID_SUBJECT no válido para iOS (revisa Dokploy).",
    );
    return false;
  }

  if (vapidConfigured && vapidSubjectBound === subject) return true;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  vapidSubjectBound = subject;
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
    return "iOS rechazó VAPID: la clave privada del servidor no coincide con NEXT_PUBLIC_VAPID_PUBLIC_KEY. Pon el mismo par en Dokploy, haz Rebuild y «Sincronizar dispositivo» en el iPhone.";
  }
  if (!diag.subjectAcceptable) {
    return "iOS rechazó VAPID: falta WEB_PUSH_VAPID_SUBJECT válido en Dokploy. Añade mailto:tu-correo@tudominio.com (correo real) o https://tu-dominio, Rebuild, luego «Sincronizar dispositivo».";
  }
  return "iOS rechazó VAPID (BadJwtToken): la suscripción del iPhone no coincide con el par de claves del servidor. En Dokploy revisa NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (mismo par), haz Rebuild, luego «Sincronizar dispositivo». Si cambiaste de dominio, abre la app desde el subdominio nuevo (no la IP antigua).";
}

function appleVapid403HintForError(detailError?: string): string {
  const base = appleVapid403Hint();
  const err = detailError?.trim() ?? "";
  if (/BadJwtToken/i.test(err)) {
    const diag = getVapidServerDiagnostics();
    if (diag.keysMatch && diag.subjectAcceptable) {
      return "Apple rechazó el token VAPID (BadJwtToken): casi siempre la app del iPhone quedó con una clave antigua o instalada desde el dominio anterior. Pulsa «Sincronizar dispositivo»; si sigue, Rebuild en Dokploy (par VAPID + WEB_PUSH_VAPID_SUBJECT), abre la app solo desde el subdominio nuevo y sincroniza otra vez.";
    }
  }
  return base;
}

function userHintForFailure(detail: WebPushDeliveryDetail): string {
  if (detail.platform === "apple") {
    if (detail.statusCode === 403) {
      const badJwt = /BadJwtToken/i.test(detail.error ?? "");
      if (badJwt) {
        return "Suscripción iOS con clave antigua (se eliminó del servidor). Pulsa «Sincronizar dispositivo» y luego «Probar aviso» otra vez.";
      }
      const base = appleVapid403HintForError(detail.error);
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
    const diag = getVapidServerDiagnostics();
    const hint =
      diag.issues.join(" ") ||
      "VAPID no configurado en el servidor (revisa variables en Dokploy).";
    console.warn("[web-push] Envío omitido:", hint);
    return {
      sent: 0,
      failed: 1,
      details,
      errors: [{ host: "servidor", platform: "apple", hint }],
    };
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
      if (
        statusCode === 404 ||
        statusCode === 410 ||
        (statusCode === 403 && /BadJwtToken/i.test(message))
      ) {
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
