const CACHE = 'noura-v1';
const ASSETS = ['./', './index.html', './config.js', './manifest.json', './Noura.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
