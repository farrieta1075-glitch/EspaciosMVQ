"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { syncWebPushSubscription } from "@/lib/push/subscribe-web-push";
import { isWebPushConfigured } from "@/lib/push/client-config";

export function WebPushRegister() {
  const { data: session, status } = useSession();
  const attemptedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (!isWebPushConfigured()) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const userId = session.user.id;
    if (attemptedRef.current === userId) return;
    attemptedRef.current = userId;

    void syncWebPushSubscription(userId).catch((error) => {
      console.warn("[web-push] No se pudo registrar la suscripción:", error);
    });
  }, [session?.user?.id, status]);

  return null;
}
