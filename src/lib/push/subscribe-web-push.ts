import {
  getOrCreateDeviceId,
  rememberLastLoggedInUserId,
} from "@/lib/push/device-id";
import {
  getVapidPublicKey,
  getVapidPublicKeyForSubscription,
  isWebPushConfigured,
  urlBase64ToUint8Array,
} from "@/lib/push/client-config";

const SW_URL = "/sw-push.js";
const VAPID_STORAGE_KEY = "mvqro_vapid_public_key";

export type SyncPushResult = {
  ok: boolean;
  error?: string;
};

async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (error) {
    console.warn("[web-push] No se pudo registrar el service worker:", error);
    return null;
  }
}

async function obtainBrowserPushSubscription(
  registration: ServiceWorkerRegistration,
  options?: { forceRefresh?: boolean },
): Promise<PushSubscription> {
  const vapidKey = await getVapidPublicKeyForSubscription();
  if (!vapidKey) {
    throw new Error("El servidor no tiene clave VAPID pública configurada.");
  }
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);
  const storedVapid = localStorage.getItem(VAPID_STORAGE_KEY);
  const forceRefresh =
    options?.forceRefresh ?? isIosDevice();

  let subscription = await registration.pushManager.getSubscription();

  if (
    subscription &&
    (forceRefresh || (storedVapid && storedVapid !== vapidKey))
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  localStorage.setItem(VAPID_STORAGE_KEY, vapidKey);
  return subscription;
}

export function canUseWebPush(): boolean {
  return (
    isWebPushConfigured() &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    "serviceWorker" in navigator
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** Registra la suscripción push en el servidor (requiere permiso ya concedido). */
export async function syncWebPushSubscription(
  userId: string,
): Promise<SyncPushResult> {
  if (!canUseWebPush()) {
    return { ok: false, error: "Este dispositivo no admite Web Push." };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, error: "Permiso de notificaciones no concedido." };
  }

  rememberLastLoggedInUserId(userId);

  const registration = await registerPushServiceWorker();
  if (!registration) {
    return { ok: false, error: "No se pudo registrar el service worker." };
  }

  await navigator.serviceWorker.ready;

  let subscription: PushSubscription;
  try {
    subscription = await obtainBrowserPushSubscription(registration, {
      forceRefresh: isIosDevice(),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo crear la suscripción push en el navegador.",
    };
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Suscripción incompleta (faltan claves)." };
  }

  let response: Response;
  try {
    response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getOrCreateDeviceId(),
        endpoint,
        keys: { p256dh, auth },
      }),
    });
  } catch {
    return { ok: false, error: "Error de red al registrar el dispositivo." };
  }

  if (!response.ok) {
    let message = "El servidor no guardó la suscripción.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }

  return { ok: true };
}

/** Pide permiso (gesto del usuario) y sincroniza suscripción. */
export async function requestWebPushPermissionAndSubscribe(
  userId: string,
): Promise<{ permission: NotificationPermission; sync: SyncPushResult | null }> {
  if (!canUseWebPush()) {
    return { permission: Notification.permission, sync: null };
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== "granted") {
    return { permission, sync: null };
  }

  const sync = await syncWebPushSubscription(userId);
  return { permission, sync };
}
