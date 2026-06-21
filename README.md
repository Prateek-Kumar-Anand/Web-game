# ⚡ IRON SLUG — City Warfare

A retro 2D side-scrolling run-and-gun action game, built with vanilla
HTML5 / CSS3 / JavaScript (Canvas 2D). Works in any modern desktop
browser and is fully playable on Android phones via touch controls.

---

## 📁 Project structure

```
iron-slug-android/
├── index.html              ← entry point, open this file
├── manifest.json           ← PWA manifest (installable on Android)
├── sw.js                   ← service worker (offline play / asset caching)
├── css/
│   └── style.css           ← all UI / HUD / overlay styling
├── js/
│   ├── loader.js           ← asset manifest + image preloader
│   ├── sprite.js           ← Sprite class (frame animation engine)
│   ├── touch.js             ← virtual D-pad + action buttons for mobile
│   └── game.js              ← core game loop, physics, AI, combat
└── assets/
    ├── sprites/
    │   ├── biker/           ← idle, run, attack1-3, jump, death, hurt, punch…
    │   ├── punk/             ← same animation set
    │   └── cyborg/           ← same animation set
    ├── bg/                  ← sky.png, layer1.png, layer2.png, full.png
    ├── tiles/                ← ground.png, buildings.png, decoration.png
    ├── ui/                   ← hp_frame.png, hp_red/yellow/blue.png
    └── guns/                 ← 01.png … 40.png gun icons
```

Every image is loaded from disk by **relative path** — nothing is
base64-embedded — so the project is a normal static site and stays
easy to edit, replace, or extend with new art.

---

## 👾 Enemy types

| Archetype | Sprite | Behavior | Tag shown above HP bar |
|-----------|--------|----------|--------------------------|
| **Brawler** | Punk or Cyborg | Standard chase-and-melee. Cyborg brawlers occasionally take pot-shots with a ranged weapon. | *(none)* |
| **Rusher** | Punk | Fast, relentless, melee-only — closes distance aggressively with almost no pause between charges. Lower HP, hits for less. | ⚡ red |
| **Sniper** | Cyborg | Keeps its distance, backs away if you get close, fires frequently from range. Never melees. Higher alert radius — spot it early! | ◎ blue |

Sniper enemies start appearing from **Stage 2** onward, so the first
stage eases you in with brawlers and rushers only.

---

## 🗺️ Level 1 — Rooftop (complete)

Per the game design doc, every level is split into 3 sub-stages:

| Stage | Name | Mechanic |
|-------|------|----------|
| **1-1** | Rooftop Entry | Basic enemy encounters across 7 platforms. Walk to the glowing **EXIT** gate to clear. |
| **1-2** | Rooftop Crossing | Heavier enemy swarm (rusher/sniper/brawler mix) **plus environmental fall-hazard pits** — 4 gaps in the rooftop, each crossable via a short jump or a helper platform. Falling in costs a life. |
| **1-3** | Boss — Cyprus-Cocopta | Full boss fight. 3 aggression phases based on remaining HP (ranged spread-shot gets wider and faster, melee swipe hits harder). Defeating it clears Level 1 and advances to Level 2. |

Story label cards (e.g. "STAGE 1-2 · ROOFTOP CROSSING") fade in at the start of each stage.

### Boss sizing
Cyprus-Cocopta's sprite sheets are native **96×96px per frame** (2× the hero
pack's 48×48). Since the hero is drawn at 2× scale (→96px on-screen), the
boss is drawn at **1× scale**, landing at exactly **96px tall — identical
height to the player**. Its hitbox (`48w × 96h`) matches the hero's footprint
exactly. See `BOSS_DRAW_SCALE` / `BOSS_FRAME` constants near the top of
`js/game.js` if you want to adjust this later.

Cyprus-Cocopta's asset pack has no death animation, so its defeat uses a
particle-driven sequence instead (multi-stage explosions + fade-out) rather
than a sprite-based death.

### Adding Level 2 / Level 3
Each stage is defined by a small builder function in `js/game.js`
(`buildStage_1_1`, `buildStage_1_2`, `buildStage_1_3`), registered in the
`STAGE_BUILDERS` map by `"level-stage"` key (e.g. `'2-1'`). To add Level 2
(Desert) or Level 3 (Hell), write `buildStage_2_1`, `buildStage_2_2`,
`buildStage_2_3`, etc. following the same pattern, then register them in
`STAGE_BUILDERS`. Until a stage is registered, the game falls back to a
short placeholder corridor labeled "COMING SOON" so nothing crashes.

---

## 📡 Offline play (service worker)

`sw.js` pre-caches the entire app shell and all 87 game assets on
first load. After that, the game works **fully offline** — handy for
mobile data, flights, or spotty Wi-Fi. It registers itself
automatically in `index.html` (only when served over `http://` or
`https://` — service workers don't run from `file://`, which is
already required anyway for asset loading).

To force a cache refresh after you change any asset, bump
`CACHE_NAME` in `sw.js` (e.g. `'iron-slug-v2'`) — the old cache is
cleaned up automatically on the next activate.

---



## ▶️ Run it locally

Browsers block `file://` access to local images for canvas/CORS
reasons, so serve the folder over HTTP. Pick any one:

```bash
# Python (already installed on most systems)
cd iron-slug-android
python3 -m http.server 8080
# then open http://localhost:8080

# Node
npx serve iron-slug-android

# VS Code
# Right-click index.html → "Open with Live Server"
```

---

## 📱 Play on Android

### Option A — Quick test over Wi-Fi
1. Start the local server on your computer (see above).
2. Find your computer's local IP (e.g. `192.168.1.42`).
3. On your Android phone (same Wi-Fi), open Chrome and go to
   `http://192.168.1.42:8080`.
4. Rotate to landscape — the game is built for landscape play.
5. Tap **Add to Home Screen** in Chrome's menu for a full-screen,
   app-like experience (uses `manifest.json`).

### Option B — Host it properly (recommended for sharing)
Upload the entire `iron-slug-android/` folder as-is to any static
host:
- **GitHub Pages** — push the folder to a repo, enable Pages.
- **Netlify / Vercel** — drag-and-drop the folder in their dashboard.
- **Firebase Hosting** — `firebase deploy` after `firebase init`.

Any of these gives you a public HTTPS URL that works identically on
desktop and Android.

### Option C — Wrap as a native Android APK
Once hosted (or even from the local folder), you can wrap it with:
- **PWABuilder** (https://www.pwabuilder.com) — paste your hosted URL,
  it packages a signed APK/AAB using Trusted Web Activity.
- **Capacitor** (`@capacitor/android`) — wraps the static folder
  directly into a native Android Studio project if you want deeper
  native integration later (vibration, notifications, etc).

---

## 🎮 Controls

| Action       | Keyboard          | Touch (mobile)             |
|--------------|-------------------|-----------------------------|
| Move         | ← → / A D         | Left-side virtual D-pad     |
| Jump         | Z / ↑ / W         | JUMP button (blue)          |
| Double-jump  | Jump again in air | Tap JUMP again mid-air      |
| Shoot/Punch  | X                 | ATK button (red)            |
| Crouch       | ↓ / S             | D-pad down                  |
| Special      | C                 | SPL button (yellow)         |

---

## 🛠️ Extending the game

- **Add a new enemy type**: copy the `mkEnemy()` pattern in
  `js/game.js`, point its sprite keys at new files dropped into
  `assets/sprites/<name>/`, then register the keys in
  `js/loader.js`'s `ASSET_MANIFEST`.
- **Add a new level**: tweak `LEVEL_LEN`, `platData`, and enemy spawn
  density inside `setupLevel()` in `js/game.js`.
- **Swap backgrounds**: drop new PNGs into `assets/bg/` and update the
  paths in `ASSET_MANIFEST` (`bg_sky`, `bg_layer1`, `bg_layer2`).
- **New gun pickups**: the `assets/guns/01.png … 40.png` set is
  already loaded — reference any `gun_XX` key in `IMG`.

All sprite sheets are expected to be **horizontal strips of 48×48 px
frames** (matching the current asset pack). If you bring sprites of a
different frame size, just change the `fw`/`fh` arguments when the
`Sprite` objects are constructed in `js/game.js`.

---

## ✅ Performance notes

- All assets are separate PNG files (not embedded base64), so the
  browser caches them individually — repeat visits load instantly.
- Canvas is rendered at a fixed internal resolution (800×450) and
  scaled via CSS, so it stays crisp (`image-rendering: pixelated`) on
  any screen size or pixel density.
- Touch controls are drawn directly on the canvas each frame — no
  extra DOM overlay cost.

Enjoy the fight! 🔥
