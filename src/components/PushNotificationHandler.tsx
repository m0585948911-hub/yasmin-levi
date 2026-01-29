
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { registerPushToken } from '@/lib/push';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { getMessaging, onMessage } from 'firebase/messaging';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { getApp } from 'firebase/app';


const FCM_PERMISSION_KEY = 'fcm_permission_requested';

export const PushNotificationHandler = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientId = searchParams.get('id');
    const { toast } = useToast();
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const initializePush = useCallback(async () => {
        if(clientId) {
            await registerPushToken(clientId, 'clients');
        }
        localStorage.setItem(FCM_PERMISSION_KEY, 'true');
        setShowPermissionDialog(false);
    }, [clientId]);
  
    useEffect(() => {
        if (!clientId) return;
        
        const permissionRequested = localStorage.getItem(FCM_PERMISSION_KEY);
        if (!permissionRequested) {
            const timer = setTimeout(() => setShowPermissionDialog(true), 5000);
            return () => clearTimeout(timer);
        } else {
            initializePush();
        }
    }, [clientId, initializePush]);

    useEffect(() => {
        if (typeof window === 'undefined' || !clientId) return;

        const platform = Capacitor.getPlatform();

        if (platform === 'web') {
            const app = getApp();
            const messaging = getMessaging(app);
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Foreground message received.', payload);
                toast({
                    title: payload.notification?.title,
                    description: payload.notification?.body,
                });
                audioRef.current?.play().catch(e => console.error("Audio play failed", e));
            });
            return () => unsubscribe();
        } else {
            // Listeners for native platforms
            let receivedHandle: PluginListenerHandle | null = null;
            let actionHandle: PluginListenerHandle | null = null;
            let cancelled = false;

            const setupListeners = async () => {
                try {
                    const recHandle = await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                        console.log('Push received in foreground (native): ', notification);
                        toast({
                            title: notification.title,
                            description: notification.body,
                        });
                        audioRef.current?.play().catch(e => console.error("Audio play failed", e));
                    });

                    if (cancelled) {
                        recHandle.remove();
                        return;
                    }
                    receivedHandle = recHandle;

                    const actHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
                        console.log('Push action performed (native): ', notification);
                        const route = notification.notification.data.route;
                        if (route) {
                            router.push(route);
                        }
                    });

                    if (cancelled) {
                        actHandle.remove();
                        return;
                    }
                    actionHandle = actHandle;

                } catch(e) {
                    console.error("Failed to add push notification listeners", e);
                }
            };

            setupListeners();

            return () => {
                cancelled = true;
                receivedHandle?.remove();
                actionHandle?.remove();
            };
        }
    }, [clientId, toast, router]);
  
    return (
        <>
            <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
            <AlertDialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>רוצה לקבל עדכונים?</AlertDialogTitle>
                        <AlertDialogDescription>
                            כדי שנוכל לשלוח לך תזכורות על תורים ועדכונים חשובים, נשמח לקבל את אישורך לקבלת התראות.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            localStorage.setItem(FCM_PERMISSION_KEY, 'true'); // Don't ask again
                            setShowPermissionDialog(false);
                        }}>אולי בפעם אחרת</AlertDialogCancel>
                        <AlertDialogAction onClick={initializePush}>כן, בטח!</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
        </AlertDialog>
      </>
  );
};
