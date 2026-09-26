// Service Worker for JK Message
// Handles push notifications, notification clicks, background focus, and badge updates on Mobile & Desktop

const CACHE_NAME = 'jk-message-v1';

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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (notifData.conversationId) {
            client.postMessage({
              type: 'NAVIGATE_CONVERSATION',
              conversationId: notifData.conversationId,
            });
          }
          return;
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle push event if Web Push Protocol is triggered from server
self.addEventListener('push', (event) => {
  let data = {
    title: '새 메시지',
    body: '새로운 메시지가 도착했습니다.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || `jk-msg-${Date.now()}`,
    renotify: true,
    data: data.data || { url: '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});
