/**
 * The vibes layer: cameo actors on the 640×360 hi-bit canvas.
 * Purely cosmetic — Math.random is fine here, the sim never sees any of it.
 * (Exception: the rare pegasus flyby is clickable; the UI routes that tap
 * back into the sim as a proper transaction.)
 */
import {
  OUTLINE, type Part, cachedSprite, drawAlienGuy, drawKid, drawLemonFolk, drawPerson, drawShadow, paintParts, shade,
} from './sprites';

type Kind = 'birds' | 'plane' | 'ufo' | 'ufoland' | 'bigfoot' | 'rockstars' | 'kaiju' | 'picnic' | 'catch' | 'busker' | 'pegasus' | 'frisbee';

interface Actor { kind: Kind; x: number; y: number; vx: number; t: number; phase: number; life: number; ok?: boolean; fired?: boolean; }

export type CameoKind = 'kaiju' | 'ufo' | 'pegasus';
export interface AmbientHooks {
  onCameo?: (kind: CameoKind) => void;
  alienSale?: () => { ok: boolean };
}

/* ------------------------------ Bigfoot ------------------------------ */

const FUR = '#6f5138';
const FUR_LIGHT_TINT = '#8a6a4b';

function bigfootSprite(frame: number, opts: { sit?: boolean; her?: boolean; sip?: boolean }): HTMLCanvasElement {
  const fur = opts.her ? FUR_LIGHT_TINT : FUR;
  const dark = shade(fur, -34);
  const lite = shade(fur, 26);
  const skin = opts.her ? '#d8b48c' : '#c9a37c';
  const key = `bf|${frame % 2}|${opts.sit ? 1 : 0}|${opts.her ? 1 : 0}|${opts.sip ? 1 : 0}`;
  return cachedSprite(key, 30, 48, (c) => {
    const A = frame % 2 === 0;
    const parts: Part[] = [];
    // head with brow ridge + muzzle
    parts.push({ x: 9, y: 0, w: 12, h: 11, c: fur });
    // torso (broad shoulders, tapered hips)
    const torsoY = 11;
    parts.push({ x: 6, y: torsoY, w: 18, h: 9, c: fur });
    parts.push({ x: 7, y: torsoY + 9, w: 16, h: 8, c: fur });
    if (opts.sit) {
      // folded legs out front
      parts.push({ x: 8, y: 26, w: 14, h: 6, c: fur });
      parts.push({ x: 5, y: 29, w: 8, h: 5, c: dark });
      parts.push({ x: 17, y: 29, w: 8, h: 5, c: dark });
    } else {
      parts.push({ x: 8, y: 28, w: 14, h: 4, c: fur }); // hips
      const lx = A ? 8 : 11;
      const rx = A ? 17 : 15;
      parts.push({ x: lx, y: 32, w: 6, h: 11, c: fur });
      parts.push({ x: rx, y: 33, w: 6, h: 10, c: fur });
      parts.push({ x: lx - 1, y: 43, w: 8, h: 4, c: dark }); // big feet
      parts.push({ x: rx, y: 43, w: 8, h: 4, c: dark });
    }
    // long arms (swing with the stride; one raises the cup when sipping)
    const armY = torsoY + 1;
    const swing = A ? 1 : -1;
    parts.push({ x: 3 - (opts.sit ? -1 : swing), y: armY + (opts.sit ? 2 : swing), w: 5, h: 17, c: fur });
    if (opts.sip) {
      parts.push({ x: 22, y: armY - 4, w: 5, h: 9, c: fur }); // raised forearm
    } else {
      parts.push({ x: 22 + (opts.sit ? -1 : swing), y: armY - (opts.sit ? -2 : swing), w: 5, h: 17, c: fur });
    }
    paintParts(c, parts);
    // shading + definition on top of the fills
    c.fillStyle = dark;
    c.fillRect(9, 3, 12, 2); // brow ridge
    c.fillRect(11, 20, 12, 1); // pec line
    c.fillRect(20, torsoY, 4, 17); // right-side shade
    for (let i = 0; i < 5; i++) c.fillRect(8 + i * 4, 14 + (i % 2) * 6, 1, 3); // shaggy ticks
    c.fillStyle = lite;
    c.fillRect(6, torsoY, 2, 16); // rim light
    c.fillRect(9, 0, 3, 2); // crown highlight
    // face: eyes under the brow, muzzle, nostrils
    c.fillStyle = skin;
    c.fillRect(11, 6, 8, 4);
    c.fillStyle = OUTLINE;
    c.fillRect(12, 5, 2, 1);
    c.fillRect(17, 5, 2, 1);
    c.fillRect(13, 8, 1, 1);
    c.fillRect(16, 8, 1, 1);
    c.fillStyle = shade(skin, -30);
    c.fillRect(11, 9, 8, 1);
    // chest patch
    c.fillStyle = shade(skin, -12);
    c.fillRect(11, 13, 8, 6);
    c.fillStyle = shade(skin, -34);
    c.fillRect(11, 18, 8, 1);
    if (opts.her) {
      c.fillStyle = '#f2b8c6';
      c.fillRect(19, 0, 3, 3);
      c.fillStyle = '#fbf7ec';
      c.fillRect(20, 1, 1, 1);
      c.fillStyle = OUTLINE; // eyelashes
      c.fillRect(11, 5, 1, 1);
      c.fillRect(19, 5, 1, 1);
    }
    if (opts.sip) {
      c.fillStyle = OUTLINE;
      c.fillRect(21, 5, 6, 6);
      c.fillStyle = '#fbf7ec';
      c.fillRect(22, 6, 4, 4);
      c.fillStyle = '#f2d24b';
      c.fillRect(22, 6, 4, 1);
    }
  });
}

export function drawBigfoot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  opts: { sit?: boolean; her?: boolean; sip?: boolean; flip?: boolean } = {},
): void {
  const spr = bigfootSprite(frame, opts);
  if (opts.flip) {
    ctx.save();
    ctx.translate(x + 30, y);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(spr, x, y);
  }
}

/* ------------------------------ the layer ------------------------------ */

export class AmbientLayer {
  private actors: Actor[] = [];
  private plan: { minute: number; kind: Kind }[] = [];
  private next = 0;
  private kaijuSeen = 0;
  private ufoLanded = false;
  private hooks: AmbientHooks = {};

  setContext(info: { kaijuSeen: number; ufoLanded: boolean }, hooks: AmbientHooks): void {
    this.kaijuSeen = info.kaijuSeen;
    this.ufoLanded = info.ufoLanded;
    this.hooks = hooks;
  }

  planDay(): void {
    this.actors = [];
    this.plan = [];
    this.next = 0;
    const at = (kind: Kind, p: number, lo = 40, hi = 540): void => {
      if (Math.random() < p) this.plan.push({ minute: lo + Math.floor(Math.random() * (hi - lo)), kind });
    };
    at('birds', 1);
    at('birds', 0.8);
    at('birds', 0.5);
    at('plane', 0.6);
    // first UFO of a run lands; after that, flybys tow the review banner
    if (this.ufoLanded) {
      at('ufo', 0.14);
      at('ufoland', 0.08, 80, 440);
    } else {
      at('ufoland', 0.18, 80, 440);
    }
    at('kaiju', 0.25);
    at('pegasus', 0.06, 100, 480);
    const pool: [Kind, number][] = [
      ['catch', 0.22], ['frisbee', 0.18], ['picnic', 0.2], ['busker', 0.18], ['rockstars', 0.12], ['bigfoot', 0.1],
    ];
    const pick = (): Kind => {
      let r = Math.random();
      for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
      return 'catch';
    };
    const nLawn = 2 + (Math.random() < 0.5 ? 1 : 0);
    let minute = 50 + Math.random() * 150;
    for (let i = 0; i < nLawn && minute < 540; i++) {
      this.plan.push({ minute: Math.floor(minute), kind: pick() });
      minute += 130 + Math.random() * 130;
    }
    this.plan.sort((a, b) => a.minute - b.minute);
  }

  /** Called by the UI when Busker Ben shows up in a day event. */
  spawnBusker(longSet: boolean): void {
    this.actors.push({ kind: 'busker', x: 384 + Math.random() * 28, y: 222, vx: 0, t: 0, phase: 0, life: longSet ? 110000 : 30000 });
  }

  /** Hit-test the flying pegasus (world coords). */
  pegasusAt(x: number, y: number): boolean {
    return this.actors.some(
      (a) => a.kind === 'pegasus' && a.phase === 0 && x > a.x - 34 && x < a.x + 40 && y > a.y - 30 && y < a.y + 34,
    );
  }

  /** The player gave Bigfoot a drink — celebrate and fly off. */
  blessPegasus(): void {
    const a = this.actors.find((k) => k.kind === 'pegasus' && k.phase === 0);
    if (a) {
      a.phase = 1;
      a.life = a.t + 2800;
    }
  }

  update(minute: number, dtMs: number): void {
    while (this.next < this.plan.length && this.plan[this.next].minute <= minute) {
      this.spawn(this.plan[this.next].kind);
      this.next++;
    }
    const dt = dtMs / 1000;
    for (const a of this.actors) {
      a.t += dtMs;
      if (a.kind === 'ufo') {
        if (a.t < 2600) a.x += a.vx * dt;
        else if (a.t < 4200) a.x += Math.sin(a.t / 120) * 0.3;
        else a.x += a.vx * 3.2 * dt;
      } else if (a.kind === 'rockstars') {
        if (a.t > 9500) a.x -= 48 * dt;
      } else if (a.kind === 'bigfoot') {
        const sipping = Math.floor(a.t / 1900) % 3 === 2;
        if (!sipping) a.x += a.vx * dt;
      } else if (a.kind === 'ufoland') {
        const PAD_X = 140;
        if (a.t < 2800) {
          const k = a.t / 2800;
          const ease = k * k * (3 - 2 * k);
          a.x = -60 + (PAD_X + 60) * ease;
          a.y = 40 + 156 * ease;
        } else if (a.t >= 11600 && !a.fired) {
          a.fired = true;
          a.ok = this.hooks.alienSale?.().ok ?? false;
          if (!this.ufoLanded) {
            this.ufoLanded = true;
            this.hooks.onCameo?.('ufo');
          }
        } else if (a.t >= 22400) {
          const k = (a.t - 22400) / 3600;
          a.y = 196 - 220 * k * k;
          a.x = PAD_X + 90 * k * k;
        }
      } else if (a.kind === 'pegasus') {
        if (a.phase === 1) {
          a.x += a.vx * 2.6 * dt;
          a.y -= 52 * dt;
        } else {
          a.x += a.vx * dt;
          a.y += Math.sin(a.t / 260) * 0.35;
        }
      } else {
        a.x += a.vx * dt;
      }
    }
    this.actors = this.actors.filter(
      (a) => a.x > -200 && a.x < 860 && a.y > -80 && (a.life === 0 || a.t < a.life),
    );
  }

  private spawn(kind: Kind): void {
    const ltr = Math.random() < 0.5;
    switch (kind) {
      case 'birds':
        this.actors.push({ kind, x: ltr ? -40 : 680, y: 44 + Math.random() * 52, vx: ltr ? 42 : -42, t: 0, phase: Math.random() * 9, life: 0 });
        break;
      case 'plane':
        this.actors.push({ kind, x: -130, y: 36 + Math.random() * 20, vx: 60, t: 0, phase: 0, life: 0 });
        break;
      case 'ufo':
        this.actors.push({ kind, x: -60, y: 32, vx: 156, t: 0, phase: 0, life: 0 });
        break;
      case 'bigfoot':
        this.actors.push({ kind, x: 672, y: 204, vx: -26, t: 0, phase: 0, life: 0 });
        break;
      case 'rockstars':
        this.actors.push({ kind, x: 168 + Math.random() * 60, y: 222, vx: 0, t: 0, phase: 0, life: 14000 });
        break;
      case 'kaiju':
        // phase = how many times he'd been seen BEFORE this visit (0 = tiny cup, 1+ = wearing your merch)
        this.actors.push({ kind, x: 700, y: 0, vx: -13, t: 0, phase: this.kaijuSeen, life: 0 });
        this.kaijuSeen++;
        this.hooks.onCameo?.('kaiju');
        break;
      case 'ufoland':
        this.actors.push({ kind, x: -60, y: 40, vx: 0, t: 0, phase: 0, life: 27000 });
        break;
      case 'frisbee':
        this.actors.push({ kind, x: 200 + Math.random() * 80, y: 226, vx: 0, t: 0, phase: 64 + Math.random() * 16, life: 30000 });
        break;
      case 'picnic':
        this.actors.push({ kind, x: 60 + Math.random() * 90, y: 214, vx: 0, t: 0, phase: 0, life: 34000 });
        break;
      case 'catch':
        this.actors.push({ kind, x: 220 + Math.random() * 70, y: 230, vx: 0, t: 0, phase: 52 + Math.random() * 16, life: 28000 });
        break;
      case 'busker':
        this.spawnBusker(false);
        break;
      case 'pegasus':
        this.actors.push({ kind, x: ltr ? -60 : 700, y: 78 + Math.random() * 30, vx: ltr ? 30 : -30, t: 0, phase: 0, life: 0 });
        this.hooks.onCameo?.('pegasus');
        break;
    }
  }

  /** Towering kaiju, drawn between the far skyline and the near buildings. */
  drawFar(ctx: CanvasRenderingContext2D): void {
    for (const a of this.actors) {
      if (a.kind !== 'kaiju') continue;
      const x = Math.round(a.x);
      const bob = Math.round(Math.sin(a.t / 700) * 2);
      const sip = Math.floor(a.t / 3400) % 3 === 2;
      const step = Math.floor(a.t / 420) % 2;
      const base = '#4e6b64';
      const dark = shade(base, -26);
      const lite = shade(base, 22);
      const belly = '#7fa08f';
      const FEET = 206;
      const parts: Part[] = [];
      // legs (mostly hidden behind the buildings — glimpsed in the gaps)
      parts.push({ x: x + 8 + (step ? 2 : 0), y: FEET - 62, w: 24, h: 62, c: dark });
      parts.push({ x: x + 40 - (step ? 2 : 0), y: FEET - 58, w: 24, h: 58, c: base });
      // tail sweeping off behind
      parts.push({ x: x + 60, y: FEET - 74, w: 44, h: 14, c: base });
      parts.push({ x: x + 96, y: FEET - 66, w: 26, h: 9, c: dark });
      // torso, tapering up
      parts.push({ x: x + 4, y: FEET - 128, w: 62, h: 70, c: base });
      parts.push({ x: x + 10, y: FEET - 152, w: 50, h: 28, c: base });
      // arms: one down, one holds the cup aloft
      parts.push({ x: x - 6, y: FEET - 118, w: 12, h: 42, c: dark });
      if (sip) parts.push({ x: x + 56, y: FEET - 168, w: 12, h: 30, c: base });
      else parts.push({ x: x + 58, y: FEET - 130, w: 12, h: 44, c: base });
      // head + jutting snout
      parts.push({ x: x + 12, y: FEET - 180 + bob, w: 34, h: 26, c: base });
      parts.push({ x: x - 4, y: FEET - 168 + bob, w: 20, h: 12, c: base });
      paintParts(ctx, parts, 'rgba(43,36,64,0.85)');
      // belly plates
      ctx.fillStyle = belly;
      for (let by = FEET - 124; by < FEET - 66; by += 10) ctx.fillRect(x + 22, by, 26, 6);
      // back spikes, marching up the spine and over the head
      ctx.fillStyle = lite;
      const spikes: [number, number, number][] = [
        [x + 60, FEET - 140, 10], [x + 54, FEET - 158, 11], [x + 44, FEET - 176, 12],
        [x + 28, FEET - 190 + bob, 12], [x + 66, FEET - 118, 9],
      ];
      for (const [sx, sy, sh] of spikes) {
        for (let i = 0; i < sh; i += 2) ctx.fillRect(sx + i / 2, sy + i, Math.max(2, sh / 2 - i / 2), 2);
      }
      // glowing eye (blinks) + nostril + teeth
      const blink = Math.floor(a.t / 2600) % 8 === 7;
      ctx.fillStyle = blink ? dark : '#f2d24b';
      ctx.fillRect(x + 14, FEET - 172 + bob, 5, 3);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, FEET - 165 + bob, 3, 2);
      ctx.fillStyle = '#e8e2d0';
      for (let tx = 0; tx < 3; tx++) ctx.fillRect(x - 2 + tx * 5, FEET - 157 + bob, 3, 2);
      // the lemonade, kaiju-sized (a thimble to him)
      const cupY = sip ? FEET - 176 : FEET - 136;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 59, cupY - 1, 8, 11);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x + 60, cupY, 6, 9);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(x + 60, cupY, 6, 3);
      // returning customer: he bought the merch (of course he did)
      if (a.phase >= 1) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 10, FEET - 184 + bob, 38, 8);
        ctx.fillStyle = '#f2d24b';
        ctx.fillRect(x + 11, FEET - 183 + bob, 36, 6);
        ctx.fillStyle = '#d9a834';
        ctx.fillRect(x + 11, FEET - 179 + bob, 36, 2);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 8, FEET - 178 + bob, 22, 4); // brim over the snout
        ctx.fillStyle = '#f2d24b';
        ctx.fillRect(x - 7, FEET - 177 + bob, 20, 2);
        // giant lemon print across the belly
        ctx.fillStyle = '#f2d24b';
        ctx.fillRect(x + 24, FEET - 104, 22, 14);
        ctx.fillStyle = '#fbf0c0';
        ctx.fillRect(x + 26, FEET - 102, 7, 5);
        ctx.fillStyle = '#5f8f6f';
        ctx.fillRect(x + 44, FEET - 108, 5, 5);
      }
    }
  }

  /** High in the sky, drawn behind the buildings so flyovers have depth. */
  drawSky(ctx: CanvasRenderingContext2D): void {
    for (const a of this.actors) {
      if (a.kind === 'birds') {
        const flap = Math.floor(a.t / 140) % 2;
        ctx.fillStyle = OUTLINE;
        for (let b = 0; b < 3; b++) {
          const bx = Math.round(a.x + b * 18 + Math.sin(a.phase + b) * 6);
          const by = Math.round(a.y + Math.sin(a.t / 500 + a.phase + b * 2) * 4);
          if (flap === 0) {
            ctx.fillRect(bx, by, 4, 2); ctx.fillRect(bx + 6, by, 4, 2); ctx.fillRect(bx + 4, by + 2, 2, 2);
          } else {
            ctx.fillRect(bx, by + 2, 4, 2); ctx.fillRect(bx + 6, by + 2, 4, 2); ctx.fillRect(bx + 4, by, 2, 2);
          }
        }
      } else if (a.kind === 'plane') {
        const x = Math.round(a.x), y = Math.round(a.y);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 80, y + 5, 16, 2);
        ctx.fillStyle = '#f7f1e3';
        ctx.fillRect(x - 152, y - 5, 72, 18);
        ctx.strokeStyle = OUTLINE;
        ctx.strokeRect(x - 152.5, y - 5.5, 73, 19);
        ctx.fillStyle = '#c74b50';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('LEMONADE', x - 148, y + 8);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 2, y - 2, 38, 14);
        ctx.fillStyle = '#e8e2d0';
        ctx.fillRect(x, y, 34, 10);
        ctx.fillStyle = '#c74b50';
        ctx.fillRect(x + 4, y, 6, 10);
        ctx.fillStyle = shade('#e8e2d0', -30);
        ctx.fillRect(x + 12, y + 8, 18, 2);
        ctx.fillStyle = '#6fa8c9';
        ctx.fillRect(x + 25, y + 2, 4, 4);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 12, y + 4, 12, 4);
        if (Math.floor(a.t / 60) % 2 === 0) ctx.fillRect(x + 35, y - 4, 2, 8);
        else ctx.fillRect(x + 35, y + 6, 2, 8);
      } else if (a.kind === 'ufo') {
        const x = Math.round(a.x), y = Math.round(a.y + Math.sin(a.t / 180) * 4);
        const hovering = a.t >= 2600 && a.t < 4200;
        if (this.ufoLanded) {
          // the review came back: five stars
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x - 44, y + 3, 12, 2);
          ctx.fillStyle = '#3a3350';
          ctx.fillRect(x - 110, y - 4, 66, 16);
          ctx.strokeStyle = '#8f86c9';
          ctx.strokeRect(x - 110.5, y - 4.5, 67, 17);
          ctx.fillStyle = '#f2d24b';
          ctx.font = 'bold 11px monospace';
          ctx.fillText('★★★★★', x - 106, y + 8);
        }
        if (hovering) {
          ctx.fillStyle = `rgba(242,210,75,${0.14 + 0.1 * Math.sin(a.t / 90)})`;
          ctx.beginPath();
          ctx.moveTo(x + 10, y + 12);
          ctx.lineTo(x + 26, y + 12);
          ctx.lineTo(x + 40, y + 200);
          ctx.lineTo(x - 4, y + 200);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#cfe8e0';
        ctx.fillRect(x + 10, y - 8, 16, 8);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 2, y - 2, 40, 12);
        ctx.fillStyle = '#8f86c9';
        ctx.fillRect(x, y, 36, 8);
        ctx.fillStyle = shade('#8f86c9', -32);
        ctx.fillRect(x, y + 6, 36, 2);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = Math.floor(a.t / 160) % 3 === i ? '#f2d24b' : '#5d5870';
          ctx.fillRect(x + 6 + i * 12, y + 2, 4, 4);
        }
      } else if (a.kind === 'ufoland') {
        const PAD_X = 140;
        if (a.t < 2800) {
          const k = a.t / 2800;
          const ease = k * k * (3 - 2 * k);
          a.x = -60 + (PAD_X + 60) * ease;
          a.y = 40 + 156 * ease;
        } else if (a.t >= 11600 && !a.fired) {
          a.fired = true;
          a.ok = this.hooks.alienSale?.().ok ?? false;
          if (!this.ufoLanded) {
            this.ufoLanded = true;
            this.hooks.onCameo?.('ufo');
          }
        } else if (a.t >= 22400) {
          const k = (a.t - 22400) / 3600;
          a.y = 196 - 220 * k * k;
          a.x = PAD_X + 90 * k * k;
        }
      } else if (a.kind === 'pegasus') {
        this.pegasus(ctx, a);
      }
    }
  }

  private pegasus(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const flip = a.vx < 0;
    const dir = flip ? -1 : 1;
    const flap = Math.floor(a.t / 170) % 2;
    // sparkle trail
    for (let i = 1; i <= 4; i++) {
      const st = (a.t / 240 + i * 0.6) % 2.4;
      ctx.fillStyle = `rgba(242,210,75,${Math.max(0, 0.8 - st / 2.4)})`;
      ctx.fillRect(x - dir * (18 + i * 12), y + 6 + Math.sin(a.t / 200 + i) * 5, 3, 3);
    }
    const parts: Part[] = [];
    // unicorn body + neck + head
    parts.push({ x: x - 12, y: y + 8, w: 30, h: 12, c: '#fbf7ec' });
    parts.push({ x: x + dir * 14 - 3, y: y + 2, w: 7, h: 10, c: '#fbf7ec' });
    parts.push({ x: x + dir * 17 - 4, y: y - 2, w: 10, h: 7, c: '#fbf7ec' });
    // galloping legs, tucked
    parts.push({ x: x - 10, y: y + 19, w: 5, h: 7, c: '#e8e2d0' });
    parts.push({ x: x + 8, y: y + 20, w: 5, h: 6, c: '#e8e2d0' });
    paintParts(ctx, parts);
    // belly shade
    ctx.fillStyle = shade('#e8e2d0', -20);
    ctx.fillRect(x - 12, y + 17, 30, 3);
    // golden horn (stepped)
    ctx.fillStyle = '#e8b45f';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + dir * (20 + i * 2) - 1, y - 3 - i, 2, 2);
    // mane + rainbow tail
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + dir * 12 - 2, y, 4, 9);
    const tail = ['#e2777a', '#e8b45f', '#7fae8e'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = tail[i];
      ctx.fillRect(x - dir * 14 - 2, y + 9 + i * 3, dir * -8 || 8, 2);
      ctx.fillRect(x - dir * (16 + i * 3), y + 9 + i * 3, 6, 2);
    }
    // eye
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + dir * 19, y - 1, 2, 2);
    // wings (flap)
    ctx.fillStyle = OUTLINE;
    if (flap === 0) {
      ctx.fillRect(x - 7, y - 12, 18, 4);
      ctx.fillRect(x - 3, y - 9, 12, 4);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x - 6, y - 11, 16, 3);
      ctx.fillRect(x - 2, y - 8, 10, 2);
    } else {
      ctx.fillRect(x - 7, y + 2, 18, 4);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x - 6, y + 3, 16, 2);
    }
    // Bigfoot riding, reins in hand
    drawBigfoot(ctx, x - 12, y - 24, 1, { sit: true, flip });
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(Math.min(x + dir * 16, x + 4), y + 1, Math.abs(dir * 16 - 4), 1);
    // blessing celebration
    if (a.phase === 1) {
      ctx.font = 'bold 10px monospace';
      const k = Math.min(1, (a.life - a.t) / 2800);
      ctx.fillStyle = `rgba(226,119,138,${k})`;
      ctx.fillText('♥', x - 2, y - 26);
      ctx.fillText('♥', x + 12, y - 32);
      ctx.fillStyle = `rgba(242,210,75,${k})`;
      ctx.fillText('+', x - 14, y - 30);
    }
  }

  /** On the lawn strip between the sidewalk and the buildings. */
  drawStrip(ctx: CanvasRenderingContext2D): void {
    for (const a of this.actors) {
      if (a.kind === 'bigfoot') {
        const x = Math.round(a.x), y = Math.round(a.y);
        const sipping = Math.floor(a.t / 1900) % 3 === 2;
        const step = Math.floor(a.t / 210) % 2;
        drawShadow(ctx, x + 2, y + 46, 26);
        drawBigfoot(ctx, x, y + (step && !sipping ? -1 : 0), step, { sip: sipping, flip: true });
      } else if (a.kind === 'rockstars') {
        this.rockstars(ctx, a);
      } else if (a.kind === 'picnic') {
        this.picnic(ctx, a);
      } else if (a.kind === 'catch') {
        this.catchGame(ctx, a);
      } else if (a.kind === 'busker') {
        this.busker(ctx, a);
      } else if (a.kind === 'ufoland') {
        this.ufoLanding(ctx, a);
      } else if (a.kind === 'frisbee') {
        this.frisbeeLemons(ctx, a);
      }
    }
  }

  private ufoLanding(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const landed = a.t >= 2800 && a.t < 22400;
    // saucer
    ctx.fillStyle = '#cfe8e0';
    ctx.fillRect(x + 10, y - 8, 16, 8);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2, y - 2, 40, 12);
    ctx.fillStyle = '#8f86c9';
    ctx.fillRect(x, y, 36, 8);
    ctx.fillStyle = shade('#8f86c9', -32);
    ctx.fillRect(x, y + 6, 36, 2);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = Math.floor(a.t / 160) % 3 === i ? '#f2d24b' : '#5d5870';
      ctx.fillRect(x + 6 + i * 12, y + 2, 4, 4);
    }
    if (landed) {
      ctx.fillStyle = OUTLINE; // landing legs
      ctx.fillRect(x + 2, y + 10, 3, 8);
      ctx.fillRect(x + 17, y + 10, 3, 8);
      ctx.fillRect(x + 31, y + 10, 3, 8);
      ctx.fillRect(x, y + 17, 7, 2);
      ctx.fillRect(x + 15, y + 17, 7, 2);
      ctx.fillRect(x + 29, y + 17, 7, 2);
      if (a.t < 4200) { // touchdown dust
        ctx.fillStyle = `rgba(184,169,154,${Math.max(0, 1 - (a.t - 2800) / 1400)})`;
        ctx.fillRect(x - 10, y + 14, 10, 3);
        ctx.fillRect(x + 36, y + 14, 10, 3);
      }
    }
    if (a.t >= 22400) { // takeoff glow
      ctx.fillStyle = `rgba(242,210,75,0.25)`;
      ctx.fillRect(x + 8, y + 10, 20, 14);
    }
    // the away team
    if (a.t >= 3600 && a.t < 22400) {
      const walkOut = Math.min(1, Math.max(0, (a.t - 3600) / 8000));
      const walkBack = Math.min(1, Math.max(0, (a.t - 13200) / 8000));
      const shopping = a.t >= 11600 && a.t < 13200;
      const fr = Math.floor(a.t / 180);
      const startX = x + 40;
      const standX = 428;
      for (let i = 0; i < 2; i++) {
        let ax: number;
        if (a.t < 11600) ax = startX + (standX - startX) * walkOut - i * 14;
        else if (shopping) ax = standX - i * 14;
        else ax = standX - (standX - startX) * walkBack - i * 14;
        const ay = 232 + (i === 1 ? 3 : 0);
        drawAlienGuy(ctx, Math.round(ax), ay, fr + i, a.ok === true && a.t >= 13200, a.ok === true && a.t >= 13200 && i === 0);
      }
      if (shopping) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(standX + 12, 214, 22, 16);
        ctx.fillRect(standX + 18, 230, 5, 4);
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(standX + 14, 216, 18, 12);
        ctx.fillStyle = a.ok === false ? '#c74b50' : '#2f7d4a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(a.ok === false ? '..' : '$', standX + 19, 226);
      }
    }
  }

  private frisbeeLemons(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const gap = Math.round(a.phase);
    const period = 1800;
    const leg = Math.floor(a.t / period);
    const frac = (a.t % period) / period;
    const leftToRight = leg % 2 === 0;
    drawLemonFolk(ctx, x, y, { throwing: leftToRight && frac < 0.25 });
    drawLemonFolk(ctx, x + gap, y, { throwing: !leftToRight && frac < 0.25, flip: true });
    // floaty disc with wobble
    const fromX = leftToRight ? x + 16 : x + gap - 6;
    const toX = leftToRight ? x + gap - 6 : x + 16;
    const bx = Math.round(fromX + (toX - fromX) * frac);
    const by = Math.round(y + 4 - Math.sin(Math.PI * frac) * 16 + Math.sin(a.t / 90) * 1.5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 1, by - 1, 12, 5);
    ctx.fillStyle = '#e2568c';
    ctx.fillRect(bx, by, 10, 3);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(bx + 2, by, 6, 1);
  }

  private rockstars(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x);
    const COLORS = [
      { shirt: '#3a3350', skin: '#f0c8a0', hair: '#e2568c', pants: '#4f4a6b' },
      { shirt: '#c74b50', skin: '#c68d5e', hair: '#4bc7b8', pants: '#3a3350' },
      { shirt: '#5d5870', skin: '#e8b48a', hair: '#f2d24b', pants: '#7a5d4f' },
    ];
    for (let i = 0; i < 3; i++) {
      const bounce = a.t < 9500 ? Math.round(Math.abs(Math.sin(a.t / 170 + i * 1.3)) * -3) : 0;
      const px = x + i * 26;
      const py = a.y + bounce;
      drawPerson(ctx, px, py, a.t < 9500 ? Math.floor(a.t / 170 + i) % 2 : 1, COLORS[i], { flip: i === 2 });
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(px + 1, py + 14, 15, 5);
      ctx.fillStyle = i === 1 ? '#e8b45f' : '#c74b50';
      ctx.fillRect(px + 2, py + 15, 9, 3);
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(px + 12, py + 15, 4, 2);
    }
    if (a.t < 9500) this.notes(ctx, x + 12, a.y - 6, a.t, 3);
  }

  private picnic(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    // checkered blanket
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 4, y + 20, 84, 20);
    for (let by = 0; by < 3; by++) {
      for (let bx = 0; bx < 13; bx++) {
        ctx.fillStyle = (bx + by) % 2 ? '#e2777a' : '#fbf7ec';
        ctx.fillRect(x - 3 + bx * 6, y + 21 + by * 6, 6, 6);
      }
    }
    // basket + pitcher + cups
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 31, y + 6, 18, 13);
    ctx.fillStyle = '#a8783f';
    ctx.fillRect(x + 32, y + 7, 16, 11);
    ctx.fillStyle = shade('#a8783f', -28);
    ctx.fillRect(x + 32, y + 7, 16, 2);
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 34 + i * 5, y + 10, 1, 6);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 36, y + 3, 8, 2);
    ctx.fillStyle = '#cfe8e0';
    ctx.fillRect(x + 52, y + 10, 7, 9);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x + 53, y + 13, 5, 5);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 62, y + 13, 4, 6);
    // the happy couple, facing each other across the blanket
    const sipA = Math.floor(a.t / 2300) % 2 === 0;
    const sipB = Math.floor((a.t + 1150) / 2300) % 2 === 0;
    drawBigfoot(ctx, x - 8, y - 14, 1, { sit: true, sip: sipA });
    drawBigfoot(ctx, x + 56, y - 14, 1, { sit: true, her: true, sip: sipB, flip: true });
    // a little heart now and then
    const beat = (a.t % 5200) / 5200;
    if (beat < 0.45) {
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = `rgba(226,119,138,${1 - beat / 0.45})`;
      ctx.fillText('♥', x + 36, y - 6 - beat * 26);
    }
  }

  private catchGame(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const gap = Math.round(a.phase);
    const period = 1500;
    const throwLeg = Math.floor(a.t / period);
    const frac = (a.t % period) / period;
    const leftToRight = throwLeg % 2 === 0;
    const hopL = !leftToRight && frac > 0.82 ? -2 : 0;
    const hopR = leftToRight && frac > 0.82 ? -2 : 0;
    drawKid(ctx, x, y + hopL, frac > 0.7 ? 0 : 1, { shirt: '#6fa8c9', skin: '#f0c8a0', hair: '#8a5a3a', pants: '#4f4a6b' }, false);
    drawKid(ctx, x + gap, y + hopR, frac > 0.7 ? 0 : 1, { shirt: '#c9d97e', skin: '#c68d5e', hair: '#3f3a52', pants: '#7a5d4f' }, true);
    const fromX = leftToRight ? x + 12 : x + gap - 2;
    const toX = leftToRight ? x + gap - 2 : x + 12;
    const bx = Math.round(fromX + (toX - fromX) * frac);
    const by = Math.round(y + 4 - Math.sin(Math.PI * frac) * 24);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 1, by - 1, 6, 6);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(bx, by, 4, 4);
    ctx.fillStyle = '#c74b50';
    ctx.fillRect(bx + 1, by, 2, 1);
    ctx.fillRect(bx, by + 2, 1, 2);
  }

  private busker(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const strum = Math.floor(a.t / 220) % 2;
    drawPerson(ctx, x, y, strum, { shirt: '#7a5d4f', skin: '#e8b48a', hair: '#8a5a3a', pants: '#3f5a52' }, {});
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 1, y + 14, 16, 5);
    ctx.fillStyle = '#e8b45f';
    ctx.fillRect(x + 2, y + 15, 10, 3);
    ctx.fillStyle = shade('#e8b45f', -30);
    ctx.fillRect(x + 2, y + 17, 10, 1);
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(x + 13, y + 15 + strum, 4, 1);
    // open case with coins
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 24, y + 20, 20, 8);
    ctx.fillStyle = '#7c5b40';
    ctx.fillRect(x - 23, y + 21, 18, 6);
    ctx.fillStyle = shade('#7c5b40', -24);
    ctx.fillRect(x - 23, y + 21, 18, 2);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x - 19, y + 24, 3, 2);
    ctx.fillRect(x - 12, y + 24, 3, 2);
    this.notes(ctx, x - 4, y - 6, a.t, 2);
  }

  private notes(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, n: number): void {
    ctx.font = '11px monospace';
    for (let i = 0; i < n; i++) {
      const nt = (t / 700 + i * 0.37) % 1;
      ctx.fillStyle = `rgba(58,51,80,${1 - nt})`;
      ctx.fillText(i % 2 ? '♪' : '♫', x + i * 26 + Math.sin(nt * 5) * 5, y - nt * 26);
    }
  }
}
