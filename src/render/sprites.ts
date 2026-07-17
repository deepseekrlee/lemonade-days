/**
 * Shared pixel-art helpers for the 640×360 hi-bit canvas: palette utilities,
 * an offscreen sprite cache (per palette/frame/flip), and the townsfolk maps.
 */

export const OUTLINE = '#19263b';

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
  ctx.save();
  ctx.fillStyle = 'rgba(12,25,42,0.24)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + 1, w / 2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const walk = ((frame % 4) + 4) % 4;
  const key = `p2|${colors.shirt}|${colors.skin}|${colors.hair}|${colors.pants}|${walk}|${merch}|${flip}|${capColor}`;
  return cachedSprite(key, 24, 36, (c) => {
    // Keep the original maps as compatibility documentation while painting a
    // larger, curved, multi-tone sprite with expressive faces and four poses.
    void PERSON_A; void PERSON_B; void CAP;
    c.save();
    if (flip) { c.translate(24, 0); c.scale(-1, 1); }
    const stride = walk === 0 ? -1 : walk === 2 ? 1 : 0;
    const arm = walk < 2 ? -1 : 1;

    // Back leg and shoe.
    c.fillStyle = OUTLINE;
    c.beginPath(); c.roundRect(11 - stride, 25, 7, 9, 2); c.fill();
    c.fillStyle = shade(colors.pants, -24);
    c.beginPath(); c.roundRect(12 - stride, 25, 5, 7, 1); c.fill();
    c.fillStyle = '#243044';
    c.beginPath(); c.roundRect(11 - stride, 31, 8, 4, 1.5); c.fill();

    // Far arm, then body so the silhouette overlaps naturally.
    c.strokeStyle = OUTLINE; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(16, 16); c.lineTo(19, 23 - arm); c.stroke();
    c.strokeStyle = shade(shirt, -20); c.lineWidth = 3;
    c.beginPath(); c.moveTo(16, 16); c.lineTo(19, 23 - arm); c.stroke();
    c.fillStyle = colors.skin; c.beginPath(); c.arc(19, 24 - arm, 2.1, 0, Math.PI * 2); c.fill();

    c.fillStyle = OUTLINE;
    c.beginPath(); c.roundRect(5, 13, 14, 15, 4); c.fill();
    const cloth = c.createLinearGradient(6, 14, 18, 27);
    cloth.addColorStop(0, shade(shirt, 34));
    cloth.addColorStop(0.4, shirt);
    cloth.addColorStop(1, shade(shirt, -34));
    c.fillStyle = cloth;
    c.beginPath(); c.roundRect(6, 14, 12, 13, 3); c.fill();
    c.fillStyle = 'rgba(255,255,230,0.35)'; c.fillRect(7, 15, 2, 8);

    // Near arm has a visible swing and hand.
    c.strokeStyle = OUTLINE; c.lineWidth = 5;
    c.beginPath(); c.moveTo(7, 16); c.lineTo(4, 23 + arm); c.stroke();
    c.strokeStyle = shade(shirt, 10); c.lineWidth = 3;
    c.beginPath(); c.moveTo(7, 16); c.lineTo(4, 23 + arm); c.stroke();
    c.fillStyle = colors.skin; c.beginPath(); c.arc(4, 24 + arm, 2.1, 0, Math.PI * 2); c.fill();

    // Front leg and shoe.
    c.fillStyle = OUTLINE;
    c.beginPath(); c.roundRect(5 + stride, 25, 7, 9, 2); c.fill();
    c.fillStyle = colors.pants;
    c.beginPath(); c.roundRect(6 + stride, 25, 5, 7, 1); c.fill();
    c.fillStyle = '#1c293b';
    c.beginPath(); c.roundRect(4 + stride, 31, 8, 4, 1.5); c.fill();

    // Neck, softly shaded face, hair mass and tiny readable expression.
    c.fillStyle = shade(colors.skin, -18); c.fillRect(10, 11, 5, 5);
    c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(12, 8, 7, 7.5, 0, 0, Math.PI * 2); c.fill();
    const skin = c.createLinearGradient(7, 4, 17, 13);
    skin.addColorStop(0, shade(colors.skin, 24));
    skin.addColorStop(0.58, colors.skin);
    skin.addColorStop(1, shade(colors.skin, -27));
    c.fillStyle = skin; c.beginPath(); c.ellipse(12, 8.5, 5.7, 6.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = colors.hair;
    c.beginPath();
    c.arc(12, 5.2, 6.2, Math.PI, Math.PI * 2);
    c.lineTo(17.5, 8); c.lineTo(15.5, 6.6); c.lineTo(13.5, 7.4); c.lineTo(11.5, 6.1); c.lineTo(8.8, 7.2); c.lineTo(6.2, 7.8); c.closePath();
    c.fill();
    c.fillStyle = shade(colors.hair, 25); c.fillRect(8, 3, 5, 1.3);
    c.fillStyle = '#243044'; c.fillRect(10, 8, 1.2, 1.2); c.fillRect(14, 8, 1.2, 1.2);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(10.2, 8, 0.55, 0.55); c.fillRect(14.2, 8, 0.55, 0.55);
    c.fillStyle = shade(colors.skin, -50); c.fillRect(12, 11, 3, 0.9);

    if (merch) {
      c.fillStyle = OUTLINE;
      c.beginPath(); c.ellipse(12, 3, 7.4, 3.8, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = capColor;
      c.beginPath(); c.ellipse(12, 3.1, 6.3, 2.8, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = shade(capColor, -24); c.fillRect(15, 3, 5.5, 1.7);
      c.fillStyle = '#37705c'; c.beginPath(); c.arc(12, 18, 2.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f7e98e'; c.fillRect(11.4, 16.4, 1.2, 3.2);
    }
    c.restore();
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
  drawShadow(ctx, x - 1, y + 27, 19);
  ctx.drawImage(personSprite(colors, frame, opts.merch ?? false, opts.flip ?? false, opts.capColor ?? '#f2d24b'), x - 4, y - 8);
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
  drawShadow(ctx, x - 1, y + 15, 14);
  const key = `k2|${colors.shirt}|${colors.skin}|${colors.hair}|${colors.pants}|${frame % 4}|${flip}`;
  const spr = cachedSprite(key, 18, 26, (c) => {
    void KID_A; void KID_B;
    c.save();
    if (flip) { c.translate(18, 0); c.scale(-1, 1); }
    const step = frame % 2 === 0 ? -1 : 1;
    c.strokeStyle = OUTLINE; c.lineCap = 'round'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(6, 13); c.lineTo(3, 18); c.moveTo(12, 13); c.lineTo(15, 18); c.stroke();
    c.strokeStyle = colors.skin; c.lineWidth = 2;
    c.beginPath(); c.moveTo(6, 13); c.lineTo(3, 18); c.moveTo(12, 13); c.lineTo(15, 18); c.stroke();
    c.fillStyle = OUTLINE; c.beginPath(); c.roundRect(4, 10, 10, 10, 3); c.fill();
    const shirt = c.createLinearGradient(4, 10, 14, 20);
    shirt.addColorStop(0, shade(colors.shirt, 28)); shirt.addColorStop(1, shade(colors.shirt, -25));
    c.fillStyle = shirt; c.beginPath(); c.roundRect(5, 11, 8, 8, 2); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = 4;
    c.beginPath(); c.moveTo(7, 19); c.lineTo(6 + step, 24); c.moveTo(11, 19); c.lineTo(12 - step, 24); c.stroke();
    c.strokeStyle = colors.pants; c.lineWidth = 2;
    c.beginPath(); c.moveTo(7, 19); c.lineTo(6 + step, 23); c.moveTo(11, 19); c.lineTo(12 - step, 23); c.stroke();
    c.fillStyle = OUTLINE; c.fillRect(3 + step, 23, 6, 2); c.fillRect(9 - step, 23, 6, 2);
    c.fillStyle = OUTLINE; c.beginPath(); c.ellipse(9, 6.5, 6, 6.3, 0, 0, Math.PI * 2); c.fill();
    const skin = c.createLinearGradient(5, 3, 13, 11);
    skin.addColorStop(0, shade(colors.skin, 24)); skin.addColorStop(1, shade(colors.skin, -22));
    c.fillStyle = skin; c.beginPath(); c.ellipse(9, 6.8, 4.8, 5.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = colors.hair; c.beginPath(); c.arc(9, 4.6, 5.1, Math.PI, Math.PI * 2); c.lineTo(13.5, 7); c.lineTo(11, 5.9); c.lineTo(8.5, 6.8); c.lineTo(5, 6.4); c.closePath(); c.fill();
    c.fillStyle = '#263348'; c.fillRect(7, 7, 1, 1); c.fillRect(11, 7, 1, 1);
    c.fillStyle = shade(colors.skin, -45); c.fillRect(8, 9, 3, 1);
    c.restore();
  });
  ctx.drawImage(spr, x - 3, y - 10);
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
