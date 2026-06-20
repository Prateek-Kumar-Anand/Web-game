'use strict';
/**
 * IRON SLUG – Sprite Engine
 * Handles frame-based sprite sheet animation.
 */

class Sprite {
  /**
   * @param {string} key    – key in window.IMG
   * @param {number} fw     – frame width  (px in source)
   * @param {number} fh     – frame height (px in source)
   * @param {number} fc     – total frames
   * @param {number} fps    – playback speed
   * @param {boolean} loop  – loop or play once
   */
  constructor(key, fw, fh, fc, fps = 8, loop = true) {
    this.key  = key;
    this.fw   = fw;  this.fh = fh;
    this.fc   = fc;  this.fps = fps;
    this.loop = loop;
    this.t    = 0;   this.f = 0;
    this.done = false;
  }

  clone() {
    return new Sprite(this.key, this.fw, this.fh, this.fc, this.fps, this.loop);
  }

  reset() { this.t = 0; this.f = 0; this.done = false; }

  update() {
    if (this.done && !this.loop) return;
    if (++this.t >= 60 / this.fps) {
      this.t = 0;
      if (this.loop) {
        this.f = (this.f + 1) % this.fc;
      } else {
        if (this.f < this.fc - 1) this.f++;
        else this.done = true;
      }
    }
  }

  /**
   * Draw the current frame onto ctx.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x       – screen X (camera-adjusted)
   * @param {number} y       – screen Y
   * @param {boolean} flip   – mirror horizontally
   * @param {number} scale   – pixel scale multiplier
   */
  draw(ctx, x, y, flip = false, scale = 2) {
    const img = window.IMG[this.key];
    if (!img || !img.complete || !img.naturalWidth) return;
    const dw = this.fw * scale;
    const dh = this.fh * scale;
    ctx.save();
    if (flip) {
      ctx.translate(x + dw / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + dw / 2), 0);
    }
    ctx.drawImage(img, this.f * this.fw, 0, this.fw, this.fh,
                  Math.round(x), Math.round(y), dw, dh);
    ctx.restore();
  }

  /** Draw a specific frame (ignores internal state). */
  drawFrame(ctx, frame, x, y, flip = false, scale = 2) {
    const img = window.IMG[this.key];
    if (!img || !img.complete || !img.naturalWidth) return;
    const dw = this.fw * scale, dh = this.fh * scale;
    ctx.save();
    if (flip) {
      ctx.translate(x + dw / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + dw / 2), 0);
    }
    ctx.drawImage(img, frame * this.fw, 0, this.fw, this.fh,
                  Math.round(x), Math.round(y), dw, dh);
    ctx.restore();
  }
}

window.Sprite = Sprite;
