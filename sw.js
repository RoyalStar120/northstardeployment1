const APP_CACHE_NAME = 'northstar-offline-v16';
const TILE_CACHE_NAME = 'northstar-map-tiles';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/seeker-dashboard.html',
  '/helper-dashboard.html',
  '/volunteer-dashboard.html',
  '/resource-map.html',
  '/map.html',
  '/css/app.css',
  '/assets/fonts/material-symbols-outlined-subset.woff2',
  '/companion.html',
  '/progress.html',
  '/css/onboarding.css',
  '/js/ns-boot.js',
  '/js/user-data.js',
  '/js/volunteer-history.js',
  '/js/voice-companion.js',
  '/js/resources-data.js',
  '/js/places.js',
  '/api/job-tips',
  '/js/tailwind-config.js',
  '/js/northstar.js',
  '/js/jobs.js',
  '/js/auth.js',
  '/js/supabase.js',
  '/js/offline-map.js',
  '/assets/static-map-snapshot.png'
];

// Convert lat/lng to OpenStreetMap tile X/Y at zoom Z
function latLngToTileXY(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function generateTileUrlsForBounds(bounds) {
  const urls = [];
  const zooms = [12, 13, 14];
  const subdomains = ['a', 'b', 'c'];

  const latMin = bounds?.latMin ?? 47.55;
  const latMax = bounds?.latMax ?? 47.66;
  const lngMin = bounds?.lngMin ?? -122.38;
  const lngMax = bounds?.lngMax ?? -122.29;

  zooms.forEach((z) => {
    const minTile = latLngToTileXY(latMax, lngMin, z); // top-left
    const maxTile = latLngToTileXY(latMin, lngMax, z); // bottom-right

    for (let x = minTile.x; x <= maxTile.x; x++) {
      for (let y = minTile.y; y <= maxTile.y; y++) {
        const sub = subdomains[(x + y) % subdomains.length];
        urls.push(`https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
        urls.push(`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`);
      }
    }
  });

  return urls;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== APP_CACHE_NAME && key !== TILE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.action === 'cacheMapTiles' || event.data.action === 'cacheMapResources') {
    const bounds = event.data.bounds || { latMin: 47.5, latMax: 47.7, lngMin: -122.4, lngMax: -122.2 };
    const tileUrls = generateTileUrlsForBounds(bounds);

    event.waitUntil(
      Promise.all([
        caches.open(APP_CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {})),
        caches.open(TILE_CACHE_NAME).then(async (tileCache) => {
          // Fetch and cache tiles concurrently in batches
          const batchSize = 8;
          for (let i = 0; i < tileUrls.length; i += batchSize) {
            const batch = tileUrls.slice(i, i + batchSize);
            await Promise.all(
              batch.map((url) =>
                fetch(url, { mode: 'cors' })
                  .then((res) => {
                    if (res && res.ok) {
                      return tileCache.put(url, res);
                    }
                  })
                  .catch(() => {})
              )
            );
          }
        })
      ])
    );
  }
});

// Helper to match tile requests ignoring subdomain differences (a/b/c)
async function matchTileInCache(request) {
  const tileCache = await caches.open(TILE_CACHE_NAME);
  let match = await tileCache.match(request);
  if (match) return match;

  // Try matching across subdomains a, b, c
  const urlStr = request.url;
  for (const sub of ['a', 'b', 'c']) {
    const altUrl = urlStr.replace(/^https:\/\/[abc]\./, `https://${sub}.`);
    match = await tileCache.match(altUrl);
    if (match) return match;
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isMapTile =
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('mapbox.com');

  if (isMapTile) {
    event.respondWith(
      matchTileInCache(event.request).then((cachedTile) => {
        if (cachedTile) {
          return cachedTile;
        }
        return fetch(event.request)
          .then((netRes) => {
            if (netRes && netRes.status === 200) {
              const clone = netRes.clone();
              caches.open(TILE_CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return netRes;
          })
          .catch(() => cachedTile);
      })
    );
    return;
  }

  // Account data and sign-in always go to the network and are never stored here
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/user-data') || url.pathname.startsWith('/api/auth'))) return;

  // App shell and local pages (including map.html?offline=true & resource-map.html?offline=true)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        return (
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(APP_CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => cachedResponse)
        );
      })
    );
  }
});
