// Offline support. Network first, so a new deploy is picked up on the next load and
// the files never mix versions; the cache only answers when there is no connection.
// Online play still needs the network, but the computer opponent works offline.
const CACHE = 'chain-five-v1';
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'game.js',
  'bot.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'cards/BACK.svg',
  ...RANKS.flatMap(rank => SUITS.map(suit => `cards/${rank}_${suit}.svg`)),
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    // no-cache revalidates with the server, so a stale HTTP cache cannot serve old code.
    fetch(request.url, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          // Store without the query, so every invite link shares one cached page.
          const key = new URL(request.url);
          key.search = '';
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(key.href, copy));
        }
        return response;
      })
      // ignoreSearch so an invite link like ?room=abc still opens the cached page offline.
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
