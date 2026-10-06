"use client";

import * as React from "react";

/**
 * Quita service workers viejos de builds con PWA que cacheaban /api/storage
 * y provocaban errores de memoria en Workbox.
 */
export function ClearLegacyServiceWorker() {
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA === "true") return;

    async function cleanup() {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    }

    void cleanup();
  }, []);

  return null;
}
