"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth/permissions";
import { hardNavigate } from "@/lib/hard-navigate";
import { releaseRadixBodyScrollLock } from "@/lib/radix-body-lock";
import { isWebPushConfigured } from "@/lib/push/client-config";
import { PushDeviceActions } from "@/components/pwa/push-device-actions";
import { useHeaderSheet } from "@/components/layout/header-sheet-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AppNotification } from "@/types/notification";

function approvalHref(notification: AppNotification) {
  if (!notification.reservationId) return "/admin/aprobaciones";
  return `/aprobaciones/responder?id=${encodeURIComponent(notification.reservationId)}`;
}

export function NotificationsBell() {
  const { data: session } = useSession();
  const { activeSheet, setSheetOpen } = useHeaderSheet();
  const [notifications, setNotifications] = React.useState<AppNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [decidingKey, setDecidingKey] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const open = activeSheet === "notifications";
  const admin = isAdmin(session?.user ?? null);

  async function loadNotifications() {
    const response = await fetch("/api/notificaciones");
    if (!response.ok) return;
    const data = await response.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  React.useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function markAllRead() {
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    await loadNotifications();
  }

  async function markRead(id: string) {
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function deleteNotification(id: string) {
    setDeletingId(id);
    try {
      await fetch("/api/notificaciones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadNotifications();
    } finally {
      setDeletingId(null);
    }
  }

  async function decide(
    notification: AppNotification,
    action: "approve" | "reject",
  ) {
    if (!notification.reservationId) return;
    setDecidingKey(`${notification.id}:${action}`);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/reservas/${notification.reservationId}/decidir`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo procesar la solicitud.",
        );
        return;
      }
      await markRead(notification.id);
      await loadNotifications();
    } finally {
      setDecidingKey(null);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => setSheetOpen("notifications", nextOpen)}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-[min(100vw,26rem)] flex-col gap-0 p-0 sm:w-[min(92vw,28rem)] lg:w-[28rem]"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <SheetTitle>Notificaciones</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-3">
            {isWebPushConfigured() && session?.user?.id ? (
              <PushDeviceActions userId={session.user.id} compact />
            ) : null}
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAllRead}>
                Marcar todas como leídas
              </Button>
            )}
            {actionError ? (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tienes notificaciones.
              </p>
            ) : (
              notifications.map((notification) => {
                const isApproval = notification.type === "APPROVAL_NEEDED";
                const canDecide =
                  admin && isApproval && Boolean(notification.reservationId);
                const busy = decidingKey?.startsWith(`${notification.id}:`);
                return (
                  <div
                    key={notification.id}
                    className={`rounded-lg border p-3 text-sm ${notification.read ? "opacity-70" : "border-primary/30 bg-primary/5"}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap break-words">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString(
                            "es-MX",
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar notificación"
                        disabled={deletingId === notification.id}
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {canDecide ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(busy)}
                          onClick={() => decide(notification, "approve")}
                        >
                          {decidingKey === `${notification.id}:approve` ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          Autorizar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(busy)}
                          onClick={() => decide(notification, "reject")}
                        >
                          {decidingKey === `${notification.id}:reject` ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : null}
                          Rechazar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void markRead(notification.id);
                            releaseRadixBodyScrollLock();
                            setSheetOpen("notifications", false);
                            hardNavigate(approvalHref(notification));
                          }}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
