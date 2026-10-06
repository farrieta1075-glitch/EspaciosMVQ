"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHeaderSheet } from "@/components/layout/header-sheet-context";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AppNotification } from "@/types/notification";

export function NotificationsBell() {
  const { activeSheet, setSheetOpen } = useHeaderSheet();
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const open = activeSheet === "notifications";

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
      <SheetContent side="right" className="flex h-full w-[min(100%,380px)] flex-col gap-0 p-0">
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <SheetTitle>Notificaciones</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-3">
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllRead}>
              Marcar todas como leídas
            </Button>
          )}
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-lg border p-3 text-sm ${notification.read ? "opacity-70" : "border-primary/30 bg-primary/5"}`}
              >
                <p>{notification.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString("es-MX")}
                </p>
              </div>
            ))
          )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
