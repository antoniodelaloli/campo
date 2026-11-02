// Service worker de Campo: recibe los avisos y abre la app al tocarlos.
// No guarda nada en caché (la app necesita conexión para leer los datos).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }
  const titulo = datos.title || "Campo";
  const opciones = {
    body: datos.body || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: datos.tag || "campo",
    renotify: true,
    // granizo y avisos muy importantes: no se quitan solos y vibran más
    requireInteraction: !!datos.importante,
    vibrate: datos.importante ? [300, 120, 300, 120, 300] : [120, 60, 120],
    data: { url: datos.url || "/calendario" },
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin) {
          await v.focus();
          if ("navigate" in v) return v.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
