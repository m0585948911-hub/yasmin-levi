
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

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "התראה";
  self.registration.showNotification(title, {
    body: payload?.notification?.body || "",
    icon: "https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971",
    badge: "https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971",
    data: {
      url: payload?.data?.url || "/",
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ('navigate' in client) {
              (client as any).navigate(url);
            }
            return;
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
