'use client';

import { LocalNotifications } from '@capacitor/local-notifications';

export async function testLocalNotification() {
  // חובה באנדרואיד 13+ (Android 33+)
  const perm = await LocalNotifications.requestPermissions();
  console.log('LocalNotifications perm:', perm);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'בדיקת התראה',
        body: 'אם אתה רואה את זה — Local Notifications עובד ✅',
        schedule: { at: new Date(Date.now() + 3000) }, // עוד 3 שניות
      },
    ],
  });
}
