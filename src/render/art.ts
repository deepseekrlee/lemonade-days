import townDayUrl from '../assets/town-day.png';
import townNightUrl from '../assets/town-night.png';

export const TOWN_DAY_URL = townDayUrl;
export const TOWN_NIGHT_URL = townNightUrl;

export const VIEW_W = 640;
export const VIEW_H = 360;
export const RENDER_SCALE = 2;

type TownVariant = 'day' | 'night';

let dayImage: HTMLImageElement | null = null;
let nightImage: HTMLImageElement | null = null;

function imageFor(variant: TownVariant): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (variant === 'day') {
    if (!dayImage) {
      dayImage = new Image();
      dayImage.decoding = 'async';
      dayImage.src = townDayUrl;
    }
    return dayImage;
  }
  if (!nightImage) {
    nightImage = new Image();
    nightImage.decoding = 'async';
    nightImage.src = townNightUrl;
  }
  return nightImage;
}

/** Keep the simulation's 640x360 coordinate system while drawing at crisp 720p. */
export function configureHiResCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = VIEW_W * RENDER_SCALE;
  canvas.height = VIEW_H * RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;
  return ctx;
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fallbackTown(ctx: CanvasRenderingContext2D, variant: TownVariant): void {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  if (variant === 'night') {
    sky.addColorStop(0, '#111b3d');
    sky.addColorStop(0.62, '#334b78');
    sky.addColorStop(1, '#17283c');
  } else {
    sky.addColorStop(0, '#79cef0');
    sky.addColorStop(0.58, '#d8eff1');
    sky.addColorStop(1, '#6b8b69');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

/** Draw the painterly pixel-art master and add simulation-aware color and light. */
export function drawTownBackground(
  ctx: CanvasRenderingContext2D,
  variant: TownVariant,
  dayProgress = 0.5,
  weather: 'sunny' | 'partly' | 'cloudy' | 'rain' | 'heatwave' = 'sunny',
  timeMs = 0,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const image = imageFor(variant);
  if (image?.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, VIEW_W, VIEW_H);
  } else {
    fallbackTown(ctx, variant);
  }

  if (variant === 'day') {
    if (dayProgress < 0.24) {
      ctx.fillStyle = `rgba(255,137,91,${(0.24 - dayProgress) * 0.7})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (dayProgress > 0.7) {
      const dusk = Math.min(1, (dayProgress - 0.7) / 0.3);
      const veil = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
      veil.addColorStop(0, `rgba(255,176,91,${dusk * 0.12})`);
      veil.addColorStop(1, `rgba(69,49,119,${dusk * 0.28})`);
      ctx.fillStyle = veil;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (weather === 'cloudy' || weather === 'rain') {
      ctx.fillStyle = weather === 'rain' ? 'rgba(28,56,86,0.26)' : 'rgba(77,99,119,0.15)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (weather === 'sunny' || weather === 'partly' || weather === 'heatwave') {
      ctx.globalCompositeOperation = 'screen';
      const sunX = 68 + dayProgress * 410;
      const sunY = 72 - Math.sin(dayProgress * Math.PI) * 44;
      const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 140);
      glow.addColorStop(0, 'rgba(255,246,191,0.24)');
      glow.addColorStop(0.45, 'rgba(255,219,146,0.08)');
      glow.addColorStop(1, 'rgba(255,210,130,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalCompositeOperation = 'source-over';

      const seconds = timeMs / 1000;
      for (let i = 0; i < 13; i++) {
        const x = (i * 83 + seconds * (2.5 + (i % 3))) % (VIEW_W + 30) - 15;
        const y = 55 + ((i * 47) % 210) + Math.sin(seconds * 0.7 + i) * 5;
        ctx.globalAlpha = 0.18 + (i % 4) * 0.05;
        ctx.fillStyle = i % 3 === 0 ? '#fff2a8' : '#d8f3cf';
        ctx.beginPath();
        ctx.arc(x, y, i % 3 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 120, VIEW_W / 2, VIEW_H / 2, 390);
  vignette.addColorStop(0.55, 'rgba(9,18,35,0)');
  vignette.addColorStop(1, variant === 'night' ? 'rgba(5,8,25,0.34)' : 'rgba(18,35,47,0.19)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}

export function drawSoftShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.24,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(12,24,38,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
