'use server';

import { getMessaging } from 'firebase-admin/messaging';
import { adminDb } from '@/lib/firebase-admin';

// This helper retrieves all FCM tokens for a given client from Firestore.
async function getTokensForClient(clientId: string): Promise<string[]> {
    const tokensSnapshot = await adminDb
        .collection("clients")
        .doc(clientId)
        .collection("pushTokens")
        .where("enabled", "==", true)
        .get();

    if (tokensSnapshot.empty) {
        return [];
    }
    return tokensSnapshot.docs.map(doc => doc.id).filter(Boolean);
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
      return { ok: true, sent: 0, failed: 0, message: 'Test call successful. No push sent.' };
  }

  const tokens = await getTokensForClient(clientId);

  if (tokens.length === 0) {
    console.warn(`[sendPushToClient] No FCM tokens found for client ${clientId}.`);
    return { ok: true, sent: 0, failed: 0, message: `No tokens found for client ${clientId}.` };
  }

  const uniqueTokens = [...new Set(tokens)];

  const response = await getMessaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: { title, body },
    data: data ?? {},
    apns: {
      payload: { aps: { sound: 'default' } },
    },
    android: {
      notification: { sound: 'default' },
    },
  });
  
  console.log(`[sendPushToClient] Push sent to ${response.successCount} of ${uniqueTokens.length} tokens for client ${clientId}.`);
  
  // Cleanup of invalid tokens
  const batch = adminDb.batch();
  let deletedCount = 0;

  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || "";
      const badToken = uniqueTokens[i];

      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token") ||
        code.includes("invalid-argument")
      ) {
        console.log(`[sendPushToClient] Deleting invalid token: ${badToken}`);
        const ref = adminDb
          .collection("clients")
          .doc(clientId)
          .collection("pushTokens")
          .doc(badToken);
        batch.delete(ref);
        deletedCount++;
      }
    }
  });

  if (deletedCount > 0) {
    await batch.commit();
    console.log(`[sendPushToClient] Deleted ${deletedCount} invalid tokens.`);
  }

  return {
    ok: true,
    sent: response.successCount,
    failed: response.failureCount,
  };
}
