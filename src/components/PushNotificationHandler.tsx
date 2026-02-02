'use client';

import { useEffect, useMemo, useRef } from 'react';
import { registerPushToken } from '@/lib/push';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getMessaging, onMessage } from 'firebase/messaging';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { getApp } from 'firebase/app';

function getClientIdFromLocalStorage(): string | null {
  try {
    const raw = localStorage.getItem('clientUser');
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj?.id || null;
  } catch {
    return null;
  }
}

export default function PushNotificationHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✅ works on web (query param) + native (localStorage)
  const clientId = useMemo(() => {
    const fromQuery = searchParams.get('id');
    if (fromQuery) return fromQuery;
    if (typeof window === 'undefined') return null;
    return getClientIdFromLocalStorage();
  }, [searchParams]);

  // ✅ Register token (web/native) once we have clientId
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!clientId) {
      console.warn('⚠️ Push: no clientId yet (query/localStorage)');
      return;
    }

    const platform = Capacitor.getPlatform();

    // --- WEB: request permission + register token ---
    const registerWeb = async () => {
      if (!('Notification' in window)) return;

      const perm =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();

      if (perm !== 'granted') {
        console.warn('❌ Push(web): permission not granted');
        return;
      }

      await registerPushToken(clientId);
      console.log('✅ Push(web): token saved');
    };

    // --- NATIVE: request permission + register token ---
    const registerNative = async () => {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        console.warn('❌ Push(native): permission not granted');
        return;
      }

      await PushNotifications.register();
      console.log('✅ Push(native): register() called');

      // This uses your existing lib/push.ts path for android/ios
      await registerPushToken(clientId);
      console.log('✅ Push(native): token saved');
    };

    (async () => {
      try {
        if (platform === 'web') await registerWeb();
        else await registerNative();
      } catch (e) {
        console.error('🔥 Push register failed:', e);
      }
    })();
  }, [clientId]);

  // ✅ Foreground listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const platform = Capacitor.getPlatform();

    // --- WEB foreground messages ---
    if (platform === 'web') {
      const app = getApp();
      const messaging = getMessaging(app);

      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground message received (web):', payload);

        toast({
          title: payload.notification?.title,
          description: payload.notification?.body,
        });

        audioRef.current?.play().catch((e) => console.error('Audio play failed', e));
      });

      return () => unsubscribe();
    }

    // --- NATIVE foreground listeners ---
    let receivedHandle: PluginListenerHandle | null = null;
    let actionHandle: PluginListenerHandle | null = null;
    let cancelled = false;

    const setupListeners = async () => {
      try {
        const recHandle = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification: PushNotificationSchema) => {
            console.log('Push received in foreground (native):', notification);

            toast({
              title: notification.title,
              description: notification.body,
            });

            audioRef.current?.play().catch((e) => console.error('Audio play failed', e));
          }
        );

        if (cancelled) {
          recHandle.remove();
          return;
        }
        receivedHandle = recHandle;

        const actHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: ActionPerformed) => {
            console.log('Push action performed (native):', action);

            // be defensive with data access
            const route = (action as any)?.notification?.data?.route;
            if (route) router.push(route);
          }
        );

        if (cancelled) {
          actHandle.remove();
          return;
        }
        actionHandle = actHandle;
      } catch (e) {
        console.error('Failed to add native push listeners', e);
      }
    };

    setupListeners();

    return () => {
      cancelled = true;
      receivedHandle?.remove();
      actionHandle?.remove();
    };
  }, [toast, router]);

  return (
    <audio
      ref={audioRef}
      src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf"
      preload="auto"
    />
  );
}
