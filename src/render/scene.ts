import { DAY_MINUTES } from '../game/data';
import type { FlavorId, SimEvent, UpgradeId, Weather } from '../game/types';
import { AmbientLayer, type AmbientHooks } from './ambient';
import { HAIRS, OUTLINE, PANTS, SHIRTS, SKINS, drawPerson, shade } from './sprites';

/** Hi-bit logical resolution (integer-scales to 720p / 1080p). */
const W = 640;
const H = 360;
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
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = '#242033';
    ctx.fillRect(x - r + 2, y - r + 2, r * 2 - 4, r * 2 - 4);
    ctx.fillStyle = '#9aa5a8';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  private drawIceCreamTruck(x: number, y: number): void {
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

  private drawSUV(x: number, y: number): void {
    const ctx = this.ctx;
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
    ctx.fillStyle = 'rgba(20,16,40,0.04)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = 'rgba(20,16,40,0.10)';
    ctx.fillRect(0, 0, W, 5);
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillRect(0, 0, 5, H);
    ctx.fillRect(W - 5, 0, 5, H);
  }
}
