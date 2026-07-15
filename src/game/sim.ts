import { cents, chance, clamp, mulberry32, range } from './rng';
import { flavorMoodFor } from './mood';
import {
  DAY_MINUTES, EVENTS, MERCH_PRICE, cupsPerPitcher, gradeFor, lemonsPerPitcher,
  priceNowOf, recipeQuality, trafficMultOf, COSTS, MERCH_COST,
} from './data';
import type { DayResult, DayRuntime, RunState, SimEvent, Weather } from './types';

/**
 * One in-game day, stepped minute by minute so the player can react mid-day.
 * Every customer draws from their own child RNG (seeded by day+minute+slot),
 * which keeps outcomes deterministic AND price-elasticity monotonic: the same
 * customer never buys at $3 but not at $1.
 */
export function createDay(run: RunState, weather: Weather): DayRuntime {
  const daySeed = (run.seed ^ Math.imul(run.day, 2654435761)) >>> 0;
  const rng = mulberry32(daySeed);
  const mkt = run.marketing;
  const marketingTraffic =
    (mkt.flyerDays > 0 ? 1.25 : 1) *
    (mkt.radioDays > 0 ? 1.15 : 1) *
    (1 + Math.min(0.25, mkt.fans * 0.01)) *
    (1 + mkt.specials.length * 0.05) *
    (1 + Math.min(0.08, mkt.muralStage * 0.016));
  const mood = flavorMoodFor(run.seed, run.day, run.flavorsAvail);
  const d: DayRuntime = {
    daySeed, rng, minute: 0, weather,
    price: run.price, recipe: { ...run.recipe }, flavor: run.flavor,
    product: run.upgrades.includes('slush') ? run.product : 'regular',
    mood,
    q: clamp(recipeQuality(run.recipe, run.flavor, weather.tempF) + (run.flavor === mood ? 0.05 : 0), 0, 1),
    supplies: { ...run.supplies }, upgrades: [...run.upgrades], rep: run.rep,
    marketingTraffic, merch: mkt.merch, merchChance: mkt.specials.length * 0.015, merchSold: 0, merchRevenue: 0,
    pitcherLeft: 0, sold: 0, revenue: 0, tips: 0, cashDelta: 0,
    lemonsUsed: 0, sugarUsed: 0, iceUsed: 0, cupsUsed: 0,
    lostStock: 0, lostPrice: 0, walkbys: 0, satSum: 0, satN: 0,
    repDelta: 0, mods: [], schedule: [], priceChanges: 0,
  };
  const first = 80 + Math.floor(rng() * 300);
  d.schedule.push({ minute: first, defId: pickEvent(d, first) });
  if (chance(rng, 0.4)) {
    const second = Math.min(DAY_MINUTES - 60, first + 130 + Math.floor(rng() * 200));
    d.schedule.push({ minute: second, defId: pickEvent(d, second) });
  }
  return d;
}

function pickEvent(d: DayRuntime, minute: number): string {
  const saved = d.minute;
  d.minute = minute;
  const pool = EVENTS.filter((e) => e.when(d) && !d.schedule.some((s) => s.defId === e.id));
  d.minute = saved;
  const all = pool.length ? pool : EVENTS.filter((e) => !d.schedule.some((s) => s.defId === e.id));
  return all[Math.floor(d.rng() * all.length)].id;
}

function baseArrival(minute: number): number {
  if (minute < 60) return 0.05;
  if (minute < 180) return 0.09;
  if (minute < 270) return 0.15;
  if (minute < 390) return 0.1;
  if (minute < 480) return 0.13;
  return 0.07;
}

const WEATHER_TRAFFIC: Record<Weather['kind'], number> = {
  sunny: 1, partly: 0.92, cloudy: 0.75, rain: 0.38, heatwave: 0.95,
};

export function arrivalRate(d: DayRuntime): number {
  let rate = baseArrival(d.minute) * WEATHER_TRAFFIC[d.weather.kind];
  if (d.upgrades.includes('sign')) rate *= 1.15;
  if (d.upgrades.includes('umbrella') && (d.weather.kind === 'rain' || d.weather.kind === 'heatwave')) rate *= 1.2;
  if (d.upgrades.includes('lights') && d.minute >= 480) rate *= 1.6;
  if (d.weather.tempF >= 90) {
    if (d.upgrades.includes('misters')) rate *= 1.12;
    else if (d.upgrades.includes('fans')) rate *= 1.05;
  }
  rate *= 0.8 + d.rep / 250;
  rate *= d.marketingTraffic;
  rate *= trafficMultOf(d);
  return rate;
}

export function stepMinute(d: DayRuntime): SimEvent[] {
  const out: SimEvent[] = [];
  d.minute++;
  const m = d.minute;

  const sched = d.schedule.find((s) => s.minute === m);
  if (sched) {
    const def = EVENTS.find((e) => e.id === sched.defId);
    if (def) out.push({ kind: 'popup', minute: m, def });
  }

  const rate = arrivalRate(d);
  let arrivals = 0;
  if (chance(d.rng, Math.min(0.95, rate))) arrivals = 1 + (chance(d.rng, rate * 0.3) ? 1 : 0);
  for (let k = 0; k < arrivals; k++) out.push(customer(d, m, k));

  return out;
}

function customer(d: DayRuntime, m: number, slot: number): SimEvent {
  const crng = mulberry32((d.daySeed ^ Math.imul(m, 8887) ^ Math.imul(slot + 1, 7691)) >>> 0);
  const w = d.weather;
  const frozen = d.product === 'frozen';
  const miss = (outcome: 'pricey' | 'walkby' | 'stockout'): SimEvent =>
    ({ kind: 'arrive', minute: m, outcome, paid: 0, tip: 0, sat: 0, warm: false, merch: false });

  let stopP = 0.42 + d.q * 0.35 + d.rep / 500 + (d.flavor === d.mood ? 0.03 : 0);
  if (d.upgrades.includes('sign')) stopP += 0.05;
  if (d.upgrades.includes('radio')) stopP += 0.04;
  if (d.upgrades.includes('lights') && m >= 460) stopP += 0.08;
  if (!chance(crng, clamp(stopP, 0, 0.97))) {
    d.walkbys++;
    return miss('walkby');
  }

  const wtpBase =
    0.8 + Math.max(0, w.tempF - 68) * 0.045 + (w.kind === 'heatwave' ? 0.5 : 0) + (w.kind === 'rain' ? -0.25 : 0);
  let wtp = wtpBase * (0.7 + d.q * 0.6) * range(crng, 0.65, 1.5);
  // Frozen lemonade: a premium product on scorchers, a shrug below 80°F.
  if (frozen) wtp += w.tempF >= 90 ? 0.55 : w.tempF >= 80 ? 0.15 : -0.25;
  const price = priceNowOf(d);

  if (price > wtp) {
    d.lostPrice++;
    return miss('pricey');
  }

  const lemonsNeed = lemonsPerPitcher(d.recipe, d.upgrades);
  if (d.supplies.cups <= 0 || (d.pitcherLeft <= 0 && (d.supplies.lemons < lemonsNeed || d.supplies.sugar < d.recipe.sugar))) {
    d.lostStock++;
    return miss('stockout');
  }
  if (d.pitcherLeft <= 0) {
    d.supplies.lemons -= lemonsNeed;
    d.supplies.sugar -= d.recipe.sugar;
    d.lemonsUsed += lemonsNeed;
    d.sugarUsed += d.recipe.sugar;
    d.pitcherLeft = cupsPerPitcher(d.upgrades);
  }

  d.pitcherLeft--;
  d.supplies.cups--;
  d.cupsUsed++;
  const iceNeed = frozen ? Math.max(2, d.recipe.icePerCup * 2) : d.recipe.icePerCup;
  const iceServed = Math.min(iceNeed, d.supplies.ice);
  d.supplies.ice -= iceServed;
  d.iceUsed += iceServed;
  const cold = iceNeed > 0 && iceServed >= iceNeed;
  const warm = !cold && w.tempF >= 85;

  const value = clamp((wtp - price) / Math.max(wtp, 0.01), 0, 1);
  const coldScore = cold ? 1 : w.tempF >= 85 ? 0.1 : 0.55;
  // Umbrella-line comfort: shade + breeze + mist on hot days.
  const comfort = w.tempF >= 88 ? (d.upgrades.includes('misters') ? 0.12 : d.upgrades.includes('fans') ? 0.06 : 0) : 0;
  const sat = clamp(0.55 * d.q + 0.25 * (0.2 + 0.8 * value) + 0.2 * coldScore + comfort, 0, 1);

  let tip = 0;
  if (sat >= 0.78 && chance(crng, 0.35)) tip = Math.max(0.05, cents(price * 0.2));

  // Delighted customers sometimes grab a cap or tee on the way out.
  let merch = false;
  if (d.merch && sat >= 0.85 && chance(crng, 0.08 + d.merchChance)) {
    merch = true;
    d.merchSold++;
    d.merchRevenue += MERCH_PRICE;
  }

  d.sold++;
  d.revenue += price;
  d.tips += tip;
  d.satSum += sat;
  d.satN++;
  return { kind: 'arrive', minute: m, outcome: 'bought', paid: price, tip, sat, warm, merch };
}

export function setPriceMidDay(d: DayRuntime, newPrice: number): void {
  const p = cents(clamp(newPrice, 0.25, 5));
  if (p > d.price * 1.1) d.repDelta -= 1.5;
  d.price = p;
  d.priceChanges++;
}

export const isDayOver = (d: DayRuntime): boolean => d.minute >= DAY_MINUTES;

export function endDayResult(d: DayRuntime): DayResult {
  const avgSat = d.satN > 0 ? d.satSum / d.satN : 0.5;
  const fanGlow = Math.min(2, d.merchSold * 0.4);
  const repAfter = clamp(
    d.rep + (avgSat * 100 - d.rep) * 0.12 + d.repDelta + fanGlow - Math.min(6, d.lostStock * 0.7),
    0, 100,
  );
  const cogs =
    d.lemonsUsed * COSTS.lemons + d.sugarUsed * COSTS.sugar + d.iceUsed * COSTS.ice + d.cupsUsed * COSTS.cups;
  const revenue = Math.round(d.revenue * 100) / 100;
  const tips = Math.round(d.tips * 100) / 100;
  const merchRevenue = Math.round(d.merchRevenue * 100) / 100;
  const profit = Math.round(
    (revenue + tips + d.cashDelta + merchRevenue - d.merchSold * MERCH_COST - cogs) * 100,
  ) / 100;

  const notes: string[] = [];
  if (d.lostStock >= 5) notes.push(`You turned away ${d.lostStock} thirsty customers. Stock up!`);
  else if (d.lostStock > 0) notes.push(`${d.lostStock} customers left because you ran dry.`);
  if (d.lostPrice >= 8) notes.push(`${d.lostPrice} people balked at the price.`);
  if (d.iceUsed === 0 && d.weather.tempF >= 85) notes.push('Warm lemonade on a hot day. People noticed.');
  if (d.product === 'frozen' && d.weather.tempF < 80) notes.push('Frozen lemonade on a mild day was a hard sell.');
  if (d.merchSold > 0) notes.push(`${d.merchSold} ${d.merchSold === 1 ? 'person is' : 'people are'} now walking around in your merch!`);
  if (avgSat >= 0.8) notes.push('Folks LOVED the recipe today.');
  if (d.sold === 0) notes.push('Not a single sale. Tomorrow is a new day.');

  return {
    day: 0,
    weather: d.weather,
    sold: d.sold, revenue, tips,
    eventCash: Math.round(d.cashDelta * 100) / 100,
    merchSold: d.merchSold,
    merchRevenue,
    cogs: Math.round(cogs * 100) / 100,
    profit,
    lostStock: d.lostStock, lostPrice: d.lostPrice, walkbys: d.walkbys,
    avgSat, repBefore: d.rep, repAfter, grade: gradeFor(profit), notes,
  };
}
