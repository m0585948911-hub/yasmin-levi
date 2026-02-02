
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { registerPushToken } from '@/lib/push';

/**
 * A client-side component that handles registering the user's device for push notifications.
 * It runs after the user has logged in and has a client ID available in the URL.
 */
export default function PushNotificationHandler() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('id');

  useEffect(() => {
    // We only proceed if we have a client ID.
    if (clientId) {
      console.log(`[PushNotificationHandler] Client ID found: ${clientId}. Attempting to register for push notifications.`);
      // We call the registration logic, which handles permissions and token saving.
      registerPushToken(clientId, 'clients').catch(err => {
        // Log errors but don't crash the app. The user might have denied permissions.
        console.error('[PushNotificationHandler] Error during push notification registration:', err);
      });
    } else {
        console.log('[PushNotificationHandler] No client ID found in URL, skipping push registration.');
    }
  }, [clientId]); // The effect runs whenever the client ID changes.

  // This component does not render any UI.
  return null;
}
