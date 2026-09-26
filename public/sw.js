// Service Worker for JK Message
// Handles push notifications, notification clicks, background focus, and badge updates on Mobile & Desktop

const CACHE_NAME = 'jk-message-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean old caches if needed
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

// Handle notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickAction = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      // If a window is already open, focus it and post a message
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus().catch(() => {});
          if (notifData.conversationId) {
            client.postMessage({
              type: 'NAVIGATE_CONVERSATION',
              conversationId: notifData.conversationId,
            });
          }
          return;
        }
      }
      // If no window is open (app was closed), open a new one straight into the conversation
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Web Push from the server (server.ts -> src/serverPush.ts).
// Fires even when the app/browser tab is closed or the phone is locked.
self.addEventListener('push', (event) => {
  let data = {
    title: '새 메시지',
    body: '새로운 메시지가 도착했습니다.',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  // Notification mode chosen by the user: 'sound' | 'vibrate' | 'silent'
  const mode = data.mode || 'sound';

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-96.png',
    vibrate: mode === 'silent' ? [] : [200, 100, 200, 100, 200],
    silent: mode === 'silent',
    tag: data.tag || `jk-msg-${Date.now()}`,
    renotify: mode !== 'silent',
    timestamp: Date.now(),
    data: data.data || { url: '/' },
    requireInteraction: false,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // App icon badge (supported on installed PWAs)
      self.navigator && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge().catch(() => {})
        : Promise.resolve(),
    ])
  );
});

// Browser rotated the push subscription: re-register it with the server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint;
      let subscription = event.newSubscription;
      if (!subscription && event.oldSubscription) {
        subscription = await self.registration.pushManager.subscribe(event.oldSubscription.options);
      }
      if (!subscription || !oldEndpoint) return;
      await fetch('/api/push/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldEndpoint, subscription: subscription.toJSON() }),
      });
    })().catch(() => {})
  );
});
