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
        await Promise.all(
          registrations.map(async (registration) => {
            const scriptUrl =
              registration.active?.scriptURL ??
              registration.installing?.scriptURL ??
              registration.waiting?.scriptURL ??
              "";
            if (scriptUrl.includes("sw-push.js")) return;
            await registration.unregister();
          }),
        );
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => !key.includes("push"))
            .map((key) => caches.delete(key)),
        );
      }
    }

    void cleanup();
  }, []);

  return null;
}
