importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');

const RAW_VERSION = '%SW_VERSION%';
// In dev, Vite serves public/sw.js directly and the placeholder is not replaced.
// Fallback to a stable "dev" cache name there to avoid churning caches.
const CACHE_NAME = `orin-ai-${RAW_VERSION === '%SW_VERSION%' ? 'dev' : RAW_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg'
];

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
