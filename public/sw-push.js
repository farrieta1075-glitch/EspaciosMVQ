/* Service worker mínimo para notificaciones push (sin cache de Workbox). */

self.addEventListener("push", (event) => {
  let payload = {
    title: "MVQro Espacios",
    body: "Tienes una nueva notificación.",
    url: "/reservas",
    tag: "mvqro-notification",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  if (!payload.body?.trim()) {
    payload.body = "Tienes una nueva notificación.";
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || "mvqro-notification",
      icon: "/logo.svg",
      badge: "/logo.svg",
      data: { url: payload.url || "/reservas" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/reservas";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (!client.url.startsWith(self.location.origin)) continue;
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
