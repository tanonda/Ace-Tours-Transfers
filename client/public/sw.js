// Service Worker for Ace Tours & Transfers
// Provides offline caching for basic functionality

const CACHE_NAME = 'ace-tours-v1';
const STATIC_CACHE_URLS = [
    '/',
    '/favicon.png',
    '/manifest.json'
];

// Install event - cache static assets
// FIX: Removed bare self.skipWaiting() here. Activation is now triggered explicitly
// via a 'SKIP_WAITING' message from the page, preventing abrupt context teardown
// that caused "message channel closed" warnings from browser extensions / devtools.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .catch((error) => {
                console.log('Cache add failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Take control of all pages immediately
    self.clients.claim();
});

// FIX: Message handler — responds to SKIP_WAITING requests and always ACKs
// incoming messages so that the browser message channel is never left hanging,
// which was the source of the repeated "message channel closed" console errors.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // Always acknowledge so the channel closes cleanly
    if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ received: true });
    }
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip non-http(s) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If valid response, clone and cache it
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // If no cache match for navigation, return cached home page
                        if (event.request.mode === 'navigate') {
                            return caches.match('/');
                        }
                    });
            })
    );
});
