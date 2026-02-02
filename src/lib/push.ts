"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token } from "@capacitor/push-notifications";
import { getApp } from "firebase/app";
import { getMessaging, getToken as getFCMToken } from "firebase/messaging";
import { savePushTokenAction } from "@/app/actions/savePushTokenAction";

async function getWebToken(): Promise<string> {
  // חובה: SW
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  }

  // חובה: Permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("Notification permission not granted");
  }

  const app = getApp();
  const messaging = getMessaging(app);

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
  const token = await getFCMToken(messaging, { vapidKey });

  if (!token) throw new Error("No web FCM token returned");
  return token;
}

function getNativeToken(): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive !== "granted") return resolve(null);

      const onReg = (token: Token) => {
        PushNotifications.removeAllListeners().catch(() => {});
        resolve(token.value);
      };

      const onErr = (err: any) => {
        PushNotifications.removeAllListeners().catch(() => {});
        reject(err);
      };

      PushNotifications.addListener("registration", onReg);
      PushNotifications.addListener("registrationError", onErr);

      await PushNotifications.register();
    } catch (e) {
      reject(e);
    }
  });
}

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

    console.log("Push not configured for platform:", platform);
  } catch (err) {
    console.error("registerPushToken failed:", err);
  }
}
