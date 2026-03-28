const CACHE_NAME = 'lmd-field-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/config.js',
    './js/map.js',
    './js/symbols.js',
    './js/storage.js',
    './js/export.js',
    './assets/pucca.svg',
    './assets/kutcha.svg'
];

// Install Event - Pre-cache core files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Fetch Event - Network first for Map Tiles, Cache first for App Shell
// Fetch Event - Network first for Map Tiles & CDNs, Cache first for App Shell
self.addEventListener('fetch', (event) => {
    // Strategy for Map Tiles and External CDNs (Tailwind, jsPDF)
    if (event.request.url.includes('mt.google.com') || 
        event.request.url.includes('unpkg.com') ||
        event.request.url.includes('cdn.tailwindcss.com') ||
        event.request.url.includes('cdnjs.cloudflare.com')) {
        
        event.respondWith(
            caches.open('lmd-map-tiles').then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
                
                // If not cached, fetch from network and save to cache
                try {
                    const networkResponse = await fetch(event.request);
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (err) {
                    console.error('[Service Worker] External resource network fail.');
                }
            })
        );
        return;
    }

    // Strategy for Local App Files (Cache First)
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== 'lmd-map-tiles') {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});