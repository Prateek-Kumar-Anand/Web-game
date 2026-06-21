/**
 * IRON SLUG – Asset Loader
 * Loads every sprite, background, tile and UI image
 * and exposes them via window.IMG map.
 */
'use strict';

const ASSET_MANIFEST = {
  // ── Backgrounds ──────────────────────────────────────────────────────────
  bg_sky:    'assets/bg/sky.png',
  bg_layer1: 'assets/bg/layer1.png',
  bg_layer2: 'assets/bg/layer2.png',
  bg_full:   'assets/bg/full.png',

  // ── Tiles ────────────────────────────────────────────────────────────────
  tile_ground:  'assets/tiles/ground.png',
  tile_bldg:    'assets/tiles/buildings.png',
  tile_deco:    'assets/tiles/decoration.png',

  // ── UI ───────────────────────────────────────────────────────────────────
  ui_hp_frame:  'assets/ui/hp_frame.png',
  ui_hp_red:    'assets/ui/hp_red.png',
  ui_hp_yellow: 'assets/ui/hp_yellow.png',
  ui_hp_blue:   'assets/ui/hp_blue.png',

  // ── Biker sprites ─────────────────────────────────────────────────────────
  biker_idle:       'assets/sprites/biker/idle.png',
  biker_run:        'assets/sprites/biker/run.png',
  biker_attack1:    'assets/sprites/biker/attack1.png',
  biker_attack2:    'assets/sprites/biker/attack2.png',
  biker_attack3:    'assets/sprites/biker/attack3.png',
  biker_jump:       'assets/sprites/biker/jump.png',
  biker_death:      'assets/sprites/biker/death.png',
  biker_hurt:       'assets/sprites/biker/hurt.png',
  biker_punch:      'assets/sprites/biker/punch.png',
  biker_run_attack: 'assets/sprites/biker/run_attack.png',
  biker_doublejump: 'assets/sprites/biker/doublejump.png',

  // ── Punk sprites ──────────────────────────────────────────────────────────
  punk_idle:        'assets/sprites/punk/idle.png',
  punk_run:         'assets/sprites/punk/run.png',
  punk_attack1:     'assets/sprites/punk/attack1.png',
  punk_attack2:     'assets/sprites/punk/attack2.png',
  punk_attack3:     'assets/sprites/punk/attack3.png',
  punk_jump:        'assets/sprites/punk/jump.png',
  punk_death:       'assets/sprites/punk/death.png',
  punk_hurt:        'assets/sprites/punk/hurt.png',
  punk_punch:       'assets/sprites/punk/punch.png',
  punk_run_attack:  'assets/sprites/punk/run_attack.png',
  punk_doublejump:  'assets/sprites/punk/doublejump.png',

  // ── Cyborg sprites ────────────────────────────────────────────────────────
  cyborg_idle:       'assets/sprites/cyborg/idle.png',
  cyborg_run:        'assets/sprites/cyborg/run.png',
  cyborg_attack1:    'assets/sprites/cyborg/attack1.png',
  cyborg_attack2:    'assets/sprites/cyborg/attack2.png',
  cyborg_attack3:    'assets/sprites/cyborg/attack3.png',
  cyborg_jump:       'assets/sprites/cyborg/jump.png',
  cyborg_death:      'assets/sprites/cyborg/death.png',
  cyborg_hurt:       'assets/sprites/cyborg/hurt.png',
  cyborg_punch:      'assets/sprites/cyborg/punch.png',
  cyborg_run_attack: 'assets/sprites/cyborg/run_attack.png',
  cyborg_doublejump: 'assets/sprites/cyborg/doublejump.png',

  // ── Boss: Cyprus-Cocopta (Level 1 boss) ─────────────────────────────────────
  boss_cc_idle:   'assets/bosses/cyprus_cocopta/idle.png',
  boss_cc_run:    'assets/bosses/cyprus_cocopta/run.png',
  boss_cc_attack: 'assets/bosses/cyprus_cocopta/attack.png',
  boss_cc_hurt:   'assets/bosses/cyprus_cocopta/hurt.png',
};

// Gun icons 01–40
for (let i = 1; i <= 40; i++) {
  ASSET_MANIFEST[`gun_${String(i).padStart(2,'0')}`] = `assets/guns/${String(i).padStart(2,'0')}.png`;
}

window.IMG = {};
window.ASSETS_READY = false;

window.loadAssets = function(onProgress, onComplete) {
  const keys   = Object.keys(ASSET_MANIFEST);
  const total  = keys.length;
  let   loaded = 0;

  function tick() {
    loaded++;
    const pct = Math.round((loaded / total) * 100);
    if (onProgress) onProgress(pct, loaded, total);
    if (loaded >= total) {
      window.ASSETS_READY = true;
      if (onComplete) onComplete();
    }
  }

  for (const key of keys) {
    const img = new Image();
    img.onload  = tick;
    img.onerror = tick; // don't block on missing optional assets
    img.src = ASSET_MANIFEST[key];
    window.IMG[key] = img;
  }
};
