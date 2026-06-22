'use strict';
/**
 * IRON SLUG – Service Worker v3
 * Caches app shell + all game assets for full offline play after first load.
 * Level 2 desert backgrounds, creatures, and Mini-Mausi boss assets added.
 */

const CACHE_NAME = 'iron-slug-v3';

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
  '/assets/bg_desert/bg1/plan1.png',
  '/assets/bg_desert/bg1/plan2.png',
  '/assets/bg_desert/bg1/plan3.png',
  '/assets/bg_desert/bg1/plan4.png',
  '/assets/bg_desert/bg1/plan5.png',
  '/assets/bg_desert/bg2/plan1.png',
  '/assets/bg_desert/bg2/plan2.png',
  '/assets/bg_desert/bg2/plan3.png',
  '/assets/bg_desert/bg2/plan4.png',
  '/assets/bg_desert/bg2/plan5.png',
  '/assets/bg_desert/bg3/plan1.png',
  '/assets/bg_desert/bg3/plan2.png',
  '/assets/bg_desert/bg3/plan3.png',
  '/assets/bg_desert/bg3/plan4.png',
  '/assets/bg_desert/bg3/plan5.png',
  '/assets/bosses/cyprus_cocopta/attack.png',
  '/assets/bosses/cyprus_cocopta/hurt.png',
  '/assets/bosses/cyprus_cocopta/idle.png',
  '/assets/bosses/cyprus_cocopta/run.png',
  '/assets/bosses/mini_mausi/attack.png',
  '/assets/bosses/mini_mausi/attack1.png',
  '/assets/bosses/mini_mausi/attack2.png',
  '/assets/bosses/mini_mausi/attack3.png',
  '/assets/bosses/mini_mausi/attack4.png',
  '/assets/bosses/mini_mausi/attack5.png',
  '/assets/bosses/mini_mausi/attack_air.png',
  '/assets/bosses/mini_mausi/climb.png',
  '/assets/bosses/mini_mausi/crouch_attack.png',
  '/assets/bosses/mini_mausi/crouch_idle.png',
  '/assets/bosses/mini_mausi/death.png',
  '/assets/bosses/mini_mausi/hanging.png',
  '/assets/bosses/mini_mausi/hurt.png',
  '/assets/bosses/mini_mausi/idle.png',
  '/assets/bosses/mini_mausi/jump.png',
  '/assets/bosses/mini_mausi/pray.png',
  '/assets/bosses/mini_mausi/roll.png',
  '/assets/bosses/mini_mausi/run.png',
  '/assets/bosses/mini_mausi/slide.png',
  '/assets/creatures/demon/attack.png',
  '/assets/creatures/demon/death.png',
  '/assets/creatures/demon/hurt.png',
  '/assets/creatures/demon/idle.png',
  '/assets/creatures/demon/walk.png',
  '/assets/creatures/jinn/attack.png',
  '/assets/creatures/jinn/death.png',
  '/assets/creatures/jinn/flight.png',
  '/assets/creatures/jinn/hurt.png',
  '/assets/creatures/jinn/idle.png',
  '/assets/creatures/jinn/magic_attack.png',
  '/assets/creatures/lizard/attack.png',
  '/assets/creatures/lizard/death.png',
  '/assets/creatures/lizard/hurt.png',
  '/assets/creatures/lizard/idle.png',
  '/assets/creatures/lizard/walk.png',
  '/assets/creatures/medusa/attack.png',
  '/assets/creatures/medusa/death.png',
  '/assets/creatures/medusa/hurt.png',
  '/assets/creatures/medusa/idle.png',
  '/assets/creatures/medusa/stone.png',
  '/assets/creatures/medusa/walk.png',
  '/assets/creatures/small_dragon/attack.png',
  '/assets/creatures/small_dragon/death.png',
  '/assets/creatures/small_dragon/fire_attack.png',
  '/assets/creatures/small_dragon/hurt.png',
  '/assets/creatures/small_dragon/idle.png',
  '/assets/creatures/small_dragon/walk.png',
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
];

const ALL_FILES = [...APP_SHELL, ...GAME_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ALL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

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
        .catch(() => cached);
    })
  );
});
