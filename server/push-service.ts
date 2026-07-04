/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import webPush from 'web-push';
import fs from 'fs';
import path from 'path';
import { dbService } from './db';

const KEYS_FILE = path.join(process.cwd(), 'data', 'vapid_keys.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys;

// Ensure data folder exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (fs.existsSync(KEYS_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
    console.log('Loaded existing VAPID keys.');
  } catch (e) {
    console.error('Failed to parse VAPID keys, generating new ones.', e);
    const keys = webPush.generateVAPIDKeys();
    vapidKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
  }
} else {
  console.log('No VAPID keys found. Generating new ones...');
  const keys = webPush.generateVAPIDKeys();
  vapidKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  fs.writeFileSync(KEYS_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
}

// Set web-push details
// Using the email from additional metadata or a general default
webPush.setVapidDetails(
  'mailto:muhammadzulfath@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export function getVapidPublicKey() {
  return vapidKeys.publicKey;
}

/**
 * Sends a push notification to a specific database subscription row.
 * Automatically deletes the subscription if the endpoint has expired (404/410 status).
 */
export async function sendNotificationToSubscription(subscription: any, payload: { title: string; body: string; url?: string }) {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth
    }
  };

  try {
    await webPush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true, endpoint: subscription.endpoint };
  } catch (err: any) {
    // If subscription is invalid/expired (Status 410 or 404), remove it from DB
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`Push subscription expired (${err.statusCode}). Pruning endpoint:`, subscription.endpoint);
      await dbService.deletePushSubscription(subscription.endpoint);
    } else {
      console.error('Failed to send push notification to endpoint:', subscription.endpoint, err);
    }
    return { success: false, error: err.message, statusCode: err.statusCode };
  }
}

/**
 * Sends a push notification to all active devices of a user.
 */
export async function sendPushToUser(userEmail: string, payload: { title: string; body: string; url?: string }) {
  try {
    const subscriptions = await dbService.getPushSubscriptions(userEmail);
    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const promises = subscriptions.map(sub => sendNotificationToSubscription(sub, payload));
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;

    return { success: true, sentCount: successful, totalCount: subscriptions.length };
  } catch (err) {
    console.error(`Error sending push to user ${userEmail}:`, err);
    return { success: false, error: err };
  }
}
