
'use client';

import { useEffect, useState } from 'react';
import { getLatestNotification } from '@/lib/notifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SEEN_NOTIFICATION_ID_KEY = 'seenNotificationId';

interface Notification {
  id: string;
  title: string;
  content: string;
  expiresAt: Date;
  createdAt: Date;
}

export function NotificationPopup() {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkNotification = async () => {
      try {
        const lastSeenId = localStorage.getItem(SEEN_NOTIFICATION_ID_KEY);
        const latestNotification = await getLatestNotification(lastSeenId);
        
        if (latestNotification) {
          // The dates from the server action will be strings, so we need to convert them back to Date objects.
          const notificationWithDates = {
              ...latestNotification,
              expiresAt: new Date(latestNotification.expiresAt),
              createdAt: new Date(latestNotification.createdAt),
          };

          setNotification(notificationWithDates);
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Failed to fetch notification:', error);
      }
    };

    checkNotification();
  }, []);

  const handleClose = () => {
    if (notification) {
      localStorage.setItem(SEEN_NOTIFICATION_ID_KEY, notification.id);
    }
    setIsOpen(false);
  };

  if (!notification) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{notification.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {notification.content}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleClose}>אישור</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
