"use server";

import { adminDb } from "@/lib/firebase-admin";

type Platform = "web" | "android" | "ios";

export async function savePushTokenAction(params: {
  clientId: string;
  token: string;
  platform: Platform;
}) {
  const { clientId, token, platform } = params;

  if (!clientId) throw new Error("Missing clientId");
  if (!token) throw new Error("Missing token");

  const ref = adminDb
    .collection("clients")
    .doc(clientId)
    .collection("pushTokens")
    .doc(token);

  // Use a transaction to handle the "createdAt" field correctly
  await adminDb.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(ref);
    if (!docSnap.exists) {
      transaction.set(ref, {
        token,
        platform,
        enabled: true,
        lastSeenAt: new Date(),
        createdAt: new Date(),
      });
    } else {
      transaction.update(ref, {
        lastSeenAt: new Date(),
        enabled: true, // Re-enable if it was disabled
      });
    }
  });


  return { ok: true };
}
