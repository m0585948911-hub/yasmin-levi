"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token } from "@capacitor/push-notifications";
import { getApp } from "firebase/app";
import { getMessaging, getToken as getFCMToken } from "firebase/messaging";
import { savePushTokenAction } from "@/app/actions/savePushTokenAction";

/**
 * Web FCM token
 * - registers/uses firebase-messaging-sw.js
 * - requests notification permission
 * - gets FCM token with VAPID + explicit SW registration
 */
async function getWebToken(): Promise<string> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported in this browser");
  }

  // Register (or reuse) the FCM service worker
  const swReg =
    (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ||
    (await navigator.serviceWorker.register("/firebase-messaging-sw.js"));

  // Request permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Notification permission not granted");
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY");
  }

  const app = getApp();
  const messaging = getMessaging(app);

  const token = await getFCMToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });

  if (!token) {
    throw new Error("No web FCM token returned");
  }

  return token;
}

/**
 * Native (Android/iOS) token via Capacitor PushNotifications
 * - requests permission
 * - registers device
 * - resolves token from 'registration' event
 */
function getNativeToken(): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") {
        return resolve(null);
      }

      const regHandler = (token: Token) => {
        sub1.remove();
        sub2.remove();
        resolve(token.value);
      };

      const errHandler = (err: any) => {
        sub1.remove();
        sub2.remove();
        reject(err);
      };

      const sub1 = await PushNotifications.addListener("registration", regHandler);
      const sub2 = await PushNotifications.addListener("registrationError", errHandler);

      await PushNotifications.register();
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Registers the device for push notifications (web or native)
 * and saves the token via server action to Firestore.
 *
 * Usage:
 *   await registerPushToken(clientId)
 */
export async function registerPushToken(clientId: string) {
  if (!clientId) return;

  const platform = Capacitor.getPlatform();

  try {
    if (platform === "web") {
      const token = await getWebToken();
      await savePushTokenAction({ clientId, token, platform: "web" });
      console.log("Saved web token");
      return;
    }

    if (platform === "android") {
      const token = await getNativeToken();
      if (!token) return;
      await savePushTokenAction({ clientId, token, platform: "android" });
      console.log("Saved android token");
      return;
    }

    // iOS (אם בעתיד תוסיף)
    if (platform === "ios") {
      const token = await getNativeToken();
      if (!token) return;
      await savePushTokenAction({ clientId, token, platform: "ios" });
      console.log("Saved ios token");
      return;
    }

    console.log("Push not configured for platform:", platform);
  } catch (err) {
    console.error("registerPushToken failed:", err);
  }
}
