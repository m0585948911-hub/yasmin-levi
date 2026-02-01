'use server';

import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from '@/lib/firebase-admin';
import type * as admin from 'firebase-admin';

// This helper retrieves all FCM tokens for a given client from Firestore.
async function getTokensForEntity(entityId: string): Promise<string[]> {
    const devicesSnapshot = await adminDb.collection('clients').doc(entityId).collection('devices').get();
    if (devicesSnapshot.empty) {
        return [];
    }
    return devicesSnapshot.docs.map(doc => doc.data().token);
}


/**
 * Sends a push notification to a specific client.
 * This is a server action.
 */
export async function sendPushToClient({
  clientId,
  title,
  body,
  data = {},
}: {
  clientId: string;
  title: string;
  body: string;
  data?: { [key: string]: string };
}) {
  console.log(`[sendPushToClient] Attempting to send push to clientId: ${clientId}`);

  if (!clientId) {
    throw new Error('clientId is required');
  }

  // The user requested a test case with clientId "TEST".
  // This will log that the function was called successfully without actually sending a push.
  if (clientId === "TEST") {
      console.log("[sendPushToClient] This is a TEST client ID. The function was called successfully. No push notification will be sent.");
      return { success: true, message: 'Test call successful. No push sent.' };
  }

  const tokens = await getTokensForEntity(clientId);

  if (tokens.length === 0) {
    console.warn(`[sendPushToClient] No FCM tokens found for client ${clientId}.`);
    return { success: false, message: `No tokens found for client ${clientId}.` };
  }

  const uniqueTokens = [...new Set(tokens)];

  const messagePayload: admin.messaging.MulticastMessage = {
    notification: { title, body },
    data,
    tokens: uniqueTokens,
    apns: {
      payload: { aps: { sound: 'default' } },
    },
    android: {
      notification: { sound: 'default' },
    },
  };

  try {
    const messaging = getMessaging(); // Gets the messaging instance for the default app
    const response = await messaging.sendEachForMulticast(messagePayload);
    
    console.log(`[sendPushToClient] Push sent to ${response.successCount} of ${uniqueTokens.length} tokens for client ${clientId}.`);
    
    if (response.failureCount > 0) {
      console.warn(`[sendPushToClient] ${response.failureCount} messages failed to send.`);
      // In a production app, we would handle cleanup of invalid tokens here.
    }

    return { success: true, response };
  } catch (error) {
    console.error(`[sendPushToClient] Error sending push notification for client ${clientId}:`, error);
    // Re-throwing the error so the client-side catch block can handle it.
    throw error;
  }
}
