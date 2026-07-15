import { chance, irange, mulberry32, pick, range } from './rng';
import type { Weather, WeatherKind } from './types';

/**
 * Summer arc: warms toward midsummer (~day 17), eases after. In endless mode
 * the curve keeps going, drifting into a cooler "late season" before cycling.
 */
export function weatherFor(seed: number, day: number): Weather {
  const rng = mulberry32(((seed ^ 0x9e3779b9) + day * 104729) >>> 0);
  const phase = ((day - 1) % 56) + 1;
  const arc = Math.max(-0.5, Math.sin((Math.PI * phase) / 34));
  const tempF = Math.round(74 + 22 * arc + range(rng, -7, 7));
  const r = rng();
  let kind: WeatherKind;
  if (tempF >= 97) kind = 'heatwave';
  else if (r < 0.14) kind = 'rain';
  else if (r < 0.3) kind = 'cloudy';
  else if (r < 0.55) kind = 'partly';
  else kind = 'sunny';
  return { kind, tempF };
}

/** What the radio tells you about a given day. Right ~75% of the time. */
export function forecastFor(seed: number, day: number): Weather {
  const actual = weatherFor(seed, day);
  const rng = mulberry32((seed * 31 + day * 977 + 5) >>> 0);
  if (chance(rng, 0.75)) {
    return { kind: actual.kind, tempF: actual.tempF + irange(rng, -3, 3) };
  }
  const kinds: WeatherKind[] = ['sunny', 'partly', 'cloudy', 'rain'];
  return { kind: pick(rng, kinds), tempF: actual.tempF + irange(rng, -8, 8) };
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  sunny: 'Sunny',
  partly: 'Partly cloudy',
  cloudy: 'Overcast',
  rain: 'Rain',
  heatwave: 'HEATWAVE',
};

export const WEATHER_ICON: Record<WeatherKind, string> = {
  sunny: '☀️',
  partly: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  heatwave: '🔥',
};
