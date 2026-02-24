
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const CACHE_NAME = 'orin-ai-v13';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

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
    const title = payload.notification?.title || 'Orin AI';
    const options = {
      body: payload.notification?.body || '',
      icon: '/favicon.svg'
    };
    self.registration.showNotification(title, options);
  });
} catch (e) {}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : Promise.resolve()))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' ||
      url.pathname.startsWith('/api') ||
      url.origin.includes('firebase') ||
      url.origin.includes('google') ||
      url.origin.includes('firestore')) {
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }
  if (['script', 'style', 'image', 'font'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((res) => {
          if (res?.status === 200 && res?.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => null);
        return cached || fetched;
      })
    );
  }
});
