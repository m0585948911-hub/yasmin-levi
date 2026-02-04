'use client';

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function testLocalNotification(): Promise<boolean> {
  // לא לרוץ ב-web preview
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    console.log('Local notifications work only on Android/iOS builds.');
    return false;
  }

  // 1) בקשת הרשאה
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') {
    console.log('Permission not granted:', perm);
    return false;
  }

  // 2) יצירת ערוץ (כדי שיופיע "Notification categories" באנדרואיד)
  try {
    await LocalNotifications.createChannel({
      id: 'general',
      name: 'General',
      description: 'התראות כלליות',
      importance: 4, // HIGH
    });
  } catch (e) {
    // אם כבר קיים – אין בעיה
    console.log('createChannel:', e);
  }

  // 3) שליחת התראה
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now(),
        title: 'בדיקת התראה',
        body: 'נשלחה התראה ✅',
        channelId: 'general',
        schedule: { at: new Date(Date.now() + 1500) },
      },
    ],
  });

  return true;
}
