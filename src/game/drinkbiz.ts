import { MERCH_COST } from './data';
import type { DayResult, DayRuntime, RunState } from './types';

export interface DrinkBizPracticeDayExport {
  format: 'drinkbiz.practice-day';
  schemaVersion: 1;
  exportId: string;
  exportedAt: string;
  source: {
    app: 'lemonade-days';
    saveVersion: 1;
    runId: string;
    mode: RunState['mode'];
    day: number;
  };
  business: { profileType: 'practice'; name: string };
  context: {
    weather: DayResult['weather'];
    flavor: DayRuntime['flavor'];
    product: DayRuntime['product'];
    basePriceCents: number;
    recipe: { lemonsPerPitcher: number; sugarPerPitcher: number; icePerCup: number };
    upgrades: string[];
  };
  sales: {
    unitsServed: number;
    beverageRevenueCents: number;
    tipsCents: number;
    merchandiseUnits: number;
    merchandiseRevenueCents: number;
  };
  inventoryUsage: { lemons: number; sugar: number; ice: number; cups: number };
  costs: {
    costingMethod: 'game-standard-cost';
    beverageCogsCents: number;
    merchandiseCogsCents: number;
    eventNetCashCents: number;
  };
  results: {
    profitCents: number;
    grade: string;
    averageSatisfaction: number;
    reputationBefore: number;
    reputationAfter: number;
    missedForPrice: number;
    missedForStock: number;
    walkbys: number;
    notes: string[];
  };
}

const toCents = (amount: number): number => Math.round(amount * 100);

/**
 * Build a stable, intentionally small bridge format for DrinkBiz.
 * This is a practice operating summary using the game's standard costs; it is
 * not a reconstruction of the player's complete cash ledger.
 */
export function buildDrinkBizPracticeDay(
  run: RunState,
  day: DayRuntime,
  result: DayResult,
  exportedAt = new Date().toISOString(),
): DrinkBizPracticeDayExport {
  const dayNumber = run.day;
  return {
    format: 'drinkbiz.practice-day',
    schemaVersion: 1,
    exportId: `lemonade-days:${run.seed}:${run.mode}:${dayNumber}`,
    exportedAt,
    source: {
      app: 'lemonade-days',
      saveVersion: 1,
      runId: String(run.seed),
      mode: run.mode,
      day: dayNumber,
    },
    business: { profileType: 'practice', name: 'Lemonade Days Practice Stand' },
    context: {
      weather: { ...result.weather },
      flavor: day.flavor,
      product: day.product,
      basePriceCents: toCents(day.price),
      recipe: {
        lemonsPerPitcher: day.recipe.lemons,
        sugarPerPitcher: day.recipe.sugar,
        icePerCup: day.recipe.icePerCup,
      },
      upgrades: [...day.upgrades],
    },
    sales: {
      unitsServed: result.sold,
      beverageRevenueCents: toCents(result.revenue),
      tipsCents: toCents(result.tips),
      merchandiseUnits: result.merchSold,
      merchandiseRevenueCents: toCents(result.merchRevenue),
    },
    inventoryUsage: {
      lemons: day.lemonsUsed,
      sugar: day.sugarUsed,
      ice: day.iceUsed,
      cups: day.cupsUsed,
    },
    costs: {
      costingMethod: 'game-standard-cost',
      beverageCogsCents: toCents(result.cogs),
      merchandiseCogsCents: toCents(result.merchSold * MERCH_COST),
      eventNetCashCents: toCents(result.eventCash),
    },
    results: {
      profitCents: toCents(result.profit),
      grade: result.grade,
      averageSatisfaction: result.avgSat,
      reputationBefore: result.repBefore,
      reputationAfter: result.repAfter,
      missedForPrice: result.lostPrice,
      missedForStock: result.lostStock,
      walkbys: result.walkbys,
      notes: [...result.notes],
    },
  };
}

export function exportDrinkBizPracticeDay(payload: DrinkBizPracticeDayExport): string {
  return JSON.stringify(payload, null, 2);
}
