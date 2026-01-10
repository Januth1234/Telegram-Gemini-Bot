// Firebase Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB5rY4e-_GOkkl4qwDZuvHqwq0_IP9mFmA",
  authDomain: "orin-ai-f6798.firebaseapp.com",
  projectId: "orin-ai-f6798",
  storageBucket: "orin-ai-f6798.firebasestorage.app",
  messagingSenderId: "259788442094",
  appId: "1:259788442094:web:4d946378ca1b4d7349a6ff",
  measurementId: "G-57DHESH4ZJ"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/favicon.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (error) {
  console.log("Service Worker Initialization Error:", error);
}