import { mulberry32 } from './rng';
import type { FlavorId } from './types';

/**
 * The neighborhood's secret flavor-of-the-day. Deterministic per seed+day,
 * drawn from the flavors available in this run. Matching it earns a small
 * quality + stop-rate bonus; the lawn mini-games are how you find it out.
 */
export function flavorMoodFor(seed: number, day: number, flavors: FlavorId[]): FlavorId {
  if (flavors.length <= 1) return flavors[0] ?? 'classic';
  const rng = mulberry32((seed ^ Math.imul(day, 69621)) >>> 0);
  return flavors[Math.floor(rng() * flavors.length)];
}
