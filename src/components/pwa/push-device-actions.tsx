"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { getOrCreateDeviceId } from "@/lib/push/device-id";
import {
  isIosDevice,
  isStandaloneDisplayMode,
  requestWebPushPermissionAndSubscribe,
  syncWebPushSubscription,
} from "@/lib/push/subscribe-web-push";

interface PushDeviceActionsProps {
  userId: string;
  compact?: boolean;
}

export function PushDeviceActions({
  userId,
  compact = false,
}: PushDeviceActionsProps) {
  const [permission, setPermission] =
    React.useState<NotificationPermission>("default");
  const [subscriptionCount, setSubscriptionCount] = React.useState<
    number | null
  >(null);
  const [currentDeviceRegistered, setCurrentDeviceRegistered] = React.useState<
    boolean | null
  >(null);
  const [serverConfigured, setServerConfigured] = React.useState<
    boolean | null
  >(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function refreshStatus() {
    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch(
        `/api/push/status?deviceId=${encodeURIComponent(deviceId)}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        subscriptionCount: number;
        serverConfigured: boolean;
        currentDeviceRegistered?: boolean;
      };
      setSubscriptionCount(data.subscriptionCount);
      setServerConfigured(data.serverConfigured);
      setCurrentDeviceRegistered(data.currentDeviceRegistered ?? null);
    } catch {
      /* ignore */
    }
  }

  React.useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    void refreshStatus();
  }, [userId]);

  async function activate() {
    setBusy(true);
    setMessage(null);
    try {
      const { permission: next, sync } =
        await requestWebPushPermissionAndSubscribe(userId);
      setPermission(next);
      if (sync && !sync.ok) {
        setMessage(sync.error ?? "No se pudo registrar el dispositivo.");
      } else if (sync?.ok) {
        setMessage("Dispositivo registrado correctamente.");
      }
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function resync() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await syncWebPushSubscription(userId);
      if (!result.ok) {
        setMessage(result.error ?? "No se pudo sincronizar.");
      } else {
        setMessage("Suscripción actualizada.");
      }
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        sent?: number;
        failed?: number;
        errors?: { host: string; statusCode?: number; hint: string }[];
      };
      if (!response.ok) {
        setMessage(data.error ?? "No se pudo enviar la prueba.");
        return;
      }
      if (data.sent && data.sent > 0) {
        setMessage(
          isIosDevice()
            ? "Prueba enviada. Cierra o minimiza la app (icono de inicio) y revisa el centro de notificaciones."
            : "Prueba enviada. Minimiza la app y revisa la bandeja del sistema.",
        );
      } else {
        const detail = data.errors?.[0]?.hint;
        setMessage(
          detail ??
            "No llegó al dispositivo. Pulsa «Sincronizar dispositivo» e intenta de nuevo.",
        );
      }
    } catch {
      setMessage("Error de red al enviar la prueba.");
    } finally {
      setBusy(false);
    }
  }

  if (typeof Notification === "undefined") return null;

  return (
    <div
      className={
        compact
          ? "space-y-2 text-sm"
          : "rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"
      }
    >
      {!compact ? (
        <p className="font-medium">Avisos fuera de la app</p>
      ) : null}
      {serverConfigured === false ? (
        <p className="text-xs text-destructive">
          El servidor no tiene claves VAPID (Vercel). Solo funcionan avisos
          dentro de la app.
        </p>
      ) : null}
      {permission === "default" ? (
        <p className="text-xs text-muted-foreground">
          Activa permisos del sistema para recibir solicitudes y recordatorios
          con la app cerrada.
        </p>
      ) : permission === "denied" ? (
        <p className="text-xs text-muted-foreground">
          Permiso bloqueado. En ajustes del teléfono o del navegador, permite
          notificaciones para MVQro Espacios.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {subscriptionCount === null
              ? "Comprobando registro…"
              : currentDeviceRegistered
                ? subscriptionCount > 1
                  ? `Este dispositivo registrado (${subscriptionCount} en total).`
                  : "Este dispositivo registrado en el servidor."
                : subscriptionCount > 0
                  ? "Hay otros dispositivos registrados, pero no este iPhone. Pulsa «Sincronizar dispositivo»."
                  : "Permiso concedido, pero el dispositivo no está registrado en el servidor."}
          </p>
          {isIosDevice() && !isStandaloneDisplayMode() ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              En iPhone, abre la app desde el icono en la pantalla de inicio (no
              desde Safari) para que lleguen las notificaciones push.
            </p>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {permission === "default" ? (
          <Button
            type="button"
            size="sm"
            className="touch-manipulation"
            disabled={busy}
            onClick={() => void activate()}
          >
            {busy ? "Activando…" : "Activar notificaciones"}
          </Button>
        ) : null}
        {permission === "granted" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="touch-manipulation"
              disabled={busy}
              onClick={() => void resync()}
            >
              Sincronizar dispositivo
            </Button>
            <Button
              type="button"
              size="sm"
              className="touch-manipulation"
              disabled={busy || currentDeviceRegistered !== true}
              onClick={() => void sendTest()}
            >
              Enviar prueba
            </Button>
          </>
        ) : null}
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
