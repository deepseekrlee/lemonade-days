import { VIEW_H as H, VIEW_W as W, configureHiResCanvas, drawSoftShadow, drawTownBackground, roundedRectPath } from './art';
import { OUTLINE, drawKid, drawLemonFolk, drawPerson, shade } from './sprites';

/** Cosmetic seventh-night epilogue: fireworks, food trucks, and a block party. */
export class FestivalScene {
  private ctx: CanvasRenderingContext2D;
  private seed: number;
  private muralStage: number;

  constructor(canvas: HTMLCanvasElement, day: number, muralStage: number) {
    this.ctx = configureHiResCanvas(canvas);
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
    drawTownBackground(ctx, 'night');
    return;
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
    if (this.muralStage > 0) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.82;
      roundedRectPath(ctx, 119, 119, 116, 74, 4);
      const mural = ctx.createLinearGradient(119, 119, 235, 193);
      mural.addColorStop(0, '#e9ad70'); mural.addColorStop(0.55, '#d86c69'); mural.addColorStop(1, '#2f8071');
      ctx.fillStyle = mural; ctx.fill();
      if (this.muralStage >= 3) {
        ctx.fillStyle = '#fff0a6'; ctx.beginPath(); ctx.arc(150, 153, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8f1d2'; ctx.font = '900 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(this.muralStage >= 5 ? 'GROW TOGETHER' : `COMMUNITY ${this.muralStage}/5`, 185, 178);
      }
      ctx.restore();
    }
    void t;
    return;
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
    ctx.strokeStyle = 'rgba(24,29,49,0.88)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 210); ctx.quadraticCurveTo(W / 2, 244, W, 210); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const x = 8 + i * 27;
      const y = 214 + Math.round(Math.sin((x / W) * Math.PI) * 16);
      ctx.save();
      ctx.shadowColor = i % 4 === 0 ? '#ee7790' : '#ffd86f';
      ctx.shadowBlur = 8;
      ctx.fillStyle = (Math.floor(t * 3) + i) % 5 === 0 ? '#e2777a' : '#f7e096';
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  private partyCrowd(t: number): void {
    const ctx = this.ctx;
    const people = [42, 82, 124, 220, 264, 304, 388, 430, 470, 570, 610];
    people.forEach((x, i) => {
      const hop = Math.round(Math.abs(Math.sin(t * 4 + i * 0.8)) * -3);
      if (i === 3) drawLemonFolk(ctx, x, 248 + hop, { throwing: true });
      else if (i % 3 === 0) drawKid(ctx, x, 254 + hop, Math.floor(t * 6 + i), { shirt: '#c9d97e', skin: '#e8b48a', hair: '#8a5a3a', pants: '#4f4a6b' }, i % 2 === 0);
      else drawPerson(ctx, x, 246 + hop, Math.floor(t * 6 + i), { shirt: ['#e2777a', '#6fa8c9', '#8f86c9'][i % 3], skin: i % 2 ? '#c68d5e' : '#f0c8a0', hair: '#3f3a52', pants: '#4f4a6b' }, { flip: i % 2 === 0, merch: i % 4 === 0 });
    });
    ctx.fillStyle = '#fff0aa';
    ctx.font = '900 10px "Trebuchet MS", sans-serif';
    ctx.shadowColor = '#1b2342'; ctx.shadowBlur = 4;
    ctx.fillText('SEVENTH-NIGHT BLOCK PARTY', 223, 237);
    ctx.shadowBlur = 0;
  }

  private street(): void {
    return;
    const ctx = this.ctx;
    ctx.fillStyle = '#5a5570';
    ctx.fillRect(0, 282, W, H - 282);
    ctx.fillStyle = '#d9cba8';
    for (let x = 10; x < W; x += 54) ctx.fillRect(x, 344, 28, 4);
  }

  private foodTruck(x: number, y: number, name: string, base: string, accent: string, kind: 'lemon' | 'taco' | 'pizza' | 'ice', t: number): void {
    this.foodTruckRemastered(x, y, name, base, accent, kind, t);
    return;
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

  private foodTruckRemastered(
    x: number,
    y: number,
    name: string,
    base: string,
    accent: string,
    kind: 'lemon' | 'taco' | 'pizza' | 'ice',
    t: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    drawSoftShadow(ctx, x + 74, y + 40, 73, 7, 0.38);

    // Rounded food-truck body with a cool night-side shadow and warm trim.
    ctx.shadowColor = 'rgba(6,10,28,0.5)';
    ctx.shadowBlur = 8;
    roundedRectPath(ctx, x, y - 17, 146, 55, 8);
    ctx.fillStyle = OUTLINE;
    ctx.fill();
    ctx.shadowBlur = 0;
    roundedRectPath(ctx, x + 2.5, y - 14.5, 141, 50, 6);
    const body = ctx.createLinearGradient(x, y - 14, x + 146, y + 36);
    body.addColorStop(0, shade(base, 32));
    body.addColorStop(0.5, base);
    body.addColorStop(1, shade(base, -39));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.fillStyle = accent;
    roundedRectPath(ctx, x + 3, y + 20, 140, 15, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,211,0.35)';
    ctx.fillRect(x + 8, y - 11, 2, 28);

    // Service window glows with its own tiny counter scene.
    roundedRectPath(ctx, x + 11, y - 10, 76, 31, 4);
    ctx.fillStyle = '#17243b'; ctx.fill();
    roundedRectPath(ctx, x + 15, y - 6, 68, 23, 2);
    const windowGlow = ctx.createLinearGradient(x + 15, y - 6, x + 83, y + 17);
    windowGlow.addColorStop(0, '#fff2ad'); windowGlow.addColorStop(1, '#ee9a8b');
    ctx.fillStyle = windowGlow; ctx.fill();
    ctx.fillStyle = 'rgba(39,52,67,0.8)';
    ctx.fillRect(x + 41, y - 6, 3, 23);
    ctx.fillStyle = '#f9f4d8';
    for (let jar = 0; jar < 3; jar++) ctx.fillRect(x + 20 + jar * 10, y + 8 - jar, 6, 7 + jar);

    // Cab window and headlamp.
    roundedRectPath(ctx, x + 101, y - 8, 30, 23, 4);
    ctx.fillStyle = '#14283c'; ctx.fill();
    ctx.fillStyle = 'rgba(122,200,221,0.55)';
    ctx.beginPath(); ctx.moveTo(x + 104, y - 5); ctx.lineTo(x + 121, y - 5); ctx.lineTo(x + 128, y + 11); ctx.lineTo(x + 104, y + 11); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ffe99a'; ctx.shadowBlur = 7;
    ctx.fillStyle = '#fff3ad'; ctx.beginPath(); ctx.arc(x + 139, y + 17, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    ctx.fillStyle = '#fff7dc';
    ctx.font = '900 7px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, x + 9, y + 31);

    const mascotX = x + 69, mascotY = y - 23 + Math.sin(t * 2 + x) * 0.6;
    ctx.shadowColor = 'rgba(4,8,23,0.35)'; ctx.shadowBlur = 5;
    if (kind === 'lemon') {
      ctx.fillStyle = '#f4d84e'; ctx.beginPath(); ctx.ellipse(mascotX, mascotY, 16, 9, -0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4f9b66'; ctx.beginPath(); ctx.ellipse(mascotX + 13, mascotY - 8, 8, 3, -0.55, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'taco') {
      ctx.fillStyle = '#edbd5f'; ctx.beginPath(); ctx.arc(mascotX, mascotY + 2, 16, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#65aa76'; ctx.fillRect(mascotX - 12, mascotY - 1, 24, 3);
    } else if (kind === 'pizza') {
      ctx.fillStyle = '#efbd62'; ctx.beginPath(); ctx.moveTo(mascotX - 13, mascotY - 9); ctx.lineTo(mascotX + 14, mascotY - 9); ctx.lineTo(mascotX, mascotY + 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d95c50'; ctx.beginPath(); ctx.arc(mascotX - 4, mascotY - 2, 3, 0, Math.PI * 2); ctx.arc(mascotX + 6, mascotY + 1, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#f4edf0'; ctx.beginPath(); ctx.arc(mascotX, mascotY - 6, 8, 0, Math.PI * 2); ctx.arc(mascotX - 5, mascotY, 7, 0, Math.PI * 2); ctx.arc(mascotX + 5, mascotY, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d58d6e'; ctx.beginPath(); ctx.moveTo(mascotX - 7, mascotY + 5); ctx.lineTo(mascotX + 7, mascotY + 5); ctx.lineTo(mascotX, mascotY + 17); ctx.closePath(); ctx.fill();
    }
    ctx.shadowBlur = 0;

    for (const wheelX of [x + 28, x + 119]) {
      ctx.fillStyle = '#111a2b'; ctx.beginPath(); ctx.arc(wheelX, y + 36, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#415366'; ctx.beginPath(); ctx.arc(wheelX, y + 36, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(wheelX, y + 36, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private grain(t: number): void {
    const ctx = this.ctx;
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 145, W / 2, H / 2, 390);
    vignette.addColorStop(0.55, 'rgba(6,8,23,0)');
    vignette.addColorStop(1, 'rgba(6,8,23,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    void t;
  }
}
