import { OUTLINE, drawKid, drawLemonFolk, drawPerson, shade } from './sprites';

const W = 640;
const H = 360;

/** Cosmetic seventh-night epilogue: fireworks, food trucks, and a block party. */
export class FestivalScene {
  private ctx: CanvasRenderingContext2D;
  private seed: number;
  private muralStage: number;

  constructor(canvas: HTMLCanvasElement, day: number, muralStage: number) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unavailable');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    this.seed = day * 7919;
    this.muralStage = muralStage;
  }

  render(timeMs: number): void {
    const t = timeMs / 1000;
    this.sky();
    this.fireworks(t);
    this.skyline(t);
    this.lights(t);
    this.partyCrowd(t);
    this.street();
    this.foodTruck(12, 292, 'LEMON LAB', '#f2d24b', '#2f7d4a', 'lemon', t);
    this.foodTruck(170, 292, 'TACO COMET', '#e2777a', '#e8b45f', 'taco', t);
    this.foodTruck(328, 292, 'PIZZA PLANET', '#c74b50', '#f7e096', 'pizza', t);
    this.foodTruck(486, 292, 'NICE ICE', '#6fa8c9', '#f2b8c6', 'ice', t);
    this.grain(t);
  }

  private sky(): void {
    const ctx = this.ctx;
    const bands = ['#15142d', '#1b1b38', '#24234a', '#30315b', '#4b486d'];
    for (let i = 0; i < bands.length; i++) {
      ctx.fillStyle = bands[i];
      ctx.fillRect(0, i * 44, W, 46);
    }
    ctx.fillStyle = '#fbf7ec';
    for (let i = 0; i < 52; i++) {
      const x = (i * 97 + this.seed) % W;
      const y = 10 + ((i * 43 + this.seed) % 155);
      ctx.globalAlpha = i % 4 === 0 ? 0.9 : 0.45;
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f7e096';
    ctx.fillRect(548, 24, 34, 34);
    ctx.fillStyle = '#15142d';
    ctx.fillRect(535, 15, 31, 42);
  }

  private fireworks(t: number): void {
    const ctx = this.ctx;
    const colors = ['#f2d24b', '#e2777a', '#6fa8c9', '#7fd97a', '#f2b8c6'];
    for (let burst = 0; burst < 7; burst++) {
      const phase = (t + burst * 1.37 + (this.seed % 17) * 0.1) % 7;
      const cx = 54 + ((burst * 103 + this.seed) % 530);
      const cy = 38 + ((burst * 47 + this.seed) % 104);
      if (phase > 5.5) {
        const k = (phase - 5.5) / 1.5;
        ctx.fillStyle = '#f7e096';
        ctx.fillRect(cx, 198 - k * (198 - cy), 2, 9);
        continue;
      }
      if (phase > 2.6) continue;
      const radius = 8 + phase * 28;
      const alpha = Math.max(0, 1 - phase / 2.6);
      for (let ray = 0; ray < 16; ray++) {
        const angle = (Math.PI * 2 * ray) / 16 + burst * 0.21;
        const x = Math.round(cx + Math.cos(angle) * radius);
        const y = Math.round(cy + Math.sin(angle) * radius * 0.72 + phase * phase * 3);
        ctx.fillStyle = colors[(burst + ray) % colors.length];
        ctx.globalAlpha = alpha;
        ctx.fillRect(x, y, ray % 3 === 0 ? 4 : 3, ray % 3 === 0 ? 4 : 3);
        if (phase > 0.8) ctx.fillRect(x - Math.cos(angle) * 8, y - Math.sin(angle) * 6, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  private skyline(t: number): void {
    const ctx = this.ctx;
    const buildings = [[0, 72, 72], [76, 92, 96], [172, 70, 62], [246, 104, 92], [354, 82, 70], [440, 90, 104], [534, 106, 78]];
    for (let i = 0; i < buildings.length; i++) {
      const [x, w, h] = buildings[i];
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x, 220 - h - 2, w, h + 2);
      ctx.fillStyle = i % 2 ? '#4c4d67' : '#56536e';
      ctx.fillRect(x + 2, 220 - h, w - 4, h);
      for (let wy = 228 - h; wy < 210; wy += 16) {
        for (let wx = x + 8; wx < x + w - 8; wx += 16) {
          const on = (wx + wy + i + Math.floor(t / 4)) % 5 !== 0;
          ctx.fillStyle = on ? '#f7e096' : '#303047';
          ctx.fillRect(wx, wy, 5, 7);
          if (on) {
            ctx.fillStyle = '#fbf0c0';
            ctx.fillRect(wx, wy, 5, 2);
          }
        }
      }
    }
    if (this.muralStage > 0) {
      ctx.fillStyle = '#f4d89a';
      ctx.fillRect(82, 140, 78, 70);
      ctx.fillStyle = '#f2d24b';
      ctx.fillRect(96, 150, 46, 42);
      ctx.fillStyle = '#2f7d4a';
      ctx.fillRect(125, 144, 18, 9);
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 8px monospace';
      ctx.fillText(this.muralStage >= 5 ? 'LEMONADE FOR ALL' : `MURAL ${this.muralStage}/5`, 86, 204);
    }
  }

  private lights(t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = OUTLINE;
    for (let x = 0; x < W; x += 4) {
      const y = 212 + Math.round(Math.sin((x / W) * Math.PI) * 16);
      ctx.fillRect(x, y, 4, 2);
    }
    for (let i = 0; i < 24; i++) {
      const x = 8 + i * 27;
      const y = 214 + Math.round(Math.sin((x / W) * Math.PI) * 16);
      ctx.fillStyle = 'rgba(247,224,150,0.25)';
      ctx.fillRect(x - 4, y - 4, 12, 12);
      ctx.fillStyle = (Math.floor(t * 3) + i) % 5 === 0 ? '#e2777a' : '#f7e096';
      ctx.fillRect(x, y, 4, 5);
    }
  }

  private partyCrowd(t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#6f9c60';
    ctx.fillRect(0, 220, W, 62);
    ctx.fillStyle = shade('#6f9c60', -18);
    ctx.fillRect(0, 278, W, 4);
    const people = [42, 82, 124, 220, 264, 304, 388, 430, 470, 570, 610];
    people.forEach((x, i) => {
      const hop = Math.round(Math.abs(Math.sin(t * 4 + i * 0.8)) * -3);
      if (i === 3) drawLemonFolk(ctx, x, 248 + hop, { throwing: true });
      else if (i % 3 === 0) drawKid(ctx, x, 254 + hop, Math.floor(t * 6 + i), { shirt: '#c9d97e', skin: '#e8b48a', hair: '#8a5a3a', pants: '#4f4a6b' }, i % 2 === 0);
      else drawPerson(ctx, x, 246 + hop, Math.floor(t * 6 + i), { shirt: ['#e2777a', '#6fa8c9', '#8f86c9'][i % 3], skin: i % 2 ? '#c68d5e' : '#f0c8a0', hair: '#3f3a52', pants: '#4f4a6b' }, { flip: i % 2 === 0, merch: i % 4 === 0 });
    });
    ctx.fillStyle = '#fbf7ec';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SEVENTH-NIGHT BLOCK PARTY', 210, 235);
  }

  private street(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#5a5570';
    ctx.fillRect(0, 282, W, H - 282);
    ctx.fillStyle = '#d9cba8';
    for (let x = 10; x < W; x += 54) ctx.fillRect(x, 344, 28, 4);
  }

  private foodTruck(x: number, y: number, name: string, base: string, accent: string, kind: 'lemon' | 'taco' | 'pizza' | 'ice', t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(15,12,30,0.35)';
    ctx.fillRect(x + 5, y + 43, 142, 5);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y - 16, 146, 54);
    ctx.fillStyle = base;
    ctx.fillRect(x + 3, y - 13, 140, 48);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 3, y + 20, 140, 15);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 12, y - 9, 72, 27);
    ctx.fillStyle = '#20233a';
    ctx.fillRect(x + 15, y - 6, 66, 21);
    ctx.fillStyle = '#f7e096';
    ctx.fillRect(x + 19, y - 2, 24, 13);
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + 49, y - 2, 27, 13);
    ctx.fillStyle = '#9fd4e8';
    ctx.fillRect(x + 102, y - 7, 28, 19);
    ctx.fillStyle = OUTLINE;
    ctx.font = 'bold 7px monospace';
    ctx.fillText(name, x + 8, y + 31);
    // Roof mascot makes each truck readable even at a glance.
    if (kind === 'lemon') {
      ctx.fillStyle = '#f2d24b'; ctx.fillRect(x + 54, y - 29, 28, 15);
      ctx.fillStyle = '#2f7d4a'; ctx.fillRect(x + 76, y - 34, 10, 7);
    } else if (kind === 'taco') {
      ctx.fillStyle = '#e8b45f'; ctx.fillRect(x + 54, y - 28, 30, 14);
      ctx.fillStyle = '#7fae8e'; ctx.fillRect(x + 60, y - 30, 18, 5);
    } else if (kind === 'pizza') {
      ctx.fillStyle = '#e8b45f'; ctx.fillRect(x + 58, y - 34, 24, 20);
      ctx.fillStyle = '#c74b50'; ctx.fillRect(x + 64, y - 29, 5, 5); ctx.fillRect(x + 73, y - 23, 5, 5);
    } else {
      ctx.fillStyle = '#fbf7ec'; ctx.fillRect(x + 60, y - 35, 18, 15);
      ctx.fillStyle = '#f2b8c6'; ctx.fillRect(x + 63, y - 40, 12, 7);
      ctx.fillStyle = '#e8b45f'; ctx.fillRect(x + 64, y - 20, 10, 7);
    }
    const wheel = (wx: number): void => {
      ctx.fillStyle = OUTLINE; ctx.fillRect(wx - 9, y + 29, 18, 18);
      ctx.fillStyle = '#202033'; ctx.fillRect(wx - 6, y + 32, 12, 12);
      ctx.fillStyle = accent; ctx.fillRect(wx - 2, y + 36, 4, 4);
    };
    wheel(x + 27); wheel(x + 119);
    if (Math.floor(t * 4 + x) % 6 === 0) {
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x + 92, y - 17, 4, 4);
    }
  }

  private grain(t: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(251,247,236,0.06)';
    const off = Math.floor(t * 31);
    for (let i = 0; i < 70; i++) ctx.fillRect((i * 83 + off) % W, (i * 47 + off * 3) % H, 1, 1);
  }
}
