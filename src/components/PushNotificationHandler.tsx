
'use client';

import { useEffect, useCallback, useRef } from 'react';
import { registerPushToken } from '@/lib/push';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getMessaging, onMessage } from 'firebase/messaging';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { getApp } from 'firebase/app';


export const PushNotificationHandler = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const clientId = searchParams.get('id');
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!clientId) return;

        // The user can grant permission from the settings page.
        // We only try to register if permission is already granted.
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
             registerPushToken(clientId).catch(err => {
                console.error("Failed to register for push notifications:", err);
            });
        }
        
    }, [clientId]);


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
        <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
  );
};
