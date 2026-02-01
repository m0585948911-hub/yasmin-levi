'use client';

import { LocalNotifications } from '@capacitor/local-notifications';

export async function setupLocalNotifications() {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  // Create a channel (Android)
  await LocalNotifications.createChannel({
    id: 'general',
    name: 'General',
    description: 'התראות כלליות',
    importance: 4, // HIGH
  });
}

export async function testLocalNotification() {
  await setupLocalNotifications();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'בדיקת התראה',
        body: 'Local Notifications עובדים ✅',
        channelId: 'general',
        schedule: { at: new Date(Date.now() + 2_000) },
      },
    ],
  });
}
