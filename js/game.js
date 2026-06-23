'use strict';
/**
 * IRON SLUG – Game Engine
 * Side-scrolling run & gun for Android / mobile browsers.
 *
 * STAGE STRUCTURE (per game_instructions.txt):
 *   Level 1 — Rooftop
 *     1-1: basic enemies, ends at a stop-point, triggers next-stage load
 *     1-2: enemy swarm + narrow ledges / fall-hazard gaps
 *     1-3: boss fight — Cyprus-Cocopta
 *   Level 2 — Desert   (not yet built)
 *   Level 3 — Hell     (not yet built)
 */

/* ── Canvas & constants ───────────────────────────────────────────────────── */
const C   = document.getElementById('gc');
const ctx = C.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = 800, H = 450;
const TILE    = 32;
const GND     = H - 96;       // ground surface Y
const GRAV    = 0.52;
const MAXFALL = 13;
const PIT_DEATH_Y = H + 60;   // falling past this Y = death (used on 1-2 ledges)

/* ── Global state ────────────────────────────────────────────────────────── */
let score = 0, lives = 3, level = 1, stage = 1;
let running = false, gameOver = false;
let camX = 0, targetCamX = 0;
let frameN = 0, shake = 0;
let combo = 0, comboT = 0;
let bossSpawned = false, boss = null;
let selectedChar = 'biker';
let stageClearedPending = false;
let killCount = 0;            // used by stages with a kill-gate (e.g. future 2-2)

const keys  = {};                          // keyboard
const VK    = () => window.VKEYS || {};    // virtual (touch) keys

/* ── Input helpers ───────────────────────────────────────────────────────── */
const K = {
  left:    () => keys['ArrowLeft']  || keys['KeyA'] || VK().left,
  right:   () => keys['ArrowRight'] || keys['KeyD'] || VK().right,
  up:      () => keys['ArrowUp']    || keys['KeyW'] || keys['KeyZ'] || VK().up || VK().jump,
  down:    () => keys['ArrowDown']  || keys['KeyS'] || VK().down,
  attack:  () => keys['KeyX'] || VK().attack,
  special: () => keys['KeyC'] || VK().special,
};

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

/* ── Sprite helper (from sprite.js) ─────────────────────────────────────── */
function spr(key, fw, fh, fc, fps = 8, loop = true) {
  return new window.Sprite(key, fw, fh, fc, fps, loop);
}

/* ── Character definitions ───────────────────────────────────────────────── */
const CHAR_DEF = {
  biker: {
    name: 'BIKER', speed: 2.5, jump: 11.5, hp: 120, atk: 22, col: '#e8a030',
    spr: {
      idle:       spr('biker_idle',       48, 48, 4, 6),
      run:        spr('biker_run',        48, 48, 6, 10),
      attack:     spr('biker_attack1',    48, 48, 6, 14),
      attack2:    spr('biker_run_attack', 48, 48, 6, 14),
      jump:       spr('biker_jump',       48, 48, 4, 8),
      djump:      spr('biker_doublejump', 48, 48, 6, 10),
      hurt:       spr('biker_hurt',       48, 48, 2, 8,  false),
      death:      spr('biker_death',      48, 48, 6, 6,  false),
      punch:      spr('biker_punch',      48, 48, 6, 12),
    },
  },
  punk: {
    name: 'PUNK', speed: 2.9, jump: 12.5, hp: 95, atk: 18, col: '#e040e8',
    spr: {
      idle:       spr('punk_idle',        48, 48, 4, 6),
      run:        spr('punk_run',         48, 48, 6, 10),
      attack:     spr('punk_attack1',     48, 48, 6, 14),
      attack2:    spr('punk_run_attack',  48, 48, 6, 14),
      jump:       spr('punk_jump',        48, 48, 4, 8),
      djump:      spr('punk_doublejump',  48, 48, 6, 10),
      hurt:       spr('punk_hurt',        48, 48, 2, 8,  false),
      death:      spr('punk_death',       48, 48, 6, 6,  false),
      punch:      spr('punk_punch',       48, 48, 6, 12),
    },
  },
  cyborg: {
    name: 'CYBORG', speed: 2.1, jump: 10.5, hp: 160, atk: 30, col: '#40e8c0',
    spr: {
      idle:       spr('cyborg_idle',       48, 48, 4, 6),
      run:        spr('cyborg_run',        48, 48, 6, 10),
      attack:     spr('cyborg_attack1',    48, 48, 6, 14),
      attack2:    spr('cyborg_attack2',    48, 48, 8, 14),
      jump:       spr('cyborg_jump',       48, 48, 4, 8),
      djump:      spr('cyborg_doublejump', 48, 48, 6, 10),
      hurt:       spr('cyborg_hurt',       48, 48, 2, 8,  false),
      death:      spr('cyborg_death',      48, 48, 6, 6,  false),
      punch:      spr('cyborg_attack3',    48, 48, 8, 12),
    },
  },
};

/* ── Entity pools ────────────────────────────────────────────────────────── */
let player    = null;
const enemies   = [];
const bullets   = [];
const particles = [];
const pickups   = [];
const platforms = [];
const pits      = [];   // fall-hazard gaps, used in stage 1-2

/* ── Player factory ──────────────────────────────────────────────────────── */
function mkPlayer(cid) {
  const def = CHAR_DEF[cid];
  const sp = {};
  for (const [k, v] of Object.entries(def.spr)) sp[k] = v.clone();
  return {
    x: 120, y: GND - 96, w: 48, h: 96,
    vx: 0, vy: 0,
    face: 1,
    cid, def, spr: sp,
    state: 'idle',
    hp: def.hp, maxHp: def.hp,
    ammo: 30, maxAmmo: 30,
    inv: 0,
    atkCd: 0, atkTimer: 0, atkDmgDone: false, attacking: false, special: false, specialCd: 0,
    onGnd: false,
    jumped: false, djumped: false,
    crouching: false, djumpTimer: 0,
    shootCd: 0,
    gunIdx: 1,
    fallingToDeath: false,
    petrified: 0, // frames remaining; while >0, player cannot move/jump/shoot
  };
}

/* ── Enemy factory ───────────────────────────────────────────────────────── */
/**
 * Enemy archetypes (controlled by `archetype`, independent of sprite `type`):
 *  - 'brawler' : default melee chaser (punk or cyborg sprite)
 *  - 'rusher'  : punk sprite, faster, no ranged attack, charges relentlessly
 *  - 'sniper'  : cyborg sprite, keeps distance, shoots more often, flees if too close
 */
function mkEnemy(x, type, archetype) {
  const isPunk = type === 'punk';
  const cid    = isPunk ? 'punk' : 'cyborg';
  archetype = archetype || 'brawler';

  let hp, alertR, shootAmmo, speed;
  if (archetype === 'rusher') {
    hp = 35 + level * 8; alertR = 280; shootAmmo = 0; speed = 2.3;
  } else if (archetype === 'sniper') {
    hp = 60 + level * 14; alertR = 360; shootAmmo = 20; speed = 0.7;
  } else { // brawler
    hp = isPunk ? (55 + level * 12) : (90 + level * 20);
    alertR = isPunk ? 240 : 310; shootAmmo = isPunk ? 0 : 8; speed = isPunk ? 1.5 : 1.1;
  }

  const sp = {
    idle:   spr(cid + '_idle',    48, 48, 4, 6),
    run:    spr(cid + '_run',     48, 48, 6, 10),
    attack: spr(cid + '_attack1', 48, 48, 6, 12),
    hurt:   spr(cid + '_hurt',    48, 48, 2, 8, false),
    death:  spr(cid + '_death',   48, 48, 6, 6, false),
  };
  return {
    x, y: GND - 96, w: 48, h: 96,
    vx: 0, vy: 0,
    face: -1, cid, type, archetype, spr: sp,
    state: 'idle', curSpr: sp.idle,
    hp, maxHp: hp,
    alert: false, alertR,
    alive: true, dying: false,
    hitF: 0,
    atkCd: 40 + Math.random() * 30,
    atkTimer: 0, atkDone: false,
    aiT: 0, moveDir: 0,
    shootAmmo,
    speed,
    onGnd: false,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   DESERT CREATURES — Level 2 enemies
   ────────────────────────────────────────────────────────────────────────── 
   Unlike the human enemy packs (uniform 48x48 frames), each creature's art
   has a different native canvas size and the character only fills part of
   that canvas. CREATURE_CFG below was derived by measuring each creature's
   actual non-transparent content against its canvas, then computing a draw
   scale so creatures read at sensible *relative* sizes next to the 96px-tall
   hero (small_dragon/lizard = small grunts, demon = human-sized threat,
   jinn = floating medium humanoid, medusa = medium serpent-bodied). The
   hitbox is sized to the visible character, not the padded canvas, so combat
   feels fair. `footInset` is the measured transparent gap between the
   character's feet and the bottom edge of its (body-anim) canvas — without
   it, bottom-aligning the padded canvas to the ground leaves the visible
   character floating above the floor. */
const CREATURE_CFG = {
  lizard:       { canvas: 256, scale: 1.111, hbW: 70, hbH: 60, archetype: 'rusher',  hasRanged: false,            footInset: 99 },
  small_dragon: { canvas: 128, scale: 1.486, hbW: 80, hbH: 55, archetype: 'rusher',  hasRanged: 'fire_attack',    footInset: 46 },
  demon:        { canvas: 256, scale: 0.978, hbW: 56, hbH: 90, archetype: 'brawler', hasRanged: false,            footInset: 69 },
  jinn:         { canvas: 128, scale: 1.039, hbW: 40, hbH: 80, archetype: 'sniper',  hasRanged: 'magic_attack',   footInset: 16 },
  medusa:       { canvas: 128, scale: 1.190, hbW: 50, hbH: 75, archetype: 'medusa',  hasRanged: false,            footInset: 30 },
};

/** Creature animation sets — keys map to loader.js asset names via
 *  `${creature}_${anim}`. Frame counts/sizes come from creature_manifest. */
const CREATURE_ANIMS = {
  lizard:       { idle: [3,256], walk: [6,256], attack: [5,256], hurt: [2,256], death: [6,256] },
  small_dragon: { idle: [3,128], walk: [4,128], attack: [3,128], fire_attack: [9,64], hurt: [2,128], death: [4,128] },
  demon:        { idle: [3,256], walk: [6,256], attack: [4,256], hurt: [2,256], death: [6,256] },
  jinn:         { idle: [3,128], flight: [4,128], attack: [4,128], magic_attack: [13,256], hurt: [2,128], death: [6,128] },
  medusa:       { idle: [3,128], walk: [4,128], attack: [6,128], stone: [8,128], hurt: [2,128], death: [6,128] },
};

function mkCreature(x, kind) {
  const cfg = CREATURE_CFG[kind];
  const animsDef = CREATURE_ANIMS[kind];
  const sp = {};
  for (const [animName, [fc, fw]] of Object.entries(animsDef)) {
    const fps = animName === 'idle' ? 6 : animName.includes('attack') || animName === 'stone' ? 12 : 10;
    const loop = !(animName.includes('attack') || animName === 'hurt' || animName === 'death' || animName === 'stone');
    sp[animName] = spr(`${kind}_${animName}`, fw, fw, fc, fps, loop);
  }
  // Normalize movement anim key: some creatures use 'walk', jinn uses 'flight'
  const moveKey = sp.walk ? 'walk' : (sp.flight ? 'flight' : 'idle');

  let hp, alertR, speed;
  if (cfg.archetype === 'rusher') { hp = 30 + level * 10; alertR = 260; speed = 2.0; }
  else if (cfg.archetype === 'sniper') { hp = 50 + level * 12; alertR = 340; speed = 0.8; }
  else if (cfg.archetype === 'medusa') { hp = 70 + level * 16; alertR = 280; speed = 1.0; }
  else { hp = 70 + level * 16; alertR = 240; speed = 1.2; } // brawler

  return {
    isCreature: true, kind, cfg, moveKey,
    x, y: GND - cfg.hbH, w: cfg.hbW, h: cfg.hbH,
    canvasSize: cfg.canvas, scale: cfg.scale,
    vx: 0, vy: 0,
    face: -1, archetype: cfg.archetype, spr: sp,
    state: 'idle', curSpr: sp.idle,
    hp, maxHp: hp,
    alert: false, alertR,
    alive: true, dying: false,
    hitF: 0,
    atkCd: 40 + Math.random() * 30,
    atkTimer: 0, atkDone: false,
    aiT: 0, moveDir: 0,
    rangedCd: 0,
    speed,
    onGnd: false,
    // Medusa petrify mechanic
    stoneCharging: false, stoneTimer: 0,
  };
}

/** 1-1: Basic enemies, ends at a stop-point (a clear "gate" the player walks
 *       into, triggers the next-stage loading transition). */
function buildStage_1_1() {
  const LEN = 2600;
  const platData = [
    [300,  GND - 72, 128], [620,  GND - 64, 112], [940,  GND - 80, 128],
    [1300, GND - 68,  96], [1620, GND - 80, 128], [1940, GND - 60, 112],
    [2260, GND - 76, 128],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 24 });

  const spawnPts = [420, 700, 980, 1260, 1540, 1820, 2080, 2340];
  for (const x of spawnPts) {
    const archetype = Math.random() < 0.25 ? 'rusher' : 'brawler';
    enemies.push(mkEnemy(x, Math.random() < 0.55 ? 'punk' : 'cyborg', archetype));
  }

  return {
    len: LEN,
    type: 'gate',
    gateX: LEN - 140,
    label: 'STAGE 1-1 · ROOFTOP ENTRY',
  };
}

/** 1-2: Enemy swarm + narrow ledges with fall-hazard gaps. "Easy but tricky" —
 *       the danger is positioning near pits while enemies push you, not raw
 *       enemy difficulty. */
function buildStage_1_2() {
  const LEN = 3000;

  const groundSegments = [
    [0,    520],
    [620,  1050],
    [1160, 1620],
    [1740, 2150],
    [2260, LEN],
  ];
  for (let i = 0; i < groundSegments.length - 1; i++) {
    const gapStart = groundSegments[i][1];
    const gapEnd   = groundSegments[i + 1][0];
    pits.push({ x: gapStart, w: gapEnd - gapStart });
  }

  const platData = [
    [560,  GND - 64, 80],
    [1090, GND - 80, 90],
    [1660, GND - 68, 90],
    [2190, GND - 76, 90],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 24 });

  const spawnPts = [340, 560, 780, 980, 1220, 1460, 1700, 1900, 2120, 2360, 2580, 2780];
  for (const x of spawnPts) {
    const onGround = groundSegments.some(([s, e]) => x > s + 40 && x < e - 40);
    if (!onGround) continue;
    const roll = Math.random();
    const archetype = roll < 0.35 ? 'rusher' : roll < 0.55 ? 'sniper' : 'brawler';
    enemies.push(mkEnemy(x, Math.random() < 0.5 ? 'punk' : 'cyborg', archetype));
  }

  return {
    len: LEN,
    type: 'gate',
    gateX: LEN - 140,
    label: 'STAGE 1-2 · ROOFTOP CROSSING',
  };
}

/** 1-3: Boss fight — Cyprus-Cocopta. */
function buildStage_1_3() {
  const LEN = 1400;
  const platData = [
    [380, GND - 70, 110],
    [900, GND - 70, 110],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 24 });

  return {
    len: LEN,
    type: 'boss',
    label: 'STAGE 1-3 · ROOFTOP — CYPRUS-COCOPTA',
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   STAGE DEFINITIONS — Level 2 (Desert)
   ──────────────────────────────────────────────────────────────────────────
   2-1  Desert Entry  : bg2, lizard + small_dragon intro
   2-2  Desert Swarm  : bg3, KILL 20 to unlock exit gate (full creature roster)
   2-3  Boss Arena    : bg1, Mini-Mausi-Chreno'bellow fight
   ────────────────────────────────────────────────────────────────────────── */

function buildStage_2_1() {
  const LEN = 2800;
  // Sand dune platforms — wide & stable, gentle intro
  const platData = [
    [260,  GND - 68, 140], [600,  GND - 56, 120], [960,  GND - 72, 140],
    [1320, GND - 60, 120], [1700, GND - 76, 140], [2100, GND - 64, 120],
    [2420, GND - 70, 120],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 22 });

  // Gentle intro: lizards in the front half, small_dragons in the back
  const lizardPts = [380, 640, 900, 1180, 1460];
  const dragonPts = [1720, 2000, 2280, 2540];
  for (const x of lizardPts)    enemies.push(mkCreature(x, 'lizard'));
  for (const x of dragonPts)    enemies.push(mkCreature(x, 'small_dragon'));

  return {
    len: LEN, type: 'gate', gateX: LEN - 140,
    bgKey: 'bg2',
    label: 'STAGE 2-1 · DESERT ENTRY',
  };
}

function buildStage_2_2() {
  const LEN = 3400;
  // Flat open desert with occasional raised rocky platforms
  const platData = [
    [300,  GND - 80, 110], [700,  GND - 64, 110], [1100, GND - 80, 110],
    [1500, GND - 72, 110], [1900, GND - 80, 110], [2300, GND - 64, 110],
    [2700, GND - 80, 110], [3100, GND - 72, 110],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 22 });

  // Full creature roster — all 5 types, 22 enemies (more than the 20-kill
  // goal so players have a small buffer and can't be softlocked by any
  // spawning edge cases).
  const spawnPts = [
    320, 520, 720, 940, 1160, 1380, 1600, 1820,
    2040, 2260, 2480, 2700, 2920, 3140,
    440, 840, 1280, 1720, 2160, 2600, 3040, 3300,
  ];
  const kinds = ['lizard', 'small_dragon', 'demon', 'jinn', 'medusa',
                 'demon', 'jinn', 'lizard', 'medusa', 'small_dragon',
                 'demon', 'lizard', 'jinn', 'medusa',
                 'small_dragon', 'demon', 'lizard', 'jinn',
                 'medusa', 'demon', 'lizard', 'small_dragon'];
  for (let i = 0; i < spawnPts.length; i++)
    enemies.push(mkCreature(spawnPts[i], kinds[i % kinds.length]));

  return {
    len: LEN,
    type: 'killgate',     // cleared by reaching kill-count, not a position gate
    killGoal: 20,
    gateX: LEN - 160,    // gate spawns visually but is locked until killGoal met
    bgKey: 'bg3',
    label: 'STAGE 2-2 · DESERT SWARM',
  };
}

function buildStage_2_3() {
  const LEN = 1600;
  // Clean boss arena: oasis canyon, a couple of rocky ledges
  const platData = [
    [340,  GND - 72, 120],
    [1000, GND - 72, 120],
  ];
  for (const [x, y, w] of platData) platforms.push({ x, y, w, h: 22 });

  return {
    len: LEN, type: 'boss',
    bgKey: 'bg1',
    label: 'STAGE 2-3 · CANYON — MINI-MAUSI',
  };
}

/* ── Mini-Mausi-Chreno'bellow — Level 2 boss ─────────────────────────────
   Sprite sheets: 128x64 per frame (horizontal strips, converted from grid).
   The character content fills most of its 128x64 canvas, so we draw at
   a scale that makes it roughly equal to the hero's 96px height: 64 * 1.5 = 96px.
   Boss uses a varied attack rotation across 5 distinct combo animations. ── */
const MM_SCALE = 1.5;    // 64px tall canvas → 96px on-screen = same as hero
const MM_FW = 128, MM_FH = 64;

function mkMiniMausi() {
  return {
    x: curStageDef.len - 380, y: GND - MM_FH * MM_SCALE,
    w: 56, h: MM_FH * MM_SCALE,    // hitbox: slightly narrower than full canvas
    drawW: MM_FW * MM_SCALE, drawH: MM_FH * MM_SCALE,
    vx: 0, vy: 0, face: -1,
    hp: 500 + level * 80, maxHp: 500 + level * 80,
    dir: -1, spd: 1.4 + level * 0.15,
    phase: 0,
    alive: true, dying: false, dyingTimer: 0,
    // Animation bank
    spr: {
      idle:         spr('boss_mm_idle',         MM_FW, MM_FH, 8,  6),
      run:          spr('boss_mm_run',          MM_FW, MM_FH, 8,  12),
      hurt:         spr('boss_mm_hurt',         MM_FW, MM_FH, 4,  10, false),
      death:        spr('boss_mm_death',        MM_FW, MM_FH, 4,  6,  false),
      jump:         spr('boss_mm_jump',         MM_FW, MM_FH, 8,  10),
      roll:         spr('boss_mm_roll',         MM_FW, MM_FH, 4,  12, false),
      slide:        spr('boss_mm_slide',        MM_FW, MM_FH, 12, 12, false),
      attack1:      spr('boss_mm_attack1',      MM_FW, MM_FH, 8,  14, false),
      attack2:      spr('boss_mm_attack2',      MM_FW, MM_FH, 8,  14, false),
      attack3:      spr('boss_mm_attack3',      MM_FW, MM_FH, 8,  14, false),
      attack4:      spr('boss_mm_attack4',      MM_FW, MM_FH, 8,  14, false),
      attack5:      spr('boss_mm_attack5',      MM_FW, MM_FH, 8,  14, false),
      crouch_idle:  spr('boss_mm_crouch_idle',  MM_FW, MM_FH, 8,  6),
      crouch_attack:spr('boss_mm_crouch_attack',MM_FW, MM_FH, 8,  14, false),
      attack_air:   spr('boss_mm_attack_air',   MM_FW, MM_FH, 8,  14, false),
    },
    curSpr: null, state: 'idle',
    atkCd: 0, atkIdx: 0,     // cycles through attack1→attack5 in order
    jumpCd: 0,               // cooldown before next jump attack
    crouchCd: 0,             // cooldown before next crouch sweep
    meleeCd: 0,
    isAirborne: false,
    onGnd: true,
  };
}

const STAGE_BUILDERS = {
  '1-1': buildStage_1_1,
  '1-2': buildStage_1_2,
  '1-3': buildStage_1_3,
  '2-1': buildStage_2_1,
  '2-2': buildStage_2_2,
  '2-3': buildStage_2_3,
};

let curStageDef = null; // { len, type, gateX?, label }

/* ── Level/stage setup ───────────────────────────────────────────────────── */
function setupStage() {
  enemies.length = bullets.length = particles.length = pickups.length = 0;
  platforms.length = 0; pits.length = 0;
  bossSpawned = false; boss = null;
  camX = targetCamX = 0;
  stageClearedPending = false;
  killCount = 0;

  const key = `${level}-${stage}`;
  const builder = STAGE_BUILDERS[key];
  if (!builder) {
    curStageDef = { len: 1600, type: 'gate', gateX: 1460, label: `STAGE ${key} · COMING SOON` };
    const spawnPts = [400, 800, 1200];
    for (const x of spawnPts) enemies.push(mkEnemy(x, 'punk', 'brawler'));
    return;
  }
  curStageDef = builder();
}

/* ── State helpers ───────────────────────────────────────────────────────── */
function setState(ent, st) {
  if (ent.state === st) return;
  ent.state = st;
  const s = ent.spr[st];
  if (s) s.reset();
}

/* ── Rect-rect collision ─────────────────────────────────────────────────── */
function rr(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/* ── Particle helpers ────────────────────────────────────────────────────── */
function fx(x, y, col, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 4 + 1;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
      life: Math.random() * 14 + 6, max: 20,
      sz: Math.random() * 4 + 1.5, col,
    });
  }
}
function explodeAt(x, y, r = 30) {
  shake = Math.max(shake, 9);
  fx(x, y, '#f80', 12); fx(x, y, '#ff0', 8);
  fx(x, y, '#f44', 6);  fx(x, y, '#fff', 4);
  particles.push({ x, y, vx: 0, vy: 0, life: 14, max: 14, sz: r, col: '', type: 'ring' });
}

/* ── Pit / fall-hazard check ─────────────────────────────────────────────── */
function isOverPit(x, w) {
  for (const p of pits) {
    if (x + w > p.x && x < p.x + p.w) return true;
  }
  return false;
}

/* ── Damage helpers ─────────────────────────────────────────────────────── */
function hurtPlayer(dmg) {
  if (!player || player.inv > 0) return;
  // Allow lethal fall-damage through even while fallingToDeath is true —
  // this guard only blocks *additional* incidental damage (e.g. enemy
  // bullets) while the player is already mid-fall, not the fall-death
  // kill itself.
  if (player.fallingToDeath && dmg < 999) return;
  player.hp -= dmg; player.inv = 75; shake = 6;
  fx(player.x + player.w / 2, player.y + player.h / 2, '#f44', 5);
  updateHUD();
  if (player.hp <= 0) {
    player.hp = 0;
    if (player.fallingToDeath) {
      // Skip the death animation (player has fallen off-screen, nothing to
      // show) and go straight to the life-lost flow.
      playerDie();
    } else {
      setState(player, 'death'); player.spr.death.reset();
    }
  }
}

function hurtEnemy(e, dmg) {
  e.hp -= dmg; e.hitF = 8;
  fx(e.x + e.w / 2, e.y + e.h / 2, '#f80', 4);
  if (e.hp <= 0) {
    e.alive = false; e.dying = true;
    e.curSpr = e.spr.death; e.spr.death.reset();
    if (e.isCreature) {
      const tierScore = { medusa: 350, jinn: 300, demon: 280, small_dragon: 200, lizard: 150 };
      score += tierScore[e.kind] || 150;
    } else {
      score += e.type === 'cyborg' ? 300 : 150;
    }
    combo++; comboT = 90; shake = 3;
    killCount++;
    explodeAt(e.x + e.w / 2, e.y + e.h / 2, 25);
    if (Math.random() < 0.38) dropPickup(e.x + e.w / 2, e.y);
    updateHUD();
  }
}

function hurtBoss(dmg) {
  if (!boss || !boss.alive) return;
  boss.hp -= dmg; shake = 5;
  fx(boss.x + boss.w / 2, boss.y + boss.h / 2, '#f80', 6);

  // Flash hurt animation if available
  if (boss.spr && boss.spr.hurt && level === 2) {
    boss.spr.hurt.reset();
    boss.state = 'hurt';
  }

  if (boss.hp <= 0) {
    boss.alive = false;
    boss.dying = true;
    boss.dyingTimer = 80;
    if (level === 2) {
      // Mini-Mausi has a death animation — play it + stagger explosions
      score += 8000;
      if (boss.spr && boss.spr.death) { boss.spr.death.reset(); boss.state = 'death'; }
      explodeAt(boss.x + boss.w / 2, boss.y + boss.h / 2, 50);
      setTimeout(() => explodeAt(boss.x + 10, boss.y + 10, 40), 200);
      setTimeout(() => explodeAt(boss.x + boss.w, boss.y + 30, 45), 400);
      setTimeout(() => explodeAt(boss.x + boss.w / 2, boss.y + 50, 60), 700);
    } else {
      // Cyprus-Cocopta: no death anim, bigger particle explosion
      score += 6000;
      explodeAt(boss.x + boss.w / 2, boss.y + boss.h / 2, 70);
      setTimeout(() => explodeAt(boss.x + 20, boss.y + 20, 50), 250);
      setTimeout(() => explodeAt(boss.x + boss.w - 20, boss.y + 40, 60), 500);
      setTimeout(() => explodeAt(boss.x + boss.w / 2, boss.y + 60, 80), 800);
    }
    updateHUD();
  }
}

/* ── Pickups ──────────────────────────────────────────────────────────────── */
function dropPickup(x, y) {
  pickups.push({ x, y, vy: -4, type: Math.random() < 0.5 ? 'ammo' : 'health', life: 300 });
}

/* ── Boss factory — Cyprus-Cocopta (Level 1 boss) ────────────────────────────
   Native sprite frames are 96x96 (2x the hero's 48x48 frames, which are
   drawn at 2x scale = 96px on-screen). Drawing the boss at 1x scale makes
   its on-screen height exactly 96px — IDENTICAL to the player's height, as
   explicitly requested. Hitbox is sized to match the visible character. ── */
const BOSS_DRAW_SCALE = 1.0;
const BOSS_FRAME = 96;

function mkBoss() {
  const drawH = BOSS_FRAME * BOSS_DRAW_SCALE; // 96px, matches player's 96px exactly
  const drawW = BOSS_FRAME * BOSS_DRAW_SCALE;
  return {
    x: curStageDef.len - 360, y: GND - drawH, w: 48, h: drawH,
    drawW, drawH,
    vx: 0, vy: 0, face: -1,
    hp: 420 + level * 80, maxHp: 420 + level * 80,
    shootCd: 0, dir: -1, spd: 1.3 + level * 0.1,
    spr: {
      idle:   spr('boss_cc_idle',   96, 96, 10, 7),
      run:    spr('boss_cc_run',    96, 96, 16, 12),
      attack: spr('boss_cc_attack', 96, 96, 7,  14, false),
      hurt:   spr('boss_cc_hurt',   96, 96, 4,  10, false),
    },
    curSpr: null, state: 'idle', alive: true, phase: 0,
    dying: false, dyingTimer: 0,
    meleeCd: 0,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   UPDATE
   ────────────────────────────────────────────────────────────────────────── */
function updatePlayer() {
  const p = player; if (!p) return;
  if (p.inv > 0) p.inv--;
  if (p.atkCd > 0) p.atkCd--;
  if (p.specialCd > 0) p.specialCd--;
  if (p.shootCd > 0) p.shootCd--;
  if (p.djumpTimer > 0) p.djumpTimer--;

  if (p.state === 'death') { p.spr.death.update(); if (p.spr.death.done) playerDie(); return; }

  // Medusa petrify: player is frozen solid — no movement, no jump, no
  // shooting/attacking — for the duration. Gravity/ground collision still
  // applies so a petrified player standing on a platform doesn't float, but
  // they're a sitting target. Camera and animation hold in place.
  if (p.petrified > 0) {
    p.petrified--;
    p.vx = 0;
    p.vy = Math.min(p.vy + GRAV, MAXFALL);
    p.y += p.vy;
    for (const pl of platforms) {
      if (p.vy >= 0 && p.y + p.h > pl.y && p.y + p.h - p.vy <= pl.y + 10
          && p.x + p.w - 8 > pl.x && p.x + 8 < pl.x + pl.w) {
        p.y = pl.y - p.h; p.vy = 0; p.onGnd = true;
      }
    }
    if (p.y + p.h >= GND) { p.y = GND - p.h; p.vy = 0; p.onGnd = true; }
    return;
  }

  if (p.fallingToDeath) {
    p.vy = Math.min(p.vy + GRAV, MAXFALL);
    p.y += p.vy;
    if (p.y > PIT_DEATH_Y) { hurtPlayer(p.hp + 999); }
    return;
  }

  p.crouching = K.down() && p.onGnd;

  if (!p.attacking) {
    if (K.left())       { p.vx = -p.def.speed; p.face = -1; }
    else if (K.right()) { p.vx =  p.def.speed; p.face =  1; }
    else                { p.vx *= 0.65; }
  } else { p.vx *= 0.5; }

  const wantsJump = K.up();
  if (wantsJump && !p.jumped) {
    if (p.onGnd) {
      p.vy = -p.def.jump; p.onGnd = false; p.jumped = true;
      setState(p, 'jump');
    } else if (!p.djumped) {
      p.vy = -p.def.jump * 0.85; p.djumped = true; p.jumped = true;
      setState(p, 'djump'); p.djumpTimer = 18;
    }
  }
  if (!wantsJump) p.jumped = false;

  if (K.attack() && p.atkCd <= 0 && !p.attacking) {
    p.atkCd = 16; p.attacking = true; p.atkTimer = 16; p.atkDmgDone = false; p.special = false;
    if (p.ammo > 0) {
      p.ammo--;
      setState(p, p.djumpTimer > 0 ? 'attack2' : 'attack');
      const bx = p.x + (p.face > 0 ? p.w * 2 + 8 : -16);
      const by = p.y + (p.crouching ? 60 : 38);
      bullets.push({ x: bx, y: by, vx: p.face * 12, vy: 0, isEnemy: false, life: 55, dmg: p.def.atk });
      fx(bx, by, '#fff', 3);
    } else { setState(p, 'punch'); }
    updateHUD();
  }

  // Special attack (KeyC / on-screen SPL button) — a heavy charged strike
  // on its own cooldown, independent of ammo. Reaches further and hits
  // harder than the regular attack so it's worth saving for tough moments
  // instead of spamming.
  if (K.special() && p.specialCd <= 0 && !p.attacking) {
    p.specialCd = 90; p.attacking = true; p.atkTimer = 20; p.atkDmgDone = false; p.special = true;
    setState(p, 'attack2');
    fx(p.x + p.w / 2, p.y + p.h / 2, '#ffe060', 10);
    shake = Math.max(shake, 5);
    updateHUD();
  }

  if (p.attacking) {
    p.atkTimer--;
    const dmgWindow = p.special ? 12 : 8;
    if (!p.atkDmgDone && p.atkTimer < dmgWindow) {
      p.atkDmgDone = true;
      const reach   = p.special ? 100 : 60;
      const dmgMul  = p.special ? 1.8 : 0.7;
      const bossMul = p.special ? 1.2 : 0.5;
      const hbx = p.x + (p.face > 0 ? p.w * 2 : -reach), hby = p.y + 16;
      for (const e of enemies) {
        if (!e.alive || e.dying) continue;
        if (rr(hbx, hby, reach, 64, e.x, e.y, e.w, e.h)) hurtEnemy(e, p.def.atk * dmgMul);
      }
      if (boss && !boss.dying && rr(hbx, hby, reach, 64, boss.x, boss.y, boss.w, boss.h)) hurtBoss(p.def.atk * bossMul);
      if (p.special) shake = Math.max(shake, 7);
    }
    if (p.atkTimer <= 0) { p.attacking = false; p.special = false; }
  }

  p.vy = Math.min(p.vy + GRAV, MAXFALL);
  p.x += p.vx; p.y += p.vy;

  p.onGnd = false;
  for (const pl of platforms) {
    if (p.vy >= 0 && p.y + p.h > pl.y && p.y + p.h - p.vy <= pl.y + 10
        && p.x + p.w - 8 > pl.x && p.x + 8 < pl.x + pl.w) {
      p.y = pl.y - p.h; p.vy = 0; p.onGnd = true; p.djumped = false;
    }
  }

  const overPit = isOverPit(p.x + p.w / 2, 2);
  if (!overPit && p.y + p.h >= GND) {
    p.y = GND - p.h; p.vy = 0; p.onGnd = true; p.djumped = false;
  } else if (overPit && p.y + p.h >= GND && p.vy >= 0) {
    p.fallingToDeath = true;
    setState(p, 'jump');
  }

  p.x = Math.max(camX + 4, Math.min(p.x, curStageDef.len - p.w - 4));

  if (p.state !== 'death' && p.state !== 'hurt') {
    if (!p.onGnd && p.state !== 'jump' && p.state !== 'djump') setState(p, 'jump');
    else if (p.onGnd && !p.attacking) setState(p, Math.abs(p.vx) > 0.4 ? 'run' : 'idle');
  }

  targetCamX = p.x - W * 0.32;
  camX += (targetCamX - camX) * 0.1;
  camX = Math.max(0, Math.min(camX, Math.max(0, curStageDef.len - W)));

  (p.spr[p.state] || p.spr.idle).update();

  if (curStageDef.type === 'gate' && !stageClearedPending && p.x >= curStageDef.gateX) {
    stageClearedPending = true;
    setTimeout(stageClear, 400);
  }
  // Kill-gate: 20 kills unlock the exit; walking through after that clears stage
  if (curStageDef.type === 'killgate' && !stageClearedPending) {
    if (killCount >= curStageDef.killGoal && p.x >= curStageDef.gateX) {
      stageClearedPending = true;
      setTimeout(stageClear, 400);
    }
  }
}

function updateEnemies() {
  if (!player) return;
  const p = player;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const sx = e.x - camX;
    if (sx < -300 || sx > W + 300) continue;

    if (e.dying) { e.curSpr.update(); if (e.curSpr.done) enemies.splice(i, 1); continue; }
    if (!e.alive) continue;
    if (e.hitF > 0) e.hitF--;

    const dx = p.x - e.x, dist = Math.abs(dx);
    if (dist < e.alertR) e.alert = true;
    if (!e.alert) continue;
    e.face = dx > 0 ? 1 : -1;

    if (e.archetype === 'rusher') {
      e.aiT--;
      if (e.aiT <= 0) { e.aiT = 8 + Math.random() * 10; e.moveDir = dist > 36 ? e.face : 0; }
      e.vx = e.moveDir * e.speed;
    } else if (e.archetype === 'sniper') {
      e.aiT--;
      if (e.aiT <= 0) {
        e.aiT = 30 + Math.random() * 25;
        if (dist < 160) e.moveDir = -e.face;
        else if (dist > 320) e.moveDir = e.face;
        else e.moveDir = 0;
      }
      e.vx = e.moveDir * e.speed;
    } else {
      e.aiT--;
      if (e.aiT <= 0) { e.aiT = 25 + Math.random() * 30; e.moveDir = dist > 90 ? e.face : 0; }
      e.vx = e.moveDir * e.speed;
    }

    const nextX = e.x + e.vx;
    if (isOverPit(nextX + e.w / 2, 2) && e.onGnd) {
      e.vx = 0; e.moveDir = 0;
    }

    e.vy = Math.min(e.vy + GRAV, MAXFALL);
    e.x += e.vx; e.y += e.vy;

    e.onGnd = false;
    for (const pl of platforms) {
      if (e.vy >= 0 && e.y + e.h > pl.y && e.y + e.h - e.vy <= pl.y + 10
          && e.x + e.w - 8 > pl.x && e.x + 8 < pl.x + pl.w) {
        e.y = pl.y - e.h; e.vy = 0; e.onGnd = true;
      }
    }
    if (!isOverPit(e.x + e.w / 2, 2) && e.y + e.h >= GND) {
      e.y = GND - e.h; e.vy = 0; e.onGnd = true;
    }

    e.atkCd--;
    if (e.archetype === 'sniper') {
      if (e.atkCd <= 0 && dist < 380 && e.shootAmmo > 0) {
        e.atkCd = 48;
        e.atkTimer = 14; e.atkDone = false;
        e.shootAmmo--;
        const ang = Math.atan2(p.y + 40 - (e.y + 40), p.x + 24 - (e.x + 24));
        bullets.push({ x: e.x + (e.face > 0 ? e.w * 2 : 0), y: e.y + 40,
          vx: Math.cos(ang) * 9, vy: Math.sin(ang) * 0.6,
          isEnemy: true, life: 60, dmg: 16 });
      }
    } else if (e.archetype === 'rusher') {
      if (e.atkCd <= 0 && dist < 110) {
        e.atkCd = 32;
        e.atkTimer = 16; e.atkDone = false;
      }
    } else {
      if (e.atkCd <= 0 && dist < 120) {
        e.atkCd = e.type === 'cyborg' ? 65 : 50;
        e.atkTimer = 20; e.atkDone = false;
        if (e.type === 'cyborg' && e.shootAmmo > 0) {
          e.shootAmmo--;
          const ang = Math.atan2(p.y + 40 - (e.y + 40), p.x + 24 - (e.x + 24));
          bullets.push({ x: e.x + (e.face > 0 ? e.w * 2 : 0), y: e.y + 40,
            vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 0.6,
            isEnemy: true, life: 55, dmg: 14 });
        }
      }
    }

    if (e.atkTimer > 0 && e.archetype !== 'sniper') {
      e.atkTimer--;
      if (!e.atkDone && e.atkTimer < 8 && dist < 100) {
        e.atkDone = true;
        const dmg = e.archetype === 'rusher' ? 8 : (e.type === 'cyborg' ? 16 : 10);
        if (p.inv <= 0 && rr(e.x + (e.face > 0 ? e.w : -60), e.y + 16, 60, 64, p.x + 8, p.y + 8, p.w - 16, p.h - 16))
          hurtPlayer(dmg);
      }
    } else if (e.atkTimer > 0) {
      e.atkTimer--;
    }

    const nst = e.atkTimer > 0 ? 'attack' : Math.abs(e.vx) > 0.2 ? 'run' : 'idle';
    if (nst !== e.state) { e.state = nst; e.spr[nst] && e.spr[nst].reset(); }
    e.state = nst;
    e.curSpr = e.spr[nst] || e.spr.idle;
    e.curSpr.update();

    if (e.archetype !== 'sniper' && p.inv <= 0 && rr(e.x + 10, e.y + 10, e.w - 20, e.h - 20, p.x + 8, p.y + 8, p.w - 16, p.h - 16))
      hurtPlayer(e.archetype === 'rusher' ? 4 : 6);
  }
}

/* ── Desert creature AI/combat (Level 2) ─────────────────────────────────── */
function updateCreatures() {
  if (!player) return;
  const p = player;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.isCreature) continue;
    const sx = e.x - camX;
    if (sx < -300 || sx > W + 300) continue;

    if (e.dying) { e.curSpr.update(); if (e.curSpr.done) enemies.splice(i, 1); continue; }
    if (!e.alive) continue;
    if (e.hitF > 0) e.hitF--;

    const dx = p.x - e.x, dist = Math.abs(dx);
    if (dist < e.alertR) e.alert = true;
    if (!e.alert) continue;
    e.face = dx > 0 ? 1 : -1;

    // ── Medusa: petrify special. When in range and off cooldown, she winds
    //    up the Stone animation; on completion, the player is petrified
    //    (frozen) for a short window — a real "don't get close" threat. ──
    if (e.archetype === 'medusa') {
      if (e.stoneCharging) {
        e.stoneTimer--;
        e.vx = 0;
        if (e.stoneTimer <= 0) {
          e.stoneCharging = false;
          if (dist < 220 && p.inv <= 0) {
            p.petrified = 110; // ~1.8s frozen
            fx(p.x + p.w / 2, p.y + p.h / 2, '#8f8', 10);
          }
          e.atkCd = 220; // long cooldown after a petrify attempt
        }
      } else {
        e.aiT--;
        if (e.aiT <= 0) { e.aiT = 25 + Math.random() * 25; e.moveDir = dist > 110 ? e.face : 0; }
        e.vx = e.moveDir * e.speed;
        e.atkCd--;
        if (e.atkCd <= 0 && dist < 260) {
          e.stoneCharging = true; e.stoneTimer = e.spr.stone.fc * (60 / e.spr.stone.fps);
          setState(e, 'stone');
        }
        // Regular melee bite if player gets in close while not charging
        e.atkTimer > 0 && e.atkTimer--;
        if (dist < 70 && e.atkTimer <= 0) {
          e.atkTimer = 24;
          if (p.inv <= 0) hurtPlayer(10);
        }
      }
    }
    // ── Jinn: flies, keeps distance, fires magic bolts (sniper-style) ──
    else if (e.archetype === 'sniper') {
      e.aiT--;
      if (e.aiT <= 0) {
        e.aiT = 30 + Math.random() * 25;
        if (dist < 180) e.moveDir = -e.face;
        else if (dist > 340) e.moveDir = e.face;
        else e.moveDir = 0;
      }
      e.vx = e.moveDir * e.speed;
      // Jinn floats — gentle vertical bob instead of gravity-locked to ground
      e.floatT = (e.floatT || 0) + 0.05;
      e.y = GND - e.h - 30 - Math.sin(e.floatT) * 14;

      e.rangedCd--;
      if (e.rangedCd <= 0 && dist < 380) {
        e.rangedCd = 70;
        const ang = Math.atan2(p.y + 40 - (e.y + e.h / 2), p.x + 24 - (e.x + e.w / 2));
        bullets.push({ x: e.x + e.w / 2, y: e.y + e.h / 2,
          vx: Math.cos(ang) * 6.5, vy: Math.sin(ang) * 0.5,
          isEnemy: true, life: 70, dmg: 14, magic: true });
        e.rangedAnimTimer = e.spr.magic_attack.fc * (60 / e.spr.magic_attack.fps);
      }
    }
    // ── small_dragon: fire-breather that holds a preferred 70-200px band,
    //    advancing only when the player is further than that and backing
    //    off slightly if the player closes in too tight — so it keeps
    //    breathing fire instead of immediately rushing into melee. ──
    else if (e.archetype === 'rusher' && e.cfg.hasRanged) {
      e.rangedCd--;
      const inFireBand = dist > 70 && dist < 200;
      if (e.rangedAnimTimer > 0) {
        e.moveDir = 0; // hold still while the breath animation plays
      } else if (inFireBand && e.rangedCd <= 0) {
        e.moveDir = 0;
        e.rangedCd = 75;
        bullets.push({ x: e.x + (e.face > 0 ? e.w : 0), y: e.y + e.h * 0.4,
          vx: e.face * 5, vy: 0, isEnemy: true, life: 50, dmg: 12, fire: true });
        const rangedSpr = e.spr[e.cfg.hasRanged];
        e.rangedAnimTimer = rangedSpr.fc * (60 / rangedSpr.fps);
      } else if (dist < 70) {
        e.moveDir = -e.face; // too close — back off toward the fire-band
      } else if (dist >= 200) {
        e.moveDir = e.face; // too far — close in toward the fire-band
      } else {
        e.moveDir = 0; // in-band but on cooldown — hold position
      }
      e.vx = e.moveDir * e.speed;
    }
    // ── Plain rusher (no ranged option): always charge ──
    else if (e.archetype === 'rusher') {
      e.aiT--;
      if (e.aiT <= 0) { e.aiT = 10 + Math.random() * 12; e.moveDir = dist > 50 ? e.face : 0; }
      e.vx = e.moveDir * e.speed;
    }
    // ── demon / default: brawler ──
    else {
      e.aiT--;
      if (e.aiT <= 0) { e.aiT = 25 + Math.random() * 30; e.moveDir = dist > 90 ? e.face : 0; }
      e.vx = e.moveDir * e.speed;
    }

    // Physics (skip ground-lock for flying jinn, handled above)
    if (e.archetype !== 'sniper') {
      const nextX = e.x + e.vx;
      if (isOverPit(nextX + e.w / 2, 2) && e.onGnd) { e.vx = 0; e.moveDir = 0; }
      e.vy = Math.min(e.vy + GRAV, MAXFALL);
      e.x += e.vx; e.y += e.vy;
      e.onGnd = false;
      for (const pl of platforms) {
        if (e.vy >= 0 && e.y + e.h > pl.y && e.y + e.h - e.vy <= pl.y + 10
            && e.x + e.w - 8 > pl.x && e.x + 8 < pl.x + pl.w) {
          e.y = pl.y - e.h; e.vy = 0; e.onGnd = true;
        }
      }
      if (!isOverPit(e.x + e.w / 2, 2) && e.y + e.h >= GND) {
        e.y = GND - e.h; e.vy = 0; e.onGnd = true;
      }
    } else {
      e.x += e.vx; // jinn x-movement only, y handled by float logic above
    }

    // Melee contact damage (brawler/rusher archetypes; medusa handled above;
    // jinn is ranged-only and stays out of melee range by design)
    if (e.archetype === 'brawler' || e.archetype === 'rusher') {
      e.atkCd = e.atkCd === undefined ? 0 : e.atkCd;
      if (e.atkTimer > 0) {
        e.atkTimer--;
      } else if (dist < (e.w + 30)) {
        e.atkTimer = e.archetype === 'rusher' ? 26 : 34;
        if (p.inv <= 0) hurtPlayer(e.archetype === 'rusher' ? 7 : 12);
      }
    }

    // Animation state
    if (e.rangedAnimTimer > 0) e.rangedAnimTimer--;
    let nst;
    if (e.archetype === 'medusa' && e.stoneCharging) nst = 'stone';
    else if (e.rangedAnimTimer > 0 && e.archetype === 'sniper' && e.spr.magic_attack) nst = 'magic_attack';
    else if (e.rangedAnimTimer > 0 && e.cfg.hasRanged && e.spr[e.cfg.hasRanged]) nst = e.cfg.hasRanged;
    else if (e.atkTimer > 0 && e.spr.attack) nst = 'attack';
    else if (Math.abs(e.vx) > 0.2 && e.spr[e.moveKey]) nst = e.moveKey;
    else nst = 'idle';
    if (nst !== e.state) { e.state = nst; e.spr[nst] && e.spr[nst].reset(); }
    e.state = nst;
    e.curSpr = e.spr[nst] || e.spr.idle;
    e.curSpr.update();
  }
}

function updateBoss() {
  if (!boss) return;
  const p = player; if (!p) return;

  if (boss.dying) {
    boss.dyingTimer--;
    boss.y -= 0.4;
    if (boss.dyingTimer <= 0) { boss.alive = false; boss = null; stageClear(); }
    return;
  }
  if (!boss.alive) return;

  const phase = boss.hp < boss.maxHp * 0.3 ? 2 : boss.hp < boss.maxHp * 0.6 ? 1 : 0;
  boss.phase = phase;
  const spd = boss.spd * (1 + phase * 0.5);

  const dx = p.x - boss.x, dist = Math.abs(dx);
  boss.face = dx < 0 ? -1 : 1;
  boss.dir = dist > 70 ? (dx > 0 ? 1 : -1) : 0;
  boss.x += boss.dir * spd;
  boss.x = Math.max(curStageDef.len - 900, Math.min(boss.x, curStageDef.len - boss.w - 20));

  boss.vy = Math.min(boss.vy + GRAV, MAXFALL);
  boss.y += boss.vy;
  if (boss.y + boss.h >= GND) { boss.y = GND - boss.h; boss.vy = 0; }

  boss.shootCd--;
  if (boss.shootCd <= 0) {
    boss.shootCd = phase === 2 ? 22 : phase === 1 ? 32 : 48;
    const cx = boss.x + boss.w / 2, cy = boss.y + boss.h * 0.4;
    const ang = Math.atan2(p.y + 40 - cy, p.x + 24 - cx);
    const s   = 8 + phase * 2;
    const spread = phase === 2 ? 5 : phase === 1 ? 3 : 1;
    for (let i = 0; i < spread; i++) {
      const a = ang + (i - (spread - 1) / 2) * 0.22;
      bullets.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * 0.5, isEnemy: true, life: 65, dmg: 18 });
    }
    setState(boss, 'attack');
  }

  boss.meleeCd--;
  if (boss.meleeCd <= 0 && dist < 90) {
    boss.meleeCd = 50;
    if (p.inv <= 0) hurtPlayer(phase === 2 ? 26 : 18);
    shake = 5;
  }

  const nst = boss.state === 'attack' && boss.spr.attack && !boss.spr.attack.done
    ? 'attack'
    : (Math.abs(boss.dir) > 0 ? 'run' : 'idle');
  if (nst !== boss.state) { boss.state = nst; boss.spr[nst] && boss.spr[nst].reset(); }
  boss.state = nst;
  boss.curSpr = boss.spr[boss.state] || boss.spr.idle;
  boss.curSpr.update();

  if (p && p.inv <= 0 && rr(boss.x + 8, boss.y + 8, boss.w - 16, boss.h - 16, p.x + 8, p.y + 8, p.w - 16, p.h - 16))
    hurtPlayer(10);
}

/* ── Mini-Mausi-Chreno'bellow AI ─────────────────────────────────────────
   3-phase fight: the boss cycles through a repertoire of attack animations
   (5 different combo-swings, plus jump-attack and crouch-sweep). Each phase
   adds new attack patterns:
   Phase 0: cycles attack1→attack3, simple approach
   Phase 1: adds attack4, jump-attacks, faster
   Phase 2: all 5 combos, crouch sweeps, fastest — and no melee cooldown ── */
function updateMiniMausi() {
  if (!boss) return;
  const b = boss;

  // Dying sequence runs even though alive=false — must check BEFORE the
  // alive guard or the death countdown is unreachable.
  if (b.dying) {
    b.dyingTimer--;
    b.y -= 0.3;
    if (b.spr.death) b.spr.death.update();
    if (b.dyingTimer <= 0) { boss = null; stageClear(); }
    return;
  }

  if (!b.alive) return;
  const p = player; if (!p) return;

  const phase = b.hp < b.maxHp * 0.3 ? 2 : b.hp < b.maxHp * 0.65 ? 1 : 0;
  b.phase = phase;
  const spd = b.spd * (1 + phase * 0.4);

  const dx = p.x - b.x, dist = Math.abs(dx);
  b.face = dx < 0 ? -1 : 1;

  // Determine if currently mid-attack animation (block movement during combos)
  const atkKey = b.state;
  const midAtk = atkKey.startsWith('attack') || atkKey === 'roll' ||
                 atkKey === 'slide' || atkKey === 'attack_air' || atkKey === 'crouch_attack';
  const atkDone = b.spr[atkKey] && b.spr[atkKey].done;

  if (midAtk && !atkDone) {
    // Hold position during combo, deal melee damage at peak frame
    b.vx = 0;
    if (b.spr[atkKey] && b.spr[atkKey].f === 4 && p.inv <= 0) {
      const meleeDmg = phase === 2 ? 24 : phase === 1 ? 18 : 14;
      if (rr(b.x - 60, b.y, b.w + 120, b.h, p.x + 8, p.y + 8, p.w - 16, p.h - 16))
        hurtPlayer(meleeDmg);
    }
    b.spr[atkKey].update();
    b.curSpr = b.spr[atkKey];
    // Update physics even mid-attack so jump arc carries through
    b.vy = Math.min(b.vy + GRAV, MAXFALL); b.y += b.vy;
    if (b.y + b.h >= GND) { b.y = GND - b.h; b.vy = 0; b.isAirborne = false; }
    return;
  }

  // Transition to idle if attack just finished
  if (midAtk && atkDone) {
    const restMs = phase === 2 ? 12 : phase === 1 ? 20 : 28;
    b.atkCd = restMs; b.state = 'idle';
  }

  // Approach/retreat logic
  if (dist > 200) {
    b.dir = dx > 0 ? 1 : -1;
    b.vx = b.dir * spd;
  } else if (dist < 60) {
    b.vx = -b.face * spd * 0.5; // slight back-step before next swing
  } else {
    b.vx = 0;
  }

  // Physics
  b.vy = Math.min(b.vy + GRAV, MAXFALL);
  b.x += b.vx; b.y += b.vy;
  b.x = Math.max(curStageDef.len - 920, Math.min(b.x, curStageDef.len - b.w - 20));
  if (b.y + b.h >= GND) { b.y = GND - b.h; b.vy = 0; b.isAirborne = false; b.onGnd = true; }
  else { b.onGnd = false; }

  // ── Attack selection ─────────────────────────────────────────────────────
  b.atkCd--;
  if (b.atkCd <= 0 && dist < 220) {
    const roll = Math.random();

    // Jump-attack (phase 1+)
    if (phase >= 1 && b.jumpCd <= 0 && dist < 300 && roll < 0.25) {
      b.vy = -10; b.isAirborne = true;
      b.atkCd = phase === 2 ? 15 : 22;
      b.jumpCd = 160;
      b.spr.attack_air.reset(); b.state = 'attack_air';

    // Crouch sweep (phase 2)
    } else if (phase === 2 && b.crouchCd <= 0 && roll < 0.35) {
      b.atkCd = 18;
      b.crouchCd = 130;
      b.spr.crouch_attack.reset(); b.state = 'crouch_attack';

    // Standard combo attack — cycle through attack1→attack(3+phase)
    } else {
      const maxAtk = phase === 2 ? 5 : phase === 1 ? 4 : 3;
      b.atkIdx = (b.atkIdx + 1) % maxAtk;
      const atkName = `attack${b.atkIdx + 1}`;
      b.atkCd = phase === 2 ? 14 : phase === 1 ? 20 : 28;
      b.spr[atkName].reset(); b.state = atkName;
    }
  }

  if (b.jumpCd > 0) b.jumpCd--;
  if (b.crouchCd > 0) b.crouchCd--;

  // Move anim
  if (b.state === 'idle' || b.state === 'run') {
    const nst = Math.abs(b.vx) > 0.3 ? 'run' : 'idle';
    if (nst !== b.state) { b.state = nst; b.spr[nst].reset(); }
    b.spr[b.state].update();
    b.curSpr = b.spr[b.state];
  }

  // Touch damage always active
  if (p.inv <= 0 && rr(b.x + 6, b.y + 6, b.w - 12, b.h - 12, p.x + 8, p.y + 8, p.w - 16, p.h - 16))
    hurtPlayer(10);
}

function updateBullets() {
  const p = player;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.gravity) b.vy = Math.min(b.vy + b.gravity, 8);
    b.life--;
    if (b.life <= 0 || b.y > H + 20) { bullets.splice(i, 1); continue; }

    if (!b.isEnemy) {
      if (boss && boss.alive && !boss.dying && rr(b.x - 4, b.y - 4, 8, 8, boss.x, boss.y, boss.w, boss.h)) {
        hurtBoss(b.dmg); fx(b.x, b.y, '#f80', 5); bullets.splice(i, 1); continue;
      }
      let hit = false;
      for (const e of enemies) {
        if (!e.alive || e.dying) continue;
        if (rr(b.x - 4, b.y - 4, 8, 8, e.x + 6, e.y + 6, e.w - 12, e.h - 12)) {
          hurtEnemy(e, b.dmg); fx(b.x, b.y, '#ff0', 4); hit = true; break;
        }
      }
      if (hit) bullets.splice(i, 1);
    } else {
      if (p && p.inv <= 0 && !p.fallingToDeath && rr(b.x - 4, b.y - 4, 8, 8, p.x + 6, p.y + 6, p.w - 12, p.h - 12)) {
        hurtPlayer(b.dmg); fx(b.x, b.y, '#f44', 4); bullets.splice(i, 1);
      }
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updatePickups() {
  if (!player) return;
  const p = player;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.vy = Math.min((pk.vy || 0) + 0.4, 8); pk.y += pk.vy; pk.life--;
    if (pk.y + 20 >= GND) { pk.y = GND - 20; pk.vy = 0; }
    if (pk.life <= 0) { pickups.splice(i, 1); continue; }
    if (rr(pk.x - 8, pk.y, 28, 28, p.x, p.y, p.w, p.h)) {
      if (pk.type === 'ammo') p.ammo = Math.min(p.maxAmmo, p.ammo + 18);
      else                   p.hp   = Math.min(p.maxHp, p.hp + 35);
      score += 100; pickups.splice(i, 1); updateHUD();
    }
  }
}

function checkBoss() {
  if (curStageDef.type !== 'boss' || bossSpawned) return;
  bossSpawned = true;
  if (level === 1) { boss = mkBoss(); }
  else if (level === 2) { boss = mkMiniMausi(); }
}

/* ──────────────────────────────────────────────────────────────────────────
   DRAW
   ────────────────────────────────────────────────────────────────────────── */
function drawBG() {
  if (level === 2) { drawDesertBG(); return; }
  drawRooftopBG();
}

function drawRooftopBG() {
  const IMG = window.IMG;
  const sky = IMG['bg_sky'];
  if (sky && sky.complete && sky.naturalWidth) {
    const ratio = sky.naturalWidth / sky.naturalHeight;
    const dw = H * ratio;
    const ox = (-camX * 0.04) % dw;
    for (let x = ox - dw; x < W + dw; x += dw)
      ctx.drawImage(sky, Math.round(x), 0, Math.round(dw), H);
  } else {
    ctx.fillStyle = '#06060e'; ctx.fillRect(0, 0, W, H);
  }

  const l1 = IMG['bg_layer1'];
  if (l1 && l1.complete && l1.naturalWidth) {
    const dw = l1.naturalWidth * (H / l1.naturalHeight);
    const ox = (-camX * 0.14) % dw;
    for (let x = ox - dw; x < W + dw; x += dw)
      ctx.drawImage(l1, Math.round(x), 0, Math.round(dw), H);
  }

  const l2 = IMG['bg_layer2'];
  if (l2 && l2.complete && l2.naturalWidth) {
    const dw = l2.naturalWidth * (H / l2.naturalHeight);
    const ox = (-camX * 0.28) % dw;
    for (let x = ox - dw; x < W + dw; x += dw)
      ctx.drawImage(l2, Math.round(x), 0, Math.round(dw), H);
  }
}

/** Desert backgrounds (Level 2) use 5 hand-painted parallax planes per
 *  variant. Stacking order back→front, with each plane's own scroll-speed
 *  multiplier for a proper depth feel:
 *    plan5 (sky gradient) → plan4 (clouds) → plan1 (far dunes)
 *    → plan3 (mid rocks/dunes) → plan2 (near ground/foliage, front-most)
 */
const DESERT_PLANE_ORDER = [
  { plane: 'plan5', speed: 0.00 },
  { plane: 'plan4', speed: 0.05 },
  { plane: 'plan1', speed: 0.12 },
  { plane: 'plan3', speed: 0.22 },
  { plane: 'plan2', speed: 0.38 },
];

function drawDesertBG() {
  const IMG = window.IMG;
  const bgKey = (curStageDef && curStageDef.bgKey) || 'bg2';

  // Base fill in case any plane image hasn't loaded
  ctx.fillStyle = '#d8c9a3'; ctx.fillRect(0, 0, W, H);

  for (const { plane, speed } of DESERT_PLANE_ORDER) {
    const img = IMG[`desert_${bgKey}_${plane}`];
    if (!img || !img.complete || !img.naturalWidth) continue;
    const dw = img.naturalWidth * (H / img.naturalHeight);
    const ox = (-camX * speed) % dw;
    for (let x = ox - dw; x < W + dw; x += dw)
      ctx.drawImage(img, Math.round(x), 0, Math.round(dw), H);
  }
}

const DESERT_SAND_COLOR = { bg1: '#d6bb83', bg2: '#c7a16d', bg3: '#b38757' };

function drawGround() {
  if (level === 2) { drawDesertGround(); return; }
  drawRooftopGround();
}

function drawDesertGround() {
  const bgKey = (curStageDef && curStageDef.bgKey) || 'bg2';
  const sandColor = DESERT_SAND_COLOR[bgKey] || '#c7a16d';

  // Ground fill colored to match the parallax art's own sand tones, so the
  // procedural ground blends with the painted foreground instead of
  // clashing with a mismatched tileset.
  ctx.fillStyle = sandColor;
  ctx.fillRect(0, GND, W, H - GND);
  // Subtle darker band at the very top edge of the sand for a horizon line
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, GND, W, 4);
  // Light texture speckle (cheap dune ripple effect), skipped over pits
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const s = Math.floor(camX / 24), e = Math.ceil((camX + W) / 24) + 1;
  for (let t = s; t < e; t++) {
    const worldX = t * 24;
    if (isOverPit(worldX + 12, 0)) continue;
    const sx = worldX - camX;
    if (t % 3 === 0) ctx.fillRect(Math.round(sx), GND + 6 + (t % 5) * 4, 16, 2);
  }

  for (const pit of pits) {
    const sx = pit.x - camX;
    if (sx > W || sx + pit.w < 0) continue;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round(sx), GND, pit.w, H - GND);
    ctx.fillStyle = '#ffcc00';
    for (let yy = 0; yy < 3; yy++) {
      ctx.fillRect(Math.round(sx), GND + yy * 8, 6, 4);
      ctx.fillRect(Math.round(sx + pit.w - 6), GND + yy * 8, 6, 4);
    }
  }

  for (const pl of platforms) {
    const sx = pl.x - camX;
    if (sx > W || sx + pl.w < 0) continue;
    ctx.fillStyle = '#a8845a';
    ctx.fillRect(Math.round(sx), pl.y, pl.w, pl.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(Math.round(sx), pl.y, pl.w, 4);
  }

  if (curStageDef && curStageDef.type === 'gate') {
    const gx = curStageDef.gateX - camX;
    if (gx > -60 && gx < W + 60) {
      ctx.fillStyle = stageClearedPending ? '#0f0a' : '#f5c518aa';
      ctx.fillRect(Math.round(gx), GND - 90, 6, 90);
      ctx.fillRect(Math.round(gx) + 40, GND - 90, 6, 90);
      ctx.fillStyle = stageClearedPending ? '#0f0' : '#f5c518';
      ctx.font = '7px "Press Start 2P",monospace'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', Math.round(gx) + 23, GND - 96); ctx.textAlign = 'left';
    }
  }
}

function drawRooftopGround() {
  const IMG = window.IMG;
  const ts  = IMG['tile_ground'];
  const bl  = IMG['tile_bldg'];

  ctx.fillStyle = '#0c0c1a';
  ctx.fillRect(0, GND, W, H - GND);

  const s = Math.floor(camX / TILE), e = Math.ceil((camX + W) / TILE) + 1;
  for (let t = s; t < e; t++) {
    const worldX = t * TILE;
    if (isOverPit(worldX + TILE / 2, 0)) continue;
    const sx = worldX - camX, col = t % 13;
    if (ts && ts.complete && ts.naturalWidth) {
      ctx.drawImage(ts, col * TILE,        0,      TILE, TILE, Math.round(sx), GND,          TILE, TILE);
      ctx.drawImage(ts, (col % 6) * TILE,  TILE,   TILE, TILE, Math.round(sx), GND + TILE,   TILE, TILE);
      ctx.drawImage(ts, (col % 6) * TILE,  TILE*2, TILE, TILE, Math.round(sx), GND + TILE*2, TILE, TILE);
    } else {
      ctx.fillStyle = '#2a2a4e'; ctx.fillRect(Math.round(sx), GND, TILE, H - GND);
    }
  }

  for (const pit of pits) {
    const sx = pit.x - camX;
    if (sx > W || sx + pit.w < 0) continue;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.round(sx), GND, pit.w, H - GND);
    ctx.fillStyle = '#ffcc00';
    for (let yy = 0; yy < 3; yy++) {
      ctx.fillRect(Math.round(sx), GND + yy * 8, 6, 4);
      ctx.fillRect(Math.round(sx + pit.w - 6), GND + yy * 8, 6, 4);
    }
  }

  for (const pl of platforms) {
    const sx = pl.x - camX;
    if (sx > W || sx + pl.w < 0) continue;
    if (bl && bl.complete && bl.naturalWidth) {
      for (let t = 0; t < Math.ceil(pl.w / TILE); t++)
        ctx.drawImage(bl, 0, 64, TILE, TILE, Math.round(sx + t * TILE), pl.y, TILE, pl.h);
    } else {
      ctx.fillStyle = '#2a3a5a'; ctx.fillRect(Math.round(sx), pl.y, pl.w, pl.h);
      ctx.fillStyle = '#4a6aba'; ctx.fillRect(Math.round(sx), pl.y, pl.w, 4);
    }
  }

  if (curStageDef && curStageDef.type === 'gate') {
    const gx = curStageDef.gateX - camX;
    if (gx > -60 && gx < W + 60) {
      ctx.fillStyle = stageClearedPending ? '#0f0a' : '#f5c518aa';
      ctx.fillRect(Math.round(gx), GND - 90, 6, 90);
      ctx.fillRect(Math.round(gx) + 40, GND - 90, 6, 90);
      ctx.fillStyle = stageClearedPending ? '#0f0' : '#f5c518';
      ctx.font = '7px "Press Start 2P",monospace'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', Math.round(gx) + 23, GND - 96); ctx.textAlign = 'left';
    }
  }
}

function shadow(x, y, rx = 26, ry = 5) {
  ctx.fillStyle = 'rgba(0,0,0,0.27)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer() {
  const p = player; if (!p) return;
  const sx = p.x - camX;
  if (p.inv > 0 && Math.floor(p.inv / 5) % 2 === 1) ctx.globalAlpha = 0.35;
  if (!p.fallingToDeath) shadow(sx + 48, GND + 2, 30);
  (p.spr[p.state] || p.spr.idle).draw(ctx, sx, p.y, p.face === -1, 2);
  ctx.globalAlpha = 1;
  if (p.hp < p.maxHp && !p.fallingToDeath) {
    const bw = 80, bx = sx + 48 - bw / 2, by = p.y - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
    const pct = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = pct > 0.5 ? '#0e0' : pct > 0.25 ? '#fa0' : '#f00';
    ctx.fillRect(bx, by, Math.round(bw * pct), 6);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const sx = e.x - camX;
    if (sx < -200 || sx > W + 200) continue;
    if (e.hitF > 0 && Math.floor(e.hitF / 2) % 2 === 0) ctx.globalAlpha = 0.25;

    if (e.isCreature) {
      // Creature canvases are larger than their hitbox (padding around the
      // art); center the drawn canvas on the hitbox horizontally, and align
      // its bottom to the hitbox bottom so feet/base touch the ground.
      // Position using the *currently playing* sprite's own native frame
      // size — body anims (idle/walk/attack/hurt/death) share one canvas
      // size, but special ranged anims (fire_attack/magic_attack) use a
      // different native size, so we can't assume e.canvasSize here.
      const drawSize = e.curSpr.fw * e.scale;
      const isBaseCanvas = e.curSpr.fw === e.cfg.canvas;
      const footPad = isBaseCanvas ? e.cfg.footInset * e.scale : 0;
      const drawX = sx + e.w / 2 - drawSize / 2;
      const drawY = e.y + e.h - drawSize + footPad;
      shadow(sx + e.w / 2, GND + 2, Math.max(18, e.w * 0.5));
      e.curSpr.draw(ctx, drawX, drawY, e.face === -1, e.scale);
      ctx.globalAlpha = 1;

      if (e.alive && e.alert) {
        const bw = 50, bx = sx + e.w / 2 - bw / 2, by = e.y - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 5);
        const hp = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = hp > 0.5 ? '#0c0' : hp > 0.25 ? '#fa0' : '#f00';
        ctx.fillRect(bx, by, Math.round(bw * hp), 5);

        // Archetype tag
        const tag = { rusher: ['⚡', '#ff5050'], sniper: ['◎', '#50c8ff'], medusa: ['☗', '#8aff8a'] }[e.archetype];
        if (tag) {
          ctx.fillStyle = tag[1];
          ctx.font = '6px "Press Start 2P",monospace'; ctx.textAlign = 'center';
          ctx.fillText(tag[0], sx + e.w / 2, by - 4); ctx.textAlign = 'left';
        }
        // Medusa stone-charge warning
        if (e.stoneCharging) {
          ctx.fillStyle = '#8aff8a';
          ctx.font = '6px "Press Start 2P",monospace'; ctx.textAlign = 'center';
          ctx.fillText('PETRIFYING!', sx + e.w / 2, by - 12); ctx.textAlign = 'left';
        }
      }
      continue;
    }

    shadow(sx + 48, GND + 2, 28);
    e.curSpr.draw(ctx, sx, e.y, e.face === -1, 2);
    ctx.globalAlpha = 1;
    if (e.alive && e.alert) {
      const bw = 56, bx = sx + 48 - bw / 2, by = e.y - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, 5);
      const hp = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = hp > 0.5 ? '#0c0' : hp > 0.25 ? '#fa0' : '#f00';
      ctx.fillRect(bx, by, Math.round(bw * hp), 5);

      if (e.archetype === 'rusher') {
        ctx.fillStyle = '#ff5050';
        ctx.font = '6px "Press Start 2P",monospace'; ctx.textAlign = 'center';
        ctx.fillText('⚡', sx + 48, by - 4); ctx.textAlign = 'left';
      } else if (e.archetype === 'sniper') {
        ctx.fillStyle = '#50c8ff';
        ctx.font = '6px "Press Start 2P",monospace'; ctx.textAlign = 'center';
        ctx.fillText('◎', sx + 48, by - 4); ctx.textAlign = 'left';
      }
    }
  }
}

function drawBossSprite() {
  if (!boss) return;
  if (level === 2) { drawMiniMausi(); return; }
  drawCyprusCocopta();
}

function drawCyprusCocopta() {
  if (!boss) return;
  const sx = boss.x - camX;
  if (sx < -300 || sx > W + 300) return;

  if (boss.dying) ctx.globalAlpha = Math.max(0, boss.dyingTimer / 70);
  shadow(sx + boss.w / 2, GND + 4, 50, 9);
  if (boss.curSpr) {
    const drawX = sx - (boss.drawW - boss.w) / 2;
    boss.curSpr.draw(ctx, drawX, boss.y, boss.face === -1, BOSS_DRAW_SCALE);
  }
  ctx.globalAlpha = 1;

  if (!boss.dying) {
    const bw = W - 100, bx = 50, by = H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#300'; ctx.fillRect(bx, by, bw, 10);
    const pct = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = boss.phase === 2 ? '#f00' : boss.phase === 1 ? '#fa0' : '#0c0';
    ctx.fillRect(bx, by, Math.round(bw * pct), 10);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(bx, by, bw, 4);
    ctx.font = '7px "Press Start 2P",monospace';
    ctx.fillStyle = '#f5c518'; ctx.textAlign = 'center';
    ctx.fillText('★  CYPRUS-COCOPTA  ★', W / 2, by - 5);
    ctx.textAlign = 'left';
  }
}

function drawMiniMausi() {
  const b = boss; if (!b) return;
  const sx = b.x - camX;
  if (sx < -300 || sx > W + 300) return;

  if (b.dying) ctx.globalAlpha = Math.max(0, b.dyingTimer / 70);

  shadow(sx + b.w / 2, GND + 3, 42, 8);
  if (b.curSpr) {
    // Center the draw canvas on the hitbox, bottom-align to feet
    const drawX = sx + b.w / 2 - b.drawW / 2;
    const drawY = b.y + b.h - b.drawH;
    b.curSpr.draw(ctx, drawX, drawY, b.face === -1, MM_SCALE);
  }
  ctx.globalAlpha = 1;

  if (!b.dying) {
    const bw = W - 100, bx = 50, by = H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#1a0a00'; ctx.fillRect(bx, by, bw, 10);
    const pct = Math.max(0, b.hp / b.maxHp);
    ctx.fillStyle = b.phase === 2 ? '#f00' : b.phase === 1 ? '#fa0' : '#a00';
    ctx.fillRect(bx, by, Math.round(bw * pct), 10);
    ctx.fillStyle = 'rgba(255,100,0,0.2)'; ctx.fillRect(bx, by, bw, 4);
    ctx.font = '7px "Press Start 2P",monospace';
    ctx.fillStyle = '#ff8844'; ctx.textAlign = 'center';
    ctx.fillText("★  MINI-MAUSI-CHRENO'BELLOW  ★", W / 2, by - 5);
    ctx.textAlign = 'left';
  }
}

function drawBullets() {
  for (const b of bullets) {
    const sx = Math.round(b.x - camX), sy = Math.round(b.y);
    if (b.fire) {
      // Fire breath — orange-yellow fireball with glow
      ctx.fillStyle = '#ff6600'; ctx.fillRect(sx - 6, sy - 4, 14, 7);
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx - 4, sy - 2, 9, 4);
      ctx.fillStyle = 'rgba(255,100,0,0.3)'; ctx.fillRect(sx - 10, sy - 6, 20, 11);
    } else if (b.magic) {
      // Jinn magic bolt — blue-purple with crackle
      ctx.fillStyle = '#aa44ff'; ctx.fillRect(sx - 5, sy - 5, 10, 10);
      ctx.fillStyle = '#cc99ff'; ctx.fillRect(sx - 3, sy - 3, 6, 6);
      ctx.fillStyle = 'rgba(150,0,255,0.3)'; ctx.fillRect(sx - 8, sy - 8, 16, 16);
    } else if (b.isEnemy) {
      ctx.fillStyle = '#f44'; ctx.fillRect(sx - 5, sy - 3, 11, 5);
      ctx.fillStyle = '#ff0'; ctx.fillRect(sx - 3, sy - 1, 7, 3);
    } else {
      ctx.fillStyle = '#ffe060'; ctx.fillRect(sx - 7, sy - 3, 15, 5);
      ctx.fillStyle = '#fff';   ctx.fillRect(sx - 5, sy - 1, 9, 3);
      ctx.fillStyle = 'rgba(255,220,80,0.3)'; ctx.fillRect(sx - 18, sy - 2, 12, 4);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    const sx = Math.round(p.x - camX), sy = Math.round(p.y);
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.type === 'ring') {
      ctx.strokeStyle = '#f80a'; ctx.lineWidth = 3;
      const r = p.sz * (1 - p.life / p.max) * 2;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.col; ctx.fillRect(sx - p.sz / 2, sy - p.sz / 2, p.sz, p.sz);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPickups() {
  for (const pk of pickups) {
    const sx = Math.round(pk.x - camX), sy = Math.round(pk.y);
    const bob = Math.sin(frameN * 0.12) * 3;
    const g = window.IMG['gun_01'];
    ctx.fillStyle = pk.type === 'ammo' ? 'rgba(245,197,24,0.18)' : 'rgba(255,80,80,0.18)';
    ctx.beginPath(); ctx.arc(sx + 8, sy + 12 + bob, 20, 0, Math.PI * 2); ctx.fill();
    if (pk.type === 'ammo' && g && g.complete)
      ctx.drawImage(g, sx, sy + bob, 32, 32);
    else {
      ctx.fillStyle = pk.type === 'ammo' ? '#f5c518' : '#e55';
      ctx.fillRect(sx, sy + bob, 22, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '7px "Press Start 2P",monospace';
      ctx.fillText(pk.type === 'ammo' ? 'A' : 'H', sx + 4, sy + 15 + bob);
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   HUD
   ────────────────────────────────────────────────────────────────────────── */
function updateHUD() {
  const p = player;
  document.getElementById('score-el').textContent  = String(score).padStart(6, '0');
  document.getElementById('lives-el').textContent  = '♥'.repeat(Math.max(0, lives));
  document.getElementById('lvl-el').textContent    = level + '-' + stage;
  if (!p) return;
  const pct = Math.max(0, p.hp / p.maxHp);
  const hf  = document.getElementById('hp-fill');
  if (hf) {
    hf.style.width = Math.round(pct * 130) + 'px';
    hf.style.background = pct > 0.5
      ? 'linear-gradient(to right,#060,#0e0)'
      : pct > 0.25 ? 'linear-gradient(to right,#860,#fa0)'
                   : 'linear-gradient(to right,#700,#f00)';
  }
  document.getElementById('ammo-el').textContent  = p.ammo + '/' + p.maxAmmo;
  document.getElementById('char-nm').textContent  = p.def.name;

  const gi = document.getElementById('gun-icon');
  const gk = 'gun_' + String(p.gunIdx).padStart(2, '0');
  if (gi && window.IMG[gk] && window.IMG[gk].complete) gi.src = window.IMG[gk].src;

  const pc  = document.getElementById('portrait');
  if (pc) {
    const pcx = pc.getContext('2d');
    pcx.imageSmoothingEnabled = false;
    pcx.clearRect(0, 0, 38, 38);
    const is = p.spr.idle, im = window.IMG[is.key];
    if (im && im.complete && im.naturalWidth) {
      const fr = Math.floor(frameN / 10) % is.fc;
      pcx.drawImage(im, fr * 48, 0, 48, 48, 0, 0, 38, 38);
    }
  }
  const hpImg  = window.IMG['ui_hp_frame'];
  const hpBgEl = document.getElementById('hp-bg-img');
  if (hpImg && hpImg.complete && hpBgEl && !hpBgEl._set) {
    hpBgEl.src = hpImg.src; hpBgEl._set = true;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   GAME FLOW
   ────────────────────────────────────────────────────────────────────────── */
function playerDie() {
  lives--; updateHUD();
  if (lives <= 0) {
    running = false; gameOver = true;
    window.showOverlay('GAME OVER', `SCORE: ${score}`, '► TRY AGAIN', '#f44');
  } else {
    setTimeout(() => {
      player = mkPlayer(selectedChar);
      player.x = Math.max(camX + 80, 120); player.y = GND - 96; player.inv = 150;
      updateHUD();
    }, 1600);
    player = null;
  }
}

function stageClear() {
  running = false;
  const key = `${level}-${stage}`;
  const isLevelFinal = stage >= 3;

  if (isLevelFinal) {
    window.showOverlay(
      'LEVEL CLEAR!',
      `LEVEL ${level} COMPLETE — SCORE: ${score}`,
      '► CONTINUE',
      '#0f0'
    );
  } else {
    window.showOverlay(
      'STAGE CLEAR!',
      `STAGE ${key} COMPLETE — SCORE: ${score}`,
      '► NEXT STAGE',
      '#0f0'
    );
  }
}

function advanceStage() {
  if (stage >= 3) {
    level++; stage = 1;
  } else {
    stage++;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   MAIN LOOP
   ────────────────────────────────────────────────────────────────────────── */
let rafId = null, lastTs = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 16.67, 2.5);
  lastTs = ts; frameN++;

  if (running) {
    updatePlayer(); updateEnemies(); updateCreatures();
    checkBoss();
    if (boss) {
      if (level === 2) updateMiniMausi();
      else updateBoss();
    }
    updateBullets(); updateParticles(); updatePickups();
    if (comboT > 0) comboT--; else combo = 0;
    if (frameN % 3 === 0) updateHUD();
  }

  ctx.save();
  if (shake > 0) {
    ctx.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
    shake = Math.max(0, shake - 1);
  }
  drawBG(); drawGround();
  drawPickups(); drawParticles();
  drawEnemies();
  if (boss) drawBossSprite();
  drawPlayer(); drawBullets();

  if (curStageDef && frameN < 200) {
    const a = frameN < 150 ? 1 : Math.max(0, (200 - frameN) / 50);
    ctx.globalAlpha = a;
    ctx.font = '8px "Press Start 2P",monospace';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(curStageDef.label, 14, 28);
    ctx.globalAlpha = 1;
  }

  if (comboT > 0 && combo >= 2) {
    const a = Math.min(1, comboT / 20);
    ctx.globalAlpha = a;
    ctx.font = 'bold 14px "Press Start 2P",monospace';
    ctx.fillStyle = '#ff0'; ctx.textAlign = 'center';
    ctx.fillText(combo + 'x COMBO!', W / 2, 70);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  if (curStageDef && curStageDef.type === 'boss' && boss && boss.alive && !boss.dying && boss.x - camX > W + 50) {
    if (Math.floor(frameN / 15) % 2 === 0) {
      ctx.font = '9px "Press Start 2P",monospace'; ctx.fillStyle = '#f44'; ctx.textAlign = 'center';
      const warnName = level === 2 ? "MINI-MAUSI INCOMING!" : "CYPRUS-COCOPTA INCOMING!";
      ctx.fillText(`⚠  ${warnName}  ⚠`, W / 2, 38); ctx.textAlign = 'left';
    }
  }
  // Kill-gate counter for stage 2-2
  if (curStageDef && curStageDef.type === 'killgate' && !stageClearedPending) {
    const remaining = Math.max(0, curStageDef.killGoal - killCount);
    const unlocked = remaining === 0;
    ctx.font = '8px "Press Start 2P",monospace';
    ctx.fillStyle = unlocked ? '#0f0' : '#f5c518';
    ctx.textAlign = 'center';
    if (unlocked) {
      if (Math.floor(frameN / 20) % 2 === 0)
        ctx.fillText('★ GATE UNLOCKED — ADVANCE! →', W / 2, 38);
    } else {
      ctx.fillText(`KILL COUNT: ${killCount} / ${curStageDef.killGoal}`, W / 2, 38);
    }
    ctx.textAlign = 'left';
  }
  if (curStageDef && curStageDef.type === 'gate' && !stageClearedPending && player) {
    const distToGate = curStageDef.gateX - player.x;
    if (distToGate > 0 && distToGate < 500 && enemies.some(e => e.alive)) {
      if (Math.floor(frameN / 20) % 2 === 0) {
        ctx.font = '8px "Press Start 2P",monospace'; ctx.fillStyle = '#fa0'; ctx.textAlign = 'center';
        ctx.fillText('→ REACH THE EXIT GATE', W / 2, 38); ctx.textAlign = 'left';
      }
    }
  }

  ctx.restore();

  if (window.drawTouchHUD) window.drawTouchHUD(ctx, W, H);

  rafId = requestAnimationFrame(loop);
}

/* ──────────────────────────────────────────────────────────────────────────
   PUBLIC API  (called from index.html)
   ────────────────────────────────────────────────────────────────────────── */
window.startGame = function (charId) {
  selectedChar = charId || selectedChar;
  if (gameOver) { score = 0; lives = 3; level = 1; stage = 1; gameOver = false; }
  setupStage();
  player = mkPlayer(selectedChar);
  updateHUD();
  running = true;
  frameN = 0;
  if (rafId) cancelAnimationFrame(rafId);
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
};

window.continueToNextStage = function () {
  advanceStage();
  setupStage();
  player = mkPlayer(selectedChar);
  updateHUD();
  running = true;
  frameN = 0;
  if (rafId) cancelAnimationFrame(rafId);
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
};

window.showOverlay = function (title, sub, btn, col = '#f5c518') {
  const ov = document.getElementById('ov');
  if (!ov) return;
  const isStageClear = title === 'STAGE CLEAR!' || title === 'LEVEL CLEAR!';
  ov.innerHTML = `
    <div class="ov-title" style="color:${col};text-shadow:3px 3px 0 #000,0 0 22px ${col}88">${title}</div>
    <div class="ov-sub">${sub}</div>
    <button class="ov-btn" id="dyn-btn" style="color:${col}">${btn}</button>`;
  ov.style.display = 'flex';
  document.getElementById('dyn-btn').addEventListener('click', () => {
    ov.style.display = 'none';
    if (isStageClear) {
      window.continueToNextStage();
    } else {
      window.startGame(selectedChar);
    }
  });
};
