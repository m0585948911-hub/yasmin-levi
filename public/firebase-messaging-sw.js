// This file must be in the public folder.

// Scripts for firebase and firebase messaging
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDW7Qr46lj42gd1y2PUi_NigiEH1tjJ2c0",
  authDomain: "yasmin-beauty-diary.firebaseapp.com",
  projectId: "yasmin-beauty-diary",
  storageBucket: "yasmin-beauty-diary.appspot.com",
  messagingSenderId: "90023766755",
  appId: "1:90023766755:web:0390d8df4b00fc58ba73d6"
};


firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico', // Make sure you have a favicon
    data: payload.data // Pass the data payload to the notification
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  
  event.notification.close();

  const deepLink = event.notification.data.route;
  if (deepLink) {
    event.waitUntil(
      clients.openWindow(deepLink)
    );
  }
});
