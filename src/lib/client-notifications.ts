'use client';

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function testLocalNotification() {
  // חשוב: LocalNotifications לא יעבוד ב-web רגיל
  if (Capacitor.getPlatform() === 'web') {
    alert('Local notifications work on native (Android/iOS), not on web preview.');
    return;
  }

  // 1) בקשת הרשאה
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') {
    console.log('Local notifications permission not granted', perm);
    return;
  }

  // 2) יצירת ערוץ (כדי שיופיע "Notification categories" באנדרואיד)
  await LocalNotifications.createChannel({
    id: 'general',
    name: 'General',
    description: 'התראות כלליות',
    importance: 4, // HIGH
  });

  // 3) שליחת התראה
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now(), // כדי שלא יתנגש עם id קיים
        title: 'בדיקה',
        body: 'נשלחה התראה ✅',
        channelId: 'general',
        schedule: { at: new Date(Date.now() + 1500) },
      },
    ],
  });
}
