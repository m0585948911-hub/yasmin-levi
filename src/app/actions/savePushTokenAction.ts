"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

type Platform = "web" | "android" | "ios";
type EntityType = "clients" | "users";

export async function savePushTokenAction(params: {
  entityId: string;
  entityType: EntityType;
  token: string;
  platform: Platform;
  deviceId?: string;
  debug?: boolean;
}) {
  const { entityId, entityType, token, platform } = params;

  if (!token) throw new Error("Missing token");
  if (!platform) throw new Error("Missing platform");
  if (!entityId) throw new Error("Missing entityId");
  if (!entityType) throw new Error("Missing entityType");

  const now = FieldValue.serverTimestamp();

  // ✅ stable-ish device id (server side)
  const deviceId =
    params.deviceId ||
    `${platform}-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  // 1) ✅ ALWAYS: write debug document so you can verify quickly in Firestore
  if (params.debug || entityId === "NO_CLIENT_ID") {
    await adminDb.collection("push_debug").doc(deviceId).set(
      {
        token,
        platform,
        entityId: entityId || null,
        entityType: entityType,
        lastSeenAt: now,
        createdAt: now,
      },
      { merge: true }
    );
  }

  // 2) If we have a real entityId, save in the "official" place:
  //    {entityType}/{entityId}/devices/{deviceId}
  if (entityId && entityId !== "NO_CLIENT_ID") {
    const deviceRef = adminDb
      .collection(entityType)
      .doc(entityId)
      .collection("devices")
      .doc(deviceId);

    await deviceRef.set(
      {
        token,
        platform,
        enabled: true,
        lastSeenAt: now,
        createdAt: now,
      },
      { merge: true }
    );

    // 3) For clients, keep backward-compat with the old `pushTokens` structure for a smoother transition.
    if (entityType === 'clients') {
        const legacyRef = adminDb
            .collection("clients")
            .doc(entityId)
            .collection("pushTokens")
            .doc(deviceId); // Using deviceId as doc ID as per original structure

        await legacyRef.set(
            {
                token,
                platform,
                enabled: true,
                lastSeenAt: now,
                createdAt: now,
            },
            { merge: true }
        );
    }
  }

  return { ok: true, deviceId };
}
