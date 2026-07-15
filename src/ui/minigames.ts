/**
 * Lawn mini-games: 60 seconds of silly.
 * - rumble & dash reveal the neighborhood's secret flavor-of-the-day
 * - chug is just for bragging rights
 * - ramp is a skill-and-luck monster-truck launch
 * All rendering reuses the game's sprite helpers; results flow back via onDone.
 */
import { FLAVORS, bossTierFor } from '../game/data';
import type { FlavorId } from '../game/types';
import { drawBigfoot } from '../render/ambient';
import { OUTLINE, drawAlienGuy, drawKid, drawLemonFolk, drawPerson, shade } from '../render/sprites';

export type MiniKind = 'rumble' | 'dash' | 'chug' | 'ramp' | 'cryo';
export interface MiniResult { won: boolean; quit: boolean; choice?: string; value?: number; summary?: string; }

export interface MiniOpts {
  playerFlavor: FlavorId;
  otherFlavor: FlavorId;
  /** Set for divination games; the verdict shown at the end. */
  moodFlavor: FlavorId | null;
  /** Victory buttons (e.g. harvest vs. mercy). Defaults to a Continue button. */
  winChoices?: { id: string; label: string; hint?: string }[];
  bossTemp?: number;
  hasSlush?: boolean;
  truckLevel?: number;
  sfx: { click: () => void; coin: () => void; chime: () => void; dayEnd: () => void };
  onDone: (result: MiniResult) => void;
}

const LIQ: Record<FlavorId, string> = { classic: '#f2d24b', pink: '#f2b8c6', mint: '#b8e0c4' };
const W = 640;
const H = 360;

interface Input { left: boolean; right: boolean; up: boolean; a: boolean; b: boolean; c: boolean; }

interface GameOutcome { won: boolean; value?: number; summary?: string; }

interface Game {
  update(dt: number, input: Input, justPressed: Set<string>): void;
  draw(ctx: CanvasRenderingContext2D): void;
  mount?(canvas: HTMLCanvasElement): void;
  result: GameOutcome | null;
}

export function runMinigame(host: HTMLElement, kind: MiniKind, opts: MiniOpts): () => void {
  host.innerHTML = `
    <div class="mg-head">
      <b>${kind === 'rumble' ? '🥊 LEMON RUMBLE' : kind === 'dash' ? '🏁 CITRUS DASH' : kind === 'ramp' ? '🏎️ RAMP RALLY' : kind === 'cryo' ? '🦹 CRYO-DEFENSE' : '🔫 CHUG DUEL'}</b>
      <button class="mg-quit">✕ quit</button>
    </div>
    <canvas class="mg-canvas" width="${W}" height="${H}"></canvas>
    <div class="mg-help">${
      kind === 'rumble'
        ? '←/→ move · Z throw lemon · X throw ice · C water cannon (when charged) · dodge the sugar bucket!'
        : kind === 'dash'
        ? '↑ or SPACE to jump the obstacles!'
        : kind === 'ramp'
        ? 'HOLD SPACE, Z, or → to build speed. Feather the gas before the engine overheats. Wind adds a little luck.'
        : kind === 'cryo'
        ? `TAP or CLICK to hurl ice. Do NOT let him reach the vats!${opts.hasSlush ? ' SPACE fires the charged SLUSH BOMB.' : ''}`
        : '←/→ to catch the stream in your mouth. Fill up first!'
    }</div>
    ${kind === 'cryo' ? (opts.hasSlush ? '<div class="mg-controls"><button data-k="up">SLUSH BOMB</button></div>' : '') : `<div class="mg-controls">
      <button data-k="left">◀</button>
      ${kind === 'dash' ? '<button data-k="up">JUMP</button>' : ''}
      ${kind === 'rumble' ? '<button data-k="a">🍋</button><button data-k="b">🧊</button><button data-k="c">💦</button>' : ''}
      ${kind === 'ramp' ? '<button class="gas" data-k="a">HOLD GAS</button>' : ''}
      <button data-k="right">▶</button>
    </div>`}`;
  const canvas = host.querySelector('.mg-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) { opts.onDone({ won: false, quit: true }); return () => undefined; }
  ctx.imageSmoothingEnabled = false;

  const input: Input = { left: false, right: false, up: false, a: false, b: false, c: false };
  const justPressed = new Set<string>();
  const keymap: Record<string, keyof Input> = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ' ': 'up',
    z: 'a', Z: 'a', x: 'b', X: 'b', c: 'c', C: 'c',
  };
  const down = (ev: KeyboardEvent): void => {
    const k = keymap[ev.key];
    if (!k) return;
    ev.preventDefault();
    if (!input[k]) justPressed.add(k);
    input[k] = true;
  };
  const up = (ev: KeyboardEvent): void => {
    const k = keymap[ev.key];
    if (k) input[k] = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  host.querySelectorAll('.mg-controls button').forEach((btn) => {
    const k = (btn as HTMLElement).dataset.k as keyof Input;
    const press = (on: boolean) => (ev: Event) => {
      ev.preventDefault();
      if (on && !input[k]) justPressed.add(k);
      input[k] = on;
    };
    btn.addEventListener('pointerdown', press(true));
    btn.addEventListener('pointerup', press(false));
    btn.addEventListener('pointerleave', press(false));
  });

  const game: Game = kind === 'rumble' ? rumble(opts) : kind === 'dash' ? dash(opts) : kind === 'ramp' ? ramp(opts) : kind === 'cryo' ? cryo(opts) : chug(opts);
  game.mount?.(canvas);
  let raf = 0;
  let last = performance.now();
  let doneShown = false;
  const cleanup = (): void => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
  (host.querySelector('.mg-quit') as HTMLElement).addEventListener('click', () => {
    cleanup();
    opts.onDone({ won: false, quit: true });
  });

  const tick = (ts: number): void => {
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    if (!game.result) game.update(dt, input, justPressed);
    justPressed.clear();
    game.draw(ctx);
    if (game.result && !doneShown) {
      doneShown = true;
      opts.sfx.dayEnd();
      const overlay = document.createElement('div');
      overlay.className = 'mg-result';
      const verdict = opts.moodFlavor
        ? `<p>🗣️ Crowd verdict: they were rooting for <b>${FLAVORS[opts.moodFlavor].icon} ${FLAVORS[opts.moodFlavor].name}</b> all along!</p>`
        : '';
      const summary = game.result.summary ? `<p class="mg-summary">${game.result.summary}</p>` : '';
      const buttons = game.result.won && opts.winChoices?.length
        ? opts.winChoices.map((c) => `<button class="mg-continue big go" data-choice="${c.id}">${c.label}${c.hint ? `<span class="hint"> ${c.hint}</span>` : ''}</button>`).join('')
        : '<button class="mg-continue big go">Continue</button>';
      overlay.innerHTML = `
        <div>
          <h2>${game.result.won ? '🏆 YOU WIN!' : kind === 'cryo' ? '💧 the vats…' : 'so close!'}</h2>
          ${summary}
          ${verdict}
          <div class="ev-choices">${buttons}</div>
        </div>`;
      host.appendChild(overlay);
      overlay.querySelectorAll('.mg-continue').forEach((btn) => {
        btn.addEventListener('click', () => {
          cleanup();
          opts.onDone({ won: game.result?.won ?? false, quit: false, choice: (btn as HTMLElement).dataset.choice, value: game.result?.value, summary: game.result?.summary });
        });
      });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return cleanup;
}

/* ------------------------------ shared bits ------------------------------ */

function arena(ctx: CanvasRenderingContext2D, time: number, crowd: boolean): void {
  ctx.fillStyle = '#9fd4e8';
  ctx.fillRect(0, 0, W, 130);
  ctx.fillStyle = '#88b078';
  ctx.fillRect(0, 130, W, H - 130);
  ctx.fillStyle = shade('#88b078', -10);
  for (let x = 0; x < W; x += 48) ctx.fillRect(x, 130, 24, H - 130);
  if (!crowd) return;
  // kaiju peeking over the treeline
  ctx.fillStyle = '#5f7d76';
  ctx.fillRect(516, 34, 44, 40);
  ctx.fillRect(500, 46, 24, 16);
  ctx.fillStyle = '#f2d24b';
  ctx.fillRect(524, 52, 6, 4);
  ctx.fillStyle = '#8fa89a';
  ctx.fillRect(548, 24, 10, 12);
  // bleachers
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(38, 96, 420, 6);
  ctx.fillStyle = '#a8783f';
  ctx.fillRect(40, 90, 416, 6);
  const bounce = (i: number): number => Math.round(Math.abs(Math.sin(time / 240 + i)) * -4);
  drawBigfoot(ctx, 46, 44 + bounce(0), Math.floor(time / 240) % 2, {});
  drawAlienGuy(ctx, 96, 74 + bounce(1), Math.floor(time / 200), false, true);
  drawAlienGuy(ctx, 116, 76 + bounce(2), Math.floor(time / 220), false, false);
  drawPerson(ctx, 142, 62 + bounce(3), Math.floor(time / 210) % 2, { shirt: '#6fa8c9', skin: '#f0c8a0', hair: '#3f3a52', pants: '#4f4a6b' }, { merch: true });
  drawPerson(ctx, 170, 62 + bounce(4), Math.floor(time / 190) % 2, { shirt: '#d98cb3', skin: '#c68d5e', hair: '#d9c37e', pants: '#5d6b7a' }, {});
  drawKid(ctx, 200, 74 + bounce(5), Math.floor(time / 180), { shirt: '#c9d97e', skin: '#e8b48a', hair: '#8a5a3a', pants: '#7a5d4f' }, false);
  drawLemonFolk(ctx, 224, 68 + bounce(6), {});
  drawPerson(ctx, 252, 62 + bounce(7), Math.floor(time / 230) % 2, { shirt: '#e8b45f', skin: '#8d5a3b', hair: '#6b4a6b', pants: '#3f5a52' }, { merch: true, capColor: '#4bc7b8' });
  drawBigfoot(ctx, 282, 44 + bounce(8), Math.floor(time / 260) % 2, { her: true });
  drawAlienGuy(ctx, 330, 74 + bounce(9), Math.floor(time / 210), true, false);
  drawPerson(ctx, 354, 62 + bounce(10), Math.floor(time / 200) % 2, { shirt: '#8f86c9', skin: '#e8b48a', hair: '#b0503c', pants: '#4f4a6b' }, {});
  drawKid(ctx, 386, 74 + bounce(11), Math.floor(time / 170), { shirt: '#e2777a', skin: '#f0c8a0', hair: '#3f3a52', pants: '#5d6b7a' }, true);
  drawLemonFolk(ctx, 410, 68 + bounce(12), { color: '#f2b8c6' });
}

function bigLemon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, opts: { flip?: boolean; throwing?: boolean; hurt?: boolean; mouthOpen?: boolean }): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2, 2);
  drawLemonFolk(ctx, 0, 0, { color: opts.hurt ? '#fbf7ec' : color, flip: opts.flip, throwing: opts.throwing, mouthOpen: opts.mouthOpen });
  ctx.restore();
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, hp: number, name: string, right: boolean): void {
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 2, 14, 224, 22);
  ctx.fillStyle = '#5d5870';
  ctx.fillRect(x, 16, 220, 14);
  ctx.fillStyle = hp > 35 ? '#7fae8e' : '#c74b50';
  const w = Math.max(0, (hp / 100) * 220);
  ctx.fillRect(right ? x + 220 - w : x, 16, w, 14);
  ctx.fillStyle = '#fbf7ec';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(name.toUpperCase(), right ? x + 220 - name.length * 7 : x + 2, 42);
}

/* ------------------------------ LEMON RUMBLE ------------------------------ */

interface Shot { x: number; y: number; vx: number; vy: number; kind: 'lemon' | 'ice'; mine: boolean; }

function rumble(opts: MiniOpts): Game {
  const pc = LIQ[opts.playerFlavor];
  const ec = LIQ[opts.otherFlavor];
  const GROUND = 268;
  let px = 120;
  let ex = 480;
  let php = 100;
  let ehp = 100;
  let meter = 0;
  let timeLeft = 45;
  let time = 0;
  let pcool = 0;
  let aiCool = 1;
  let bucket: { x: number; t: number } | null = null;
  let bucketCool = 4;
  let cannonAnim = 0;
  let pThrow = 0;
  let eThrow = 0;
  const shots: Shot[] = [];
  let result: GameOutcome | null = null;

  return {
    get result() { return result; },
    set result(v) { result = v; },
    update(dt, input, justPressed) {
      time += dt * 1000;
      timeLeft -= dt;
      pcool -= dt;
      aiCool -= dt;
      bucketCool -= dt;
      cannonAnim = Math.max(0, cannonAnim - dt);
      pThrow = Math.max(0, pThrow - dt);
      eThrow = Math.max(0, eThrow - dt);
      if (input.left) px -= 190 * dt;
      if (input.right) px += 190 * dt;
      px = Math.max(30, Math.min(W - 70, px));
      if (justPressed.has('a') && pcool <= 0) {
        pcool = 0.45;
        pThrow = 0.2;
        shots.push({ x: px + 34, y: GROUND + 8, vx: 250, vy: -170, kind: 'lemon', mine: true });
        opts.sfx.click();
      }
      if (justPressed.has('b') && pcool <= 0) {
        pcool = 0.4;
        pThrow = 0.2;
        shots.push({ x: px + 34, y: GROUND + 16, vx: 330, vy: 0, kind: 'ice', mine: true });
        opts.sfx.click();
      }
      if (justPressed.has('c') && meter >= 100) {
        meter = 0;
        cannonAnim = 0.5;
        ehp -= 20;
        opts.sfx.coin();
      }
      // AI: keep spacing, lob things, occasionally call in the sugar bucket
      const want = 240 + Math.sin(time / 900) * 70;
      const gap = ex - px;
      if (gap < want - 12) ex += 120 * dt;
      else if (gap > want + 12) ex -= 120 * dt;
      ex = Math.max(60, Math.min(W - 40, ex));
      if (aiCool <= 0) {
        aiCool = 0.8 + Math.random() * 0.5;
        eThrow = 0.2;
        const ice = Math.random() < 0.45;
        shots.push({ x: ex - 6, y: GROUND + (ice ? 16 : 8), vx: ice ? -330 : -250, vy: ice ? 0 : -170, kind: ice ? 'ice' : 'lemon', mine: false });
      }
      if (ehp < 60 && bucketCool <= 0 && !bucket) {
        bucket = { x: px + 17, t: 0.9 };
        bucketCool = 5;
      }
      if (bucket) {
        bucket.t -= dt;
        if (bucket.t <= 0) {
          if (Math.abs(px + 17 - bucket.x) < 42) {
            php -= 12;
            opts.sfx.click();
          }
          bucket = null;
        }
      }
      for (const s of shots) {
        s.x += s.vx * dt;
        if (s.kind === 'lemon') { s.vy += 420 * dt; s.y += s.vy * dt; }
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        const tx = s.mine ? ex : px;
        if (s.x > tx && s.x < tx + 34 && s.y > GROUND - 6 && s.y < GROUND + 46) {
          const dmg = s.kind === 'lemon' ? 8 : 5;
          if (s.mine) { ehp -= dmg; meter = Math.min(100, meter + 25); opts.sfx.coin(); }
          else php -= dmg;
          shots.splice(i, 1);
        } else if (s.x < -20 || s.x > W + 20 || s.y > H) {
          shots.splice(i, 1);
        }
      }
      if (php <= 0 || ehp <= 0 || timeLeft <= 0) {
        result = { won: ehp < php };
      }
    },
    draw(ctx) {
      arena(ctx, time, true);
      // ring ropes
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(16, GROUND + 44, W - 32, 4);
      ctx.fillStyle = '#e2777a';
      ctx.fillRect(16, GROUND + 45, W - 32, 2);
      hpBar(ctx, 28, php, FLAVORS[opts.playerFlavor].name, false);
      hpBar(ctx, W - 252, ehp, FLAVORS[opts.otherFlavor].name, true);
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 18px monospace';
      ctx.fillText(String(Math.max(0, Math.ceil(timeLeft))), W / 2 - 10, 32);
      // super meter
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(26, 46, 104, 10);
      ctx.fillStyle = '#6fa8c9';
      ctx.fillRect(28, 48, meter, 6);
      ctx.font = '9px monospace';
      ctx.fillStyle = OUTLINE;
      ctx.fillText(meter >= 100 ? 'CANNON READY (C)!' : 'cannon charge', 28, 66);
      // fighters
      bigLemon(ctx, px, GROUND, pc, { throwing: pThrow > 0, hurt: false });
      bigLemon(ctx, ex, GROUND, ec, { flip: true, throwing: eThrow > 0 });
      // water cannon beam
      if (cannonAnim > 0) {
        ctx.fillStyle = `rgba(111,168,201,${cannonAnim * 1.6})`;
        ctx.fillRect(px + 36, GROUND + 12, ex - px - 30, 12);
        ctx.fillStyle = `rgba(251,247,236,${cannonAnim * 1.4})`;
        ctx.fillRect(px + 36, GROUND + 16, ex - px - 30, 4);
      }
      // projectiles
      for (const s of shots) {
        if (s.kind === 'lemon') {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(s.x - 5, s.y - 4, 10, 9);
          ctx.fillStyle = '#f2d24b';
          ctx.fillRect(s.x - 4, s.y - 3, 8, 7);
          ctx.fillStyle = '#fbf0c0';
          ctx.fillRect(s.x - 3, s.y - 2, 3, 2);
        } else {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(s.x - 4, s.y - 4, 9, 9);
          ctx.fillStyle = '#cfe8e0';
          ctx.fillRect(s.x - 3, s.y - 3, 7, 7);
          ctx.fillStyle = '#fbf7ec';
          ctx.fillRect(s.x - 2, s.y - 2, 3, 3);
        }
      }
      // sugar bucket telegraph + drop
      if (bucket) {
        ctx.fillStyle = `rgba(43,36,64,${0.25 + 0.2 * Math.sin(time / 60)})`;
        ctx.fillRect(bucket.x - 24, GROUND + 40, 48, 5);
        const by = bucket.t > 0.25 ? 60 : 60 + (0.25 - bucket.t) * 700;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(bucket.x - 16, by, 32, 20);
        ctx.fillStyle = '#9aa5a8';
        ctx.fillRect(bucket.x - 14, by + 2, 28, 16);
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(bucket.x - 14, by + 2, 28, 4);
        if (bucket.t <= 0.25) {
          ctx.fillStyle = 'rgba(251,247,236,0.85)';
          ctx.fillRect(bucket.x - 12, by + 20, 24, GROUND + 40 - by);
        }
      }
    },
  };
}

/* ------------------------------ CITRUS DASH ------------------------------ */

interface Hurdle { x: number; w: number; h: number; kind: 'ice' | 'cups' | 'puddle'; aiFails?: boolean; jumped?: boolean; }

function makeCourse(length: number): Hurdle[] {
  const out: Hurdle[] = [];
  let x = 420;
  while (x < length - 240) {
    const r = Math.random();
    const aiFails = Math.random() < 0.18; // the rival is fallible, just like us
    if (r < 0.4) out.push({ x, w: 26, h: 22, kind: 'ice', aiFails });
    else if (r < 0.7) out.push({ x, w: 30, h: 34, kind: 'cups', aiFails });
    else out.push({ x, w: 56, h: 8, kind: 'puddle', aiFails });
    x += 240 + Math.random() * 190;
  }
  return out;
}

function dash(opts: MiniOpts): Game {
  const LEN = 4200;
  const lanes = [
    { y: 218, color: LIQ[opts.otherFlavor], dist: 0, vy: 0, jumpY: 0, stun: 0, course: makeCourse(LEN), ai: true },
    { y: 300, color: LIQ[opts.playerFlavor], dist: 0, vy: 0, jumpY: 0, stun: 0, course: makeCourse(LEN), ai: false },
  ];
  let time = 0;
  let go = -1.6; // countdown
  let result: { won: boolean } | null = null;

  return {
    get result() { return result; },
    set result(v) { result = v; },
    update(dt, _input, justPressed) {
      time += dt * 1000;
      go += dt;
      if (go < 0) return;
      for (const lane of lanes) {
        const base = lane.ai ? 172 : 178;
        // rubber-band the AI so it stays a race
        let speed = base;
        if (lane.ai) {
          const gap = lanes[1].dist - lane.dist;
          speed = base * (gap > 120 ? 1.18 : gap < -120 ? 0.86 : 1);
        }
        if (lane.stun > 0) { lane.stun -= dt; speed *= lane.ai ? 0.42 : 0.55; }
        lane.dist += speed * dt;
        // jumping
        if (lane.jumpY > 0 || lane.vy !== 0) {
          lane.vy += 980 * dt;
          lane.jumpY = Math.max(0, lane.jumpY - lane.vy * dt);
          if (lane.jumpY === 0) lane.vy = 0;
        }
        const jump = (): void => {
          if (lane.jumpY === 0) { lane.vy = -330; lane.jumpY = 0.0001; opts.sfx.click(); }
        };
        if (!lane.ai && (justPressed.has('up'))) jump();
        if (lane.ai) {
          const next = lane.course.find((h) => !h.jumped && h.x > lane.dist + 60 && h.x < lane.dist + 110);
          if (next) {
            next.jumped = true;
            if (!next.aiFails) jump(); // pre-rolled: some hurdles it just... doesn't
          }
        }
        // collisions
        for (const h of lane.course) {
          const cx = h.x - lane.dist;
          if (cx > 26 && cx < 26 + 30 && lane.jumpY < h.h) {
            if (lane.stun <= 0) { lane.stun = lane.ai ? 0.65 : 0.5; }
            break;
          }
        }
      }
      if (lanes[0].dist >= LEN || lanes[1].dist >= LEN) {
        result = { won: lanes[1].dist >= lanes[0].dist };
      }
    },
    draw(ctx) {
      arena(ctx, time, false);
      ctx.fillStyle = '#9fd4e8';
      ctx.fillRect(0, 0, W, 96);
      // progress bar
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(58, 28, 524, 12);
      ctx.fillStyle = '#b8a99a';
      ctx.fillRect(60, 30, 520, 8);
      for (const [i, lane] of lanes.entries()) {
        ctx.fillStyle = lane.color;
        ctx.fillRect(60 + (520 * Math.min(1, lane.dist / LEN)) - 4, 26 + i * 8, 10, 8);
      }
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 10px monospace';
      ctx.fillText('FINISH', 542, 22);
      for (const lane of lanes) {
        // track
        ctx.fillStyle = '#a4968a';
        ctx.fillRect(0, lane.y + 44, W, 4);
        ctx.fillStyle = shade('#a4968a', -24);
        for (let x = -Math.floor(lane.dist % 40); x < W; x += 40) ctx.fillRect(x, lane.y + 46, 20, 2);
        // hurdles
        for (const h of lane.course) {
          const cx = h.x - lane.dist;
          if (cx < -60 || cx > W + 40) continue;
          if (h.kind === 'ice') {
            ctx.fillStyle = OUTLINE;
            ctx.fillRect(cx - 1, lane.y + 44 - h.h - 1, h.w + 2, h.h + 2);
            ctx.fillStyle = '#cfe8e0';
            ctx.fillRect(cx, lane.y + 44 - h.h, h.w, h.h);
            ctx.fillStyle = '#fbf7ec';
            ctx.fillRect(cx + 3, lane.y + 44 - h.h + 3, 8, 6);
          } else if (h.kind === 'cups') {
            ctx.fillStyle = OUTLINE;
            ctx.fillRect(cx - 1, lane.y + 44 - h.h - 1, h.w + 2, h.h + 2);
            ctx.fillStyle = '#fbf7ec';
            ctx.fillRect(cx, lane.y + 44 - h.h, h.w, h.h);
            ctx.fillStyle = shade('#fbf7ec', -30);
            ctx.fillRect(cx, lane.y + 44 - 12, h.w, 4);
            ctx.fillRect(cx, lane.y + 44 - 26, h.w, 4);
          } else {
            ctx.fillStyle = 'rgba(111,168,201,0.7)';
            ctx.fillRect(cx, lane.y + 40, h.w, 6);
          }
        }
        // finish flag
        const fx = LEN - lane.dist;
        if (fx < W + 30) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(fx, lane.y - 26, 3, 70);
          for (let fy = 0; fy < 3; fy++) {
            for (let fxx = 0; fxx < 3; fxx++) {
              ctx.fillStyle = (fy + fxx) % 2 ? '#fbf7ec' : OUTLINE;
              ctx.fillRect(fx + 3 + fxx * 7, lane.y - 26 + fy * 7, 7, 7);
            }
          }
        }
        // runner
        const wob = lane.stun > 0 ? Math.sin(time / 40) * 3 : 0;
        drawLemonFolk(ctx, 26 + wob, lane.y - Math.round(lane.jumpY), {
          color: lane.color,
          throwing: false,
        });
      }
      if (go < 0) {
        ctx.fillStyle = OUTLINE;
        ctx.font = 'bold 40px monospace';
        ctx.fillText(String(Math.ceil(-go)), W / 2 - 12, 200);
      } else if (go < 0.7) {
        ctx.fillStyle = '#2f7d4a';
        ctx.font = 'bold 40px monospace';
        ctx.fillText('GO!', W / 2 - 34, 200);
      }
    },
  };
}

/* ------------------------------- CHUG DUEL ------------------------------- */

type ChugKind = 'bigfoot' | 'alien' | 'lemon' | 'kid';
const CHUG_POOL: ChugKind[] = ['bigfoot', 'alien', 'lemon', 'kid'];

function drawChugger(ctx: CanvasRenderingContext2D, kind: ChugKind, x: number, y: number, fill: number, time: number): void {
  // inflating belly behind the character
  const stage = Math.floor(fill / 20);
  if (stage > 0) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 2 - stage * 3, y + 12 - 1, 18 + stage * 6, 14 + stage * 2);
    ctx.fillStyle = kind === 'alien' ? '#7fd97a' : kind === 'lemon' ? '#f2d24b' : kind === 'bigfoot' ? '#6f5138' : '#6fa8c9';
    ctx.fillRect(x - 1 - stage * 3, y + 12, 16 + stage * 6, 12 + stage * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - stage * 3, y + 13, 5, 4);
  }
  const f = Math.floor(time / 200);
  if (kind === 'bigfoot') drawBigfoot(ctx, x - 8, y - 26, 1, { sit: false });
  else if (kind === 'alien') drawAlienGuy(ctx, x, y, f, false, false);
  else if (kind === 'lemon') drawLemonFolk(ctx, x, y - 6, { mouthOpen: true });
  else drawKid(ctx, x, y - 2, f, { shirt: '#6fa8c9', skin: '#f0c8a0', hair: '#8a5a3a', pants: '#4f4a6b' }, false);
  // open mouth marker so you know where to catch
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x + 4, y + (kind === 'bigfoot' ? -18 : 2), 8, 4);
  ctx.fillStyle = '#c74b50';
  ctx.fillRect(x + 5, y + (kind === 'bigfoot' ? -17 : 3), 6, 2);
}

function chug(opts: MiniOpts): Game {
  const roll = (): ChugKind => CHUG_POOL[Math.floor(Math.random() * CHUG_POOL.length)];
  const stations = [
    { baseX: 60, span: 220, kind: roll(), shooter: roll(), fill: 0, drinkerX: 150, wander: Math.random() * 9, ai: false },
    { baseX: 360, span: 220, kind: roll(), shooter: roll(), fill: 0, drinkerX: 450, wander: Math.random() * 9, ai: true },
  ];
  let time = 0;
  let result: { won: boolean } | null = null;

  return {
    get result() { return result; },
    set result(v) { result = v; },
    update(dt, input) {
      time += dt * 1000;
      for (const st of stations) {
        const landX = st.baseX + st.span / 2 +
          Math.sin(time / 700 + st.wander) * (st.span / 2 - 30) +
          Math.sin(time / 233 + st.wander * 2) * 14;
        if (st.ai) {
          // the rival drinker chases with lag, jitter, and regular bouts of showboating
          const distracted = (time % 3600) < 850;
          if (!distracted) {
            const target = landX + Math.sin(time / 150) * 30;
            st.drinkerX += Math.max(-92 * dt, Math.min(92 * dt, target - st.drinkerX));
          }
        } else {
          if (input.left) st.drinkerX -= 170 * dt;
          if (input.right) st.drinkerX += 170 * dt;
        }
        st.drinkerX = Math.max(st.baseX + 6, Math.min(st.baseX + st.span - 20, st.drinkerX));
        const window = st.ai ? 13 : 22;
        const rate = st.ai ? 13 : 16;
        if (Math.abs(st.drinkerX + 8 - landX) < window) {
          st.fill = Math.min(100, st.fill + rate * dt);
          if (!st.ai && Math.floor(time / 300) % 3 === 0) opts.sfx.click();
        }
      }
      if (stations[0].fill >= 100 || stations[1].fill >= 100) {
        result = { won: stations[0].fill >= 100 };
      }
    },
    draw(ctx) {
      arena(ctx, time, false);
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('YOU', 140, 60);
      ctx.fillText('RIVALS', 430, 60);
      for (const st of stations) {
        // platform + shooter with cannon
        const shooterX = st.baseX + st.span / 2 - 8;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(shooterX - 14, 118, 46, 6);
        ctx.fillRect(shooterX - 10, 124, 4, 24);
        ctx.fillRect(shooterX + 24, 124, 4, 24);
        const f = Math.floor(time / 220);
        if (st.shooter === 'bigfoot') drawBigfoot(ctx, shooterX - 6, 72, 1, {});
        else if (st.shooter === 'alien') drawAlienGuy(ctx, shooterX, 104, f, false, true);
        else if (st.shooter === 'lemon') drawLemonFolk(ctx, shooterX, 96, {});
        else drawKid(ctx, shooterX, 102, f, { shirt: '#e2777a', skin: '#c68d5e', hair: '#3f3a52', pants: '#7a5d4f' }, false);
        // cannon barrel
        const landX = st.baseX + st.span / 2 +
          Math.sin(time / 700 + st.wander) * (st.span / 2 - 30) +
          Math.sin(time / 233 + st.wander * 2) * 14;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(shooterX + 10, 112, 18, 8);
        ctx.fillStyle = '#9aa5a8';
        ctx.fillRect(shooterX + 12, 114, 14, 4);
        // stream: quadratic-ish droplet arc from barrel to landX
        const sx = shooterX + 26;
        const sy = 116;
        const ey = 292;
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          const dropX = sx + (landX - sx) * k;
          const dropY = sy + (ey - sy) * (k * k * 0.75 + k * 0.25) - Math.sin(Math.PI * k) * 26;
          ctx.fillStyle = i % 2 ? '#f2d24b' : '#fbf0c0';
          ctx.fillRect(Math.round(dropX + Math.sin(time / 90 + i) * 1.5), Math.round(dropY), 3, 4);
        }
        // drinker
        drawChugger(ctx, st.kind, Math.round(st.drinkerX), 268, st.fill, time);
        // fill gauge
        const gx = st.baseX + st.span / 2 - 52;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(gx - 2, 328, 108, 14);
        ctx.fillStyle = '#5d5870';
        ctx.fillRect(gx, 330, 104, 10);
        ctx.fillStyle = st.fill > 80 ? '#e8b45f' : '#7fae8e';
        ctx.fillRect(gx, 330, (st.fill / 100) * 104, 10);
      }
    },
  };
}

/* ------------------------------- RAMP RALLY ------------------------------ */

type RallyTruck = 'lemon' | 'ice';

function drawRallyTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  wheelY: number,
  kind: RallyTruck,
  level: number,
  flame: boolean,
  time: number,
): void {
  const body = kind === 'lemon' ? '#f2d24b' : '#fbf7ec';
  const accent = kind === 'lemon' ? '#2f7d4a' : '#f2b8c6';
  const bounce = Math.round(Math.sin(time / 70 + x) * 1.5);
  const y = wheelY - 35 + bounce;
  ctx.fillStyle = 'rgba(43,36,64,0.22)';
  ctx.fillRect(x + 4, wheelY + 8, 70, 4);
  // suspension and monster wheels
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x + 12, wheelY - 6, 48, 5);
  for (const wx of [x + 15, x + 61]) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(wx - 10, wheelY - 10, 20, 20);
    ctx.fillStyle = '#242033';
    ctx.fillRect(wx - 7, wheelY - 7, 14, 14);
    ctx.fillStyle = level >= 1 ? accent : '#9aa5a8';
    ctx.fillRect(wx - 3, wheelY - 3, 6, 6);
    ctx.fillStyle = '#fbf7ec';
    if (Math.floor(time / 100) % 2 === 0) ctx.fillRect(wx - 1, wheelY - 6, 2, 12);
    else ctx.fillRect(wx - 6, wheelY - 1, 12, 2);
  }
  // body: lemonade stand-on-wheels versus ice cream truck
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x, y - 8, 76, 35);
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y - 5, 70, 29);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 3, y + 14, 70, 10);
  if (kind === 'lemon') {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 9, y - 17, 48, 12);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fbf7ec' : '#e8b45f';
      ctx.fillRect(x + 11 + i * 8, y - 15, 8, 8);
    }
    ctx.fillStyle = '#27364a';
    ctx.fillRect(x + 10, y, 35, 12);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x + 16, y + 3, 8, 6);
    ctx.fillStyle = '#2f7d4a';
    ctx.fillRect(x + 24, y + 1, 5, 4);
    ctx.fillStyle = OUTLINE;
    ctx.font = 'bold 7px monospace';
    ctx.fillText('ZEST', x + 48, y + 9);
  } else {
    ctx.fillStyle = '#6fa8c9';
    ctx.fillRect(x + 48, y - 2, 20, 14);
    ctx.fillStyle = '#9fd4e8';
    ctx.fillRect(x + 51, y, 14, 9);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 9, y - 2, 31, 14);
    ctx.fillStyle = '#f2b8c6';
    ctx.fillRect(x + 12, y + 1, 25, 8);
    ctx.fillStyle = '#e8b45f';
    ctx.fillRect(x + 25, y - 17, 12, 12);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 22, y - 23, 18, 8);
  }
  // matched rocket packages: lemon pods vs. ice-cream-cone pods
  if (level >= 2) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 10, y + 7, 13, 10);
    ctx.fillStyle = level >= 3 ? accent : '#9aa5a8';
    ctx.fillRect(x - 8, y + 9, 10, 6);
    if (kind === 'ice' && level >= 3) {
      ctx.fillStyle = '#e8b45f';
      ctx.fillRect(x - 15, y + 8, 7, 8);
      ctx.fillStyle = '#fbf7ec';
      ctx.fillRect(x - 18, y + 6, 7, 4);
    }
    if (flame) {
      ctx.fillStyle = '#c74b50';
      ctx.fillRect(x - 20 - (Math.floor(time / 70) % 2) * 5, y + 10, 12, 4);
      ctx.fillStyle = '#f7e096';
      ctx.fillRect(x - 15, y + 11, 8, 2);
    }
  }
}

function ramp(opts: MiniOpts): Game {
  const level = Math.max(0, Math.min(3, opts.truckLevel ?? 0));
  const cap = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
  const wind = Math.round((Math.random() - 0.5) * 6);
  let phase: 'countdown' | 'runup' | 'air' = 'countdown';
  let countdown = 1.6;
  let runTime = 0;
  let airTime = 0;
  let speed = 0;
  let heat = 8;
  let overheat = 0;
  let overheats = 0;
  let playerLemons = 0;
  let rivalLemons = 0;
  let time = 0;
  let result: GameOutcome | null = null;

  const launch = (): void => {
    const heatPenalty = Math.max(0, heat - 86) * 0.006 + overheats * 0.08;
    const skillSpeed = speed * Math.max(0.62, 1 - heatPenalty);
    playerLemons = cap(Math.round(5 + skillSpeed * 0.235 + level * 0.9 + wind), 4, 34);
    const rivalSkill = 0.78 + Math.random() * 0.22;
    const rivalSpeed = (78 + level * 8) * rivalSkill;
    rivalLemons = cap(Math.round(5 + rivalSpeed * 0.235 + level * 0.9 - wind * 0.35), 4, 34);
    phase = 'air';
    opts.sfx.chime();
  };

  return {
    get result() { return result; },
    set result(v) { result = v; },
    update(dt, input) {
      time += dt * 1000;
      if (phase === 'countdown') {
        countdown -= dt;
        if (countdown <= 0) phase = 'runup';
        return;
      }
      if (phase === 'runup') {
        runTime += dt;
        const gas = input.a || input.right || input.up;
        if (overheat > 0) {
          overheat -= dt;
          speed = Math.max(0, speed - 20 * dt);
          heat = Math.max(0, heat - (25 + level * 3) * dt);
        } else if (gas) {
          speed = Math.min(92 + level * 8, speed + (24 + level * 2.5) * dt);
          heat += (25 - level * 2.2) * dt;
        } else {
          speed = Math.max(0, speed - 4.5 * dt);
          heat = Math.max(0, heat - (18 + level * 3) * dt);
        }
        if (heat >= 100) {
          heat = 82;
          speed *= 0.86;
          overheat = 0.75;
          overheats++;
          opts.sfx.click();
        }
        if (runTime >= 6) launch();
        return;
      }
      airTime += dt;
      if (airTime >= 2.8 && !result) {
        const won = playerLemons >= rivalLemons;
        result = {
          won,
          value: playerLemons,
          summary: `You cleared <b>${playerLemons} lemons</b>. The ice cream truck cleared <b>${rivalLemons}</b>. Wind: ${wind === 0 ? 'calm' : `${Math.abs(wind)} ${wind > 0 ? 'tailwind' : 'headwind'}`}.`,
        };
      }
    },
    draw(ctx) {
      // grandstand, layered hills, and two launch lanes
      ctx.fillStyle = '#7cb7d2'; ctx.fillRect(0, 0, W, 72);
      ctx.fillStyle = '#9fd4e8'; ctx.fillRect(0, 72, W, 66);
      ctx.fillStyle = '#789e78'; ctx.fillRect(0, 138, W, 222);
      ctx.fillStyle = '#6f8d6b';
      for (let x = 0; x < W; x += 48) ctx.fillRect(x, 138, 24, 222);
      ctx.fillStyle = '#3a3350'; ctx.fillRect(0, 64, W, 5);
      ctx.fillStyle = '#a8783f'; ctx.fillRect(0, 68, W, 7);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = ['#e2777a', '#f2d24b', '#6fa8c9'][i % 3];
        ctx.fillRect(8 + i * 36, 54 - (i % 2) * 4, 10, 10);
      }
      const lane = (base: number, label: string, lemons: number): void => {
        ctx.fillStyle = '#8d8277'; ctx.fillRect(0, base, W, 17);
        ctx.fillStyle = '#b8a99a'; ctx.fillRect(0, base, W, 4);
        // launch ramp
        ctx.fillStyle = OUTLINE;
        for (let i = 0; i < 9; i++) ctx.fillRect(190 + i * 8, base - i * 3 - 3, 10, i * 3 + 6);
        ctx.fillStyle = '#a8783f';
        for (let i = 0; i < 9; i++) ctx.fillRect(192 + i * 8, base - i * 3 - 1, 8, i * 3 + 2);
        // a long row of lemons to clear
        for (let i = 0; i < 34; i++) {
          const lx = 270 + i * 8;
          ctx.fillStyle = OUTLINE; ctx.fillRect(lx - 1, base - 8 - (i % 3), 7, 7);
          ctx.fillStyle = i < lemons && phase === 'air' ? '#d7aa28' : '#f2d24b';
          ctx.fillRect(lx, base - 7 - (i % 3), 5, 5);
          ctx.fillStyle = '#2f7d4a'; ctx.fillRect(lx + 4, base - 9 - (i % 3), 3, 2);
        }
        ctx.fillStyle = OUTLINE; ctx.font = 'bold 8px monospace'; ctx.fillText(label, 8, base - 7);
      };
      lane(180, 'ICE CREAM RIVAL', rivalLemons);
      lane(298, 'YOU: LEMONADE STAND', playerLemons);

      const held = phase === 'runup';
      const runX = 28 + Math.min(1, runTime / 6) * 145;
      const jumpK = Math.min(1, airTime / 2.35);
      const truckPos = (lemons: number, base: number): { x: number; y: number } => ({
        x: phase === 'air' ? 210 + lemons * 8 * jumpK : runX,
        y: phase === 'air' ? base - Math.sin(Math.PI * jumpK) * (50 + lemons * 0.8) : base,
      });
      const rival = truckPos(rivalLemons, 174);
      const player = truckPos(playerLemons, 292);
      drawRallyTruck(ctx, rival.x, rival.y, 'ice', level, held && level >= 2, time + 100);
      drawRallyTruck(ctx, player.x, player.y, 'lemon', level, held && level >= 2, time);

      // Driver feedback is intentionally explicit: skill is managing both bars.
      ctx.fillStyle = OUTLINE; ctx.fillRect(18, 82, 190, 13);
      ctx.fillStyle = '#5d5870'; ctx.fillRect(20, 84, 186, 9);
      ctx.fillStyle = '#6fa8c9'; ctx.fillRect(20, 84, (speed / (92 + level * 8)) * 186, 9);
      ctx.fillStyle = OUTLINE; ctx.font = 'bold 8px monospace'; ctx.fillText(`SPEED ${Math.round(speed)}`, 22, 80);
      ctx.fillStyle = OUTLINE; ctx.fillRect(226, 82, 190, 13);
      ctx.fillStyle = '#5d5870'; ctx.fillRect(228, 84, 186, 9);
      ctx.fillStyle = heat >= 86 ? '#c74b50' : '#e8b45f'; ctx.fillRect(228, 84, (heat / 100) * 186, 9);
      ctx.fillStyle = OUTLINE; ctx.fillText(`ENGINE ${Math.round(heat)}°`, 230, 80);
      ctx.fillText(`GARAGE TIER ${level}/3`, 442, 82);
      ctx.fillText(`WIND ${wind > 0 ? '+' : ''}${wind}`, 548, 82);
      if (phase === 'countdown') {
        ctx.font = 'bold 38px monospace'; ctx.fillText(String(Math.max(1, Math.ceil(countdown))), 300, 136);
      } else if (phase === 'runup') {
        ctx.fillStyle = overheat > 0 ? '#c74b50' : '#f7e096';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(overheat > 0 ? 'OVERHEAT! COOLING...' : 'HOLD GAS · RELEASE TO COOL', 222, 118);
        ctx.fillStyle = OUTLINE; ctx.font = 'bold 9px monospace'; ctx.fillText(`RAMP IN ${(6 - runTime).toFixed(1)}s`, 278, 132);
      } else {
        ctx.fillStyle = OUTLINE; ctx.font = 'bold 10px monospace';
        ctx.fillText(`YOU ${playerLemons} LEMONS`, 250, 334);
        ctx.fillText(`RIVAL ${rivalLemons} LEMONS`, 250, 216);
      }
    },
  };
}

/* ----------------------------- CRYO-DEFENSE ------------------------------ */
/* The Tepid Terror: lukewarm water piloting a scratched gas-station tumbler.
   Tap to hurl ice. Hits knock him back — active play always wins; only
   ignoring him loses the vats. Hitboxes are toddler-forgiving on purpose. */

interface IceShot { x: number; y: number; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; }

function cryo(opts: MiniOpts): Game {
  const GROUND = 288;
  const VAT_X = 540;
  const tier = bossTierFor(opts.bossTemp ?? 90);
  let time = 0;
  let phase: 1 | 2 = 1;
  let armor = tier.armor;
  let hp = tier.hp;
  let vilX = 30;
  let cool = 0;
  let slushCharge = opts.hasSlush ? 28 : 0;
  let slushFx = -1;
  let slowed = 0;
  let freeze = -1;
  let losing = -1;
  let hitFlash = 0;
  const shots: IceShot[] = [];
  const splashes: { x: number; y: number; t: number }[] = [];
  let result: GameOutcome | null = null;

  const center = (): { x: number; y: number } => ({
    x: vilX + 24 + (phase === 2 ? Math.sin(time / 260) * 26 : Math.sin(time / 700) * 6),
    y: phase === 1 ? GROUND - 34 : GROUND - 8,
  });

  const damageBoss = (damage: number, knockback: number): void => {
    hitFlash = 0.18;
    vilX = Math.max(16, vilX - knockback);
    const c = center();
    splashes.push({ x: c.x, y: c.y, t: 0 });
    if (phase === 1) {
      armor -= damage;
      if (armor <= 0) { armor = 0; phase = 2; opts.sfx.chime(); }
    } else {
      hp -= damage;
      if (hp <= 0) { hp = 0; freeze = 0; opts.sfx.chime(); }
    }
  };

  const fireSlush = (): boolean => {
    if (!opts.hasSlush || slushCharge < 100 || result || freeze >= 0 || losing >= 0) return false;
    slushCharge = 0;
    slushFx = 0;
    slowed = 3.5;
    damageBoss(3, 92);
    opts.sfx.chime();
    return true;
  };

  return {
    get result() { return result; },
    set result(v) { result = v; },
    mount(canvas) {
      canvas.addEventListener('pointerdown', (ev) => {
        if (result || freeze >= 0 || losing >= 0) return;
        const rect = canvas.getBoundingClientRect();
        const wx = ((ev.clientX - rect.left) / rect.width) * W;
        const wy = ((ev.clientY - rect.top) / rect.height) * H;
        if (opts.hasSlush && wx >= 410 && wy >= 306 && fireSlush()) return;
        if (cool > 0) return;
        cool = 0.26;
        const c = center();
        // generous auto-aim: anywhere near him counts as aiming at him
        const near = Math.hypot(wx - c.x, wy - c.y) < 85;
        const tx = near ? c.x : wx;
        const ty = near ? c.y : wy;
        const dur = Math.max(0.2, Math.hypot(tx - 86, ty - 318) / 520);
        shots.push({ x: 86, y: 318, sx: 86, sy: 318, tx, ty, t: 0, dur });
        opts.sfx.click();
      });
    },
    update(dt, _input, justPressed) {
      time += dt * 1000;
      cool = Math.max(0, cool - dt);
      hitFlash = Math.max(0, hitFlash - dt);
      slowed = Math.max(0, slowed - dt);
      if (slushFx >= 0) {
        slushFx += dt;
        if (slushFx > 0.85) slushFx = -1;
      }
      if (opts.hasSlush) slushCharge = Math.min(100, slushCharge + dt * 9);
      if (justPressed.has('up')) fireSlush();
      if (freeze >= 0) {
        freeze += dt;
        if (freeze > 1.7) result = { won: true };
        return;
      }
      if (losing >= 0) {
        losing += dt;
        if (losing > 1.5) result = { won: false };
        return;
      }
      // he oozes toward the vats
      vilX += (phase === 1 ? tier.suitSpeed : tier.puddleSpeed) * (slowed > 0 ? 0.28 : 1) * dt;
      if (vilX + 30 >= VAT_X) { losing = 0; opts.sfx.click(); return; }
      // ice in flight
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.t += dt / s.dur;
        const k = Math.min(1, s.t);
        s.x = s.sx + (s.tx - s.sx) * k;
        s.y = s.sy + (s.ty - s.sy) * k - Math.sin(Math.PI * k) * 46;
        if (s.t >= 1) {
          const c = center();
          if (Math.hypot(s.x - c.x, s.y - c.y) < 42) {
            damageBoss(1, tier.knockback);
            if (opts.hasSlush) slushCharge = Math.min(100, slushCharge + 7);
            opts.sfx.coin();
          }
          shots.splice(i, 1);
        }
      }
      for (const sp of splashes) sp.t += dt;
      while (splashes.length && splashes[0].t > 0.5) splashes.shift();
    },
    draw(ctx) {
      // record-highs backdrop
      ctx.fillStyle = '#f2b04b';
      ctx.fillRect(0, 0, W, 70);
      ctx.fillStyle = '#f7d9b8';
      ctx.fillRect(0, 70, W, 90);
      ctx.fillStyle = '#e8d8b8';
      ctx.fillRect(0, 160, W, 60);
      ctx.fillStyle = '#f7e096';
      ctx.fillRect(556, 18, 36, 36);
      ctx.fillStyle = '#c98a5b';
      ctx.fillRect(0, 220, W, H - 220);
      ctx.fillStyle = shade('#c98a5b', -18);
      for (let y = 232; y < H; y += 16) {
        const off = Math.round(Math.sin(time / 150 + y) * 2);
        ctx.fillRect(off, y, W, 2);
      }
      // humidity drips along the top of the frame
      ctx.fillStyle = 'rgba(159,184,216,0.7)';
      for (let i = 0; i < 8; i++) {
        const dy = (time / 14 + i * 137) % 130;
        ctx.fillRect(20 + i * 82, dy * 0.4, 3, 9);
      }
      // the vats he's after
      for (const [vx0, vy0] of [[548, 224], [590, 236]] as [number, number][]) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(vx0 - 2, vy0 - 2, 40, 62);
        ctx.fillStyle = losing >= 0 ? '#8d93a8' : '#a8783f';
        ctx.fillRect(vx0, vy0, 36, 58);
        ctx.fillStyle = shade('#a8783f', -26);
        for (let b = 0; b < 3; b++) ctx.fillRect(vx0, vy0 + 12 + b * 16, 36, 3);
        ctx.fillStyle = losing >= 0 ? '#b9c9cf' : '#f2d24b';
        ctx.fillRect(vx0 + 3, vy0 - 8, 30, 10);
      }
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 10px monospace';
      ctx.fillText('THE VATS', 546, 300);
      if (losing >= 0) {
        ctx.fillStyle = `rgba(251,247,236,${0.5 + Math.sin(time / 80) * 0.3})`;
        for (let p = 0; p < 4; p++) ctx.fillRect(556 + p * 16, 200 - losing * 60 - p * 8, 8, 12);
        ctx.fillStyle = '#c74b50';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('NOOO — THE BATCH!', 380, 180);
      }
      // ice bucket launcher
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(60, 308, 52, 34);
      ctx.fillStyle = '#6fa8c9';
      ctx.fillRect(62, 310, 48, 30);
      ctx.fillStyle = '#cfe8e0';
      for (let i = 0; i < 6; i++) ctx.fillRect(66 + (i % 3) * 14, 306 - Math.floor(i / 3) * 8, 10, 9);
      ctx.fillStyle = OUTLINE;
      ctx.font = '9px monospace';
      ctx.fillText('ICE (tap him!)', 54, 354);
      // villain
      const c = center();
      const bob = Math.sin(time / 300) * 3;
      if (freeze >= 0) {
        const k = Math.min(1, freeze / 1.2);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(c.x - 28, GROUND - 66, 56, 70);
        ctx.fillStyle = '#cfe8e0';
        ctx.fillRect(c.x - 26, GROUND - 64 + (1 - k) * 66, 52, 66 * k + 2);
        ctx.fillStyle = 'rgba(138,144,120,0.8)';
        ctx.fillRect(c.x - 14, GROUND - 44, 28, 34);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(c.x - 9, GROUND - 36, 6, 3);
        ctx.fillRect(c.x + 3, GROUND - 36, 6, 3);
        ctx.fillRect(c.x - 6, GROUND - 24, 12, 3);
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(c.x - 22, GROUND - 60, 6, 6);
        ctx.fillRect(c.x + 14, GROUND - 34, 5, 5);
        if (freeze > 1.2) {
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = OUTLINE;
          ctx.fillText('FROZEN SOLID!', c.x - 44, GROUND - 76);
        }
      } else if (phase === 1) {
        const x = vilX;
        const flash = hitFlash > 0;
        // tumbler suit
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x - 2, GROUND - 70 + bob, 52, 74);
        ctx.fillStyle = flash ? '#fbf7ec' : '#b9c9cf';
        ctx.fillRect(x, GROUND - 68 + bob, 48, 70);
        // murky occupant
        ctx.fillStyle = '#8a9078';
        ctx.fillRect(x + 4, GROUND - 44 + bob, 40, 44);
        ctx.fillStyle = shade('#8a9078', -20);
        ctx.fillRect(x + 4, GROUND - 44 + bob, 40, 5);
        for (let bx = 0; bx < 3; bx++) ctx.fillRect(x + 8 + bx * 12, GROUND - 30 + bob + (bx % 2) * 8, 6, 5);
        if (tier.tier >= 2) {
          const flex = Math.round(Math.sin(time / 120) * 2);
          const muscle = tier.tier === 3 ? 17 : 13;
          // Sloshing biceps punch through ports in the containment suit.
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(x - muscle - 4, GROUND - 54 + bob - flex, muscle + 7, 13);
          ctx.fillRect(x - muscle - 9, GROUND - 48 + bob - flex, 11, 25);
          ctx.fillRect(x + 46, GROUND - 54 + bob + flex, muscle + 7, 13);
          ctx.fillRect(x + 48 + muscle, GROUND - 48 + bob + flex, 10, 25);
          ctx.fillStyle = hitFlash > 0 ? '#cfe8e0' : '#8a9078';
          ctx.fillRect(x - muscle - 2, GROUND - 52 + bob - flex, muscle + 4, 9);
          ctx.fillRect(x - muscle - 7, GROUND - 46 + bob - flex, 7, 21);
          ctx.fillRect(x + 48, GROUND - 52 + bob + flex, muscle + 4, 9);
          ctx.fillRect(x + 50 + muscle, GROUND - 46 + bob + flex, 6, 21);
          ctx.fillStyle = '#a6ad8d';
          ctx.fillRect(x - muscle + 1, GROUND - 50 + bob - flex, 5, 3);
          ctx.fillRect(x + 52, GROUND - 50 + bob + flex, 5, 3);
        }
        // scowl (condensation)
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(x + 10, GROUND - 38 + bob, 10, 3);
        ctx.fillRect(x + 28, GROUND - 38 + bob, 10, 3);
        ctx.fillRect(x + 16, GROUND - 22 + bob, 16, 3);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 12, GROUND - 34 + bob, 6, 4);
        ctx.fillRect(x + 30, GROUND - 34 + bob, 6, 4);
        if (tier.tier === 3) {
          // Hottest-day face: angry stepped brows and gritted square teeth.
          ctx.fillRect(x + 9, GROUND - 42 + bob, 5, 3);
          ctx.fillRect(x + 13, GROUND - 40 + bob, 9, 3);
          ctx.fillRect(x + 27, GROUND - 40 + bob, 9, 3);
          ctx.fillRect(x + 35, GROUND - 42 + bob, 5, 3);
          ctx.fillRect(x + 15, GROUND - 24 + bob, 20, 8);
          ctx.fillStyle = '#fbf7ec';
          for (let tx = 0; tx < 4; tx++) ctx.fillRect(x + 17 + tx * 4, GROUND - 22 + bob, 3, 4);
        }
        // scratched plastic + faded logo
        ctx.fillStyle = 'rgba(251,247,236,0.5)';
        ctx.fillRect(x + 6, GROUND - 62 + bob, 2, 30);
        ctx.fillRect(x + 40, GROUND - 56 + bob, 2, 36);
        ctx.fillStyle = 'rgba(226,119,122,0.4)';
        ctx.fillRect(x + 16, GROUND - 64 + bob, 16, 10);
        // chewed straw
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(x + 30, GROUND - 88 + bob, 6, 20);
        ctx.fillStyle = '#e2777a';
        ctx.fillRect(x + 31, GROUND - 87 + bob, 4, 18);
        ctx.fillRect(x + 27, GROUND - 92 + bob, 8, 6);
        // armor cracks as it chips
        ctx.fillStyle = OUTLINE;
        if (armor <= tier.armor * 0.67) { ctx.fillRect(x + 10, GROUND - 58 + bob, 12, 2); ctx.fillRect(x + 20, GROUND - 56 + bob, 2, 8); }
        if (armor <= tier.armor * 0.34) { ctx.fillRect(x + 32, GROUND - 48 + bob, 12, 2); ctx.fillRect(x + 36, GROUND - 46 + bob, 2, 10); ctx.fillRect(x + 8, GROUND - 30 + bob, 10, 2); }
      } else {
        // phase 2: fast murky puddle
        const px = c.x;
        const widths = [20, 36, 50, 58, 58, 46];
        ctx.fillStyle = OUTLINE;
        for (let r = 0; r < widths.length; r++) ctx.fillRect(px - widths[r] / 2 - 1, GROUND - 18 + r * 3 - 1, widths[r] + 2, 5);
        for (let r = 0; r < widths.length; r++) {
          ctx.fillStyle = hitFlash > 0 ? '#fbf7ec' : r < 2 ? '#9aa078' : '#8a9078';
          ctx.fillRect(px - widths[r] / 2, GROUND - 18 + r * 3, widths[r], 3);
        }
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(px - 12, GROUND - 14, 8, 4);
        ctx.fillRect(px + 4, GROUND - 14, 8, 4);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(px - 10, GROUND - 13, 4, 3);
        ctx.fillRect(px + 6, GROUND - 13, 4, 3);
        ctx.fillRect(px - 6, GROUND - 6, 12, 2);
        if (tier.tier >= 2) {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(px - 41, GROUND - 16, 18, 8);
          ctx.fillRect(px + 23, GROUND - 16, 18, 8);
          ctx.fillStyle = '#8a9078';
          ctx.fillRect(px - 39, GROUND - 14, 16, 4);
          ctx.fillRect(px + 23, GROUND - 14, 16, 4);
        }
        // drip trail
        ctx.fillStyle = 'rgba(138,144,120,0.5)';
        for (let d2 = 1; d2 <= 3; d2++) ctx.fillRect(px - 30 - d2 * 14, GROUND - 2, 8, 3);
      }
      // flying ice + splashes
      for (const s of shots) {
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(s.x - 5, s.y - 5, 11, 11);
        ctx.fillStyle = '#cfe8e0';
        ctx.fillRect(s.x - 4, s.y - 4, 9, 9);
        ctx.fillStyle = '#fbf7ec';
        ctx.fillRect(s.x - 3, s.y - 3, 4, 4);
      }
      for (const sp of splashes) {
        ctx.fillStyle = `rgba(207,232,224,${1 - sp.t * 2})`;
        for (let a = 0; a < 4; a++) {
          ctx.fillRect(sp.x + Math.cos(a * 1.57) * sp.t * 40, sp.y + Math.sin(a * 1.57) * sp.t * 40 - sp.t * 20, 4, 4);
        }
      }
      if (slowed > 0 && freeze < 0) {
        ctx.fillStyle = 'rgba(207,232,224,0.7)';
        for (let i = 0; i < 7; i++) {
          const sx = c.x - 34 + ((i * 17 + Math.floor(time / 45)) % 68);
          const sy = c.y - 58 + ((i * 29 + Math.floor(time / 25)) % 54);
          ctx.fillRect(sx, sy, 4, 4);
          ctx.fillRect(sx - 2, sy + 1, 8, 2);
        }
      }
      if (slushFx >= 0) {
        const radius = 12 + slushFx * 110;
        ctx.fillStyle = `rgba(207,232,224,${Math.max(0, 0.9 - slushFx)})`;
        for (let a = 0; a < 16; a++) {
          const angle = (Math.PI * 2 * a) / 16;
          ctx.fillRect(c.x + Math.cos(angle) * radius - 4, c.y + Math.sin(angle) * radius * 0.65 - 4, 8, 8);
        }
        ctx.fillStyle = '#fbf7ec';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('SLUSH BOMB!', Math.max(150, c.x - 48), 116);
      }
      // HUD: name + health pips + vat-danger bar
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`THE TEPID TERROR · ${opts.bossTemp ?? 90}°`, 22, 26);
      ctx.font = '9px monospace';
      ctx.fillText(`${tier.name}: ${phase === 1 ? 'chip the tumbler armor!' : 'HE ESCAPED THE CUP — freeze the puddle!'}`, 22, 40);
      for (let i = 0; i < (phase === 1 ? tier.armor : tier.hp); i++) {
        const on = i < (phase === 1 ? armor : hp);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(20 + i * 18, 48, 14, 12);
        ctx.fillStyle = on ? (phase === 1 ? '#b9c9cf' : '#8a9078') : '#5d5870';
        ctx.fillRect(22 + i * 18, 50, 10, 8);
      }
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(198, 48, 244, 12);
      ctx.fillStyle = '#5d5870';
      ctx.fillRect(200, 50, 240, 8);
      ctx.fillStyle = vilX > 400 ? '#c74b50' : '#e8b45f';
      ctx.fillRect(200, 50, Math.min(240, (vilX / VAT_X) * 240), 8);
      ctx.font = '9px monospace';
      ctx.fillStyle = OUTLINE;
      ctx.fillText('distance to the vats', 200, 72);
      if (opts.hasSlush) {
        const ready = slushCharge >= 100;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(410, 314, 216, 34);
        ctx.fillStyle = '#5d5870';
        ctx.fillRect(414, 318, 208, 26);
        ctx.fillStyle = ready ? '#cfe8e0' : '#6fa8c9';
        ctx.fillRect(414, 318, 208 * (slushCharge / 100), 26);
        if (ready) {
          ctx.fillStyle = 'rgba(251,247,236,0.35)';
          ctx.fillRect(414, 318, 208, 6);
        }
        ctx.fillStyle = OUTLINE;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(ready ? 'SPACE / TAP: SLUSH BOMB!' : `SLUSH CHARGING ${Math.floor(slushCharge)}%`, 426, 336);
      }
    },
  };
}
