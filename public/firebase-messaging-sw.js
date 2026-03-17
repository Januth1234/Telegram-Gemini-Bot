importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

try {
  firebase.initializeApp(self.FIREBASE_CONFIG);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Orin AI';
    const options = {
      body: payload.notification?.body || '',
      icon: '/favicon.svg'
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {}
