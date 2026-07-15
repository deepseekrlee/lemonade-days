import { describe, expect, it } from 'vitest';
import { buildDrinkBizPracticeDay } from './drinkbiz';
import type { DayResult, DayRuntime, RunState } from './types';

describe('DrinkBiz practice-day bridge', () => {
  it('exports deterministic identity and integer-cent accounting fields', () => {
    const run = { seed: 384729103, mode: 'summer', day: 7 } as RunState;
    const day = {
      price: 2,
      recipe: { lemons: 6, sugar: 4, icePerCup: 2 },
      flavor: 'classic',
      product: 'frozen',
      upgrades: ['cooler', 'slush'],
      lemonsUsed: 24,
      sugarUsed: 16,
      iceUsed: 62,
      cupsUsed: 31,
    } as DayRuntime;
    const result = {
      weather: { kind: 'heatwave', tempF: 96 },
      sold: 31,
      revenue: 62,
      tips: 4.5,
      eventCash: -4,
      merchSold: 2,
      merchRevenue: 24,
      cogs: 12.61,
      profit: 63.89,
      lostStock: 2,
      lostPrice: 3,
      walkbys: 14,
      avgSat: 0.86,
      repBefore: 55,
      repAfter: 59,
      grade: 'S',
      notes: ['Great day'],
    } as DayResult;

    const payload = buildDrinkBizPracticeDay(run, day, result, '2026-07-15T00:00:00.000Z');

    expect(payload.exportId).toBe('lemonade-days:384729103:summer:7');
    expect(payload.sales.beverageRevenueCents).toBe(6200);
    expect(payload.sales.tipsCents).toBe(450);
    expect(payload.costs.beverageCogsCents).toBe(1261);
    expect(payload.costs.merchandiseCogsCents).toBe(1000);
    expect(payload.costs.eventNetCashCents).toBe(-400);
    expect(payload.results.profitCents).toBe(6389);
    expect(payload.inventoryUsage.cups).toBe(31);
  });
});
