
'use client';

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { getMessaging, getToken as getFCMToken } from "firebase/messaging";
import { getApp } from 'firebase/app';
import { savePushTokenAction } from '@/app/actions/savePushTokenAction';

async function getWebToken(): Promise<string> {
    try {
        const app = getApp();
        const messaging = getMessaging(app);
        // This is the VAPID key from your Firebase project settings
        const vapidKey = "BA_QAdiiYimKiW14NtYSCfj2Bp-fJzWalaswuLOHTONV6ZNp-SFxiVtOdtgcoqMIPCONX1D8-yiDIT5-ogljcGk";
        const currentToken = await getFCMToken(messaging, { vapidKey: vapidKey });
        
        if (currentToken) {
            console.log('Web FCM Token received:', currentToken);
            return currentToken;
        } else {
            throw new Error('No registration token available. Request permission to generate one.');
        }
    } catch (error: any) {
        if (error.code === 'messaging/permission-blocked') {
            console.warn('Notification permission was denied by the user.');
        } else {
            console.error('An error occurred while retrieving web token.', error);
        }
        throw error;
    }
}


function getNativeToken(): Promise<string | null> {
    return new Promise(async (resolve, reject) => {
        try {
            await PushNotifications.requestPermissions().then(async result => {
                if (result.receive === 'granted') {
                    await PushNotifications.register();
                } else {
                    console.warn('Push notification permission not granted on native device.');
                    resolve(null);
                }
            });

            // This listener will be triggered when registration is successful
            PushNotifications.addListener('registration', (token: Token) => {
                console.log('Native Push registration success, token: ', token.value);
                resolve(token.value);
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                console.error('Error on native registration: ', JSON.stringify(error));
                reject(error);
            });
        } catch(e) {
            reject(e);
        }
    });
}


/**
 * Registers the device for push notifications (web or native) and saves the token to Firestore.
 * This should be called after a user logs in and their `clientId` is available.
 */
export async function registerPushToken(clientId: string, entityType: 'clients' | 'users' = 'clients') {
    if (!clientId) {
        console.error("Cannot register push token without a clientId.");
        return;
    }

    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
        try {
            console.log("Registering for web push...");
            const token = await getWebToken();
            if (token) {
                // The action handles saving to the correct collection based on its logic
                await savePushTokenAction({ clientId, token, platform: 'web' });
            }
        } catch (err) {
            console.error('Web push registration failed', err);
        }
    } else { // android or ios
        try {
            console.log(`Registering for native push on ${platform}...`);
            const token = await getNativeToken();
            if (token) {
                await savePushTokenAction({ clientId, token, platform: platform as 'android' | 'ios' });
            }
        } catch (err) {
            console.error('Native push registration failed', err);
        }
    }
}
