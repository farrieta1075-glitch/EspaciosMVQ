import {
  getOrCreateDeviceId,
  rememberLastLoggedInUserId,
} from "@/lib/push/device-id";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  urlBase64ToUint8Array,
} from "@/lib/push/client-config";

const SW_URL = "/sw-push.js";

async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
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
    // iOS Safari
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** Registra la suscripción push (requiere permiso ya concedido). */
export async function syncWebPushSubscription(userId: string): Promise<boolean> {
  if (!canUseWebPush()) return false;
  if (Notification.permission !== "granted") return false;

  rememberLastLoggedInUserId(userId);

  const registration = await registerPushServiceWorker();
  if (!registration) return false;

  await navigator.serviceWorker.ready;

  const vapidKey = getVapidPublicKey();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      endpoint,
      keys: { p256dh, auth },
    }),
  });

  return response.ok;
}

/** Pide permiso (gesto del usuario) y sincroniza suscripción. */
export async function requestWebPushPermissionAndSubscribe(
  userId: string,
): Promise<NotificationPermission> {
  if (!canUseWebPush()) {
    return Notification.permission;
  }

  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission === "granted") {
    await syncWebPushSubscription(userId);
  }

  return permission;
}
