"use client";

import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { PushNotifications, Token } from "@capacitor/push-notifications";
import { getApp } from "firebase/app";
import { getMessaging, getToken as getFCMToken } from "firebase/messaging";

async function getWebToken(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[PUSH] Service workers not supported in this browser.");
    return null;
  }
  const swReg =
    (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
    (await navigator.serviceWorker.register("/firebase-messaging-sw.js"));

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    console.warn("[PUSH] Notification permission not granted.");
    return null;
  }
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.error(
      "[PUSH] Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY environment variable."
    );
    return null;
  }
  const app = getApp();
  const messaging = getMessaging(app);
  const token = await getFCMToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });
  if (!token) {
    console.warn("[PUSH] No web FCM token returned from Firebase.");
    return null;
  }
  console.log("🔥 WEB FCM TOKEN 🔥\n" + token);
  return token;
}

function getNativeToken(): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    let regHandler: PluginListenerHandle | null = null;
    let errHandler: PluginListenerHandle | null = null;

    const cleanup = () => {
        regHandler?.remove();
        errHandler?.remove();
    };

    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") {
        cleanup();
        return resolve(null);
      }
      
      regHandler = await PushNotifications.addListener("registration", (token: Token) => {
        console.log("🔥 NATIVE FCM TOKEN 🔥\n" + token.value);
        cleanup();
        resolve(token.value);
      });

      errHandler = await PushNotifications.addListener("registrationError", (err: any) => {
        console.error("Native token registration error:", err);
        cleanup();
        reject(err);
      });

      await PushNotifications.register();
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

export async function registerPushToken(entityId: string, entityType: "clients" | "users") {
  if (!entityId) {
    console.warn("[PUSH] registerPushToken called without an entityId.");
    return;
  }

  const platform = Capacitor.getPlatform();
  const getOrCreateDeviceId = (platform: string) => {
    const key = `push_device_id_${platform}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const newId = `${platform}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    localStorage.setItem(key, newId);
    return newId;
  };
  const deviceId = getOrCreateDeviceId(platform);

  try {
    let token: string | null = null;
    if (platform === "web") {
      token = await getWebToken();
    } else if (platform === "android" || platform === "ios") {
      token = await getNativeToken();
    } else {
      console.log("[PUSH] Push not configured for platform:", platform);
      return;
    }
    
    if (!token) {
        console.warn(`[PUSH] Could not get a push token for platform: ${platform}`);
        localStorage.removeItem(`push_token_registered_${entityType}_${entityId}`);
        return;
    }

    console.log(`[PUSH] ✅ Got token for ${platform}. Saving for ${entityType}/${entityId}`);
    
    const response = await fetch('/api/save-push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            entityId,
            entityType,
            token,
            platform: platform as "web" | "android" | "ios",
            deviceId,
            debug: true
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save push token: ${errorData.error || response.statusText}`);
    }

    localStorage.setItem(`push_token_registered_${entityType}_${entityId}`, 'true');
    console.log(`[PUSH] ✅ Saved ${platform} token successfully.`);

  } catch (err) {
    console.error(`[PUSH] registerPushToken for ${entityType}/${entityId} failed:`, err);
  }
}
