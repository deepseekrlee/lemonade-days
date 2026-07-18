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
  const key = `bf3|${frame % 4}|${opts.sit ? 1 : 0}|${opts.her ? 1 : 0}|${opts.sip ? 1 : 0}`;
  return cachedSprite(key, 42, 56, (c) => {
    const stride = frame % 2 === 0 ? -2 : 2;
    const swing = frame % 2 === 0 ? -2 : 2;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // Powerful legs and broad bare-looking feet establish a readable gait.
    if (opts.sit) {
      c.fillStyle = OUTLINE;
      c.beginPath(); c.ellipse(15, 40, 10, 7, -0.2, 0, Math.PI * 2); c.ellipse(28, 40, 10, 7, 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = dark;
      c.beginPath(); c.ellipse(14.5, 40, 8, 5, -0.2, 0, Math.PI * 2); c.ellipse(28.5, 40, 8, 5, 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(skin, -22);
      c.beginPath(); c.ellipse(9, 44, 7, 3.4, -0.1, 0, Math.PI * 2); c.ellipse(34, 44, 7, 3.4, 0.1, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = OUTLINE; c.lineWidth = 11;
      c.beginPath(); c.moveTo(16, 31); c.lineTo(14 + stride, 49); c.moveTo(27, 31); c.lineTo(29 - stride, 49); c.stroke();
      c.strokeStyle = fur; c.lineWidth = 7.5;
      c.beginPath(); c.moveTo(16, 31); c.lineTo(14 + stride, 48); c.moveTo(27, 31); c.lineTo(29 - stride, 48); c.stroke();
      c.fillStyle = OUTLINE;
      c.beginPath(); c.ellipse(12 + stride, 51, 8, 4, -0.08, 0, Math.PI * 2); c.ellipse(31 - stride, 51, 8, 4, 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(skin, -26);
      c.beginPath(); c.ellipse(11.5 + stride, 50.5, 6, 2.2, 0, 0, Math.PI * 2); c.ellipse(31.5 - stride, 50.5, 6, 2.2, 0, 0, Math.PI * 2); c.fill();
    }

    // Long arms are layered behind the torso; sipping bends one to the face.
    c.strokeStyle = OUTLINE; c.lineWidth = 10;
    c.beginPath(); c.moveTo(11, 21); c.quadraticCurveTo(6, 29, 7 + swing, 39); c.stroke();
    c.strokeStyle = dark; c.lineWidth = 6.5;
    c.beginPath(); c.moveTo(11, 21); c.quadraticCurveTo(6, 29, 7 + swing, 39); c.stroke();
    c.fillStyle = shade(skin, -18); c.beginPath(); c.ellipse(7 + swing, 40, 4.2, 3.3, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = 10;
    if (opts.sip) {
      c.beginPath(); c.moveTo(31, 21); c.quadraticCurveTo(35, 13, 31, 8); c.stroke();
      c.strokeStyle = fur; c.lineWidth = 6.5; c.beginPath(); c.moveTo(31, 21); c.quadraticCurveTo(35, 13, 31, 8); c.stroke();
    } else {
      c.beginPath(); c.moveTo(31, 21); c.quadraticCurveTo(36, 29, 35 - swing, 39); c.stroke();
      c.strokeStyle = fur; c.lineWidth = 6.5; c.beginPath(); c.moveTo(31, 21); c.quadraticCurveTo(36, 29, 35 - swing, 39); c.stroke();
      c.fillStyle = skin; c.beginPath(); c.ellipse(35 - swing, 40, 4.2, 3.3, 0, 0, Math.PI * 2); c.fill();
    }

    // Curved torso with a cool woodland rim and warm chest patch.
    c.fillStyle = OUTLINE;
    c.beginPath(); c.moveTo(12, 17); c.bezierCurveTo(7, 21, 8, 34, 13, 38); c.bezierCurveTo(18, 42, 27, 42, 31, 37); c.bezierCurveTo(35, 32, 35, 21, 30, 17); c.closePath(); c.fill();
    const body = c.createLinearGradient(9, 18, 34, 38);
    body.addColorStop(0, lite); body.addColorStop(0.35, fur); body.addColorStop(1, dark);
    c.fillStyle = body;
    c.beginPath(); c.moveTo(13, 18); c.bezierCurveTo(10, 22, 10, 32, 14, 36); c.bezierCurveTo(19, 39, 26, 39, 30, 35); c.bezierCurveTo(33, 30, 32, 21, 29, 18); c.closePath(); c.fill();
    c.fillStyle = shade(skin, -18);
    c.beginPath(); c.ellipse(21.5, 26, 7.5, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,225,185,0.2)'; c.beginPath(); c.ellipse(19, 23, 2.5, 6, 0.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(skin, -48); c.lineWidth = 1.2;
    c.beginPath(); c.arc(21.5, 25, 5.5, 0.15, Math.PI - 0.15); c.stroke();

    // Shaggy shoulder/head silhouette with a humanlike, friendly face.
    c.fillStyle = OUTLINE;
    c.beginPath(); c.ellipse(21, 11, 12.5, 11.8, 0, 0, Math.PI * 2); c.fill();
    const head = c.createRadialGradient(15, 4, 1, 23, 13, 15);
    head.addColorStop(0, lite); head.addColorStop(0.45, fur); head.addColorStop(1, dark);
    c.fillStyle = head; c.beginPath(); c.ellipse(21, 11, 11, 10.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = skin;
    c.beginPath(); c.ellipse(21, 13, 7, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(14, 9); c.quadraticCurveTo(17, 6, 20, 9); c.quadraticCurveTo(24, 6, 28, 9); c.lineTo(27, 11); c.lineTo(15, 11); c.closePath(); c.fill();
    c.fillStyle = OUTLINE;
    c.beginPath(); c.arc(18, 10.5, 1.1, 0, Math.PI * 2); c.arc(24, 10.5, 1.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff4cf'; c.beginPath(); c.arc(17.7, 10.2, 0.35, 0, Math.PI * 2); c.arc(23.7, 10.2, 0.35, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(skin, -55); c.beginPath(); c.ellipse(21, 14, 2.2, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(skin, -50); c.lineWidth = 1.2; c.beginPath(); c.arc(21, 15, 4, 0.18, Math.PI - 0.18); c.stroke();

    // A few tapered fur locks keep the edge handcrafted instead of smooth-plastic.
    c.fillStyle = dark;
    for (const [px, py, dx] of [[12, 20, -3], [10, 27, -2], [31, 23, 3], [30, 31, 3], [16, 37, -2], [27, 37, 2]] as const) {
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + dx, py + 5); c.lineTo(px + (dx > 0 ? -1 : 1), py + 3); c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(235,205,155,0.34)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(13, 19); c.quadraticCurveTo(16, 27, 14, 34); c.moveTo(16, 4); c.quadraticCurveTo(13, 9, 15, 13); c.stroke();

    if (opts.her) {
      c.fillStyle = OUTLINE;
      c.beginPath(); c.ellipse(30, 3, 4, 2.7, -0.5, 0, Math.PI * 2); c.ellipse(34, 6, 4, 2.7, 0.45, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ee96b6';
      c.beginPath(); c.ellipse(30, 3, 3, 1.7, -0.5, 0, Math.PI * 2); c.ellipse(34, 6, 3, 1.7, 0.45, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff5d8'; c.beginPath(); c.arc(32, 4.5, 1.3, 0, Math.PI * 2); c.fill();
    }
    if (opts.sip) {
      c.fillStyle = OUTLINE; c.beginPath(); c.roundRect(29, 2, 9, 11, 2); c.fill();
      c.fillStyle = '#fff9e9'; c.beginPath(); c.roundRect(30.4, 3.2, 6.2, 8.3, 1); c.fill();
      c.fillStyle = '#f3d34c'; c.fillRect(30.4, 7.5, 6.2, 4);
      c.strokeStyle = '#fff0b0'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(34, 3); c.lineTo(31, -1); c.stroke();
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
  const left = x - 5;
  const top = y - 5;
  if (opts.flip) {
    ctx.save();
    ctx.translate(left + 42, top);
    ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(spr, left, top);
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
    at('kaiju', 0.42, 110, 470);
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
      if (a.kind === 'kaiju') {
        const approach = Math.min(1, a.t / 3600);
        const ease = approach * approach * (3 - 2 * approach);
        if (a.t < 3600) a.x = 720 + (394 - 720) * ease;
        else if (a.t < 21600) a.x = 394 + Math.sin(a.t / 1200) * 2.5;
        else {
          const leave = Math.min(1, (a.t - 21600) / 5200);
          a.x = 394 - 430 * leave * leave;
        }
      } else if (a.kind === 'ufo') {
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
        this.actors.push({ kind, x: 720, y: 0, vx: 0, t: 0, phase: this.kaijuSeen, life: 27200 });
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
    for (const actor of this.actors) {
      if (actor.kind === 'kaiju') this.drawKaijuRemastered(ctx, actor);
    }
    return;
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

  private drawKaijuRemastered(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const arrival = Math.min(1, actor.t / 3600);
    const departure = actor.t > 21600 ? Math.max(0, 1 - (actor.t - 21600) / 5200) : 1;
    const reveal = Math.max(0, Math.min(arrival, departure));
    if (reveal <= 0) return;
    const bob = Math.sin(actor.t / 620) * 2;
    const sip = actor.t > 7800 && actor.t < 12400;
    const wave = actor.t > 14600 && actor.t < 19300;
    const blink = Math.floor(actor.t / 2400) % 7 === 6;
    const x = actor.x;
    const baseY = 207;
    const scale = 0.72 + reveal * 0.28;
    const body = '#547c70';
    const bodyDark = '#294f50';
    const bodyLight = '#8fc0a0';
    const belly = '#a7c8a5';

    ctx.save();
    ctx.globalAlpha = 0.55 + reveal * 0.45;
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.translate(0, bob);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Atmospheric silhouette and tail, only briefly visible between the trees.
    ctx.save();
    ctx.shadowColor = 'rgba(24,46,55,0.42)'; ctx.shadowBlur = 12;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(26, -59); ctx.bezierCurveTo(61, -55, 89, -43, 116, -24);
    ctx.bezierCurveTo(91, -33, 70, -28, 49, -16); ctx.lineTo(20, -20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bodyDark;
    ctx.beginPath(); ctx.moveTo(28, -55); ctx.bezierCurveTo(59, -50, 83, -39, 104, -27); ctx.bezierCurveTo(76, -33, 54, -25, 36, -17); ctx.closePath(); ctx.fill();

    // Big pear-shaped torso with an illuminated belly and layered scales.
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(-30, -111); ctx.bezierCurveTo(-49, -78, -44, -25, -21, 5);
    ctx.bezierCurveTo(1, 25, 43, 16, 50, -24); ctx.bezierCurveTo(58, -68, 38, -111, 16, -124); ctx.closePath(); ctx.fill();
    const torso = ctx.createLinearGradient(-38, -111, 48, 2);
    torso.addColorStop(0, bodyLight); torso.addColorStop(0.36, body); torso.addColorStop(1, bodyDark);
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-27, -108); ctx.bezierCurveTo(-42, -75, -37, -27, -18, 1);
    ctx.bezierCurveTo(3, 18, 36, 10, 44, -25); ctx.bezierCurveTo(51, -65, 34, -105, 14, -119); ctx.closePath(); ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(8, -46, 24, 55, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(46,85,73,0.52)'; ctx.lineWidth = 2;
    for (let py = -83; py < -6; py += 13) {
      ctx.beginPath(); ctx.arc(8, py, 18 - Math.abs(py + 43) * 0.08, 0.12, Math.PI - 0.12); ctx.stroke();
    }

    // Far arm brushes the treetops; near arm raises a tiny lemonade or waves.
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 19;
    ctx.beginPath(); ctx.moveTo(-25, -94); ctx.quadraticCurveTo(-54, -66, -47, -30); ctx.stroke();
    ctx.strokeStyle = bodyDark; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(-25, -94); ctx.quadraticCurveTo(-54, -66, -47, -30); ctx.stroke();
    ctx.fillStyle = bodyDark; ctx.beginPath(); ctx.ellipse(-46, -25, 10, 7, -0.2, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 20;
    if (sip) {
      ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(58, -110, 50, -137); ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(58, -110, 50, -137); ctx.stroke();
    } else if (wave) {
      const wiggle = Math.sin(actor.t / 170) * 5;
      ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(64, -120, 65 + wiggle, -151); ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(64, -120, 65 + wiggle, -151); ctx.stroke();
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(66 + wiggle, -154, 11, 9, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bodyLight; ctx.beginPath(); ctx.ellipse(66 + wiggle, -154, 8, 6, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(62 + wiggle + i * 5, -159); ctx.lineTo(61 + wiggle + i * 6, -168); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(55, -70, 46, -35); ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(35, -91); ctx.quadraticCurveTo(55, -70, 46, -35); ctx.stroke();
    }

    // Long head and crocodilian muzzle, softened into the game's storybook palette.
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(-4, -137, 39, 31, -0.08, 0, Math.PI * 2);
    ctx.ellipse(-35, -128, 31, 17, -0.04, 0, Math.PI * 2); ctx.fill();
    const face = ctx.createLinearGradient(-42, -160, 29, -112);
    face.addColorStop(0, bodyLight); face.addColorStop(0.48, body); face.addColorStop(1, bodyDark);
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.ellipse(-3, -137, 35, 27, -0.08, 0, Math.PI * 2); ctx.ellipse(-34, -128, 27, 13.5, -0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a9c49c';
    ctx.beginPath(); ctx.ellipse(-31, -124, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bodyDark; ctx.beginPath(); ctx.ellipse(-48, -132, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Brow, expressive eye, and a gentle toothy grin.
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-18, -146); ctx.quadraticCurveTo(-8, -153, 2, -146); ctx.stroke();
    ctx.fillStyle = blink ? bodyDark : '#ffe369';
    ctx.beginPath(); ctx.ellipse(-8, -143, 5, blink ? 1.2 : 4, -0.1, 0, Math.PI * 2); ctx.fill();
    if (!blink) { ctx.fillStyle = '#18263a'; ctx.beginPath(); ctx.ellipse(-7, -143, 1.5, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff6da';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(-45 + i * 8, -119); ctx.lineTo(-41 + i * 8, -113); ctx.lineTo(-37 + i * 8, -120); ctx.closePath(); ctx.fill();
    }

    // Sea-glass dorsal plates catch the sky and make the silhouette unmistakable.
    const spikes = [[23, -161, 18], [37, -145, 23], [43, -122, 22], [47, -98, 20], [49, -73, 16], [49, -51, 13]] as const;
    for (const [sx, sy, size] of spikes) {
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(sx - 4, sy + size); ctx.lineTo(sx + 5, sy - 3); ctx.lineTo(sx + size, sy + size); ctx.closePath(); ctx.fill();
      const plate = ctx.createLinearGradient(sx, sy, sx + size, sy + size);
      plate.addColorStop(0, '#d8f1be'); plate.addColorStop(1, '#5ca69b'); ctx.fillStyle = plate;
      ctx.beginPath(); ctx.moveTo(sx, sy + size - 2); ctx.lineTo(sx + 6, sy + 2); ctx.lineTo(sx + size - 3, sy + size - 2); ctx.closePath(); ctx.fill();
    }

    // His comically tiny purchase stays visible during every pose.
    const cupX = sip ? 46 : 42;
    const cupY = sip ? -151 : -48;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(cupX, cupY, 15, 22, 3); ctx.fill();
    ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.roundRect(cupX + 2, cupY + 2, 11, 18, 2); ctx.fill();
    ctx.fillStyle = '#f2d24b'; ctx.fillRect(cupX + 2, cupY + 10, 11, 10);
    ctx.strokeStyle = '#fff0ae'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cupX + 8, cupY + 2); ctx.lineTo(cupX + 4, cupY - 9); ctx.stroke();

    if (actor.phase >= 1) {
      // Repeat visitors proudly wear the neighborhood's lemon crest and cap.
      ctx.fillStyle = '#f2cf45'; ctx.beginPath(); ctx.ellipse(7, -50, 13, 17, -0.08, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3aa'; ctx.beginPath(); ctx.ellipse(2, -56, 4, 7, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#43805d'; ctx.beginPath(); ctx.ellipse(17, -68, 7, 3, -0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(-2, -163, 36, 9, -0.08, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1c947'; ctx.beginPath(); ctx.ellipse(-2, -162, 32, 7, -0.08, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d89d35'; ctx.beginPath(); ctx.ellipse(-28, -158, 23, 4, 0, 0, Math.PI); ctx.fill();
    }
    ctx.restore();

    // Repaint a foreground treeline over the lower body: this is the depth cue
    // that lets a giant character inhabit the new pre-rendered town backdrop.
    ctx.fillStyle = '#183f46';
    for (let i = -4; i <= 5; i++) {
      const lx = i * 19 + Math.sin(i * 2.1) * 5;
      const ly = -7 - (i % 3) * 5;
      ctx.beginPath(); ctx.ellipse(lx, ly, 24, 17, i * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#356e58';
    for (let i = -4; i <= 5; i++) {
      const lx = i * 20 + Math.sin(i * 1.7) * 6;
      const ly = -12 - ((i + 5) % 3) * 5;
      ctx.beginPath(); ctx.ellipse(lx, ly, 18, 12, i * -0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(133,185,111,0.5)';
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath(); ctx.ellipse(i * 22 - 4, -19 - (i % 2) * 3, 7, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** High in the sky, drawn behind the buildings so flyovers have depth. */
  drawSky(ctx: CanvasRenderingContext2D): void {
    for (const a of this.actors) {
      if (a.kind === 'birds') {
        const flap = Math.floor(a.t / 140) % 2;
        for (let b = 0; b < 3; b++) {
          const bx = Math.round(a.x + b * 18 + Math.sin(a.phase + b) * 6);
          const by = Math.round(a.y + Math.sin(a.t / 500 + a.phase + b * 2) * 4);
          const lift = flap === 0 ? -3 : 2;
          ctx.strokeStyle = 'rgba(24,43,59,0.78)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(bx - 1, by); ctx.quadraticCurveTo(bx + 3, by + lift, bx + 6, by + 1); ctx.quadraticCurveTo(bx + 9, by + lift, bx + 13, by); ctx.stroke();
          ctx.strokeStyle = 'rgba(230,241,226,0.55)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(bx, by - 0.5); ctx.quadraticCurveTo(bx + 3, by + lift, bx + 6, by + 0.5); ctx.stroke();
        }
      } else if (a.kind === 'plane') {
        this.drawPlaneRemastered(ctx, a);
        continue;
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
        this.drawFlyingSaucer(ctx, a);
        continue;
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

  private drawPlaneRemastered(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const x = actor.x;
    const y = actor.y + Math.sin(actor.t / 190) * 1.5;
    ctx.save();
    // Fabric banner rolls gently through the prop wash.
    ctx.strokeStyle = '#26364a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 78, y + 3); ctx.quadraticCurveTo(x - 65, y + 7, x - 50, y + 2); ctx.stroke();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(x - 150, y - 8); ctx.quadraticCurveTo(x - 116, y - 12, x - 80, y - 7);
    ctx.lineTo(x - 80, y + 12); ctx.quadraticCurveTo(x - 116, y + 7, x - 150, y + 12); ctx.closePath(); ctx.fill();
    const banner = ctx.createLinearGradient(x - 150, y - 8, x - 80, y + 12);
    banner.addColorStop(0, '#fff8df'); banner.addColorStop(0.55, '#f0e7d8'); banner.addColorStop(1, '#d9c8bc');
    ctx.fillStyle = banner;
    ctx.beginPath();
    ctx.moveTo(x - 148, y - 6); ctx.quadraticCurveTo(x - 116, y - 9, x - 82, y - 5);
    ctx.lineTo(x - 82, y + 10); ctx.quadraticCurveTo(x - 116, y + 6, x - 148, y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b84750'; ctx.font = '900 10px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LEMONADE!', x - 115, y + 5);

    // Curved fuselage, polished wings, spinning propeller, and pilot canopy.
    ctx.save(); ctx.shadowColor = 'rgba(25,42,58,0.3)'; ctx.shadowBlur = 5;
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(x + 16, y + 3, 25, 9, 0.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const body = ctx.createLinearGradient(x - 8, y - 5, x + 38, y + 10);
    body.addColorStop(0, '#fffdf0'); body.addColorStop(0.5, '#dfe4df'); body.addColorStop(1, '#9ea9b0');
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x + 16, y + 3, 22.5, 6.8, 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 1); ctx.lineTo(x + 22, y - 10); ctx.lineTo(x + 28, y - 9); ctx.lineTo(x + 22, y + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 8, y + 5); ctx.lineTo(x + 21, y + 15); ctx.lineTo(x + 29, y + 14); ctx.lineTo(x + 22, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ecf0e8';
    ctx.beginPath(); ctx.moveTo(x + 10, y + 1); ctx.lineTo(x + 22, y - 8); ctx.lineTo(x + 25, y - 8); ctx.lineTo(x + 20, y + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 10, y + 5); ctx.lineTo(x + 22, y + 13); ctx.lineTo(x + 26, y + 13); ctx.lineTo(x + 20, y + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ca4f57'; ctx.beginPath(); ctx.roundRect(x - 2, y - 4, 8, 14, 3); ctx.fill();
    ctx.fillStyle = '#72a9c0'; ctx.beginPath(); ctx.ellipse(x + 20, y - 1, 5, 3, -0.05, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.58)'; ctx.beginPath(); ctx.ellipse(x + 19, y - 2, 2, 0.8, -0.1, 0, Math.PI * 2); ctx.fill();
    const spin = actor.t / 34;
    ctx.save(); ctx.translate(x + 39, y + 3); ctx.rotate(spin); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#f4d45a'; ctx.beginPath(); ctx.arc(x + 39, y + 3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawFlyingSaucer(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const x = actor.x;
    const y = actor.y + Math.sin(actor.t / 180) * 4;
    const hovering = actor.t >= 2600 && actor.t < 4200;
    ctx.save();
    if (this.ufoLanded) {
      ctx.strokeStyle = '#283651'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 39, y + 3); ctx.quadraticCurveTo(x - 31, y + 7, x - 23, y + 3); ctx.stroke();
      ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x - 112, y - 9, 73, 22, 5); ctx.fill();
      const review = ctx.createLinearGradient(x - 110, y - 7, x - 41, y + 11);
      review.addColorStop(0, '#453d6b'); review.addColorStop(1, '#242944');
      ctx.fillStyle = review; ctx.beginPath(); ctx.roundRect(x - 110, y - 7, 69, 18, 3); ctx.fill();
      ctx.fillStyle = '#ffe56d'; ctx.font = '900 12px "Trebuchet MS", sans-serif'; ctx.fillText('★★★★★', x - 105, y + 7);
    }
    if (hovering) {
      const beam = ctx.createLinearGradient(x, y + 8, x, y + 205);
      beam.addColorStop(0, 'rgba(255,240,122,0.35)'); beam.addColorStop(1, 'rgba(142,230,193,0.02)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(x + 8, y + 7); ctx.lineTo(x + 29, y + 7); ctx.lineTo(x + 48, y + 205); ctx.lineTo(x - 13, y + 205); ctx.closePath(); ctx.fill();
    }
    this.drawSaucer(ctx, x, y, false, actor.t);
    ctx.restore();
  }

  private drawSaucer(ctx: CanvasRenderingContext2D, x: number, y: number, landed: boolean, time: number): void {
    ctx.save();
    const glow = ctx.createRadialGradient(x + 18, y + 8, 1, x + 18, y + 8, 31);
    glow.addColorStop(0, 'rgba(158,235,207,0.55)'); glow.addColorStop(1, 'rgba(158,235,207,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 16, y - 22, 68, 56);
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(x + 18, y + 2, 18, 12, 0, Math.PI, Math.PI * 2); ctx.fill();
    const dome = ctx.createRadialGradient(x + 12, y - 6, 1, x + 18, y + 1, 18);
    dome.addColorStop(0, '#e8fff0'); dome.addColorStop(0.5, '#8ed9c7'); dome.addColorStop(1, '#477f8a');
    ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(x + 18, y + 2, 15, 9.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(27,52,72,0.6)'; ctx.beginPath(); ctx.ellipse(x + 18, y - 1, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(x + 18, y + 7, 25, 9, 0, 0, Math.PI * 2); ctx.fill();
    const metal = ctx.createLinearGradient(x - 7, y, x + 43, y + 14);
    metal.addColorStop(0, '#c9bdea'); metal.addColorStop(0.48, '#887cc0'); metal.addColorStop(1, '#4d487d');
    ctx.fillStyle = metal; ctx.beginPath(); ctx.ellipse(x + 18, y + 6.5, 22, 6.3, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI * 0.2 + i * Math.PI * 0.2;
      const lx = x + 18 + Math.cos(angle) * 18;
      const ly = y + 7 + Math.sin(angle) * 4;
      ctx.save(); ctx.shadowColor = '#ffe66d'; ctx.shadowBlur = 5;
      ctx.fillStyle = Math.floor(time / 120) % 5 === i ? '#fff19a' : '#74b9ae'; ctx.beginPath(); ctx.arc(lx, ly, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (landed) {
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      for (const dx of [2, 18, 34]) { ctx.beginPath(); ctx.moveTo(x + dx, y + 11); ctx.lineTo(x + dx - 3, y + 19); ctx.stroke(); }
      ctx.strokeStyle = '#7884a0'; ctx.lineWidth = 1.4;
      for (const dx of [2, 18, 34]) { ctx.beginPath(); ctx.moveTo(x + dx, y + 11); ctx.lineTo(x + dx - 3, y + 19); ctx.stroke(); }
    }
    ctx.restore();
  }

  private pegasus(ctx: CanvasRenderingContext2D, a: Actor): void {
    this.pegasusRemastered(ctx, a);
    return;
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

  private pegasusRemastered(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const x = actor.x;
    const y = actor.y;
    const dir = actor.vx < 0 ? -1 : 1;
    const flap = Math.sin(actor.t / 135);
    ctx.save();

    // Star-shaped dust curls along the flight path.
    for (let i = 1; i <= 6; i++) {
      const age = (actor.t / 360 + i * 0.31) % 1;
      const sx = x - dir * (24 + i * 12 + age * 10);
      const sy = y + 10 + Math.sin(actor.t / 240 + i) * 7 - age * 5;
      ctx.save(); ctx.globalAlpha = 0.8 - age * 0.65; ctx.translate(sx, sy); ctx.rotate(age * 3);
      ctx.fillStyle = i % 2 ? '#ffe36c' : '#ef91b8';
      ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(1.2, -1); ctx.lineTo(4, 0); ctx.lineTo(1.2, 1); ctx.lineTo(0, 4); ctx.lineTo(-1.2, 1); ctx.lineTo(-4, 0); ctx.lineTo(-1.2, -1); ctx.closePath(); ctx.fill(); ctx.restore();
    }

    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Rainbow tail ribbons flow independently.
    for (const [i, color] of ['#e66d7f', '#efbd55', '#6dc3a2', '#76aee0'].entries()) {
      ctx.strokeStyle = color; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(-18, 10 + i * 1.3); ctx.bezierCurveTo(-29, 5 + i * 4, -38, 18 - i * 2, -49, 10 + Math.sin(actor.t / 180 + i) * 4); ctx.stroke();
    }

    // Back legs tuck into a gallop beneath a luminous body.
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.quadraticCurveTo(-13, 22, -20, 23); ctx.moveTo(10, 14); ctx.quadraticCurveTo(15, 21, 21, 19); ctx.stroke();
    ctx.strokeStyle = '#d8d8df'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-10, 14); ctx.quadraticCurveTo(-13, 22, -20, 23); ctx.moveTo(10, 14); ctx.quadraticCurveTo(15, 21, 21, 19); ctx.stroke();

    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(0, 9, 24, 13, -0.04, 0, Math.PI * 2); ctx.fill();
    const coat = ctx.createRadialGradient(-8, 2, 1, 5, 12, 28);
    coat.addColorStop(0, '#fffdf2'); coat.addColorStop(0.55, '#ecebf0'); coat.addColorStop(1, '#b9b8c8');
    ctx.fillStyle = coat; ctx.beginPath(); ctx.ellipse(0, 9, 21.5, 10.5, -0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.64)'; ctx.beginPath(); ctx.ellipse(-8, 4, 8, 3, -0.2, 0, Math.PI * 2); ctx.fill();

    // Layered wing feathers flare on the upstroke and fold on the downstroke.
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(-9, -11 - flap * 7, 8, -25 - flap * 7); ctx.quadraticCurveTo(18, -19 - flap * 4, 12, 1); ctx.closePath(); ctx.fill();
    const wing = ctx.createLinearGradient(0, -28, 12, 5); wing.addColorStop(0, '#fffdf5'); wing.addColorStop(1, '#c7c7d2');
    ctx.fillStyle = wing;
    ctx.beginPath(); ctx.moveTo(-3, 3); ctx.quadraticCurveTo(-5, -9 - flap * 6, 8, -21 - flap * 7); ctx.quadraticCurveTo(14, -15 - flap * 4, 10, 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a7a9bc'; ctx.lineWidth = 1.2;
    for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo(2 + f * 3, -2); ctx.quadraticCurveTo(1 + f * 2, -9 - flap * 4, 8 + f * 2, -17 - flap * 5); ctx.stroke(); }

    // Arched neck, expressive head, gold horn, and cotton-candy mane.
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(14, 7); ctx.quadraticCurveTo(18, -7, 25, -8); ctx.stroke();
    ctx.strokeStyle = '#ecebf0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(14, 7); ctx.quadraticCurveTo(18, -7, 25, -8); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(29, -9, 12, 7, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0eef2'; ctx.beginPath(); ctx.ellipse(29, -9, 10, 5.2, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0a4c1';
    ctx.beginPath(); ctx.moveTo(17, -8); ctx.bezierCurveTo(13, -14, 18, -19, 22, -12); ctx.bezierCurveTo(19, -8, 21, -3, 17, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(32, -10, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#80c8c0'; ctx.beginPath(); ctx.arc(32.4, -10.3, 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b850'; ctx.beginPath(); ctx.moveTo(35, -14); ctx.lineTo(50, -24); ctx.lineTo(38, -11); ctx.closePath(); ctx.fill();

    // Bigfoot rides at a reduced scale, holding curved reins.
    ctx.save(); ctx.translate(-8, -19); ctx.scale(0.62, 0.62); drawBigfoot(ctx, 0, -27, 1, { sit: true }); ctx.restore();
    ctx.strokeStyle = '#6f4938'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(4, -12); ctx.quadraticCurveTo(19, -7, 30, -6); ctx.stroke();
    ctx.restore();

    if (actor.phase === 1) {
      const fade = Math.max(0, Math.min(1, (actor.life - actor.t) / 2800));
      ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = '#ef7e9c'; ctx.font = '900 13px "Trebuchet MS", sans-serif';
      ctx.fillText('♥', x + 6, y - 35); ctx.fillText('♥', x + 25, y - 28); ctx.restore();
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
    this.ufoLandingRemastered(ctx, a);
    return;
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

  private ufoLandingRemastered(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const x = actor.x;
    const y = actor.y;
    const landed = actor.t >= 2800 && actor.t < 22400;
    this.drawSaucer(ctx, x, y, landed, actor.t);

    if (landed && actor.t < 4400) {
      const fade = Math.max(0, 1 - (actor.t - 2800) / 1600);
      for (let puff = 0; puff < 6; puff++) {
        ctx.fillStyle = `rgba(206,188,157,${fade * (0.28 - puff * 0.025)})`;
        ctx.beginPath(); ctx.ellipse(x - 18 + puff * 15, y + 20 + (puff % 2) * 3, 9 + puff, 3.5 + puff * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (actor.t >= 22400) {
      const lift = Math.max(0, Math.min(1, (actor.t - 22400) / 3600));
      const beam = ctx.createLinearGradient(x, y + 10, x, y + 52);
      beam.addColorStop(0, `rgba(255,240,127,${0.38 * (1 - lift)})`); beam.addColorStop(1, 'rgba(109,211,185,0)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(x + 7, y + 8); ctx.lineTo(x + 29, y + 8); ctx.lineTo(x + 42, y + 50); ctx.lineTo(x - 6, y + 50); ctx.closePath(); ctx.fill();
    }

    if (actor.t >= 3600 && actor.t < 22400) {
      const walkOut = Math.min(1, Math.max(0, (actor.t - 3600) / 8000));
      const walkBack = Math.min(1, Math.max(0, (actor.t - 13200) / 8000));
      const shopping = actor.t >= 11600 && actor.t < 13200;
      const frame = Math.floor(actor.t / 170);
      const startX = x + 42;
      const standX = 428;
      for (let i = 0; i < 2; i++) {
        let alienX: number;
        if (actor.t < 11600) alienX = startX + (standX - startX) * walkOut - i * 21;
        else if (shopping) alienX = standX - i * 21;
        else alienX = standX - (standX - startX) * walkBack - i * 21;
        const alienY = 232 + (i === 1 ? 3 : 0);
        drawAlienGuy(ctx, alienX, alienY, frame + i, actor.ok === true && actor.t >= 13200, actor.ok === true && actor.t >= 13200 && i === 0);
      }
      if (shopping) {
        ctx.save();
        ctx.fillStyle = 'rgba(20,38,55,0.9)'; ctx.beginPath(); ctx.roundRect(standX + 16, 211, 37, 26, 9); ctx.fill();
        ctx.beginPath(); ctx.moveTo(standX + 19, 230); ctx.lineTo(standX + 11, 237); ctx.lineTo(standX + 25, 233); ctx.closePath(); ctx.fill();
        ctx.fillStyle = actor.ok === false ? '#ff9b9f' : '#ffe36d';
        ctx.font = '900 15px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(actor.ok === false ? '…' : '$', standX + 34, 229);
        ctx.restore();
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
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(bx + 5, by + 1, 7, 2.8, Math.sin(a.t / 130) * 0.2, 0, Math.PI * 2); ctx.fill();
    const disc = ctx.createLinearGradient(bx, by - 1, bx + 10, by + 3); disc.addColorStop(0, '#ff9ec3'); disc.addColorStop(1, '#c93f7d');
    ctx.fillStyle = disc; ctx.beginPath(); ctx.ellipse(bx + 5, by + 0.8, 5.7, 1.8, Math.sin(a.t / 130) * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.beginPath(); ctx.ellipse(bx + 4, by, 2.5, 0.6, 0, 0, Math.PI * 2); ctx.fill();
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
      this.guitar(ctx, px + 8, py + 18, i === 1 ? '#e8b45f' : '#c74b50', i === 2);
    }
    if (a.t < 9500) this.notes(ctx, x + 12, a.y - 6, a.t, 3);
  }

  private picnic(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    // Woven blanket with rounded corners, fringe, and a softer picnic basket.
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x - 5, y + 19, 86, 22, 5); ctx.fill();
    const blanket = ctx.createLinearGradient(x, y + 20, x + 78, y + 40);
    blanket.addColorStop(0, '#fff2df'); blanket.addColorStop(0.5, '#e97f88'); blanket.addColorStop(1, '#bd566e');
    ctx.fillStyle = blanket; ctx.beginPath(); ctx.roundRect(x - 3, y + 21, 82, 18, 3); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x - 3, y + 21, 82, 18, 3); ctx.clip();
    ctx.strokeStyle = 'rgba(255,247,225,0.7)'; ctx.lineWidth = 2;
    for (let stripe = -2; stripe < 12; stripe++) { ctx.beginPath(); ctx.moveTo(x + stripe * 9, y + 20); ctx.lineTo(x + stripe * 9 + 20, y + 42); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(103,48,72,0.35)';
    for (let stripe = -1; stripe < 12; stripe++) { ctx.beginPath(); ctx.moveTo(x + stripe * 9 + 18, y + 20); ctx.lineTo(x + stripe * 9 - 2, y + 42); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#fff0d7'; ctx.lineWidth = 1.2;
    for (let tassel = 0; tassel < 8; tassel++) { ctx.beginPath(); ctx.moveTo(x + tassel * 11, y + 39); ctx.lineTo(x + tassel * 11 - 2, y + 44); ctx.stroke(); }

    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x + 30, y + 5, 21, 15, 4); ctx.fill();
    const basket = ctx.createLinearGradient(x + 31, y + 6, x + 49, y + 19); basket.addColorStop(0, '#d6a15d'); basket.addColorStop(1, '#8a5536');
    ctx.fillStyle = basket; ctx.beginPath(); ctx.roundRect(x + 32, y + 7, 17, 11, 3); ctx.fill();
    ctx.strokeStyle = '#70432f'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 35 + i * 5, y + 7); ctx.lineTo(x + 35 + i * 5, y + 18); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x + 40.5, y + 7, 7, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x + 53, y + 8, 9, 12, 3); ctx.fill();
    ctx.fillStyle = 'rgba(212,245,234,0.78)'; ctx.beginPath(); ctx.roundRect(x + 54.5, y + 9.5, 6, 9, 2); ctx.fill();
    ctx.fillStyle = '#f2d24b'; ctx.beginPath(); ctx.roundRect(x + 54.5, y + 14, 6, 4.5, 1); ctx.fill();
    ctx.strokeStyle = '#d8eee6'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + 61, y + 13, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x + 65, y + 13, 6, 8, 2); ctx.fill();
    ctx.fillStyle = '#fff8e5'; ctx.beginPath(); ctx.roundRect(x + 66, y + 14, 4, 6, 1); ctx.fill();
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
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(bx + 2, by + 2, 4, 0, Math.PI * 2); ctx.fill();
    const ball = ctx.createRadialGradient(bx, by, 0.5, bx + 2, by + 2, 3.5); ball.addColorStop(0, '#fffdf0'); ball.addColorStop(1, '#cfc9c1');
    ctx.fillStyle = ball; ctx.beginPath(); ctx.arc(bx + 2, by + 2, 2.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c74b50'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx + 1, by + 2, 2.2, -1.2, 1.2); ctx.stroke();
  }

  private busker(ctx: CanvasRenderingContext2D, a: Actor): void {
    const x = Math.round(a.x), y = Math.round(a.y);
    const strum = Math.floor(a.t / 220) % 2;
    drawPerson(ctx, x, y, strum, { shirt: '#7a5d4f', skin: '#e8b48a', hair: '#8a5a3a', pants: '#3f5a52' }, {});
    this.guitar(ctx, x + 8, y + 18, '#e8b45f', false, strum);
    // open case with coins
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(x - 26, y + 19, 23, 10, 4); ctx.fill();
    const caseFill = ctx.createLinearGradient(x - 25, y + 20, x - 4, y + 28); caseFill.addColorStop(0, '#a77549'); caseFill.addColorStop(1, '#5e3c31');
    ctx.fillStyle = caseFill; ctx.beginPath(); ctx.roundRect(x - 24, y + 21, 19, 6, 2); ctx.fill();
    ctx.fillStyle = '#f4d55c'; ctx.beginPath(); ctx.arc(x - 19, y + 24, 1.7, 0, Math.PI * 2); ctx.arc(x - 12, y + 25, 1.7, 0, Math.PI * 2); ctx.fill();
    this.notes(ctx, x - 4, y - 6, a.t, 2);
  }

  private guitar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, flip: boolean, strum = 0): void {
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.rotate(-0.24);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(14, -7); ctx.stroke();
    ctx.strokeStyle = '#d9c59e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(14, -7); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(-2, 1, 7, 5.5, -0.08, 0, Math.PI * 2); ctx.fill();
    const wood = ctx.createRadialGradient(-5, -1, 0.5, -1, 2, 8); wood.addColorStop(0, shade(color, 45)); wood.addColorStop(1, shade(color, -38));
    ctx.fillStyle = wood; ctx.beginPath(); ctx.ellipse(-2, 1, 5.5, 4.2, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#302a38'; ctx.beginPath(); ctx.arc(-1, 1, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(13, -9, 4, 3);
    ctx.strokeStyle = '#fff4d7'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-5, -1 + strum); ctx.lineTo(15, -8); ctx.stroke();
    ctx.restore();
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
