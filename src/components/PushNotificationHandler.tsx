'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  PushNotifications,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { registerPushToken } from '@/lib/push';
import { getApp } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

// Helper to get client ID without causing server/client mismatch
function useClientId(): string | null {
  const searchParams = useSearchParams();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get('id');
    if (fromQuery) {
      setClientId(fromQuery);
      return;
    }
    
    try {
      const raw = localStorage.getItem('clientUser');
      if (raw) {
        const obj = JSON.parse(raw);
        setClientId(obj?.id || null);
      }
    } catch {
      setClientId(null);
    }
  }, [searchParams]);

  return clientId;
}


export default function PushNotificationHandler() {
  const router = useRouter();
  const { toast } = useToast();
  const clientId = useClientId();
  const listenersRef = useRef<PluginListenerHandle[]>([]);

  const platform = useMemo(() => Capacitor.getPlatform(), []);

  const log = (...args: any[]) => console.log('[PUSH]', ...args);

  // 1. Register device token on mount when clientId is available
  useEffect(() => {
    if (clientId && (platform === 'web' || platform === 'android' || platform === 'ios')) {
      log(`Client ID found (${clientId}), registering for push notifications on platform: ${platform}`);
      registerPushToken(clientId, 'clients');
    }
  }, [clientId, platform]);

  // 2. Setup listeners for native platforms and web foreground
  useEffect(() => {
    if (platform === 'web') {
        try {
            const app = getApp();
            const messaging = getMessaging(app);
            const unsubscribe = onMessage(messaging, (payload) => {
                log('Foreground message (web):', payload);
                toast({
                    title: payload.notification?.title,
                    description: payload.notification?.body,
                });
            });
            return () => unsubscribe();
        } catch (error) {
            log('Error setting up web foreground listener:', error);
        }
    }
    
    if (platform === 'android' || platform === 'ios') {
      log('Setting up native push listeners...');

      const notificationListener = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          log('Foreground notification (native):', notification);
          toast({
            title: notification.title,
            description: notification.body,
          });
        }
      );

      const actionListener = PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          const route = notification.notification.data?.route;
          log(`Notification action performed. Route: ${route}`);
          if (route) {
            router.push(route);
          }
        }
      );
      
      listenersRef.current.push(notificationListener, actionListener);

      return () => {
        log('Cleaning up native listeners.');
        listenersRef.current.forEach(listener => listener.remove());
        listenersRef.current = [];
      };
    }
  }, [platform, router, toast]);

  // This component doesn't render anything.
  return null;
}
