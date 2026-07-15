/**
 * Shared pixel-art helpers for the 640×360 hi-bit canvas: palette utilities,
 * an offscreen sprite cache (per palette/frame/flip), and the townsfolk maps.
 */

export const OUTLINE = '#2b2440';

/** Lighten/darken a #rrggbb color by `amt` (-255..255). */
export function shade(hex: string, amt: number): string {
  const v = [1, 3, 5].map((i) => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + amt)));
  return `rgb(${v[0]},${v[1]},${v[2]})`;
}

export function assertMap(name: string, rows: string[]): void {
  const w = rows[0].length;
  for (const r of rows) {
    if (r.length !== w) throw new Error(`sprite map ${name} has ragged rows (${r.length} vs ${w})`);
  }
}

/** Draw a string pixel-map. `color(ch)` returns a fill or null to skip. */
export function drawMap(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rows: string[],
  color: (ch: string) => string | null,
  flip = false,
): void {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[flip ? row.length - 1 - c : c];
      if (!ch || ch === '.') continue;
      const fill = color(ch);
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

/** Render-once sprite cache; keyed by anything that changes the pixels. */
export function cachedSprite(
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    if (c) {
      c.imageSmoothingEnabled = false;
      paint(c);
    }
    cache.set(key, cv);
  }
  return cv;
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.fillStyle = 'rgba(43,36,64,0.20)';
  ctx.fillRect(x + 2, y, w - 4, 3);
  ctx.fillRect(x, y + 1, w, 1);
}

export interface PersonColors { shirt: string; skin: string; hair: string; pants: string; }

/* Townsperson — 16×28, two walk frames.
   o outline · H/h hair · S/s skin · T/t/r shirt (base/shade/rim) · P/p pants · B shoes */
const PERSON_A = [
  '......oooo......',
  '.....oHHHHo.....',
  '....oHHHHHHo....',
  '....oHhhhhHo....',
  '....oSSSSSSo....',
  '....oSsSSsSo....',
  '....oSSSSSSo....',
  '.....osSSso.....',
  '.....ooTToo.....',
  '....orTTTTTo....',
  '...orTTTTTTTo...',
  '..oTtTTTTTTtTo..',
  '..oTtTTTTTTtTo..',
  '..oSsTTTTTTsSo..',
  '...orTttttTTo...',
  '....oTTTTTTo....',
  '....oPPPPPPo....',
  '....oPpPPpPo....',
  '....oPPPPPPo....',
  '...oPPPooPPPo...',
  '...oPPo..oPPo...',
  '..oPPo....oPPo..',
  '..oPPo....oPPo..',
  '..oPPo....oPPo..',
  '..oBBo....oBBo..',
  '..oBBo....oBBo..',
  '.oBBBo....oBBBo.',
  '..ooo......ooo..',
];
const PERSON_B = [
  '......oooo......',
  '.....oHHHHo.....',
  '....oHHHHHHo....',
  '....oHhhhhHo....',
  '....oSSSSSSo....',
  '....oSsSSsSo....',
  '....oSSSSSSo....',
  '.....osSSso.....',
  '.....ooTToo.....',
  '....orTTTTTo....',
  '....oTTTTTTo....',
  '....oTtTTtTo....',
  '....oTtTTtTo....',
  '....oSTTTTSo....',
  '....orttttTo....',
  '....oTTTTTTo....',
  '....oPPPPPPo....',
  '....oPpPPpPo....',
  '....oPPPPPPo....',
  '....oPPooPPo....',
  '....oPPooPPo....',
  '....oPPooPPo....',
  '....oPPooPPo....',
  '....oPPooPPo....',
  '....oBBooBBo....',
  '....oBBooBBo....',
  '...oBBBooBBBo...',
  '....ooo..ooo....',
];
const CAP = [
  '.....oooooo.....',
  '....oCCCCCCo....',
  '...oCcCCCCcCo...',
  '..occCCCCCCcco..',
];
assertMap('PERSON_A', PERSON_A);
assertMap('PERSON_B', PERSON_B);
assertMap('CAP', CAP);

export function personSprite(colors: PersonColors, frame: number, merch: boolean, flip: boolean, capColor = '#f2d24b'): HTMLCanvasElement {
  const shirt = merch ? '#f2d24b' : colors.shirt;
  const key = `p|${colors.shirt}|${colors.skin}|${colors.hair}|${colors.pants}|${frame % 2}|${merch}|${flip}|${capColor}`;
  return cachedSprite(key, 16, 28, (c) => {
    const map = frame % 2 === 0 ? PERSON_A : PERSON_B;
    const pick = (ch: string): string | null => {
      switch (ch) {
        case 'o': case 'B': return OUTLINE;
        case 'H': return colors.hair;
        case 'h': return shade(colors.hair, -30);
        case 'S': return colors.skin;
        case 's': return shade(colors.skin, -28);
        case 'T': return shirt;
        case 't': return shade(shirt, -32);
        case 'r': return shade(shirt, 26);
        case 'P': return colors.pants;
        case 'p': return shade(colors.pants, -26);
        default: return null;
      }
    };
    drawMap(c, 0, 0, map, pick, flip);
    if (merch) {
      drawMap(c, 0, 0, CAP, (ch) =>
        ch === 'o' ? OUTLINE : ch === 'C' ? capColor : ch === 'c' ? shade(capColor, -30) : null, flip);
      c.fillStyle = '#5f8f6f';
      c.fillRect(flip ? 9 : 6, 11, 2, 2);
    }
  });
}

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  colors: PersonColors,
  opts: { merch?: boolean; flip?: boolean; capColor?: string } = {},
): void {
  drawShadow(ctx, x + 1, y + 27, 14);
  ctx.drawImage(personSprite(colors, frame, opts.merch ?? false, opts.flip ?? false, opts.capColor ?? '#f2d24b'), x, y);
}

/* Kid — 12×18, two frames. */
const KID_A = [
  '....oooo....',
  '...oHHHHo...',
  '...oSSSSo...',
  '...osSSso...',
  '...oTTTTo...',
  '..oTTTTTTo..',
  '..oTtTTtTo..',
  '..oSTTTTSo..',
  '...oTttTo...',
  '...oPPPPo...',
  '..oPPooPPo..',
  '..oPo..oPo..',
  '..oPo..oPo..',
  '..oBo..oBo..',
  '.oBBo..oBBo.',
  '..oo....oo..',
];
const KID_B = [
  '....oooo....',
  '...oHHHHo...',
  '...oSSSSo...',
  '...osSSso...',
  '...oTTTTo...',
  '..oTTTTTTo..',
  '..oTtTTtTo..',
  '..oSTTTTSo..',
  '...oTttTo...',
  '...oPPPPo...',
  '...oPooPo...',
  '...oPooPo...',
  '...oPooPo...',
  '...oBooBo...',
  '..oBBooBBo..',
  '...oo..oo...',
];
assertMap('KID_A', KID_A);
assertMap('KID_B', KID_B);

export function drawKid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  colors: PersonColors,
  flip: boolean,
): void {
  drawShadow(ctx, x + 1, y + 15, 10);
  const key = `k|${colors.shirt}|${colors.skin}|${colors.hair}|${colors.pants}|${frame % 2}|${flip}`;
  const spr = cachedSprite(key, 12, 16, (c) => {
    drawMap(c, 0, 0, frame % 2 === 0 ? KID_A : KID_B, (ch) => {
      switch (ch) {
        case 'o': case 'B': return OUTLINE;
        case 'H': return colors.hair;
        case 'S': return colors.skin;
        case 's': return shade(colors.skin, -26);
        case 'T': return colors.shirt;
        case 't': return shade(colors.shirt, -30);
        case 'P': return colors.pants;
        default: return null;
      }
    }, flip);
  });
  ctx.drawImage(spr, x, y);
}

export const SHIRTS = ['#e2777a', '#7fae8e', '#8f86c9', '#e8b45f', '#6fa8c9', '#d98cb3', '#c9d97e'];
export const SKINS = ['#f0c8a0', '#c68d5e', '#8d5a3b', '#e8b48a'];
export const HAIRS = ['#3f3a52', '#8a5a3a', '#d9c37e', '#6b4a6b', '#b0503c'];
export const PANTS = ['#4f4a6b', '#5d6b7a', '#7a5d4f', '#3f5a52'];

export interface Part { x: number; y: number; w: number; h: number; c: string; }

/** Two-pass part painter: expanded outlines first, then fills — clean 16-bit rims. */
export function paintParts(ctx: CanvasRenderingContext2D, parts: Part[], outline = OUTLINE): void {
  ctx.fillStyle = outline;
  for (const p of parts) ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
  for (const p of parts) {
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
}

/** Little green tourist. */
export function drawAlienGuy(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, cup: boolean, cap: boolean): void {
  const G = '#7fd97a';
  drawShadow(ctx, x, y + 13, 10);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x + 4, y - 4, 2, 4);
  ctx.fillStyle = '#f2d24b';
  ctx.fillRect(x + 3, y - 6, 4, 3);
  paintParts(ctx, [
    { x: x, y: y, w: 10, h: 7, c: G },
    { x: x + 1, y: y + 7, w: 8, h: 4, c: shade(G, -18) },
  ]);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x + 2, y + 2, 3, 3);
  ctx.fillRect(x + 6, y + 2, 3, 3);
  ctx.fillStyle = '#fbf7ec';
  ctx.fillRect(x + 2, y + 2, 1, 1);
  ctx.fillRect(x + 6, y + 2, 1, 1);
  ctx.fillStyle = OUTLINE;
  if (frame % 2 === 0) {
    ctx.fillRect(x + 2, y + 11, 2, 3);
    ctx.fillRect(x + 6, y + 11, 2, 3);
  } else {
    ctx.fillRect(x + 1, y + 11, 2, 3);
    ctx.fillRect(x + 7, y + 11, 2, 3);
  }
  if (cap) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, y - 2, 12, 3);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x, y - 1, 10, 2);
  }
  if (cup) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x + 9, y + 5, 5, 6);
    ctx.fillStyle = '#fbf7ec';
    ctx.fillRect(x + 10, y + 6, 3, 4);
    ctx.fillStyle = '#f2d24b';
    ctx.fillRect(x + 10, y + 6, 3, 2);
  }
}

/** Anthropomorphic lemon (or pink lemonade, or mint) person, 14×22. */
export function drawLemonFolk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { throwing?: boolean; flip?: boolean; color?: string; mouthOpen?: boolean } = {},
): void {
  const L = opts.color ?? '#f2d24b';
  drawShadow(ctx, x, y + 20, 14);
  const rows = [6, 10, 12, 14, 14, 12, 10, 6];
  ctx.fillStyle = OUTLINE;
  for (let r = 0; r < rows.length; r++) {
    const w = rows[r];
    ctx.fillRect(x + (14 - w) / 2 - 1, y + r * 2 - 1, w + 2, 4);
  }
  for (let r = 0; r < rows.length; r++) {
    const w = rows[r];
    ctx.fillStyle = r < 2 ? shade(L, 16) : r > 5 ? shade(L, -24) : L;
    ctx.fillRect(x + (14 - w) / 2, y + r * 2, w, 2);
  }
  ctx.fillStyle = '#5f8f6f';
  ctx.fillRect(x + 8, y - 3, 5, 3);
  ctx.fillStyle = OUTLINE;
  const fx = opts.flip ? x + 3 : x + 5;
  ctx.fillRect(fx, y + 5, 2, 2);
  ctx.fillRect(fx + 4, y + 5, 2, 2);
  if (opts.mouthOpen) {
    ctx.fillRect(fx + 1, y + 8, 4, 3);
  } else {
    ctx.fillRect(fx + 1, y + 9, 4, 1);
  }
  const armY = y + 8;
  ctx.fillRect(opts.flip ? x - 4 : x + 14, opts.throwing ? armY - 5 : armY, 5, 2);
  ctx.fillRect(opts.flip ? x + 14 : x - 4, armY + 2, 4, 2);
  ctx.fillRect(x + 3, y + 16, 2, 5);
  ctx.fillRect(x + 9, y + 16, 2, 5);
  ctx.fillRect(x + 2, y + 20, 4, 2);
  ctx.fillRect(x + 8, y + 20, 4, 2);
}
