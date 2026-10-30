"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
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

export function WebPushRegister() {
  const { data: session, status } = useSession();
  const attemptedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (!isWebPushConfigured()) return;
    if (!("Notification" in window) || !("PushManager" in window)) return;

    const userId = session.user.id;
    if (attemptedRef.current === userId) return;
    attemptedRef.current = userId;

    rememberLastLoggedInUserId(userId);

    async function syncSubscription() {
      try {
        const permission =
          Notification.permission === "granted"
            ? "granted"
            : Notification.permission === "denied"
              ? "denied"
              : await Notification.requestPermission();

        if (permission !== "granted") return;

        const registration = await registerPushServiceWorker();
        if (!registration) return;

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
        if (!endpoint || !p256dh || !auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: getOrCreateDeviceId(),
            endpoint,
            keys: { p256dh, auth },
          }),
        });
      } catch (error) {
        console.warn("[web-push] No se pudo registrar la suscripción:", error);
      }
    }

    void syncSubscription();
  }, [session?.user?.id, status]);

  return null;
}
