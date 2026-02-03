import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

type Platform = "web" | "android" | "ios";
type EntityType = "clients" | "users";

function isValidEntityType(v: any): v is EntityType {
  return v === "clients" || v === "users";
}

function isValidPlatform(v: any): v is Platform {
  return v === "web" || v === "android" || v === "ios";
}

function looksLikeFcmToken(token: string) {
  if (!token) return false;
  if (token.length < 50) return false;
  return /^[A-Za-z0-9\-\_:]+$/.test(token);
}

function generateDeviceId(platform: string) {
  return `${platform}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      entityId,
      entityType,
      token,
      platform,
      deviceId: deviceIdRaw,
      debug,
    } = body as {
      entityId?: string;
      entityType?: EntityType;
      token?: string;
      platform?: Platform;
      deviceId?: string;
      debug?: boolean;
    };

    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing entityId" }, { status: 400 });
    }
    if (!isValidEntityType(entityType)) {
      return NextResponse.json({ ok: false, error: "Missing/invalid entityType" }, { status: 400 });
    }
    if (!isValidPlatform(platform)) {
      return NextResponse.json({ ok: false, error: "Missing/invalid platform" }, { status: 400 });
    }
    if (!token || typeof token !== "string") {
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    // Debug mode מאפשר בדיקות עם טוקן "לא אמיתי"
    if (!debug && !looksLikeFcmToken(token)) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
    }

    const deviceId =
      typeof deviceIdRaw === "string" && deviceIdRaw.trim()
        ? deviceIdRaw.trim()
        : generateDeviceId(platform);

    const now = new Date();

    // 1) Debug collection (אופציונלי)
    if (debug) {
      await adminDb.collection("push_debug").doc(deviceId).set(
        {
          token,
          platform,
          entityId,
          entityType,
          deviceId,
          lastSeenAt: now,
          createdAt: now,
        },
        { merge: true }
      );
    }

    // 2) Upsert device under {entityType}/{entityId}/devices/{deviceId}
    await adminDb
      .collection(entityType)
      .doc(entityId)
      .collection("devices")
      .doc(deviceId)
      .set(
        {
          token,
          platform,
          enabled: true,
          deviceId,
          lastSeenAt: now,
          createdAt: now,
        },
        { merge: true }
      );

    // 3) Legacy path by token (אופציונלי)
    if (entityType === "clients") {
      await adminDb
        .collection("clients")
        .doc(entityId)
        .collection("pushTokens")
        .doc(token)
        .set(
          {
            platform,
            enabled: true,
            deviceId,
            lastSeenAt: now,
            createdAt: now,
          },
          { merge: true }
        );
    }

    return NextResponse.json({ ok: true, deviceId });
  } catch (error: any) {
    console.error("[API save-push-token] Error:", error);

    const msg =
      typeof error?.message === "string" ? error.message : "Unknown server error";

    return NextResponse.json(
      { ok: false, error: "Internal Server Error", details: msg },
      { status: 500 }
    );
  }
}
