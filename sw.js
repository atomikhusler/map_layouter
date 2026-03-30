/**
 * MAP LAYOUT DRAFTER - V9 Premium Architecture
 * Service Worker & Offline Cache Manager
 * Fix: Changed to 'var' to satisfy strict global-script linters (Error 2451).
 */

var CACHE_NAME = 'lmd-field-cache-v9'; // CRITICAL: Bumped to V9 to force total system wipe
var ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/config.js',
    './js/map.js',
    './js/symbol.js', 
    './js/storage.js',
    './js/projectManager.js', 
    './js/export.js',
    './logo.png' 
];

// Install Event - Pre-cache core files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching V9 Master App Shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force active immediately
});

// Fetch Event - Network first for Map Tiles & CDNs, Cache first for App Shell
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('mt.google.com') || 
        event.request.url.includes('unpkg.com') ||
        event.request.url.includes('cdn.tailwindcss.com') ||
        event.request.url.includes('cdnjs.cloudflare.com')) {
        
        event.respondWith(
            caches.open('lmd-map-tiles').then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) return cachedResponse;
                
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

// Activate Event - Clean up old buggy caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    // Instantly hunt down and destroy the old V8/V7 caches
                    if (cache !== CACHE_NAME && cache !== 'lmd-map-tiles') {
                        console.log(`[Service Worker] Eradicating obsolete cache: ${cache}`);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); 
        })
    );
});
