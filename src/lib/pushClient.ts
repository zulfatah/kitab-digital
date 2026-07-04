/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function checkNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported on this browser.');
      return false;
    }

    // Register push service worker
    const registration = await navigator.serviceWorker.register('/push-sw.js', {
      scope: '/'
    });
    
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied.');
      return false;
    }

    // Get VAPID public key from server
    const token = localStorage.getItem('auth_token');
    const keyRes = await fetch('/api/notifications/vapid-public-key');
    if (!keyRes.ok) {
      throw new Error('Failed to retrieve VAPID public key');
    }
    const { publicKey } = await keyRes.json();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // Send subscription details to server
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const subRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscription })
    });

    if (!subRes.ok) {
      throw new Error('Failed to send subscription details to the server');
    }

    console.log('Successfully subscribed to native Web Push Notifications.');
    return true;
  } catch (err) {
    console.error('Error during Web Push subscription flow:', err);
    return false;
  }
}

export async function sendTestPushNotification(): Promise<boolean> {
  try {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers
    });

    return res.ok;
  } catch (err) {
    console.error('Error sending test push:', err);
    return false;
  }
}
