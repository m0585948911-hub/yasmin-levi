
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications, type PushNotification } from "@capacitor/push-notifications";


interface AppNotification {
  id: string;
  title: string;
  content: string;
  actionText?: string;
  actionUrl?: string;
}

const LinkifiedText = ({ text }: { text: string }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <p className="whitespace-pre-wrap text-center">
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 underline hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </p>
    );
};

export function AppointmentListener({ clientId }: { clientId: string }) {
  const [notificationQueue, setNotificationQueue] = useState<AppNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<AppNotification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const seenPushIds = useRef(new Set<string>());

  const addNotificationToQueue = useCallback((notification: AppNotification) => {
    setNotificationQueue(prev => {
        if (prev.some(n => n.id === notification.id)) {
            return prev;
        }
        return [...prev, notification];
    });
  }, []);

  const handlePush = useCallback((push: PushNotification) => {
      const { title, body, data } = push;
      const notificationId = data?.notificationId || data?.appointmentId || `push-${Date.now()}`;

      if (seenPushIds.current.has(notificationId)) {
          console.log(`[Push] Ignoring already seen notification: ${notificationId}`);
          return;
      }
      seenPushIds.current.add(notificationId);
      
      let actionText = "אישור";
      let actionUrl = data?.route || '/dashboard';

      if (actionUrl === '/my-appointments') {
          actionText = "צפה בתורים שלי";
      } else if (actionUrl === '/my-documents') {
          actionText = "צפה במסמכים";
      }

      addNotificationToQueue({
        id: notificationId,
        title: title || 'עדכון חדש',
        content: body || 'קיבלת עדכון חדש.',
        actionText,
        actionUrl
      });
  }, [addNotificationToQueue]);

  useEffect(() => {
    if (!currentNotification && notificationQueue.length > 0) {
      const nextNotification = notificationQueue[0];
      setCurrentNotification(nextNotification);
      setNotificationQueue(prev => prev.slice(1));
      audioRef.current?.play().catch(console.error);
    }
  }, [notificationQueue, currentNotification]);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'web') return;

    let receivedListener: PluginListenerHandle | null = null;
    let actionPerformedListener: PluginListenerHandle | null = null;

    const setupListeners = async () => {
      try {
        await PushNotifications.removeAllListeners();
        
        receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotification) => {
          console.log('Push received in foreground:', notification);
          handlePush(notification);
        });

        actionPerformedListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action performed:', action);
          handlePush(action.notification);
        });
      } catch(e) {
        console.error("Failed to set up push notification listeners", e);
      }
    };

    setupListeners();

    return () => {
      receivedListener?.remove();
      actionPerformedListener?.remove();
    };
  }, [handlePush]);

  const handleAction = () => {
    if (currentNotification?.actionUrl) {
      const params = new URLSearchParams(searchParams.toString());
      router.push(`${currentNotification.actionUrl}?${params.toString()}`);
    }
    setCurrentNotification(null);
  };

  return (
    <>
      <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
      
      <Dialog open={!!currentNotification} onOpenChange={(isOpen) => {
          if (!isOpen) {
              setCurrentNotification(null);
          }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentNotification?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
              <LinkifiedText text={currentNotification?.content || ''} />
          </div>
          <DialogFooter>
            <Button onClick={handleAction}>
              {currentNotification?.actionText || "אישור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
