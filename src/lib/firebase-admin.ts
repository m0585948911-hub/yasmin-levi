import 'server-only';

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App;

if (!getApps().length) {
  // אם יש JSON ב-ENV (לרוב בפיתוח מקומי)
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (json) {
    const serviceAccount = JSON.parse(json);
    adminApp = initializeApp({ credential: cert(serviceAccount) });
    console.log('Initialized Firebase Admin with service account JSON.');
  } else {
    // בפרודקשן (Cloud Run/App Hosting) זה ייקח default credentials
    adminApp = initializeApp();
    console.log('Initialized Firebase Admin with default credentials.');
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb: Firestore = getFirestore(adminApp);
