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

  self.registration.showNotification(title, {
    body,
    icon: ICON_URL,
    badge: ICON_URL,
    data: {
      url: payload?.data?.url || "/",
    },
    // אופציונלי: מונע הצפה של התראות כפולות
    tag: payload?.data?.tag || "yasmin-push",
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // אם כבר יש חלון פתוח — נביא אותו לפוקוס וננווט אליו
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
        }
        if ("navigate" in client) {
          return client.navigate(url);
        }
        // אם אין navigate מסיבה כלשהי, לפחות focus
        return;
      }

      // אם אין חלון פתוח — נפתח חדש
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })()
  );
});
