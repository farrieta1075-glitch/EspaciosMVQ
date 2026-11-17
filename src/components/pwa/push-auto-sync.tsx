"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { isWebPushConfigured } from "@/lib/push/client-config";
import {
  canUseWebPush,
  isIosDevice,
  isStandaloneDisplayMode,
  syncWebPushSubscription,
} from "@/lib/push/subscribe-web-push";

const LAST_SYNC_KEY = "mvqro_push_last_sync";
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;

function shouldSyncNow(): boolean {
  try {
    const raw = sessionStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at > SYNC_EVERY_MS;
  } catch {
    return true;
  }
}

function markSynced() {
  try {
    sessionStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Registra este dispositivo en el servidor si el permiso ya está concedido. */
export function PushAutoSync() {
  const { data: session, status } = useSession();

  React.useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (!isWebPushConfigured() || !canUseWebPush()) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (isIosDevice() && !isStandaloneDisplayMode()) return;
    if (!shouldSyncNow()) return;

    void syncWebPushSubscription(session.user.id).then((result) => {
      if (result.ok) markSynced();
    });
  }, [session?.user?.id, status]);

  return null;
}
