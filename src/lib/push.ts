
'use client';

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { getMessaging, getToken as getFCMToken } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getApp } from 'firebase/app';


async function saveTokenToFirestore(collectionPath: string, token: string) {
    const platform = Capacitor.getPlatform();
    // Use the token as the document ID for easy lookup and to prevent duplicates
    const deviceRef = doc(db, collectionPath, token);
    
    try {
        await setDoc(deviceRef, {
            token,
            platform,
            updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log(`FCM token saved to Firestore at ${collectionPath}`);
    } catch (error) {
        console.error('Error saving FCM token to Firestore:', error);
    }
}


export const registerPushToken = async (entityId: string, entityType: 'clients' | 'users') => {
    const collectionPath = `${entityType}/${entityId}/devices`;
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
        try {
            const app = getApp();
            const messaging = getMessaging(app);
            // Removed explicit vapidKey to rely on the service worker configuration
            const currentToken = await getFCMToken(messaging);
            
            if (currentToken) {
                console.log('Web FCM Token received:', currentToken);
                await saveTokenToFirestore(collectionPath, currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } catch (error: any) {
            if (error.code === 'messaging/permission-blocked') {
                console.warn('Notification permission was denied by the user.');
            } else {
                console.error('An error occurred while retrieving web token.', error);
            }
        }
    } else { // Native platforms
        await PushNotifications.requestPermissions().then(async result => {
            if (result.receive === 'granted') {
                await PushNotifications.register();
            } else {
                console.warn('Push notification permission not granted on native device.');
            }
        });

        // This listener will be triggered when registration is successful
        PushNotifications.addListener('registration', async (token: Token) => {
            console.log('Native Push registration success, token: ', token.value);
            await saveTokenToFirestore(collectionPath, token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
            console.error('Error on native registration: ', JSON.stringify(error));
        });
    }
};
