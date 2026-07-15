/** Deterministic PRNG (mulberry32). Same seed -> same summer, same customers. */
export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: RNG, min: number, max: number): number => min + rng() * (max - min);
export const irange = (rng: RNG, min: number, max: number): number => Math.floor(range(rng, min, max + 1));
export const chance = (rng: RNG, p: number): boolean => rng() < p;
export const pick = <T>(rng: RNG, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
/** Round to the nearest nickel, avoiding float dust. */
export const cents = (n: number): number => Math.round(n * 20) / 20;
