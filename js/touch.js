'use strict';
/**
 * IRON SLUG – Touch Controls
 * Virtual D-pad (left side) + action buttons (right side), drawn directly
 * on the game canvas. Writes into window.VKEYS which game.js reads
 * exactly like keyboard input.
 *
 * IMPORTANT: the canvas is rendered at a fixed internal resolution
 * (800x450 — see game.js: const W=800,H=450) but displayed at a
 * different CSS size (scaled + letterboxed via object-fit: contain).
 * All touch math below converts real screen touch coordinates into
 * that same 800x450 internal space, so the invisible touch zones line
 * up exactly with the buttons drawn by drawTouchHUD().
 */

window.VKEYS = {
  left: false, right: false, up: false, down: false,
  attack: false, jump: false, special: false,
};

(function () {
  const vk = window.VKEYS;
  const GAME_W = 800, GAME_H = 450; // must match game.js W/H

  let canvasEl = null;
  function getCanvas() {
    if (!canvasEl) canvasEl = document.getElementById('gc');
    return canvasEl;
  }

  /* ── Convert a raw touch (clientX/clientY) into internal canvas-space coords ── */
  function toCanvasSpace(clientX, clientY) {
    const c = getCanvas();
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return { x: relX * GAME_W, y: relY * GAME_H };
  }

  /* ── Button hit-zone definitions (MUST match drawTouchHUD layout below) ── */
  function dpadCenter() {
    return { cx: GAME_W * 0.12, cy: GAME_H * 0.72, r: GAME_H * 0.14 };
  }
  function actionButtons() {
    const btnR = GAME_H * 0.075;
    return [
      { x: GAME_W * 0.88, y: GAME_H * 0.38, key: 'jump',    r: btnR * 1.4 },
      { x: GAME_W * 0.76, y: GAME_H * 0.60, key: 'attack',  r: btnR * 1.4 },
      { x: GAME_W * 0.92, y: GAME_H * 0.68, key: 'special', r: btnR * 1.4 },
    ];
  }

  function getZone(cx, cy) {
    const dpad = dpadCenter();
    const distToDpad = Math.hypot(cx - dpad.cx, cy - dpad.cy);
    if (distToDpad < dpad.r * 1.6) return { zone: 'dpad', cx: dpad.cx, cy: dpad.cy };

    for (const b of actionButtons()) {
      const d = Math.hypot(cx - b.x, cy - b.y);
      if (d < b.r) return { zone: b.key };
    }
    // Fallback: left half of screen = dpad
    if (cx < GAME_W * 0.45) return { zone: 'dpad', cx: dpad.cx, cy: dpad.cy };
    return { zone: null };
  }

  /* ── Touch tracking ─────────────────────────────────────────────────────── */
  const touches = {}; // identifier -> { zone, startX, startY, curX, curY }

  function recalc() {
    vk.left = vk.right = vk.up = vk.down = false;
    vk.attack = vk.jump = vk.special = false;

    for (const id in touches) {
      const t = touches[id];
      if (t.zone === 'dpad') {
        const dx = t.curX - t.startX;
        const dy = t.curY - t.startY;
        const dead = 10; // canvas-space px
        if (dx < -dead) vk.left  = true;
        if (dx >  dead) vk.right = true;
        if (dy < -dead) vk.up    = true;
        if (dy >  dead) vk.down  = true;
      } else if (t.zone === 'jump')    { vk.jump    = true; }
      else if (t.zone === 'attack')  { vk.attack  = true; }
      else if (t.zone === 'special') { vk.special = true; }
    }
  }

  function handleStart(e) {
    // Don't hijack touches on the overlay (char-select / start / game-over
    // buttons are real DOM elements and need their native click behavior).
    const ov = document.getElementById('ov');
    if (ov && ov.style.display !== 'none' && ov.contains(e.target)) return;

    e.preventDefault();
    for (const t of e.changedTouches) {
      const pt = toCanvasSpace(t.clientX, t.clientY);
      if (!pt) continue;
      const z = getZone(pt.x, pt.y);
      touches[t.identifier] = {
        zone: z.zone,
        startX: pt.x, startY: pt.y,
        curX: pt.x, curY: pt.y,
      };
    }
    recalc();
  }

  function handleMove(e) {
    const ov = document.getElementById('ov');
    if (ov && ov.style.display !== 'none' && ov.contains(e.target)) return;

    e.preventDefault();
    for (const t of e.changedTouches) {
      const rec = touches[t.identifier];
      if (!rec) continue;
      const pt = toCanvasSpace(t.clientX, t.clientY);
      if (!pt) continue;
      rec.curX = pt.x; rec.curY = pt.y;
    }
    recalc();
  }

  function handleEnd(e) {
    const ov = document.getElementById('ov');
    if (ov && ov.style.display !== 'none' && ov.contains(e.target)) return;

    e.preventDefault();
    for (const t of e.changedTouches) delete touches[t.identifier];
    recalc();
  }

  /* ── Attach listeners once the DOM exists.
        Listen on #stage (the canvas's wrapper) so taps register even if the
        canvas is letterboxed and #stage has extra padding around it. ── */
  function attach() {
    const target = document.getElementById('stage') || document.body;
    target.addEventListener('touchstart',  handleStart, { passive: false });
    target.addEventListener('touchmove',   handleMove,  { passive: false });
    target.addEventListener('touchend',    handleEnd,   { passive: false });
    target.addEventListener('touchcancel', handleEnd,   { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }

  /* Expose for debugging from the console: window.VKEYS_DEBUG() */
  window.VKEYS_DEBUG = function () {
    console.log('Active touches:', JSON.parse(JSON.stringify(touches)));
    console.log('VKEYS:', JSON.parse(JSON.stringify(vk)));
  };
})();


/* ── Draw the HUD overlay (called every frame, in internal canvas space) ──── */
window.drawTouchHUD = function (ctx, W, H) {
  const vk = window.VKEYS;
  const alpha = 0.42;

  ctx.save();
  ctx.globalAlpha = alpha;

  /* ── D-Pad ── */
  const cx = W * 0.12, cy = H * 0.72, r = H * 0.14;
  ctx.fillStyle = '#ffffff22';
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.stroke();

  function arrow(ax, ay, rot, active) {
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(rot);
    ctx.fillStyle = active ? '#ffffffee' : '#ffffff66';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(12, 4); ctx.lineTo(-12, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  arrow(cx,      cy - r * 0.7, 0,            vk.up);
  arrow(cx,      cy + r * 0.7, Math.PI,      vk.down);
  arrow(cx - r * 0.7, cy,      -Math.PI / 2, vk.left);
  arrow(cx + r * 0.7, cy,       Math.PI / 2, vk.right);

  ctx.fillStyle = '#ffffff33';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();

  /* ── Action buttons ── */
  const btnR = H * 0.075;
  const buttons = [
    { x: W * 0.88, y: H * 0.38, key: 'jump',    label: 'JUMP', col: '#60c8ff' },
    { x: W * 0.76, y: H * 0.60, key: 'attack',  label: 'ATK',  col: '#ff6060' },
    { x: W * 0.92, y: H * 0.68, key: 'special', label: 'SPL',  col: '#ffe060' },
  ];

  for (const b of buttons) {
    const active = vk[b.key];
    ctx.fillStyle = active ? b.col + 'cc' : b.col + '3a';
    ctx.strokeStyle = active ? b.col + 'ff' : b.col + '88';
    ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, btnR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = active ? 1 : 0.65;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(H * 0.03)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y);
    ctx.globalAlpha = alpha;
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
};
