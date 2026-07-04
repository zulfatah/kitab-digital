/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

self.addEventListener('push', function(event) {
  let data = { title: 'Khazanah Digital', body: 'Notifikasi khazanah baru!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Khazanah Digital', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [100, 50, 100],
    tag: data.tag || 'khazanah-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Buka Khazanah' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  let url = '/';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
