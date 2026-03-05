import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title: string = data.title || 'GlobalSnab';
  const isIncomingCall = data.type === 'incoming_call' || String(data.tag || '').startsWith('call-');
  const url = data.url || '/';
  const options = {
    body: data.body || '',
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: !!isIncomingCall,
    silent: false,
    vibrate: isIncomingCall ? [200, 80, 200, 80, 200, 300, 200] : undefined,
    actions: isIncomingCall
      ? [
          { action: 'answer', title: 'Ответить' },
          { action: 'decline', title: 'Отклонить' },
        ]
      : undefined,
    data: {
      url,
      type: data.type,
      callId: data.callId,
      fromUserId: data.fromUserId,
      kind: data.kind,
    },
  } as any;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data: any = (event.notification as any)?.data || {};
  const action = (event as any).action;
  const url: string = data?.url || '/';

  // NOTE: In web/PWA we can't auto-accept a call from SW reliably.
  // We route user to the app; call UI will be shown from pending invite.
  if (action === 'decline' && data?.fromUserId && data?.callId) {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          for (const c of clients) {
            (c as any).postMessage({ type: 'call:decline', fromUserId: data.fromUserId, callId: data.callId });
          }
        })
        .catch(() => {})
    );
    return;
  }

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
