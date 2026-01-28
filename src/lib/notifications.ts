

'use server';

import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AllSettings } from './settings-types';
import type { Appointment } from './appointments';
import { getServices, Service } from './services';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  content: string;
  expiresAt: Date;
  createdAt: Date;
}

interface NotificationData {
  id: string;
  title: string;
  content: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}


const notificationsCollection = collection(db, 'notifications');

// Admin action to create a new notification.
export async function createNotification(title: string, content: string, expiresAt: Date) {
  try {
    const newNotification = {
      title,
      content,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.now(),
    };
    await addDoc(notificationsCollection, newNotification);
    console.log('New notification created:', newNotification);
    return { success: true, message: 'ההודעה נשלחה בהצלחה' };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { success: false, error: "שגיאה ביצירת ההודעה."}
  }
}

// Client action to get the latest unseen notification for a user.
export async function getLatestNotification(lastSeenId: string | null): Promise<Notification | null> {
  const now = Timestamp.now();
  
  // Query for the latest notification that hasn't expired.
  const q = query(
    notificationsCollection, 
    where('expiresAt', '>', now),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }
  
  const docSnap = querySnapshot.docs[0];
  const latestNotificationData = docSnap.data() as Omit<NotificationData, 'id'>;

  const latestNotification: Notification = {
    id: docSnap.id,
    title: latestNotificationData.title,
    content: latestNotificationData.content,
    expiresAt: latestNotificationData.expiresAt.toDate(),
    createdAt: latestNotificationData.createdAt.toDate(),
  };

  // Check if user has already seen this notification
  if (latestNotification.id === lastSeenId) {
    return null;
  }

  return latestNotification;
}

export async function getActiveNotifications(): Promise<Notification[]> {
    const now = new Date();
    const q = query(
      notificationsCollection, 
      where('expiresAt', '>', Timestamp.fromDate(now)),
      orderBy('expiresAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<NotificationData, 'id'>;
        return {
            id: doc.id,
            title: data.title,
            content: data.content,
            expiresAt: data.expiresAt.toDate(),
            createdAt: data.createdAt.toDate()
        }
    });
}

export async function deleteNotification(id: string): Promise<{success: boolean}> {
    try {
        await deleteDoc(doc(db, 'notifications', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting notification:", error);
        return { success: false };
    }
}

// This function is now only used for appointment REJECTION, as approval is handled by the cloud function.
export async function sendTemplatedNotification(
  templateKey: 'rejection',
  appointment: Appointment,
  allSettings: AllSettings | null
) {
  if (!allSettings) {
    console.error('Settings not loaded, cannot send notification.');
    return;
  }

  const notificationSetting = allSettings.appointmentNotifications?.[templateKey];

  if (!notificationSetting?.enabled || !notificationSetting?.content) {
    console.log(`Notification for "${templateKey}" is disabled or has no content.`);
    return;
  }

  const template = notificationSetting.content;
  const content = template.replace(/#שם_השירות#/g, appointment.serviceName);
      
  const title = 'התור לא אושר';

  await createNotification(
      title,
      content,
      new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 1 day
  );

  console.log(`Sent notification "${templateKey}" to ${appointment.clientName}`);
}
