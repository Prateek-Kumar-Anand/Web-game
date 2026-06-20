'use strict';
/**
 * IRON SLUG – Touch Controls
 * Virtual D-pad (left side) + action buttons (right side).
 * Writes into window.VKEYS which the game reads like keyboard input.
 */

window.VKEYS = {
  left: false, right: false, up: false, down: false,
  attack: false, jump: false, special: false,
};

(function () {
  const vk = window.VKEYS;

  /* ── Touch tracking ─────────────────────────────────────────────────────── */
  const touches = {};   // identifier → { startX, startY, curX, curY, zone }

  function getZone(x, y, W, H) {
    const lHalf = x < W * 0.45;
    if (lHalf) return 'dpad';
    // Right side buttons
    if (y > H * 0.55) return 'attack';
    if (y > H * 0.25) return 'jump';
    return 'special';
  }

  function recalc() {
    // Reset all
    vk.left = vk.right = vk.up = vk.down = false;
    vk.attack = vk.jump = vk.special = false;

    const W = window.innerWidth, H = window.innerHeight;
    for (const id in touches) {
      const t = touches[id];
      if (t.zone === 'dpad') {
        const dx = t.curX - t.startX;
        const dy = t.curY - t.startY;
        const dead = 12;
        if (dx < -dead) vk.left  = true;
        if (dx >  dead) vk.right = true;
        if (dy < -dead) vk.up    = true;
        if (dy >  dead) vk.down  = true;
      } else if (t.zone === 'attack')  { vk.attack  = true; }
      else if (t.zone === 'jump')    { vk.jump    = true; }
      else if (t.zone === 'special') { vk.special = true; }
    }
  }

  document.addEventListener('touchstart', e => {
    e.preventDefault();
    const W = window.innerWidth, H = window.innerHeight;
    for (const t of e.changedTouches) {
      touches[t.identifier] = {
        startX: t.clientX, startY: t.clientY,
        curX:   t.clientX, curY:   t.clientY,
        zone: getZone(t.clientX, t.clientY, W, H),
      };
    }
    recalc();
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (touches[t.identifier]) {
        touches[t.identifier].curX = t.clientX;
        touches[t.identifier].curY = t.clientY;
      }
    }
    recalc();
  }, { passive: false });

  document.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) delete touches[t.identifier];
    recalc();
  }, { passive: false });

  document.addEventListener('touchcancel', e => {
    e.preventDefault();
    for (const t of e.changedTouches) delete touches[t.identifier];
    recalc();
  }, { passive: false });
})();


/* ── Draw the HUD overlay (called every frame) ─────────────────────────────── */
window.drawTouchHUD = function (ctx, W, H) {
  const vk = window.VKEYS;
  const alpha = 0.38;

  ctx.save();
  ctx.globalAlpha = alpha;

  /* ── D-Pad ── */
  const cx = W * 0.12, cy = H * 0.72, r = H * 0.14;
  // Outer ring
  ctx.fillStyle = '#ffffff22';
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();

  function arrow(ax, ay, rot, active) {
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(rot);
    ctx.fillStyle = active ? '#ffffffcc' : '#ffffff55';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(12, 4); ctx.lineTo(-12, 4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  arrow(cx,      cy - r * 0.7, 0,            vk.up);
  arrow(cx,      cy + r * 0.7, Math.PI,      vk.down);
  arrow(cx - r * 0.7, cy,      -Math.PI / 2, vk.left);
  arrow(cx + r * 0.7, cy,       Math.PI / 2, vk.right);

  // Centre dot
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();

  /* ── Action buttons ── */
  const btnR = H * 0.075;
  const buttons = [
    { x: W * 0.88, y: H * 0.38, key: 'jump',    label: 'JUMP', col: '#60c8ff' },
    { x: W * 0.76, y: H * 0.60, key: 'attack',  label: 'ATK',  col: '#ff6060' },
    { x: W * 0.92, y: H * 0.68, key: 'special',  label: 'SPL',  col: '#ffe060' },
  ];

  for (const b of buttons) {
    const active = vk[b.key];
    ctx.fillStyle = active ? b.col + 'bb' : b.col + '33';
    ctx.strokeStyle = active ? b.col + 'ff' : b.col + '77';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, btnR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = active ? 0.95 : 0.55;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(H * 0.028)}px 'Press Start 2P', monospace`;
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
