// Minimal service worker: a fetch handler is required for Chrome/Android
// to offer the "install to home screen" prompt, plus push + notification
// click handling for receipt notifications.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// МАҢЫЗДЫ: бұл жерде event.respondWith(fetch(...)) ҚОЛДАНУҒА БОЛМАЙДЫ.
// Ол барлық сұранысты service worker арқылы өткізеді, ал желі сәл
// іркілсе — промис қабылданбай, бет "network error" болып ашылмай қалады
// (онлайн тест беті осыдан ашылмады). Chrome-ға орнатылатын болу үшін
// fetch тыңдаушысының болуы жеткілікті, оның ішіне ештеңе жазудың қажеті жоқ.
self.addEventListener("fetch", () => {
  // Әдейі бос: ешбір сұранысқа араласпаймыз, бәрі браузердің өзі арқылы кетеді.
});

self.addEventListener("push", (event) => {
  let data = { title: "Ziro", body: "Жаңа хабарландыру", url: "/admin/bookings" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads, fall back to defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/admin/bookings";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
