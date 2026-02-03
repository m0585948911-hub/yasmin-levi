import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

type Platform = "web" | "android" | "ios";
type EntityType = "clients" | "users";

export async function POST(req: Request) {
  try {
    const body: {
        entityId: string;
        entityType: EntityType;
        token: string;
        platform: Platform;
        deviceId?: string;
        debug?: boolean;
    } = await req.json();

    const { entityId, entityType, token, platform } = body;

    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    if (!platform) return NextResponse.json({ error: "Missing platform" }, { status: 400 });
    if (!entityId) return NextResponse.json({ error: "Missing entityId" }, { status: 400 });
    if (!entityType) return NextResponse.json({ error: "Missing entityType" }, { status: 400 });

    const now = new Date();

    const deviceId =
      body.deviceId ||
      `${platform}-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    if (body.debug || entityId === "NO_CLIENT_ID") {
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

      if (entityType === 'clients') {
          const legacyRef = adminDb
              .collection("clients")
              .doc(entityId)
              .collection("pushTokens")
              .doc(token);

          await legacyRef.set(
              {
                  platform,
                  enabled: true,
                  lastSeenAt: now,
                  createdAt: now,
                  deviceId: deviceId,
              },
              { merge: true }
          );
      }
    }

    return NextResponse.json({ ok: true, deviceId });

  } catch (error) {
    console.error('[API save-push-token] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
