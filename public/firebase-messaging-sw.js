importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDW7Qr46lj42gd1y2PUi_NigiEH1tjJ2c0",
  authDomain: "yasmin-beauty-diary.firebaseapp.com",
  projectId: "yasmin-beauty-diary",
  messagingSenderId: "90023766755",
  appId: "1:90023766755:web:0390d8df4b00fc58ba73d6",
});

const messaging = firebase.messaging();

const ICON_URL =
  "https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971";

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "התראה";
  const body = payload?.notification?.body || "";

  // ✅ Server sends "route" (not "url")
  const route = payload?.data?.route || "/";

  // ✅ Use a unique tag to avoid overriding unrelated notifications
  const tag =
    payload?.data?.notificationId ||
    payload?.data?.appointmentId ||
    `yasmin-push-${Date.now()}`;

  self.registration.showNotification(title, {
    body,
    icon: ICON_URL,
    badge: ICON_URL,
    data: {
      route,
    },
    tag,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const route =
    (event.notification && event.notification.data && event.notification.data.route) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If there's an open window, focus + navigate it
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
        }
        if ("navigate" in client) {
          return client.navigate(route);
        }
        return;
      }

      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(route);
      }
    })()
  );
});
