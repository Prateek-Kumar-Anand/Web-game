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

  // ── Boss: Mini-Mausi-Chreno'bellow (Level 2 boss) ───────────────────────────
  boss_mm_idle:          'assets/bosses/mini_mausi/idle.png',
  boss_mm_run:           'assets/bosses/mini_mausi/run.png',
  boss_mm_hurt:          'assets/bosses/mini_mausi/hurt.png',
  boss_mm_death:         'assets/bosses/mini_mausi/death.png',
  boss_mm_jump:          'assets/bosses/mini_mausi/jump.png',
  boss_mm_roll:          'assets/bosses/mini_mausi/roll.png',
  boss_mm_slide:         'assets/bosses/mini_mausi/slide.png',
  boss_mm_pray:          'assets/bosses/mini_mausi/pray.png',
  boss_mm_crouch_idle:   'assets/bosses/mini_mausi/crouch_idle.png',
  boss_mm_crouch_attack: 'assets/bosses/mini_mausi/crouch_attack.png',
  boss_mm_attack_air:    'assets/bosses/mini_mausi/attack_air.png',
  boss_mm_climb:         'assets/bosses/mini_mausi/climb.png',
  boss_mm_hanging:       'assets/bosses/mini_mausi/hanging.png',
  boss_mm_attack1:       'assets/bosses/mini_mausi/attack1.png',
  boss_mm_attack2:       'assets/bosses/mini_mausi/attack2.png',
  boss_mm_attack3:       'assets/bosses/mini_mausi/attack3.png',
  boss_mm_attack4:       'assets/bosses/mini_mausi/attack4.png',
  boss_mm_attack5:       'assets/bosses/mini_mausi/attack5.png',

  // ── Desert creatures (Level 2 enemies) ──────────────────────────────────────
  lizard_idle:    'assets/creatures/lizard/idle.png',
  lizard_walk:    'assets/creatures/lizard/walk.png',
  lizard_attack:  'assets/creatures/lizard/attack.png',
  lizard_hurt:    'assets/creatures/lizard/hurt.png',
  lizard_death:   'assets/creatures/lizard/death.png',

  small_dragon_idle:        'assets/creatures/small_dragon/idle.png',
  small_dragon_walk:        'assets/creatures/small_dragon/walk.png',
  small_dragon_attack:      'assets/creatures/small_dragon/attack.png',
  small_dragon_fire_attack: 'assets/creatures/small_dragon/fire_attack.png',
  small_dragon_hurt:        'assets/creatures/small_dragon/hurt.png',
  small_dragon_death:       'assets/creatures/small_dragon/death.png',

  demon_idle:   'assets/creatures/demon/idle.png',
  demon_walk:   'assets/creatures/demon/walk.png',
  demon_attack: 'assets/creatures/demon/attack.png',
  demon_hurt:   'assets/creatures/demon/hurt.png',
  demon_death:  'assets/creatures/demon/death.png',

  jinn_idle:         'assets/creatures/jinn/idle.png',
  jinn_flight:        'assets/creatures/jinn/flight.png',
  jinn_attack:        'assets/creatures/jinn/attack.png',
  jinn_magic_attack:  'assets/creatures/jinn/magic_attack.png',
  jinn_hurt:          'assets/creatures/jinn/hurt.png',
  jinn_death:         'assets/creatures/jinn/death.png',

  medusa_idle:   'assets/creatures/medusa/idle.png',
  medusa_walk:   'assets/creatures/medusa/walk.png',
  medusa_attack: 'assets/creatures/medusa/attack.png',
  medusa_stone:  'assets/creatures/medusa/stone.png',
  medusa_hurt:   'assets/creatures/medusa/hurt.png',
  medusa_death:  'assets/creatures/medusa/death.png',

  // ── Desert backgrounds (3 variants, 5 parallax layers each) ─────────────────
  // Layer order back→front: plan5 (sky) < plan4 (clouds) < plan1 (far dunes)
  // < plan3 (mid rocks/dunes) < plan2 (near ground/foliage, front-most)
  desert_bg1_plan1: 'assets/bg_desert/bg1/plan1.png',
  desert_bg1_plan2: 'assets/bg_desert/bg1/plan2.png',
  desert_bg1_plan3: 'assets/bg_desert/bg1/plan3.png',
  desert_bg1_plan4: 'assets/bg_desert/bg1/plan4.png',
  desert_bg1_plan5: 'assets/bg_desert/bg1/plan5.png',

  desert_bg2_plan1: 'assets/bg_desert/bg2/plan1.png',
  desert_bg2_plan2: 'assets/bg_desert/bg2/plan2.png',
  desert_bg2_plan3: 'assets/bg_desert/bg2/plan3.png',
  desert_bg2_plan4: 'assets/bg_desert/bg2/plan4.png',
  desert_bg2_plan5: 'assets/bg_desert/bg2/plan5.png',

  desert_bg3_plan1: 'assets/bg_desert/bg3/plan1.png',
  desert_bg3_plan2: 'assets/bg_desert/bg3/plan2.png',
  desert_bg3_plan3: 'assets/bg_desert/bg3/plan3.png',
  desert_bg3_plan4: 'assets/bg_desert/bg3/plan4.png',
  desert_bg3_plan5: 'assets/bg_desert/bg3/plan5.png',
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
