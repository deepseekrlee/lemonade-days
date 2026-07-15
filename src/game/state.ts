import { cents, clamp, mulberry32, newSeed, range } from './rng';
import {
  COSTS, MARKETING, MARKETING_UNLOCK_CASH, MERCH_COST, MURAL_FAN_REQUIREMENT, MURAL_STAGE_COSTS,
  SPECIAL_MERCH, START_CASH, START_REP, SUMMER_DAYS, TRUCK_UPGRADES, UPGRADES,
} from './data';
import { forecastFor, weatherFor } from './weather';
import type {
  DayResult, GameMode, MarketingAction, MetaState, RunState, Supplies, UpgradeId, Weather,
} from './types';

export const DEFAULT_META: MetaState = {
  bestScore: 0, summers: 0, endlessUnlocked: false,
  flavors: ['classic'], headStart: false, boss: true,
  audio: { music: true, sfx: true },
};

export function newRun(meta: MetaState, mode: GameMode, seed: number = newSeed()): RunState {
  return {
    seed, mode, day: 1,
    cash: START_CASH + (meta.headStart ? 10 : 0),
    rep: START_REP,
    supplies: { lemons: 12, sugar: 8, ice: 20, cups: 30 },
    upgrades: [],
    flavor: 'classic',
    product: 'regular',
    recipe: { lemons: 6, sugar: 4, icePerCup: 1 },
    price: 1.5,
    marketing: { unlocked: false, merch: false, specials: [], fans: 0, flyerDays: 0, radioDays: 0, muralStage: 0 },
    truck: { level: 0, bestJump: 0, wins: 0 },
    cameos: { kaiju: 0, ufo: 0, pegasus: 0 },
    flavorsAvail: [...meta.flavors],
    hint: null,
    bossFights: 0,
    totals: { sold: 0, revenue: 0, tips: 0, profit: 0, bestDay: 0, daysPlayed: 0 },
    history: [],
  };
}

export const todayWeather = (run: RunState): Weather => weatherFor(run.seed, run.day);
export const tomorrowForecast = (run: RunState): Weather => forecastFor(run.seed, run.day + 1);
export const todayForecast = (run: RunState): Weather => forecastFor(run.seed, run.day);

export function marketPrices(run: RunState): Record<keyof Supplies, number> {
  const rng = mulberry32((run.seed ^ Math.imul(run.day, 40503)) >>> 0);
  const wob = () => range(rng, 0.75, 1.25);
  return {
    lemons: cents(COSTS.lemons * wob()),
    sugar: cents(COSTS.sugar * wob()),
    ice: cents(COSTS.ice * wob()),
    cups: cents(COSTS.cups * wob()),
  };
}

export function buySupply(run: RunState, item: keyof Supplies, qty: number): boolean {
  const cost = Math.round(marketPrices(run)[item] * qty * 100) / 100;
  if (qty <= 0 || run.cash < cost) return false;
  run.cash = Math.round((run.cash - cost) * 100) / 100;
  run.supplies[item] += qty;
  return true;
}

export function buyUpgrade(run: RunState, id: UpgradeId): boolean {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def || run.upgrades.includes(id) || run.cash < def.cost) return false;
  if (def.requires && !run.upgrades.includes(def.requires)) return false;
  run.cash = Math.round((run.cash - def.cost) * 100) / 100;
  run.upgrades.push(id);
  return true;
}

export function buyMarketing(run: RunState, id: MarketingAction): boolean {
  if (id === 'mural') {
    const stage = Math.max(0, Math.min(5, run.marketing.muralStage));
    if (!muralUnlocked(run) || stage >= 5) return false;
    const cost = MURAL_STAGE_COSTS[stage];
    if (run.cash < cost) return false;
    run.cash = Math.round((run.cash - cost) * 100) / 100;
    run.marketing.muralStage = stage + 1;
    run.rep = clamp(run.rep + (stage === 4 ? 6 : 1), 0, 100);
    return true;
  }
  const def = MARKETING.find((m) => m.id === id) ?? SPECIAL_MERCH.find((m) => m.id === id);
  if (!def || !run.marketing.unlocked || run.cash < def.cost) return false;
  const mkt = run.marketing;
  if (def.cameo) {
    // special drops: need the base merch line AND to have witnessed the cameo
    if (!mkt.merch || mkt.specials.includes(id) || run.cameos[def.cameo] < 1) return false;
    run.cash = Math.round((run.cash - def.cost) * 100) / 100;
    mkt.specials.push(id);
    run.rep = clamp(run.rep + 4, 0, 100);
    return true;
  }
  if (id === 'flyers' && mkt.flyerDays > 0) return false;
  if (id === 'radiospot' && mkt.radioDays > 0) return false;
  if (id === 'merch' && mkt.merch) return false;
  run.cash = Math.round((run.cash - def.cost) * 100) / 100;
  if (id === 'flyers') mkt.flyerDays = 1;
  if (id === 'radiospot') mkt.radioDays = 3;
  if (id === 'merch') mkt.merch = true;
  return true;
}

export function muralUnlocked(run: RunState): boolean {
  return run.marketing.unlocked && run.marketing.merch && run.marketing.fans >= MURAL_FAN_REQUIREMENT;
}

export function buyTruckUpgrade(run: RunState): boolean {
  const next = TRUCK_UPGRADES.find((u) => u.level === run.truck.level + 1);
  if (!next || run.cash < next.cost) return false;
  run.cash = Math.round((run.cash - next.cost) * 100) / 100;
  run.truck.level = next.level;
  return true;
}

/** The sun sprite reaches its apex at minute 300: 2:00 PM. */
export function peakHeatBossMinute(tempF: number, enabled: boolean): number | null {
  return enabled && tempF >= 90 ? 300 : null;
}

/** Apply a finished day to the run: cash, rep, totals, marketing, overnight spoilage. */
export function completeDay(run: RunState, result: DayResult): { summerOver: boolean } {
  result.day = run.day;
  const merchNet = result.merchRevenue - result.merchSold * MERCH_COST;
  run.cash = Math.round((run.cash + result.revenue + result.tips + result.eventCash + merchNet) * 100) / 100;
  run.rep = result.repAfter;
  run.totals.sold += result.sold;
  run.totals.revenue = Math.round((run.totals.revenue + result.revenue + result.merchRevenue) * 100) / 100;
  run.totals.tips = Math.round((run.totals.tips + result.tips) * 100) / 100;
  run.totals.profit = Math.round((run.totals.profit + result.profit) * 100) / 100;
  run.totals.bestDay = Math.max(run.totals.bestDay, result.profit);
  run.totals.daysPlayed++;
  run.history.push({ day: run.day, sold: result.sold, profit: result.profit, grade: result.grade });

  const mkt = run.marketing;
  mkt.fans += result.merchSold;
  mkt.flyerDays = Math.max(0, mkt.flyerDays - 1);
  mkt.radioDays = Math.max(0, mkt.radioDays - 1);
  if (run.cash >= MARKETING_UNLOCK_CASH) mkt.unlocked = true;

  const iceKeep = run.upgrades.includes('cooler') ? 0.75 : 0.5;
  run.supplies.ice = Math.floor(run.supplies.ice * iceKeep);
  run.supplies.lemons = Math.ceil(run.supplies.lemons * 0.85);

  run.day++;
  return { summerOver: run.mode === 'summer' && run.day > SUMMER_DAYS };
}

export function summerScore(run: RunState): number {
  return Math.round(run.cash + run.rep * 2 + run.totals.sold * 0.1 + run.marketing.fans);
}

export function applySummerToMeta(meta: MetaState, run: RunState): { meta: MetaState; unlocked: string[] } {
  const score = summerScore(run);
  const unlocked: string[] = [];
  const next: MetaState = { ...meta, flavors: [...meta.flavors] };
  next.summers++;
  next.bestScore = Math.max(next.bestScore, score);
  if (!next.endlessUnlocked) { next.endlessUnlocked = true; unlocked.push('Endless Mode'); }
  if (!next.headStart) { next.headStart = true; unlocked.push('Head Start (+$10 starting cash)'); }
  if (!next.flavors.includes('pink')) { next.flavors.push('pink'); unlocked.push('Pink Lemonade recipe'); }
  if (!next.flavors.includes('mint') && (score >= 350 || next.summers >= 2)) {
    next.flavors.push('mint'); unlocked.push('Mint Cooler recipe');
  }
  return { meta: next, unlocked };
}

export function repLabel(rep: number): string {
  if (rep >= 80) return 'Beloved';
  if (rep >= 60) return 'Popular';
  if (rep >= 40) return 'Known';
  if (rep >= 20) return 'New kid';
  return 'Unknown';
}

export function clampRecipe(v: number, lo: number, hi: number): number {
  return clamp(Math.round(v), lo, hi);
}
