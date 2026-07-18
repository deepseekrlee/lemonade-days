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
  const green = '#78d995';
  const bob = frame % 4 === 1 || frame % 4 === 2 ? -1 : 0;
  const stride = frame % 2 === 0 ? -1 : 1;
  drawShadow(ctx, x - 4, y + 14, 19);
  ctx.save();
  ctx.translate(x + 5, y - 7 + bob);

  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(1, -3, 4, -5); ctx.stroke();
  ctx.save();
  ctx.shadowColor = '#ffe36e'; ctx.shadowBlur = 5;
  ctx.fillStyle = '#ffe36e'; ctx.beginPath(); ctx.arc(4.5, -5.5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-2, 17); ctx.lineTo(-3 + stride, 21); ctx.moveTo(3, 17); ctx.lineTo(4 - stride, 21); ctx.stroke();
  ctx.strokeStyle = shade(green, -34); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2, 17); ctx.lineTo(-3 + stride, 21); ctx.moveTo(3, 17); ctx.lineTo(4 - stride, 21); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(-3 + stride, 22, 3.5, 1.8, -0.1, 0, Math.PI * 2); ctx.ellipse(4 - stride, 22, 3.5, 1.8, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6e7696';
  ctx.beginPath(); ctx.ellipse(-3 + stride, 21.6, 2.5, 1, 0, 0, Math.PI * 2); ctx.ellipse(4 - stride, 21.6, 2.5, 1, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(0, 14, 7.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  const suit = ctx.createLinearGradient(-6, 8, 6, 20);
  suit.addColorStop(0, '#b9b2e8'); suit.addColorStop(0.5, '#7e79b8'); suit.addColorStop(1, '#484d81');
  ctx.fillStyle = suit;
  ctx.beginPath(); ctx.ellipse(0, 14, 6.1, 7.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9f6e6'; ctx.beginPath(); ctx.ellipse(0, 8.7, 5.2, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffdf6d'; ctx.beginPath(); ctx.arc(0, 14, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 7.2, 0, 0, Math.PI * 2); ctx.fill();
  const skin = ctx.createRadialGradient(-3, 1, 1, 0, 6, 10);
  skin.addColorStop(0, '#c9f3b1'); skin.addColorStop(0.46, green); skin.addColorStop(1, '#3f956f');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, 5, 7.6, 5.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#17243b';
  ctx.beginPath(); ctx.ellipse(-3.2, 4.3, 2.2, 2.9, -0.28, 0, Math.PI * 2); ctx.ellipse(3.2, 4.3, 2.2, 2.9, 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(-3.8, 3.2, 0.8, 0, Math.PI * 2); ctx.arc(2.6, 3.2, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = shade(green, -55); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 7, 2.2, 0.12, Math.PI - 0.12); ctx.stroke();

  if (cap) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath(); ctx.ellipse(0, 0.2, 9.1, 2.6, -0.08, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c84b';
    ctx.beginPath(); ctx.ellipse(0, 0.3, 7.8, 1.8, -0.08, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d79b33'; ctx.beginPath(); ctx.ellipse(5.3, 0.4, 5.2, 1.1, 0.05, 0, Math.PI); ctx.fill();
  }
  if (cup) {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(9, 10); ctx.stroke();
    ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.roundRect(8, 6, 7, 9, 2); ctx.fill();
    ctx.fillStyle = '#fff8e5'; ctx.beginPath(); ctx.roundRect(9.2, 7, 4.7, 6.8, 1); ctx.fill();
    ctx.fillStyle = '#f4d34c'; ctx.fillRect(9.2, 7.4, 4.7, 2.5);
    ctx.strokeStyle = '#ffefba'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, 7); ctx.lineTo(13, 3); ctx.stroke();
  }
  ctx.restore();
}

/** Anthropomorphic lemon (or pink lemonade, or mint) person, 14×22. */
export function drawLemonFolk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { throwing?: boolean; flip?: boolean; color?: string; mouthOpen?: boolean } = {},
): void {
  const lemon = opts.color ?? '#f2d24b';
  drawShadow(ctx, x - 3, y + 21, 20);
  ctx.save();
  ctx.translate(x + 7, y + 7);
  if (opts.flip) ctx.scale(-1, 1);

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-4, 14); ctx.moveTo(3, 8); ctx.lineTo(4, 14); ctx.stroke();
  ctx.strokeStyle = '#6d794c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-4, 14); ctx.moveTo(3, 8); ctx.lineTo(4, 14); ctx.stroke();
  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(-5, 15, 4.4, 2.2, -0.12, 0, Math.PI * 2); ctx.ellipse(5, 15, 4.4, 2.2, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f6f0df';
  ctx.beginPath(); ctx.ellipse(-5.4, 14.6, 3.2, 1.1, 0, 0, Math.PI * 2); ctx.ellipse(5.4, 14.6, 3.2, 1.1, 0, 0, Math.PI * 2); ctx.fill();

  const handY = opts.throwing ? -7 : 4;
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(10, opts.throwing ? -1 : 2, 12, handY); ctx.stroke();
  ctx.strokeStyle = shade(lemon, -25); ctx.lineWidth = 2.3;
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(10, opts.throwing ? -1 : 2, 12, handY); ctx.stroke();
  ctx.fillStyle = '#fff7dd'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(12.2, handY, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-10, 3, -11, 7); ctx.stroke();
  ctx.strokeStyle = shade(lemon, -34); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-10, 3, -11, 7); ctx.stroke();
  ctx.fillStyle = '#fff7dd'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(-11, 7, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(0, -11); ctx.bezierCurveTo(8, -10, 10, -3, 9, 3); ctx.bezierCurveTo(8, 10, 3, 12, 0, 13);
  ctx.bezierCurveTo(-4, 12, -9, 9, -10, 3); ctx.bezierCurveTo(-11, -3, -7, -9, 0, -11); ctx.closePath(); ctx.fill();
  const rind = ctx.createRadialGradient(-4, -6, 1, 1, 2, 14);
  rind.addColorStop(0, shade(lemon, 48)); rind.addColorStop(0.42, lemon); rind.addColorStop(1, shade(lemon, -44));
  ctx.fillStyle = rind;
  ctx.beginPath();
  ctx.moveTo(0, -9.2); ctx.bezierCurveTo(6.5, -8.5, 8.3, -2.5, 7.5, 3); ctx.bezierCurveTo(6.8, 8.2, 2.5, 10.2, 0, 11.2);
  ctx.bezierCurveTo(-3.4, 10.3, -7.2, 7.7, -8, 2.8); ctx.bezierCurveTo(-8.6, -2.3, -5.8, -8, 0, -9.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,225,0.5)';
  ctx.beginPath(); ctx.ellipse(-4.2, -4.5, 2.2, 4.3, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(lemon, -30);
  ctx.beginPath(); ctx.arc(4.5, 5.5, 1, 0, Math.PI * 2); ctx.arc(-1.5, 8, 0.7, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(2, -13, 5, -13); ctx.stroke();
  ctx.fillStyle = '#377b58'; ctx.beginPath(); ctx.ellipse(6.5, -13, 4.4, 2.1, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#79b66d'; ctx.beginPath(); ctx.ellipse(5.8, -13.5, 2.4, 0.8, -0.35, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(-3.2, -1.6, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(3, -1.6, 1.3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath(); ctx.arc(-3.6, -2.2, 0.45, 0, Math.PI * 2); ctx.arc(2.6, -2.2, 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OUTLINE;
  if (opts.mouthOpen) {
    ctx.beginPath(); ctx.ellipse(0, 3, 2.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef8995'; ctx.beginPath(); ctx.ellipse(0, 4, 1.3, 0.8, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 1.8, 3, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
}

/** Soft-serve rival used by the lawn crowd and the boxing game. */
export function drawIceCreamFolk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { flip?: boolean; boxing?: boolean; hurt?: boolean; frame?: number } = {},
): void {
  const frame = opts.frame ?? 0;
  const bounce = frame % 4 === 1 || frame % 4 === 2 ? -1 : 0;
  drawShadow(ctx, x - 4, y + 24, 23);
  ctx.save();
  ctx.translate(x + 7, y + bounce);
  if (opts.flip) ctx.scale(-1, 1);

  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 17); ctx.lineTo(-4, 22); ctx.moveTo(3, 17); ctx.lineTo(4, 22); ctx.stroke();
  ctx.strokeStyle = '#bc7d46'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, 17); ctx.lineTo(-4, 22); ctx.moveTo(3, 17); ctx.lineTo(4, 22); ctx.stroke();
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.ellipse(-5, 23, 4.5, 2, 0, 0, Math.PI * 2); ctx.ellipse(5, 23, 4.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b527a'; ctx.beginPath(); ctx.ellipse(-5.3, 22.7, 3.1, 0.9, 0, 0, Math.PI * 2); ctx.ellipse(5.3, 22.7, 3.1, 0.9, 0, 0, Math.PI * 2); ctx.fill();

  const glove = opts.boxing ? '#e95f6d' : '#fff7e6';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-6, 7); ctx.quadraticCurveTo(-11, 5, -12, opts.boxing ? 0 : 8); ctx.moveTo(6, 7); ctx.quadraticCurveTo(11, 5, 12, opts.boxing ? 1 : 8); ctx.stroke();
  ctx.strokeStyle = '#bd7c4a'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-6, 7); ctx.quadraticCurveTo(-11, 5, -12, opts.boxing ? 0 : 8); ctx.moveTo(6, 7); ctx.quadraticCurveTo(11, 5, 12, opts.boxing ? 1 : 8); ctx.stroke();
  ctx.fillStyle = glove; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(-12, opts.boxing ? 0 : 8, opts.boxing ? 3.7 : 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(12, opts.boxing ? 1 : 8, opts.boxing ? 3.7 : 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(8, 6); ctx.lineTo(1.4, 19); ctx.quadraticCurveTo(0, 21, -1.4, 19); ctx.closePath(); ctx.fill();
  const cone = ctx.createLinearGradient(-7, 7, 5, 19);
  cone.addColorStop(0, '#f3c978'); cone.addColorStop(0.55, '#d59a55'); cone.addColorStop(1, '#9f623d');
  ctx.fillStyle = cone;
  ctx.beginPath(); ctx.moveTo(-6.4, 7.2); ctx.lineTo(6.4, 7.2); ctx.lineTo(0, 19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(111,61,40,0.56)'; ctx.lineWidth = 0.8;
  for (let i = -6; i <= 4; i += 4) { ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i + 6, 17); ctx.stroke(); }
  for (let i = -4; i <= 6; i += 4) { ctx.beginPath(); ctx.moveTo(i, 8); ctx.lineTo(i - 6, 17); ctx.stroke(); }

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.arc(-3.5, 4, 6, 0, Math.PI * 2); ctx.arc(3.5, 4, 6, 0, Math.PI * 2); ctx.arc(0, -1, 6.5, 0, Math.PI * 2); ctx.arc(0, -6, 4, 0, Math.PI * 2); ctx.fill();
  const cream = ctx.createRadialGradient(-3, -7, 1, 2, 2, 14);
  cream.addColorStop(0, '#fffdf5'); cream.addColorStop(0.55, opts.hurt ? '#f2c5cd' : '#f3e8ee'); cream.addColorStop(1, '#c8b9d3');
  ctx.fillStyle = cream;
  ctx.beginPath(); ctx.arc(-3.3, 4, 4.7, 0, Math.PI * 2); ctx.arc(3.3, 4, 4.7, 0, Math.PI * 2); ctx.arc(0, -0.8, 5.2, 0, Math.PI * 2); ctx.arc(0, -5.8, 3.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(-2.8, -3.5, 1.3, 3.4, 0.35, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = OUTLINE;
  ctx.beginPath(); ctx.ellipse(-2.5, 1.5, 1.2, 1.6, 0, 0, Math.PI * 2); ctx.ellipse(2.5, 1.5, 1.2, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 4, 2.6, opts.boxing ? Math.PI + 0.25 : 0.15, opts.boxing ? Math.PI * 2 - 0.25 : Math.PI - 0.15); ctx.stroke();
  if (opts.boxing) {
    ctx.strokeStyle = '#7b4f8e'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-5, -0.5); ctx.lineTo(-1.2, 0.2); ctx.moveTo(5, -0.5); ctx.lineTo(1.2, 0.2); ctx.stroke();
  }
  ctx.restore();
}
