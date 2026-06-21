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
    atkCd: 0, atkTimer: 0, atkDmgDone: false, attacking: false,
    onGnd: false,
    jumped: false, djumped: false,
    crouching: false, djumpTimer: 0,
    shootCd: 0,
    gunIdx: 1,
    fallingToDeath: false,
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
   STAGE DEFINITIONS — Level 1 (Rooftop)
   ────────────────────────────────────────────────────────────────────────── */

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

const STAGE_BUILDERS = {
  '1-1': buildStage_1_1,
  '1-2': buildStage_1_2,
  '1-3': buildStage_1_3,
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
    score += e.type === 'cyborg' ? 300 : 150;
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
  if (boss.hp <= 0) {
    boss.alive = false;
    score += 6000;
    boss.dying = true; boss.dyingTimer = 70;
    explodeAt(boss.x + boss.w / 2, boss.y + boss.h / 2, 70);
    setTimeout(() => explodeAt(boss.x + 20, boss.y + 20, 50), 250);
    setTimeout(() => explodeAt(boss.x + boss.w - 20, boss.y + 40, 60), 500);
    setTimeout(() => explodeAt(boss.x + boss.w / 2, boss.y + 60, 80), 800);
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
  const drawH = BOSS_FRAME * BOSS_DRAW_SCALE; // ~115px, vs player's 96px
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
  if (p.shootCd > 0) p.shootCd--;
  if (p.djumpTimer > 0) p.djumpTimer--;

  if (p.state === 'death') { p.spr.death.update(); if (p.spr.death.done) playerDie(); return; }

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

  if (K.attack() && p.atkCd <= 0) {
    p.atkCd = 16; p.attacking = true; p.atkTimer = 16; p.atkDmgDone = false;
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
  if (p.attacking) {
    p.atkTimer--;
    if (!p.atkDmgDone && p.atkTimer < 8) {
      p.atkDmgDone = true;
      const hbx = p.x + (p.face > 0 ? p.w * 2 : -60), hby = p.y + 24;
      for (const e of enemies) {
        if (!e.alive || e.dying) continue;
        if (rr(hbx, hby, 60, 48, e.x, e.y, e.w, e.h)) hurtEnemy(e, p.def.atk * 0.7);
      }
      if (boss && !boss.dying && rr(hbx, hby, 60, 48, boss.x, boss.y, boss.w, boss.h)) hurtBoss(p.def.atk * 0.5);
    }
    if (p.atkTimer <= 0) p.attacking = false;
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
  bossSpawned = true; boss = mkBoss();
}

/* ──────────────────────────────────────────────────────────────────────────
   DRAW
   ────────────────────────────────────────────────────────────────────────── */
function drawBG() {
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

function drawGround() {
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
  const sx = boss.x - camX;
  if (sx < -300 || sx > W + 300) return;

  if (boss.dying) ctx.globalAlpha = Math.max(0, boss.dyingTimer / 70);

  shadow(sx + boss.w / 2, GND + 4, 50, 9);
  if (boss.curSpr) {
    const drawX = sx - (boss.drawW - boss.w) / 2;
    boss.curSpr.draw(ctx, drawX, boss.y, boss.face === -1, BOSS_DRAW_SCALE * 2);
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

function drawBullets() {
  for (const b of bullets) {
    const sx = Math.round(b.x - camX), sy = Math.round(b.y);
    if (b.isEnemy) {
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
    updatePlayer(); updateEnemies();
    checkBoss();
    if (boss) updateBoss();
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
      ctx.fillText('⚠  CYPRUS-COCOPTA INCOMING!  ⚠', W / 2, 38); ctx.textAlign = 'left';
    }
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
