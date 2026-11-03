"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isWebPushConfigured } from "@/lib/push/client-config";
import {
  canUseWebPush,
  isIosDevice,
  isStandaloneDisplayMode,
} from "@/lib/push/subscribe-web-push";
import { PushDeviceActions } from "@/components/pwa/push-device-actions";

const DISMISS_KEY = "mvqro_push_prompt_dismissed";

export function PushNotificationPrompt() {
  const { data: session, status } = useSession();
  const [permission, setPermission] =
    React.useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (status !== "authenticated" || !session?.user?.id) return null;
  if (!isWebPushConfigured()) return null;
  if (dismissed && permission !== "granted") return null;
  if (permission === "denied") return null;

  const ios = isIosDevice();
  const standalone = isStandaloneDisplayMode();
  const pushReady = canUseWebPush();

  if (permission === "granted" && session.user?.id) {
    return (
      <div className="mb-4">
        <PushDeviceActions userId={session.user.id} />
      </div>
    );
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Activar notificaciones"
      className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Notificaciones en este celular</p>
          {ios && !standalone ? (
            <p className="text-xs text-muted-foreground">
              En iPhone, agrega MVQro Espacios a la pantalla de inicio (Safari →
              Compartir → Añadir a inicio). Luego vuelve aquí y toca activar
              notificaciones.
            </p>
          ) : !pushReady ? (
            <p className="text-xs text-muted-foreground">
              Tu navegador no admite notificaciones push en este dispositivo.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Recibe avisos de reservas y recordatorios directamente en este
              dispositivo.
            </p>
          )}
          {pushReady && (!ios || standalone) && session.user?.id ? (
            <PushDeviceActions userId={session.user.id} compact />
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="touch-manipulation"
              onClick={dismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Ocultar aviso"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
