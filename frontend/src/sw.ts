import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title: string = data.title || 'GlobalSnab';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    tag: data.tag || 'default',
    renotify: true,
    data: { url: data.url || '/' },
  } as any;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url: string = (event.notification.data as any)?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
