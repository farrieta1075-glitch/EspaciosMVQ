"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/types/user";

const ACTIVE_INTERVAL_MS = 15 * 60 * 1000;
const NAV_DEBOUNCE_MS = 45 * 1000;

interface GeneralActivityPingProps {
  user: SessionUser | null;
}

export function GeneralActivityPing({ user }: GeneralActivityPingProps) {
  const pathname = usePathname();
  const lastNavRef = React.useRef("");
  const lastNavAtRef = React.useRef(0);

  React.useEffect(() => {
    if (!user || user.role !== "GENERAL") return;

    function send(kind: "APP_ACTIVE" | "NAVIGATION", path: string) {
      void fetch("/api/activity/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, path }),
        keepalive: true,
      }).catch(() => {});
    }

    send("APP_ACTIVE", pathname);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      send("APP_ACTIVE", pathname);
    }, ACTIVE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [user, pathname]);

  React.useEffect(() => {
    if (!user || user.role !== "GENERAL") return;
    const now = Date.now();
    if (
      lastNavRef.current === pathname &&
      now - lastNavAtRef.current < NAV_DEBOUNCE_MS
    ) {
      return;
    }
    lastNavRef.current = pathname;
    lastNavAtRef.current = now;

    void fetch("/api/activity/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "NAVIGATION", path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [user, pathname]);

  return null;
}
