'use strict';
/**
 * IRON SLUG – Service Worker
 * Caches the app shell + all game assets so the game works fully
 * offline after the first successful load (handy for Android,
 * spotty connections, or "Add to Home Screen" installs).
 */

const CACHE_NAME = 'iron-slug-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/loader.js',
  '/js/sprite.js',
  '/js/touch.js',
  '/js/game.js',
];

const GAME_ASSETS = [
  '/assets/bg/full.png',
  '/assets/bg/layer1.png',
  '/assets/bg/layer2.png',
  '/assets/bg/sky.png',
  '/assets/guns/01.png',
  '/assets/guns/02.png',
  '/assets/guns/03.png',
  '/assets/guns/04.png',
  '/assets/guns/05.png',
  '/assets/guns/06.png',
  '/assets/guns/07.png',
  '/assets/guns/08.png',
  '/assets/guns/09.png',
  '/assets/guns/10.png',
  '/assets/guns/11.png',
  '/assets/guns/12.png',
  '/assets/guns/13.png',
  '/assets/guns/14.png',
  '/assets/guns/15.png',
  '/assets/guns/16.png',
  '/assets/guns/17.png',
  '/assets/guns/18.png',
  '/assets/guns/19.png',
  '/assets/guns/20.png',
  '/assets/guns/21.png',
  '/assets/guns/22.png',
  '/assets/guns/23.png',
  '/assets/guns/24.png',
  '/assets/guns/25.png',
  '/assets/guns/26.png',
  '/assets/guns/27.png',
  '/assets/guns/28.png',
  '/assets/guns/29.png',
  '/assets/guns/30.png',
  '/assets/guns/31.png',
  '/assets/guns/32.png',
  '/assets/guns/33.png',
  '/assets/guns/34.png',
  '/assets/guns/35.png',
  '/assets/guns/36.png',
  '/assets/guns/37.png',
  '/assets/guns/38.png',
  '/assets/guns/39.png',
  '/assets/guns/40.png',
  '/assets/sprites/biker/attack1.png',
  '/assets/sprites/biker/attack2.png',
  '/assets/sprites/biker/attack3.png',
  '/assets/sprites/biker/climb.png',
  '/assets/sprites/biker/death.png',
  '/assets/sprites/biker/doublejump.png',
  '/assets/sprites/biker/hurt.png',
  '/assets/sprites/biker/idle.png',
  '/assets/sprites/biker/jump.png',
  '/assets/sprites/biker/punch.png',
  '/assets/sprites/biker/run.png',
  '/assets/sprites/biker/run_attack.png',
  '/assets/sprites/cyborg/attack1.png',
  '/assets/sprites/cyborg/attack2.png',
  '/assets/sprites/cyborg/attack3.png',
  '/assets/sprites/cyborg/climb.png',
  '/assets/sprites/cyborg/death.png',
  '/assets/sprites/cyborg/doublejump.png',
  '/assets/sprites/cyborg/hurt.png',
  '/assets/sprites/cyborg/idle.png',
  '/assets/sprites/cyborg/jump.png',
  '/assets/sprites/cyborg/punch.png',
  '/assets/sprites/cyborg/run.png',
  '/assets/sprites/cyborg/run_attack.png',
  '/assets/sprites/punk/attack1.png',
  '/assets/sprites/punk/attack2.png',
  '/assets/sprites/punk/attack3.png',
  '/assets/sprites/punk/climb.png',
  '/assets/sprites/punk/death.png',
  '/assets/sprites/punk/doublejump.png',
  '/assets/sprites/punk/hurt.png',
  '/assets/sprites/punk/idle.png',
  '/assets/sprites/punk/jump.png',
  '/assets/sprites/punk/punch.png',
  '/assets/sprites/punk/run.png',
  '/assets/sprites/punk/run_attack.png',
  '/assets/tiles/buildings.png',
  '/assets/tiles/decoration.png',
  '/assets/tiles/ground.png',
  '/assets/ui/hp_blue.png',
  '/assets/ui/hp_frame.png',
  '/assets/ui/hp_red.png',
  '/assets/ui/hp_yellow.png',
  '/assets/bosses/cyprus_cocopta/idle.png',
  '/assets/bosses/cyprus_cocopta/run.png',
  '/assets/bosses/cyprus_cocopta/attack.png',
  '/assets/bosses/cyprus_cocopta/hurt.png',
];

const ALL_FILES = [...APP_SHELL, ...GAME_ASSETS];

/* ── Install: pre-cache everything ──────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ALL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old cache versions ──────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first, falling back to network, then caching the result ── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline & not cached: just fail gracefully
    })
  );
});
