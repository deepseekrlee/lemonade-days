import { DAY_MINUTES } from '../game/data';
import type { FlavorId, SimEvent, UpgradeId, Weather } from '../game/types';
import { AmbientLayer, type AmbientHooks } from './ambient';
import { VIEW_H as H, VIEW_W as W, configureHiResCanvas, drawSoftShadow, drawTownBackground, roundedRectPath } from './art';
import { HAIRS, OUTLINE, PANTS, SHIRTS, SKINS, drawPerson, shade } from './sprites';

/** Hi-bit logical resolution (integer-scales to 720p / 1080p). */
const STAND_X = 455;   // where customers stop
const GRASS_TOP = 208; // buildings' ground line
const WALK_TOP = 256;  // sidewalk
const ROAD_TOP = 312;

const LIQUID: Record<FlavorId, string> = { classic: '#f2d24b', pink: '#f2b8c6', mint: '#b8e0c4' };

interface Walker {
  x: number; dir: 1 | -1; speed: number; anim: number;
  shirt: string; skin: string; hair: string; pants: string; merch: boolean; capColor: string;
  state: 'cross' | 'approach' | 'stand' | 'leave';
  standMs: number; bubble: string; bubbleColor: string;
}
interface Floater { x: number; y: number; text: string; color: string; t: number; }
interface Drop { x: number; y: number; v: number; }

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const SKY: [number, string, string, string][] = [
  [0.0, '#f7d9b8', '#f2e2c8', '#cfe8e0'],
  [0.35, '#9fd4e8', '#bfe3dd', '#d8ecd8'],
  [0.75, '#a8cbe0', '#cfd8c8', '#e8d8b8'],
  [1.0, '#e89a7a', '#f2c69a', '#f7e0b8'],
];

interface Building { x: number; w: number; h: number; c: string; tower?: boolean; door?: boolean; ac?: boolean; antenna?: boolean; fire?: boolean; }
const BUILDINGS: Building[] = [
  { x: 8, w: 96, h: 80, c: '#a8909c', door: true },
  { x: 116, w: 80, h: 104, c: '#8f9bb0', tower: true, fire: true },
  { x: 208, w: 68, h: 68, c: '#b0a08a', ac: true },
  { x: 288, w: 88, h: 88, c: '#9aa88f', antenna: true },
  { x: 388, w: 72, h: 76, c: '#a89a78', door: true },
  { x: 472, w: 76, h: 92, c: '#98889c', ac: true },
  { x: 560, w: 72, h: 70, c: '#8f9bb0', door: true },
];

/** Distant silhouette skyline behind everything (parallax depth). */
const FAR_SKYLINE: [number, number, number][] = [
  [0, 46, 40], [50, 30, 56], [86, 54, 28], [146, 38, 48], [190, 60, 22],
  [256, 34, 52], [296, 70, 30], [372, 42, 44], [420, 56, 26], [482, 36, 50],
  [524, 64, 34], [594, 46, 46],
];

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private weather: Weather = { kind: 'sunny', tempF: 80 };
  private upgrades: UpgradeId[] = [];
  private flavor: FlavorId = 'classic';
  private frozen = false;
  private fanChance = 0;
  private capColors: string[] = ['#f2d24b'];
  private price = 1.5;
  private walkers: Walker[] = [];
  private floaters: Floater[] = [];
  private drops: Drop[] = [];
  private ambient = new AmbientLayer();
  private servePulse = 0;
  private time = 0;
  private muralStage = 0;
  private motorcadeMinute: number | null = null;
  private iceCreamStart = -1;
  private iceCreamUntil = -1;
  private rand = () => Math.random(); // cosmetic only — the sim stays deterministic

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = configureHiResCanvas(canvas);
    for (let i = 0; i < 140; i++) this.drops.push({ x: this.rand() * W, y: this.rand() * H, v: 260 + this.rand() * 180 });
  }

  setDay(
    weather: Weather,
    upgrades: UpgradeId[],
    flavor: FlavorId,
    price: number,
    opts: {
      fanChance?: number;
      frozen?: boolean;
      capColors?: string[];
      kaijuSeen?: number;
      ufoLanded?: boolean;
      muralStage?: number;
      motorcadeMinute?: number | null;
      hooks?: AmbientHooks;
    } = {},
  ): void {
    this.weather = weather;
    this.upgrades = [...upgrades];
    this.flavor = flavor;
    this.price = price;
    this.frozen = opts.frozen ?? false;
    this.fanChance = opts.fanChance ?? 0;
    this.capColors = opts.capColors?.length ? opts.capColors : ['#f2d24b'];
    this.muralStage = Math.max(0, Math.min(5, opts.muralStage ?? 0));
    this.motorcadeMinute = opts.motorcadeMinute ?? null;
    this.iceCreamStart = -1;
    this.iceCreamUntil = -1;
    this.walkers = [];
    this.floaters = [];
    this.ambient.setContext(
      { kaijuSeen: opts.kaijuSeen ?? 0, ufoLanded: opts.ufoLanded ?? false },
      opts.hooks ?? {},
    );
    this.ambient.planDay();
  }

  setPrice(price: number): void { this.price = price; }

  /** Sim-linked cameo: Busker Ben sets up on the greens after his day event. */
  buskerCameo(longSet: boolean): void { this.ambient.spawnBusker(longSet); }

  /** Keep the event's ice cream truck visibly parked across the street. */
  iceCreamTruck(minute: number, duration = 120): void {
    this.iceCreamStart = minute - 8;
    this.iceCreamUntil = minute + duration;
  }

  /** Pegasus interaction (world coords 0..640 × 0..360). */
  pegasusAt(x: number, y: number): boolean { return this.ambient.pegasusAt(x, y); }
  blessPegasus(): void { this.ambient.blessPegasus(); }

  onSimEvents(evts: SimEvent[]): void {
    for (const e of evts) {
      if (e.kind !== 'arrive') continue;
      if (e.outcome === 'bought') {
        this.servePulse = 420;
        this.floaters.push({ x: STAND_X - 20, y: 224, text: `+$${(e.paid + e.tip).toFixed(2)}`, color: '#2f7d4a', t: 0 });
        if (e.merch) this.floaters.push({ x: STAND_X + 14, y: 236, text: '+🧢', color: '#c9a227', t: 0 });
      }
      if (this.walkers.length >= 9 && e.outcome === 'walkby') continue;
      if (this.walkers.length >= 13) continue;
      const ltr = this.rand() < 0.5;
      const stopper = e.outcome !== 'walkby';
      this.walkers.push({
        x: ltr ? -20 : W + 20,
        dir: ltr ? 1 : -1,
        speed: 48 + this.rand() * 32,
        anim: this.rand() * 400,
        shirt: SHIRTS[Math.floor(this.rand() * SHIRTS.length)],
        skin: SKINS[Math.floor(this.rand() * SKINS.length)],
        hair: HAIRS[Math.floor(this.rand() * HAIRS.length)],
        pants: PANTS[Math.floor(this.rand() * PANTS.length)],
        merch: e.merch || this.rand() < this.fanChance,
        capColor: this.capColors[Math.floor(this.rand() * this.capColors.length)],
        state: stopper ? 'approach' : 'cross',
        standMs: 0,
        bubble: e.outcome === 'bought' ? (e.sat >= 0.78 ? '<3' : '$') : e.outcome === 'pricey' ? '!' : e.outcome === 'stockout' ? '..' : '',
        bubbleColor: e.outcome === 'bought' ? '#2f7d4a' : e.outcome === 'pricey' ? '#c74b50' : '#6b6577',
      });
    }
  }

  render(minute: number, dtMs: number, paused: boolean): void {
    if (!paused) {
      this.time += dtMs;
      this.servePulse = Math.max(0, this.servePulse - dtMs);
      this.ambient.update(minute, dtMs);
      this.updateWalkers(dtMs);
    }
    const t = Math.min(1, minute / DAY_MINUTES);
    this.sky(t);
    this.farSkyline(t);
    this.ambient.drawFar(this.ctx);
    this.buildings(t);
    this.ambient.drawSky(this.ctx);
    this.grass();
    this.ambient.drawStrip(this.ctx);
    this.ground(t);
    this.stand(minute);
    this.roadCameos(minute);
    this.drawWalkers();
    this.drawFloaters(paused ? 0 : dtMs);
    if (this.weather.kind === 'rain') this.rain(paused ? 0 : dtMs);
    this.grain();
  }

  // ------------------------------------------------------------ layers

  private sky(t: number): void {
    const ctx = this.ctx;
    drawTownBackground(ctx, 'day', t, this.weather.kind, this.time);
    return;
    let i = 0;
    while (i < SKY.length - 2 && SKY[i + 1][0] < t) i++;
    const [t0, a0, b0, c0] = SKY[i];
    const [t1, a1, b1, c1] = SKY[i + 1];
    const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const top = lerpHex(a0, a1, k);
    const mid = lerpHex(b0, b1, k);
    const low = lerpHex(c0, c1, k);
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 88);
    ctx.fillStyle = mid; ctx.fillRect(0, 88, W, 68);
    ctx.fillStyle = low; ctx.fillRect(0, 156, W, GRASS_TOP - 156);
    for (const [y, upper, lower] of [[86, top, mid], [154, mid, low]] as [number, string, string][]) {
      for (let row = 0; row < 5; row++) {
        ctx.fillStyle = row < 3 ? lower : upper;
        for (let x = (y + row) % 2 * 2; x < W; x += 4) ctx.fillRect(x, y + row - 2, 2, 1);
      }
    }
    if (this.weather.kind === 'cloudy' || this.weather.kind === 'rain') {
      ctx.fillStyle = 'rgba(88,92,110,0.38)';
      ctx.fillRect(0, 0, W, GRASS_TOP);
    }
    if (this.weather.kind !== 'rain' && this.weather.kind !== 'cloudy') {
      const sx = Math.round(48 + 544 * t);
      const sy = Math.round(120 - 84 * Math.sin(Math.PI * t));
      const r = this.weather.kind === 'heatwave' ? 22 : 17;
      const disc = (cx: number, cy: number, rr: number, fill: string): void => {
        ctx.fillStyle = fill;
        ctx.fillRect(cx - rr, cy - rr + 3, rr * 2, rr * 2 - 6);
        ctx.fillRect(cx - rr + 3, cy - rr, rr * 2 - 6, rr * 2);
        ctx.fillRect(cx - rr + 1, cy - rr + 1, rr * 2 - 2, rr * 2 - 2);
      };
      disc(sx, sy, r + 7, 'rgba(247,224,150,0.25)');
      disc(sx, sy, r, this.weather.kind === 'heatwave' ? '#f2b04b' : '#f7e096');
      disc(sx - 4, sy - 4, Math.max(4, r - 11), 'rgba(255,255,255,0.55)');
    }
    // three cloud layers for parallax
    const cloudy = this.weather.kind === 'cloudy' || this.weather.kind === 'rain';
    const layer = (count: number, speed: number, y0: number, scale: number, tone: number): void => {
      for (let c = 0; c < count; c++) {
        const cx = Math.round(((this.time * speed + c * 240) % (W + 160)) - 80);
        const cy = y0 + ((c * 53) % 36);
        const base = cloudy ? shade('#8d93a8', tone) : shade('#fbf7ec', tone);
        ctx.fillStyle = base;
        ctx.fillRect(cx + 8 * scale, cy - 6 * scale, 34 * scale, 7 * scale);
        ctx.fillRect(cx, cy, 56 * scale, 9 * scale);
        ctx.fillStyle = shade(base, -18);
        ctx.fillRect(cx, cy + 7 * scale, 56 * scale, 2 * scale);
      }
    };
    layer(2, 0.002, 18, 0.7, -8);
    layer(3, 0.005, 44, 1, 0);
    layer(2, 0.009, 20, 1.5, 4);
  }

  private farSkyline(t: number): void {
    return;
    const ctx = this.ctx;
    const dusk = t > 0.8;
    for (const [x, w, h] of FAR_SKYLINE) {
      ctx.fillStyle = '#9a92ac';
      ctx.fillRect(x, GRASS_TOP - 60 - h + 60, w, h); // tops between 148..186
      if (h > 44) {
        ctx.fillStyle = '#8d86a0';
        ctx.fillRect(x + 4, GRASS_TOP - h - 8, 2, 8);
      }
      if (dusk) {
        ctx.fillStyle = 'rgba(247,224,150,0.5)';
        for (let wx = x + 4; wx < x + w - 4; wx += 10) ctx.fillRect(wx, GRASS_TOP - h + 8, 2, 2);
      }
    }
    // haze where the far city meets the ground
    ctx.fillStyle = 'rgba(207,232,224,0.35)';
    ctx.fillRect(0, GRASS_TOP - 26, W, 26);
  }

  private buildings(t: number): void {
    this.communityMural();
    return;
    const ctx = this.ctx;
    const lit = t > 0.82;
    for (const b of BUILDINGS) {
      const top = GRASS_TOP - b.h;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(b.x - 2, top - 13, b.w + 4, b.h + 14);
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, top, b.w, b.h);
      ctx.fillStyle = shade(b.c, -38);
      ctx.fillRect(b.x - 2, top - 11, b.w + 4, 11);
      ctx.fillStyle = shade(b.c, -16);
      ctx.fillRect(b.x - 2, top - 11, b.w + 4, 4);
      // brick courses
      ctx.fillStyle = shade(b.c, -12);
      for (let y = top + 6; y < top + b.h - 4; y += 8) {
        for (let x = b.x + ((y / 8) % 2 === 0 ? 2 : 6); x < b.x + b.w - 4; x += 12) ctx.fillRect(x, y, 6, 2);
      }
      ctx.fillStyle = shade(b.c, -24);
      ctx.fillRect(b.x + b.w - 4, top, 4, b.h);
      ctx.fillStyle = shade(b.c, 14);
      ctx.fillRect(b.x, top, 2, b.h);
      // windows with frames, sills, and top-light
      for (let wy = top + 12; wy < GRASS_TOP - 24; wy += 26) {
        for (let wx = b.x + 10; wx < b.x + b.w - 14; wx += 22) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(wx - 2, wy - 2, 14, 18);
          ctx.fillStyle = lit ? '#f7e096' : '#5d5870';
          ctx.fillRect(wx, wy, 10, 14);
          ctx.fillStyle = lit ? '#fbf0c0' : shade('#5d5870', 18);
          ctx.fillRect(wx, wy, 10, 4);
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(wx + 4, wy, 2, 14);
          ctx.fillStyle = shade(b.c, -26);
          ctx.fillRect(wx - 2, wy + 16, 14, 2);
        }
      }
      if (b.door) {
        const dx = b.x + Math.floor(b.w / 2) - 8;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(dx, GRASS_TOP - 24, 16, 24);
        ctx.fillStyle = '#7c5b40';
        ctx.fillRect(dx + 1, GRASS_TOP - 22, 14, 22);
        ctx.fillStyle = shade('#7c5b40', 18);
        ctx.fillRect(dx + 1, GRASS_TOP - 22, 14, 3);
        ctx.fillStyle = '#f2d24b';
        ctx.fillRect(dx + 11, GRASS_TOP - 13, 2, 2);
        ctx.fillStyle = shade(b.c, -30);
        ctx.fillRect(dx - 2, GRASS_TOP - 2, 20, 2);
      }
      if (b.ac) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(b.x + 8, top + 22, 16, 12);
        ctx.fillStyle = '#9aa5a8';
        ctx.fillRect(b.x + 9, top + 23, 14, 10);
        ctx.fillStyle = shade('#9aa5a8', -26);
        for (let g = 0; g < 3; g++) ctx.fillRect(b.x + 10, top + 25 + g * 3, 12, 1);
      }
      if (b.fire) {
        ctx.fillStyle = shade(b.c, -34);
        for (let fy = top + 10; fy < GRASS_TOP - 16; fy += 26) {
          ctx.fillRect(b.x + b.w - 26, fy, 20, 2);
          ctx.fillRect(b.x + b.w - 26, fy, 2, 26);
        }
      }
      if (b.tower) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(b.x + 16, top - 42, 30, 30);
        ctx.fillStyle = '#8a6a4f';
        ctx.fillRect(b.x + 18, top - 40, 26, 26);
        ctx.fillStyle = shade('#8a6a4f', -24);
        ctx.fillRect(b.x + 18, top - 40, 26, 6);
        ctx.fillStyle = shade('#8a6a4f', 16);
        ctx.fillRect(b.x + 18, top - 34, 3, 20);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(b.x + 20, top - 14, 4, 4);
        ctx.fillRect(b.x + 38, top - 14, 4, 4);
        ctx.fillRect(b.x + 29, top - 48, 3, 8);
      }
      if (b.antenna) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(b.x + b.w - 16, top - 32, 2, 22);
        ctx.fillRect(b.x + b.w - 21, top - 28, 12, 2);
        ctx.fillRect(b.x + b.w - 18, top - 34, 6, 2);
      }
    }
    this.communityMural();
  }

  private communityMural(): void {
    const stage = this.muralStage;
    if (stage <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    const x = 119, y = 119, w = 116, h = 74;
    ctx.globalAlpha = 0.96;
    ctx.shadowColor = 'rgba(15,26,43,0.32)';
    ctx.shadowBlur = 7;
    roundedRectPath(ctx, x - 4, y - 4, w + 8, h + 8, 5);
    ctx.fillStyle = '#24324a';
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRectPath(ctx, x, y, w, h, 3);
    const wash = ctx.createLinearGradient(x, y, x + w, y + h);
    wash.addColorStop(0, '#f8d889');
    wash.addColorStop(0.52, '#ef9a6c');
    wash.addColorStop(1, '#7ac5a2');
    ctx.fillStyle = wash;
    ctx.fill();
    ctx.save();
    roundedRectPath(ctx, x, y, w, h, 3);
    ctx.clip();
    if (stage >= 2) {
      ctx.fillStyle = '#fff2af';
      ctx.beginPath();
      ctx.arc(x + 31, y + 35, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#df7c48';
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x + 31 + Math.cos(a) * 23, y + 35 + Math.sin(a) * 23);
        ctx.lineTo(x + 31 + Math.cos(a) * 31, y + 35 + Math.sin(a) * 31);
        ctx.stroke();
      }
    }
    if (stage >= 3) {
      ctx.fillStyle = '#1f6f63';
      ctx.beginPath();
      ctx.moveTo(x + 52, y + h);
      ctx.bezierCurveTo(x + 68, y + 40, x + 83, y + 61, x + 94, y + 24);
      ctx.bezierCurveTo(x + 107, y + 46, x + 111, y + 58, x + w, y + 42);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    }
    if (stage >= 4) {
      ctx.fillStyle = '#fff9df';
      ctx.font = '900 16px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GROW', x + 81, y + 34);
      ctx.font = '700 8px "Trebuchet MS", sans-serif';
      ctx.fillText('TOGETHER', x + 82, y + 45);
    }
    if (stage >= 5) {
      ctx.globalCompositeOperation = 'screen';
      const shine = ctx.createLinearGradient(x, y, x + w, y + h);
      shine.addColorStop(0, 'rgba(255,255,255,0.28)');
      shine.addColorStop(0.45, 'rgba(255,255,255,0)');
      shine.addColorStop(1, 'rgba(255,243,155,0.2)');
      ctx.fillStyle = shine;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
    if (stage < 5) {
      ctx.strokeStyle = '#6f4b35';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, y + h + 7); ctx.lineTo(x + w + 7, y + h + 7);
      ctx.moveTo(x + 8, y + h + 1); ctx.lineTo(x + 8, y + h + 17);
      ctx.moveTo(x + w - 8, y + h + 1); ctx.lineTo(x + w - 8, y + h + 17);
      ctx.stroke();
      drawPerson(ctx, x + w - 19, y + h - 19, Math.floor(this.time / 260), {
        shirt: '#6fa8c9', skin: '#c68d5e', hair: '#3f3a52', pants: '#4f4a6b',
      });
    }
    ctx.restore();
    return;
    const panels = [[122, 118, 68, 82], [212, 142, 58, 58]] as const;
    for (const [x, y, w, h] of panels) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#f4d89a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#e8b45f';
      ctx.fillRect(x, y, w, 4);
      ctx.fillRect(x, y + h - 4, w, 4);
    }
    if (stage >= 2) {
      ctx.fillStyle = '#2f7d4a';
      ctx.fillRect(145, 126, 12, 8);
      ctx.fillRect(154, 122, 15, 7);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(133, 136, 48, 48);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(135, 138, 44, 44);
      ctx.fillStyle = '#fbf0c0';
      ctx.fillRect(141, 142, 12, 9);
      ctx.fillStyle = '#d7aa28';
      for (let i = 0; i < 4; i++) ctx.fillRect(142 + i * 9, 173 - (i % 2) * 4, 6, 5);
    }
    if (stage >= 3) {
      ctx.fillStyle = '#6fa8c9';
      ctx.fillRect(216, 170, 50, 24);
      ctx.fillRect(222, 160, 38, 12);
      ctx.fillStyle = '#cfe8e0';
      ctx.fillRect(220, 165, 12, 7);
      ctx.fillRect(247, 157, 8, 8);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(230, 176, 26, 12);
    }
    if (stage >= 4) {
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('LEMONADE', 126, 196);
      ctx.fillText('FOR ALL', 218, 154);
    }
    if (stage < 5) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(112, 196, 168, 3);
      for (const x of [116, 190, 272]) ctx.fillRect(x, 116, 3, 92);
      ctx.fillStyle = '#a8783f';
      ctx.fillRect(114, 178, 162, 4);
      ctx.fillRect(114, 150, 162, 4);
      drawPerson(ctx, 184, 162, Math.floor(this.time / 260), { shirt: '#6fa8c9', skin: '#c68d5e', hair: '#3f3a52', pants: '#4f4a6b' }, {});
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(202, 170, 8, 7);
    } else {
      ctx.fillStyle = '#fbf7ec';
      const twinkle = Math.floor(this.time / 240) % 3;
      for (let i = 0; i < 3; i++) if (i !== twinkle) ctx.fillRect(199 + i * 22, 126 + (i % 2) * 11, 4, 4);
      ctx.fillStyle = '#2f7d4a';
      ctx.fillRect(185, 190, 30, 6);
    }
  }

  private grass(): void {
    return;
    const ctx = this.ctx;
    ctx.fillStyle = '#88b078';
    ctx.fillRect(0, GRASS_TOP, W, WALK_TOP - GRASS_TOP);
    ctx.fillStyle = '#7fa471';
    for (let x = 0; x < W; x += 48) ctx.fillRect(x, GRASS_TOP, 24, WALK_TOP - GRASS_TOP);
    // dithered texture rows
    ctx.fillStyle = shade('#88b078', -10);
    for (let y = GRASS_TOP + 6; y < WALK_TOP; y += 10) {
      for (let x = (y % 20 === 6 ? 0 : 4); x < W; x += 8) ctx.fillRect(x, y, 2, 1);
    }
    ctx.fillStyle = shade('#88b078', -26);
    ctx.fillRect(0, GRASS_TOP, W, 2);
    ctx.fillRect(0, WALK_TOP - 2, W, 2);
    // flowers + tufts
    for (let i = 0; i < 22; i++) {
      const fx = (i * 89 + 17) % W;
      const fy = GRASS_TOP + 8 + ((i * 29) % 30);
      if (i % 4 === 3) {
        ctx.fillStyle = '#6f9c60';
        ctx.fillRect(fx, fy, 2, 4);
        ctx.fillRect(fx + 4, fy + 2, 2, 2);
      } else {
        ctx.fillStyle = ['#f2b8c6', '#fbf7ec', '#f2d24b'][i % 3];
        ctx.fillRect(fx, fy, 4, 3);
        ctx.fillStyle = shade(['#f2b8c6', '#fbf7ec', '#f2d24b'][i % 3], -40);
        ctx.fillRect(fx + 1, fy + 1, 1, 1);
        ctx.fillStyle = '#6f9c60';
        ctx.fillRect(fx + 1, fy + 3, 1, 3);
      }
    }
    // park bench on the left greens
    const bx = 30, by = 224;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx - 1, by - 1, 62, 8);
    ctx.fillRect(bx - 1, by + 9, 62, 6);
    ctx.fillStyle = '#a8783f';
    ctx.fillRect(bx, by, 60, 6);
    ctx.fillRect(bx, by + 10, 60, 4);
    ctx.fillStyle = shade('#a8783f', 18);
    ctx.fillRect(bx, by, 60, 2);
    ctx.fillStyle = shade('#a8783f', -26);
    for (let s = 0; s < 4; s++) ctx.fillRect(bx + 12 + s * 12, by, 2, 6);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(bx + 4, by + 14, 4, 8);
    ctx.fillRect(bx + 52, by + 14, 4, 8);
  }

  private ground(t: number): void {
    const ctx = this.ctx;
    if (this.weather.kind === 'heatwave' || this.weather.tempF >= 95) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.strokeStyle = '#fff2b3';
      for (let row = 0; row < 3; row++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = 305 + row * 9 + Math.sin(x * 0.045 + this.time * 0.004 + row) * 2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    void t;
    return;
    ctx.fillStyle = '#b8a99a';
    ctx.fillRect(0, WALK_TOP, W, ROAD_TOP - WALK_TOP);
    ctx.fillStyle = '#cbbcab';
    ctx.fillRect(0, WALK_TOP, W, 4);
    ctx.fillStyle = '#a4968a';
    for (let x = 0; x < W; x += 52) {
      ctx.fillRect(x, WALK_TOP, 2, ROAD_TOP - WALK_TOP);
    }
    ctx.fillRect(0, WALK_TOP + 28, W, 2);
    // cracks
    ctx.fillStyle = shade('#b8a99a', -22);
    for (let i = 0; i < 7; i++) {
      const cx = (i * 131 + 40) % W;
      ctx.fillRect(cx, WALK_TOP + 8 + (i % 3) * 12, 6, 1);
      ctx.fillRect(cx + 5, WALK_TOP + 9 + (i % 3) * 12, 4, 1);
    }
    ctx.fillStyle = '#8f8276';
    ctx.fillRect(0, ROAD_TOP - 4, W, 4);
    // road: gradient + speckle + shimmer
    const shimmer = this.weather.kind === 'heatwave' || this.weather.tempF >= 95;
    for (let y = ROAD_TOP; y < H; y++) {
      const off = shimmer ? Math.round(Math.sin(this.time / 160 + y * 0.5) * 2) : 0;
      ctx.fillStyle = y === ROAD_TOP ? '#4f4b63' : lerpHex('#6b6577', '#5a5570', (y - ROAD_TOP) / (H - ROAD_TOP));
      ctx.fillRect(off, y, W, 1);
    }
    ctx.fillStyle = shade('#6b6577', -14);
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 67 + 13) % W, ROAD_TOP + 6 + ((i * 17) % 40), 2, 1);
    // crosswalk + dashes + manhole
    ctx.fillStyle = 'rgba(233,226,208,0.85)';
    for (let x = 36; x < 130; x += 20) ctx.fillRect(x, ROAD_TOP + 6, 10, H - ROAD_TOP - 10);
    ctx.fillStyle = '#d9cba8';
    const dashOff = Math.floor(this.time / 40) % 56;
    for (let x = 150 - dashOff; x < W; x += 56) ctx.fillRect(x, 334, 28, 4);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(154, 344, 24, 7);
    ctx.fillStyle = '#57536b';
    ctx.fillRect(156, 345, 20, 5);
    ctx.fillStyle = shade('#57536b', 14);
    ctx.fillRect(158, 346, 16, 1);
    if (t > 0.85) {
      ctx.fillStyle = 'rgba(232,154,122,0.12)';
      ctx.fillRect(0, GRASS_TOP, W, H - GRASS_TOP);
    }
  }

  private stand(minute: number): void {
    this.standRemastered(minute);
    return;
    const ctx = this.ctx;
    const up = (id: UpgradeId): boolean => this.upgrades.includes(id);
    const x = 470;
    const hot = this.weather.tempF >= 80;

    ctx.fillStyle = 'rgba(43,36,64,0.18)';
    ctx.fillRect(x - 28, 292, 172, 6);

    for (const px of [x, x + 116]) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(px - 2, 180, 12, 112);
      ctx.fillStyle = '#a06a43';
      ctx.fillRect(px, 182, 8, 110);
      ctx.fillStyle = '#c98a5b';
      ctx.fillRect(px, 182, 2, 110);
      ctx.fillStyle = shade('#a06a43', -24);
      ctx.fillRect(px + 6, 182, 2, 110);
    }

    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 14, 158, 152, 32);
    for (let s = 0; s < 8; s++) {
      const sx = x - 12 + s * 18;
      const col = s % 2 ? '#fbf7ec' : '#e8b45f';
      ctx.fillStyle = col;
      ctx.fillRect(sx, 160, 18, 24);
      ctx.fillStyle = shade(col, 16);
      ctx.fillRect(sx, 160, 18, 4);
      ctx.fillStyle = shade(col, -22);
      ctx.fillRect(sx, 180, 18, 4);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(sx + 2, 184, 14, 6);
      ctx.fillStyle = shade(col, -10);
      ctx.fillRect(sx + 4, 184, 10, 4);
    }
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 16, 154, 156, 6);
    ctx.fillStyle = '#c98a5b';
    ctx.fillRect(x - 14, 154, 152, 4);
    ctx.fillStyle = shade('#c98a5b', 18);
    ctx.fillRect(x - 14, 154, 152, 1);

    if (up('lights')) {
      for (let i = 0; i < 12; i++) {
        const lx = x - 8 + i * 12;
        const on = minute >= 460 && (Math.floor(this.time / 400) + i) % 3 !== 0;
        if (on) {
          ctx.fillStyle = 'rgba(247,224,150,0.30)';
          ctx.fillRect(lx - 3, 190, 10, 10);
        }
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(lx, 191, 4, 5);
        ctx.fillStyle = on ? '#f7e096' : '#b8a05a';
        ctx.fillRect(lx + 1, 192, 2, 3);
      }
    }

    drawPerson(ctx, x + 44, 212, 1, { shirt: '#e2777a', skin: '#f0c8a0', hair: '#3f3a52', pants: '#4f4a6b' });
    if (this.servePulse > 0) {
      ctx.fillStyle = '#f0c8a0';
      ctx.fillRect(x + 62, 218, 6, 4);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 67, 210, 8, 10);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x + 68, 211, 6, 8);
      ctx.fillStyle = this.frozen ? '#dceff2' : '#f2d24b';
      ctx.fillRect(x + 68, 211, 6, 3);
    }

    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 20, 226, 164, 14);
    ctx.fillStyle = '#e8d5a8';
    ctx.fillRect(x - 18, 228, 160, 8);
    ctx.fillStyle = shade('#e8d5a8', 20);
    ctx.fillRect(x - 18, 228, 160, 2);
    ctx.fillStyle = shade('#e8d5a8', -28);
    ctx.fillRect(x - 18, 234, 160, 2);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 14, 240, 152, 48);
    ctx.fillStyle = '#c98a5b';
    ctx.fillRect(x - 12, 242, 148, 44);
    ctx.fillStyle = shade('#c98a5b', -24);
    for (let px = x - 12; px < x + 136; px += 16) ctx.fillRect(px, 242, 2, 44);
    for (let i = 0; i < 8; i++) ctx.fillRect(x - 4 + i * 18, 252 + (i % 3) * 10, 6, 2);
    ctx.fillStyle = shade('#c98a5b', 18);
    ctx.fillRect(x - 12, 242, 148, 2);

    // lemon logo
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 2, 250, 28, 22);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x + 4, 252, 24, 18);
    ctx.fillStyle = '#fbf0c0';
    ctx.fillRect(x + 6, 254, 8, 6);
    ctx.fillStyle = '#d9a834';
    ctx.fillRect(x + 20, 264, 8, 6);
    ctx.fillStyle = '#5f8f6f';
    ctx.fillRect(x + 26, 246, 6, 6);
    ctx.fillStyle = shade('#5f8f6f', -24);
    ctx.fillRect(x + 29, 249, 3, 3);

    // chalkboard
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 56, 246, 72, 36);
    ctx.fillStyle = '#7c5b40';
    ctx.fillRect(x + 58, 248, 68, 32);
    ctx.fillStyle = '#3a3350';
    ctx.fillRect(x + 62, 252, 60, 24);
    ctx.fillStyle = 'rgba(251,247,236,0.65)';
    ctx.font = '8px monospace';
    ctx.fillText(this.frozen ? 'FROZEN!' : 'LEMONADE', x + 68, 261);
    ctx.fillStyle = '#fbf7ec';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`$${this.price.toFixed(2)}`, x + 70, 273);

    // pitcher + straw + condensation
    const pw = up('pitcher') ? 30 : 22;
    const liquid = this.frozen ? lerpHex(LIQUID[this.flavor], '#ffffff', 0.45) : LIQUID[this.flavor];
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 8, 198, pw + 4, 30);
    ctx.fillStyle = '#cfe8e0';
    ctx.fillRect(x - 6, 200, pw, 26);
    ctx.fillStyle = liquid;
    ctx.fillRect(x - 4, 206, pw - 4, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x - 4, 200, 3, 24);
    ctx.fillStyle = '#e2777a';
    ctx.fillRect(x + pw - 12, 192, 2, 12);
    if (hot) {
      const dy = Math.floor(this.time / 300) % 20;
      ctx.fillStyle = 'rgba(207,232,224,0.8)';
      ctx.fillRect(x + pw - 8, 202 + dy, 2, 4);
      ctx.fillRect(x - 7, 210 + ((dy + 8) % 20), 2, 3);
    }

    // cup pyramid + coin jar
    for (const [cx, cy, cw] of [[x + 108, 208, 12], [x + 96, 214, 10], [x + 118, 214, 10]] as [number, number, number][]) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(cx - 1, cy - 1, cw + 2, 20);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(cx, cy, cw, 18);
      ctx.fillStyle = shade('#fbf7ec', -30);
      ctx.fillRect(cx, cy + 14, cw, 4);
      ctx.fillStyle = shade('#fbf7ec', 12);
      ctx.fillRect(cx, cy, cw, 2);
    }
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 132, 210, 12, 18);
    ctx.fillStyle = 'rgba(207,232,224,0.9)';
    ctx.fillRect(x + 133, 211, 10, 16);
    ctx.fillStyle = '#e8b45f';
    ctx.fillRect(x + 134, 220, 8, 6);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x + 135, 218, 6, 2);

    // lemon crate beside the stand
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 52, 268, 30, 20);
    ctx.fillStyle = '#a8783f';
    ctx.fillRect(x - 51, 269, 28, 18);
    ctx.fillStyle = shade('#a8783f', -26);
    ctx.fillRect(x - 51, 269, 28, 3);
    ctx.fillRect(x - 38, 269, 2, 18);
    ctx.fillStyle = '#f2d24b';
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 48 + i * 6, 264, 5, 5);
    ctx.fillStyle = '#d9a834';
    ctx.fillRect(x - 45, 266, 2, 2);

    // radio
    if (up('radio')) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 34, 208, 20, 18);
      ctx.fillStyle = '#5d5870';
      ctx.fillRect(x + 35, 209, 18, 16);
      ctx.fillStyle = shade('#5d5870', 16);
      ctx.fillRect(x + 35, 209, 18, 3);
      ctx.fillStyle = '#8f86c9';
      for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 4; gx++) ctx.fillRect(x + 37 + gx * 4, 214 + gy * 3, 2, 2);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(x + 50, 211, 2, 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 52, 200, 2, 8);
      const ny = 194 - ((this.time / 90) % 52);
      ctx.fillStyle = 'rgba(58,51,80,0.75)';
      ctx.font = '11px monospace';
      ctx.fillText('♪', x + 38, ny);
    }

    if (up('juicer')) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 84, 206, 18, 20);
      ctx.fillStyle = '#e8b45f';
      ctx.fillRect(x + 85, 207, 16, 18);
      ctx.fillStyle = '#fbf0c0';
      ctx.fillRect(x + 87, 209, 5, 5);
      ctx.fillStyle = shade('#e8b45f', -28);
      ctx.fillRect(x + 85, 221, 16, 4);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x + 100, 210, 6, 2);
      ctx.fillRect(x + 104, 206, 2, 6);
    }

    if (up('slush')) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 50, 192, 28, 36);
      ctx.fillStyle = '#9aa5a8';
      ctx.fillRect(x - 49, 193, 26, 34);
      ctx.fillStyle = shade('#9aa5a8', -26);
      ctx.fillRect(x - 49, 193, 26, 6);
      ctx.fillStyle = shade('#9aa5a8', 16);
      ctx.fillRect(x - 49, 199, 3, 28);
      const liq = lerpHex(LIQUID[this.flavor], '#ffffff', 0.45);
      ctx.fillStyle = liq;
      ctx.fillRect(x - 45, 202, 18, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const sw = Math.floor(this.time / 260) % 3;
      ctx.fillRect(x - 45 + sw * 3, 204, 6, 2);
      ctx.fillRect(x - 37 - sw * 2, 210, 6, 2);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 39, 218, 4, 7);
      ctx.fillStyle = '#c74b50';
      ctx.fillRect(x - 39, 224, 4, 2);
    }

    if (up('umbrella')) {
      const ux = x + 148;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(ux, 184, 6, 104);
      ctx.fillStyle = '#7c5b40';
      ctx.fillRect(ux + 1, 186, 3, 102);
      ctx.fillStyle = shade('#7c5b40', 18);
      ctx.fillRect(ux + 1, 186, 1, 102);
      const tiers: [number, number, number][] = [[ux - 32, 176, 70], [ux - 24, 168, 54], [ux - 14, 160, 34]];
      for (const [tx, ty, tw] of tiers) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(tx - 2, ty - 2, tw + 4, 12);
        for (let seg = 0; seg < Math.ceil(tw / 14); seg++) {
          ctx.fillStyle = seg % 2 ? '#fbf7ec' : '#e2777a';
          ctx.fillRect(tx + seg * 14, ty, Math.min(14, tw - seg * 14), 8);
        }
        ctx.fillStyle = 'rgba(43,36,64,0.25)';
        ctx.fillRect(tx, ty + 6, tw, 2);
      }
      ctx.fillStyle = '#e8b45f';
      ctx.fillRect(ux + 1, 154, 4, 6);
      ctx.fillStyle = 'rgba(43,36,64,0.12)';
      ctx.fillRect(ux - 30, 292, 66, 4);
      if (up('fans')) {
        for (const fy of [202, 226]) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(ux - 15, fy - 7, 15, 15);
          ctx.fillStyle = '#9aa5a8';
          ctx.fillRect(ux - 14, fy - 6, 13, 13);
          ctx.fillStyle = '#fbf7ec';
          if (Math.floor(this.time / 110) % 2 === 0) {
            ctx.fillRect(ux - 9, fy - 6, 3, 13);
            ctx.fillRect(ux - 14, fy - 1, 13, 3);
          } else {
            ctx.fillRect(ux - 13, fy - 5, 4, 4); ctx.fillRect(ux - 6, fy - 5, 4, 4);
            ctx.fillRect(ux - 13, fy + 2, 4, 4); ctx.fillRect(ux - 6, fy + 2, 4, 4);
          }
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(ux - 9, fy - 1, 3, 3);
        }
      }
      if (up('misters') && this.weather.tempF >= 80) {
        for (let mzi = 0; mzi < 3; mzi++) {
          const mx = ux - 28 + mzi * 20;
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(mx, 188, 4, 4);
          const cycle = ((this.time / 900) + mzi * 0.33) % 1;
          ctx.fillStyle = `rgba(223,240,238,${0.5 * (1 - cycle)})`;
          ctx.fillRect(mx - 3, 194 + cycle * 18, 10, 4);
          ctx.fillRect(mx - 1, 197 + cycle * 18, 6, 7);
        }
      }
    }

    if (up('cooler')) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 88, 262, 34, 28);
      ctx.fillStyle = '#6fa8c9';
      ctx.fillRect(x - 87, 263, 32, 26);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x - 87, 263, 32, 6);
      ctx.fillStyle = shade('#6fa8c9', -28);
      ctx.fillRect(x - 87, 283, 32, 6);
      ctx.fillStyle = shade('#6fa8c9', 18);
      ctx.fillRect(x - 87, 269, 3, 14);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 75, 271, 8, 2);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(x - 82, 276, 5, 5);
    }

    if (up('sign')) {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 96, 246, 36, 42);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x - 94, 248, 32, 34);
      ctx.fillStyle = shade('#fbf7ec', -14);
      ctx.fillRect(x - 94, 278, 32, 4);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(x - 88, 252, 10, 8);
      ctx.fillStyle = '#5f8f6f';
      ctx.fillRect(x - 79, 250, 4, 4);
      ctx.fillStyle = '#c74b50';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('$', x - 76, 262);
      ctx.fillStyle = OUTLINE;
      ctx.font = '8px monospace';
      ctx.fillText('FRESH', x - 89, 274);
    }
  }

  private standRemastered(minute: number): void {
    const ctx = this.ctx;
    const up = (id: UpgradeId): boolean => this.upgrades.includes(id);
    const x = 468;
    const hot = this.weather.tempF >= 80;
    const liquid = LIQUID[this.flavor];
    const bob = Math.sin(this.time / 520) * 0.8;

    ctx.save();
    drawSoftShadow(ctx, x + 66, 294, 90, 8, 0.3);

    // Optional parasol and sidewalk accessories sit behind the cart.
    if (up('umbrella')) {
      ctx.strokeStyle = '#694a35';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 29, 181); ctx.lineTo(x - 27, 290);
      ctx.stroke();
      const parasol = ctx.createLinearGradient(x - 76, 156, x + 18, 184);
      parasol.addColorStop(0, '#fff6d4');
      parasol.addColorStop(0.48, '#f4c757');
      parasol.addColorStop(1, '#dc704f');
      ctx.fillStyle = parasol;
      ctx.strokeStyle = '#553b3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 76, 181);
      ctx.quadraticCurveTo(x - 62, 148, x - 29, 148);
      ctx.quadraticCurveTo(x + 2, 150, x + 18, 181);
      ctx.quadraticCurveTo(x + 5, 174, x - 5, 182);
      ctx.quadraticCurveTo(x - 17, 173, x - 29, 182);
      ctx.quadraticCurveTo(x - 41, 173, x - 53, 182);
      ctx.quadraticCurveTo(x - 64, 174, x - 76, 181);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff4c7';
      ctx.beginPath();
      ctx.arc(x - 29, 148, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Carved walnut frame with warm rim light.
    for (const postX of [x, x + 122]) {
      const wood = ctx.createLinearGradient(postX, 0, postX + 10, 0);
      wood.addColorStop(0, '#e1a45e');
      wood.addColorStop(0.28, '#a9633f');
      wood.addColorStop(1, '#5c3b36');
      roundedRectPath(ctx, postX, 177, 10, 115, 3);
      ctx.fillStyle = '#263047';
      ctx.fill();
      roundedRectPath(ctx, postX + 1.5, 178, 7, 113, 2);
      ctx.fillStyle = wood;
      ctx.fill();
    }

    // Soft striped canopy with scalloped cloth instead of a block roof.
    ctx.shadowColor = 'rgba(19,29,48,0.32)';
    ctx.shadowBlur = 9;
    roundedRectPath(ctx, x - 17, 155 + bob, 164, 32, 8);
    const canopy = ctx.createLinearGradient(x, 154, x, 189);
    canopy.addColorStop(0, '#fff6d9');
    canopy.addColorStop(0.58, '#f2c45d');
    canopy.addColorStop(1, '#d7784e');
    ctx.fillStyle = canopy;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    roundedRectPath(ctx, x - 17, 155 + bob, 164, 32, 8);
    ctx.clip();
    for (let stripe = 0; stripe < 7; stripe++) {
      if (stripe % 2 === 0) continue;
      ctx.fillStyle = 'rgba(255,252,229,0.68)';
      ctx.beginPath();
      ctx.moveTo(x - 17 + stripe * 24, 155);
      ctx.lineTo(x - 4 + stripe * 24, 155);
      ctx.lineTo(x - 13 + stripe * 24, 188);
      ctx.lineTo(x - 28 + stripe * 24, 188);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#cf6349';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(x - 8 + i * 18, 184 + bob, 8.5, 0, Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,248,215,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 8, 160); ctx.lineTo(x + 134, 160);
    ctx.stroke();

    if (up('lights')) {
      ctx.strokeStyle = '#4c3c43';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, 181); ctx.quadraticCurveTo(x + 62, 197, x + 132, 181);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const lx = x + 3 + i * 18;
        const ly = 184 + Math.sin((i / 7) * Math.PI) * 7;
        ctx.save();
        ctx.shadowColor = i % 2 ? '#ffd97d' : '#8fe2cf';
        ctx.shadowBlur = 7;
        ctx.fillStyle = i % 2 ? '#fff0a6' : '#b9f2db';
        ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Vendor is tucked behind a deeper, more dimensional counter.
    drawPerson(ctx, x + 59, 196, Math.floor(this.time / 260), {
      shirt: '#f0b74e', skin: '#bd8056', hair: '#493643', pants: '#31515c',
    }, { merch: true, capColor: '#f1c94a' });

    const cabinet = ctx.createLinearGradient(x, 232, x, 291);
    cabinet.addColorStop(0, '#b86c45');
    cabinet.addColorStop(0.62, '#824c3d');
    cabinet.addColorStop(1, '#563643');
    ctx.shadowColor = 'rgba(17,25,42,0.34)';
    ctx.shadowBlur = 7;
    roundedRectPath(ctx, x + 8, 229, 112, 63, 5);
    ctx.fillStyle = '#293047';
    ctx.fill();
    roundedRectPath(ctx, x + 11, 232, 106, 57, 3);
    ctx.fillStyle = cabinet;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,210,136,0.28)';
    ctx.lineWidth = 1;
    for (let plank = 1; plank < 4; plank++) {
      ctx.beginPath();
      ctx.moveTo(x + 13, 232 + plank * 13); ctx.lineTo(x + 115, 232 + plank * 13);
      ctx.stroke();
    }

    ctx.shadowColor = this.servePulse > 0 ? 'rgba(255,235,142,0.75)' : 'rgba(19,27,43,0.25)';
    ctx.shadowBlur = this.servePulse > 0 ? 13 : 5;
    roundedRectPath(ctx, x - 10, 221, 151, 14, 5);
    const top = ctx.createLinearGradient(x, 221, x, 235);
    top.addColorStop(0, '#f4c985');
    top.addColorStop(0.4, '#c88254');
    top.addColorStop(1, '#71483d');
    ctx.fillStyle = top;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hand-painted enamel badge.
    roundedRectPath(ctx, x + 28, 246, 72, 29, 6);
    ctx.fillStyle = '#f7e7b4';
    ctx.fill();
    ctx.strokeStyle = '#5e4a43';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#276c5c';
    ctx.font = '900 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEMONADE', x + 64, 259);
    ctx.fillStyle = '#d86b4c';
    ctx.font = '700 8px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${this.price.toFixed(2)}  •  FRESH`, x + 64, 269);

    // Glass pitcher, cups, and bowl of fruit.
    const pitcherX = x + 15;
    ctx.fillStyle = 'rgba(224,248,246,0.7)';
    roundedRectPath(ctx, pitcherX, 201, 24, 21, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(248,255,245,0.9)';
    ctx.stroke();
    ctx.fillStyle = liquid;
    roundedRectPath(ctx, pitcherX + 2, 209, 20, 11, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,248,246,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pitcherX + 25, 211, 7, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.fillStyle = '#fff6da';
    for (let cup = 0; cup < 3; cup++) ctx.fillRect(x + 45 + cup * 6, 212 - cup, 5, 9 + cup);
    ctx.fillStyle = '#f0c83f';
    for (let lemon = 0; lemon < 5; lemon++) {
      ctx.beginPath();
      ctx.ellipse(x + 105 + (lemon % 3) * 8, 216 - Math.floor(lemon / 3) * 5, 5, 3.8, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (up('juicer')) {
      ctx.fillStyle = '#b9c7c8';
      roundedRectPath(ctx, x + 84, 199, 17, 23, 3); ctx.fill();
      ctx.fillStyle = '#53636e'; ctx.fillRect(x + 91, 195, 3, 7);
      ctx.fillStyle = '#f4cc45'; ctx.beginPath(); ctx.arc(x + 92, 205, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (up('slush')) {
      const sx = x + 126;
      ctx.shadowColor = '#82d7ef'; ctx.shadowBlur = 8;
      roundedRectPath(ctx, sx, 199, 28, 51, 5);
      ctx.fillStyle = '#dcefee'; ctx.fill();
      ctx.shadowBlur = 0;
      roundedRectPath(ctx, sx + 4, 203, 20, 24, 4);
      ctx.fillStyle = '#6fc6d4'; ctx.fill();
      ctx.fillStyle = '#f5fbf4'; ctx.beginPath(); ctx.arc(sx + 14, 215, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4c6872'; ctx.fillRect(sx + 12, 229, 4, 11);
      ctx.fillStyle = '#ec7c65'; ctx.beginPath(); ctx.arc(sx + 14, 244, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (up('radio')) {
      roundedRectPath(ctx, x + 101, 276, 25, 14, 3);
      ctx.fillStyle = '#314a58'; ctx.fill();
      ctx.fillStyle = '#e8c76a'; ctx.beginPath(); ctx.arc(x + 108, 283, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#263047'; ctx.beginPath(); ctx.moveTo(x + 120, 276); ctx.lineTo(x + 127, 267); ctx.stroke();
    }
    if (up('cooler')) {
      drawSoftShadow(ctx, x - 61, 291, 21, 4, 0.25);
      roundedRectPath(ctx, x - 80, 261, 38, 29, 5);
      ctx.fillStyle = '#4d95ad'; ctx.fill();
      ctx.fillStyle = '#f1f0d9';
      roundedRectPath(ctx, x - 81, 258, 40, 9, 4); ctx.fill();
      ctx.fillStyle = '#f2c943'; ctx.beginPath(); ctx.arc(x - 61, 278, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (up('sign')) {
      drawSoftShadow(ctx, x - 96, 291, 21, 4, 0.24);
      ctx.strokeStyle = '#5e4137'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 110, 250); ctx.lineTo(x - 118, 289); ctx.moveTo(x - 82, 250); ctx.lineTo(x - 74, 289); ctx.stroke();
      roundedRectPath(ctx, x - 116, 244, 40, 35, 4);
      ctx.fillStyle = '#fff1c6'; ctx.fill();
      ctx.strokeStyle = '#6b4b3f'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#2c765e'; ctx.font = '900 8px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SUNSHINE', x - 96, 256);
      ctx.fillStyle = '#d76c4b'; ctx.font = '700 11px "Trebuchet MS", sans-serif';
      ctx.fillText(`$${this.price.toFixed(2)}`, x - 96, 270);
    }
    if (up('fans')) {
      const fx = x + 131, fy = 265;
      ctx.fillStyle = '#425765'; ctx.beginPath(); ctx.arc(fx, fy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b9d1cf'; ctx.lineWidth = 3;
      const spin = this.time / 100;
      for (let blade = 0; blade < 3; blade++) {
        const a = spin + blade * (Math.PI * 2 / 3);
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8); ctx.stroke();
      }
      ctx.fillStyle = '#f1c547'; ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (up('misters') && hot) {
      ctx.fillStyle = 'rgba(205,242,244,0.36)';
      for (let i = 0; i < 7; i++) {
        const mx = x + 6 + i * 19 + Math.sin(this.time / 330 + i) * 3;
        const my = 191 + ((this.time / 25 + i * 13) % 28);
        ctx.beginPath(); ctx.arc(mx, my, 1.2 + (i % 2), 0, Math.PI * 2); ctx.fill();
      }
    }

    if (this.frozen) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(171,233,244,0.2)';
      roundedRectPath(ctx, x - 14, 151, 168, 143, 9); ctx.fill();
      ctx.restore();
    }
    void minute;
    ctx.restore();
  }

  private roadCameos(minute: number): void {
    if (minute >= this.iceCreamStart && minute <= this.iceCreamUntil) {
      const inTime = minute - this.iceCreamStart;
      const outTime = this.iceCreamUntil - minute;
      let x = 178;
      if (inTime < 8) x = -150 + (328 * inTime) / 8;
      else if (outTime < 8) x = 178 + (610 * (8 - outTime)) / 8;
      this.drawIceCreamTruck(Math.round(x), 316);
    }
    if (this.motorcadeMinute === null) return;
    const elapsed = minute - this.motorcadeMinute;
    if (elapsed < 0 || elapsed > 46) return;
    let leadX = 58;
    if (elapsed < 10) leadX = -430 + (488 * elapsed) / 10;
    else if (elapsed > 34) leadX = 58 + (720 * (elapsed - 34)) / 12;
    this.drawSUV(Math.round(leadX), 322);
    this.drawLimo(Math.round(leadX + 116), 320);
    this.drawSUV(Math.round(leadX + 286), 322);
    if (elapsed >= 11 && elapsed <= 33) this.drawPresidentialStop();
  }

  private wheel(x: number, y: number, r = 8): void {
    const ctx = this.ctx;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111a2b';
    ctx.beginPath(); ctx.arc(x, y, r - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8295a2';
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, r * 0.43), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9eee4';
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.16), 0, Math.PI * 2); ctx.fill();
  }

  private drawIceCreamTruck(x: number, y: number): void {
    this.iceCreamTruckRemastered(x, y);
    return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20,16,40,0.2)';
    ctx.fillRect(x + 8, y + 32, 126, 5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y - 25, 132, 53);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 3, y - 22, 126, 47);
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + 3, y + 8, 126, 17);
    ctx.fillStyle = '#6fa8c9';
    ctx.fillRect(x + 84, y - 19, 39, 20);
    ctx.fillStyle = '#9fd4e8';
    ctx.fillRect(x + 88, y - 16, 31, 14);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 10, y - 17, 58, 27);
    ctx.fillStyle = '#3a3350';
    ctx.fillRect(x + 13, y - 14, 52, 21);
    ctx.fillStyle = '#f7e096';
    ctx.fillRect(x + 17, y - 10, 17, 13);
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + 40, y - 10, 20, 13);
    ctx.fillStyle = OUTLINE;
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ICE CREAM', x + 12, y + 19);
    // roof cone and tiny serving bell
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 40, y - 39, 20, 14);
    ctx.fillStyle = '#e8b45f';
    ctx.fillRect(x + 43, y - 36, 14, 11);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 41, y - 44, 18, 8);
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + 44, y - 48, 12, 6);
    ctx.fillStyle = '#f7e096';
    ctx.fillRect(x + 74, y - 29, 5, 5);
    this.wheel(x + 24, y + 27);
    this.wheel(x + 106, y + 27);
  }

  private iceCreamTruckRemastered(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    drawSoftShadow(ctx, x + 66, y + 31, 67, 6, 0.33);
    ctx.shadowColor = 'rgba(12,19,35,0.32)'; ctx.shadowBlur = 7;
    roundedRectPath(ctx, x, y - 26, 132, 54, 8);
    ctx.fillStyle = OUTLINE; ctx.fill();
    ctx.shadowBlur = 0;
    roundedRectPath(ctx, x + 2.5, y - 23.5, 127, 49, 6);
    const body = ctx.createLinearGradient(x, y - 23, x + 132, y + 26);
    body.addColorStop(0, '#fffbe8'); body.addColorStop(0.55, '#eaded8'); body.addColorStop(1, '#b8b7c4');
    ctx.fillStyle = body; ctx.fill();
    ctx.fillStyle = '#e790aa';
    roundedRectPath(ctx, x + 3, y + 8, 126, 17, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillRect(x + 8, y - 20, 2, 25);

    roundedRectPath(ctx, x + 9, y - 17, 61, 29, 4);
    ctx.fillStyle = '#17243a'; ctx.fill();
    roundedRectPath(ctx, x + 13, y - 13, 53, 21, 2);
    const window = ctx.createLinearGradient(x + 13, y - 13, x + 66, y + 8);
    window.addColorStop(0, '#ffe99a'); window.addColorStop(1, '#ed9faf');
    ctx.fillStyle = window; ctx.fill();
    ctx.fillStyle = 'rgba(36,51,64,0.72)'; ctx.fillRect(x + 35, y - 13, 3, 21);
    ctx.fillStyle = '#f9f2d7'; ctx.fillRect(x + 18, y - 2, 12, 8); ctx.fillRect(x + 43, y - 3, 14, 9);

    roundedRectPath(ctx, x + 84, y - 19, 39, 22, 4);
    ctx.fillStyle = '#1c3046'; ctx.fill();
    ctx.fillStyle = 'rgba(132,206,222,0.63)';
    ctx.beginPath(); ctx.moveTo(x + 88, y - 15); ctx.lineTo(x + 108, y - 15); ctx.lineTo(x + 119, y - 1); ctx.lineTo(x + 88, y - 1); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = '#fff1a8'; ctx.shadowBlur = 7;
    ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(x + 126, y + 10, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    ctx.fillStyle = '#fff8e2'; ctx.font = '900 8px "Trebuchet MS", sans-serif';
    ctx.fillText('NICE ICE', x + 13, y + 20);

    // Oversized soft-serve roof mascot and bell.
    ctx.shadowColor = 'rgba(12,19,35,0.28)'; ctx.shadowBlur = 5;
    ctx.fillStyle = '#d59a62';
    ctx.beginPath(); ctx.moveTo(x + 42, y - 37); ctx.lineTo(x + 59, y - 37); ctx.lineTo(x + 51, y - 23); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4e6';
    ctx.beginPath(); ctx.arc(x + 51, y - 43, 8, 0, Math.PI * 2); ctx.arc(x + 47, y - 38, 6, 0, Math.PI * 2); ctx.arc(x + 55, y - 38, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef9eb6'; ctx.beginPath(); ctx.arc(x + 51, y - 47, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f4cf55'; ctx.beginPath(); ctx.arc(x + 77, y - 29, 3, 0, Math.PI * 2); ctx.fill();

    this.wheel(x + 24, y + 27);
    this.wheel(x + 106, y + 27);
    ctx.restore();
  }

  private drawSUV(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    drawSoftShadow(ctx, x + 48, y + 13, 49, 5, 0.38);
    roundedRectPath(ctx, x, y - 17, 96, 30, 7);
    ctx.fillStyle = OUTLINE; ctx.fill();
    const paint = ctx.createLinearGradient(x, y - 28, x, y + 12);
    paint.addColorStop(0, '#505c6b'); paint.addColorStop(0.45, '#252d3d'); paint.addColorStop(1, '#111827');
    roundedRectPath(ctx, x + 2.5, y - 14.5, 91, 25, 5);
    ctx.fillStyle = paint; ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(x + 17, y - 15); ctx.lineTo(x + 25, y - 28); ctx.lineTo(x + 70, y - 28); ctx.lineTo(x + 79, y - 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7594ab';
    ctx.beginPath(); ctx.moveTo(x + 27, y - 25); ctx.lineTo(x + 43, y - 25); ctx.lineTo(x + 43, y - 17); ctx.lineTo(x + 22, y - 17); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 48, y - 25); ctx.lineTo(x + 68, y - 25); ctx.lineTo(x + 74, y - 17); ctx.lineTo(x + 48, y - 17); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.23)'; ctx.fillRect(x + 6, y - 11, 2, 14);
    const flash = Math.floor(this.time / 180) % 2 === 0;
    ctx.save(); ctx.shadowColor = flash ? '#ef6464' : '#67b7e8'; ctx.shadowBlur = 8;
    ctx.fillStyle = flash ? '#ef6464' : '#67b7e8'; ctx.fillRect(x + 41, y - 33, 13, 4); ctx.restore();
    ctx.fillStyle = '#fff0a0'; ctx.beginPath(); ctx.arc(x + 91, y - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    this.wheel(x + 20, y + 11, 7); this.wheel(x + 76, y + 11, 7);
    ctx.restore();
    return;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y - 17, 96, 30);
    ctx.fillRect(x + 18, y - 29, 58, 14);
    ctx.fillStyle = '#232634';
    ctx.fillRect(x + 3, y - 14, 90, 24);
    ctx.fillStyle = '#363a4a';
    ctx.fillRect(x + 21, y - 26, 52, 12);
    ctx.fillStyle = '#7f93a8';
    ctx.fillRect(x + 26, y - 23, 16, 8);
    ctx.fillRect(x + 48, y - 23, 20, 8);
    ctx.fillStyle = Math.floor(this.time / 180) % 2 ? '#c74b50' : '#6fa8c9';
    ctx.fillRect(x + 43, y - 34, 10, 4);
    ctx.fillStyle = '#f7e096';
    ctx.fillRect(x + 88, y - 8, 6, 5);
    this.wheel(x + 20, y + 11, 7);
    this.wheel(x + 76, y + 11, 7);
  }

  private drawLimo(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    drawSoftShadow(ctx, x + 77, y + 13, 78, 5, 0.42);
    roundedRectPath(ctx, x, y - 17, 154, 30, 7);
    ctx.fillStyle = OUTLINE; ctx.fill();
    const paint = ctx.createLinearGradient(x, y - 27, x, y + 12);
    paint.addColorStop(0, '#3c4657'); paint.addColorStop(0.45, '#171e2d'); paint.addColorStop(1, '#090e19');
    roundedRectPath(ctx, x + 2.5, y - 14.5, 149, 25, 5);
    ctx.fillStyle = paint; ctx.fill();
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.moveTo(x + 34, y - 15); ctx.lineTo(x + 43, y - 28); ctx.lineTo(x + 109, y - 28); ctx.lineTo(x + 119, y - 15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6f879d';
    for (let i = 0; i < 4; i++) {
      roundedRectPath(ctx, x + 44 + i * 17, y - 25, 13, 8, 1.5); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x + 7, y - 11, 2, 14);
    ctx.fillStyle = '#f0d6a7'; ctx.beginPath(); ctx.arc(x + 16, y - 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.shadowColor = '#fff2a7'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#fff2a7'; ctx.beginPath(); ctx.arc(x + 149, y - 5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x + 134, y - 19); ctx.lineTo(x + 134, y - 38); ctx.stroke();
    ctx.fillStyle = '#e25259'; ctx.fillRect(x + 135, y - 37, 10, 6);
    ctx.fillStyle = '#fff8e2'; ctx.fillRect(x + 135, y - 31, 10, 6);
    ctx.fillStyle = '#4d75af'; ctx.fillRect(x + 135, y - 25, 10, 6);
    this.wheel(x + 28, y + 11, 7); this.wheel(x + 126, y + 11, 7);
    ctx.restore();
    return;
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y - 17, 154, 30);
    ctx.fillRect(x + 36, y - 29, 78, 14);
    ctx.fillStyle = '#151827';
    ctx.fillRect(x + 3, y - 14, 148, 24);
    ctx.fillStyle = '#303647';
    ctx.fillRect(x + 39, y - 26, 72, 12);
    ctx.fillStyle = '#7f93a8';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 44 + i * 16, y - 23, 11, 8);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 16, y - 12, 5, 4);
    ctx.fillStyle = '#c74b50';
    ctx.fillRect(x + 132, y - 36, 3, 17);
    ctx.fillStyle = '#6fa8c9';
    ctx.fillRect(x + 135, y - 36, 10, 6);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 135, y - 30, 10, 6);
    ctx.fillStyle = '#c74b50';
    ctx.fillRect(x + 135, y - 24, 10, 5);
    this.wheel(x + 28, y + 11, 7);
    this.wheel(x + 126, y + 11, 7);
  }

  private drawPresidentialStop(): void {
    const ctx = this.ctx;
    const bob = Math.floor(this.time / 220) % 2;
    drawPerson(ctx, 430, 260 - bob, 1, { shirt: '#243f77', skin: '#e8b48a', hair: '#d9c37e', pants: '#243f77' }, {});
    drawPerson(ctx, 404, 263, 1, { shirt: '#252538', skin: '#8d5a3b', hair: '#3f3a52', pants: '#252538' }, {});
    drawPerson(ctx, 456, 263, 1, { shirt: '#252538', skin: '#c68d5e', hair: '#3f3a52', pants: '#252538' }, { flip: true });
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(446, 268 - bob, 8, 11);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(447, 269 - bob, 6, 9);
    ctx.fillStyle = LIQUID[this.flavor];
    ctx.fillRect(447, 269 - bob, 6, 4);
    ctx.fillStyle = '#fbf7ec';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ONE LEMONADE, PLEASE.', 356, 246);
  }

  private updateWalkers(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const wk of this.walkers) {
      wk.anim += dtMs;
      if (wk.state === 'cross') {
        wk.x += wk.dir * wk.speed * dt;
      } else if (wk.state === 'approach') {
        const target = STAND_X - 8;
        const dir = wk.x < target ? 1 : -1;
        wk.dir = dir as 1 | -1;
        wk.x += dir * wk.speed * dt;
        if (Math.abs(wk.x - target) < 3) { wk.state = 'stand'; wk.standMs = 1100; wk.dir = 1; }
      } else if (wk.state === 'stand') {
        wk.standMs -= dtMs;
        if (wk.standMs <= 0) { wk.state = 'leave'; wk.dir = wk.x > W / 2 ? 1 : -1; }
      } else {
        wk.x += wk.dir * wk.speed * dt;
      }
    }
    this.walkers = this.walkers.filter((wk) => wk.x > -28 && wk.x < W + 28);
  }

  private drawWalkers(): void {
    const ctx = this.ctx;
    for (const wk of this.walkers) {
      const frame = wk.state === 'stand' ? 1 : Math.floor(wk.anim / 150) % 2;
      const px = Math.round(wk.x - 8);
      const py = 272;
      drawPerson(ctx, px, py, frame, { shirt: wk.shirt, skin: wk.skin, hair: wk.hair, pants: wk.pants }, {
        merch: wk.merch,
        flip: wk.dir === -1,
        capColor: wk.capColor,
      });
      if (wk.state === 'stand' && wk.bubble) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(px + 18, py - 26, 38, 24);
        ctx.fillRect(px + 24, py - 4, 9, 6);
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(px + 20, py - 24, 34, 20);
        ctx.fillRect(px + 26, py - 4, 5, 4);
        ctx.fillStyle = wk.bubbleColor;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(wk.bubble, px + 26, py - 9);
      }
    }
  }

  private drawFloaters(dtMs: number): void {
    const ctx = this.ctx;
    ctx.font = 'bold 13px monospace';
    for (const f of this.floaters) {
      f.t += dtMs;
      const k = f.t / 1100;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = OUTLINE;
      ctx.fillText(f.text, f.x + 1, f.y - k * 40 + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - k * 40);
      ctx.globalAlpha = 1;
    }
    this.floaters = this.floaters.filter((f) => f.t < 1100);
  }

  private rain(dtMs: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(159,184,216,0.75)';
    ctx.lineWidth = 1;
    for (const d of this.drops) {
      d.y += (d.v * dtMs) / 1000;
      d.x -= (d.v * 0.12 * dtMs) / 1000;
      if (d.y > H) { d.y = -8; d.x = this.rand() * (W + 60); }
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + 8);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(159,184,216,0.35)';
    for (const d of this.drops) if (d.y > 296 && d.y < 308) ctx.fillRect(d.x - 2, 304, 6, 2);
    // puddle shine on the road
    ctx.fillStyle = 'rgba(159,184,216,0.18)';
    ctx.fillRect(200, 330, 90, 5);
    ctx.fillRect(420, 344, 120, 5);
  }

  private grain(): void {
    const ctx = this.ctx;
    ctx.save();
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 145, W / 2, H / 2, 390);
    vignette.addColorStop(0.58, 'rgba(8,16,31,0)');
    vignette.addColorStop(1, 'rgba(8,16,31,0.2)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,248,218,0.045)';
    for (let i = 0; i < 22; i++) {
      const x = (i * 97 + Math.floor(this.time / 40)) % W;
      const y = (i * 53 + 17) % H;
      ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 0.8 : 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return;
    ctx.fillStyle = 'rgba(20,16,40,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = 'rgba(20,16,40,0.10)';
    ctx.fillRect(0, 0, W, 5);
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillRect(0, 0, 5, H);
    ctx.fillRect(W - 5, 0, 5, H);
  }
}
