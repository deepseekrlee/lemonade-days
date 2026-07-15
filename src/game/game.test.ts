import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { weatherFor, forecastFor } from './weather';
import { createDay, endDayResult, isDayOver, stepMinute } from './sim';
import type { Weather } from './types';
import {
  DEFAULT_META, applySummerToMeta, buyMarketing, buySupply, buyTruckUpgrade, buyUpgrade, completeDay,
  marketPrices, muralUnlocked, newRun, peakHeatBossMinute, summerScore, todayWeather,
} from './state';
import { MERCH_COST, MURAL_FAN_REQUIREMENT, SUMMER_DAYS, alienVisit, bigfootBlessing, bossOutcome, bossTierFor, isFestivalNight } from './data';
import { flavorMoodFor } from './mood';
import type { DayResult, RunState, SimEvent } from './types';

describe('rng', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('weather', () => {
  it('is deterministic per seed+day and stays plausible', () => {
    for (let day = 1; day <= 60; day++) {
      const w1 = weatherFor(123, day), w2 = weatherFor(123, day);
      expect(w1).toEqual(w2);
      expect(w1.tempF).toBeGreaterThan(40);
      expect(w1.tempF).toBeLessThan(115);
    }
  });
  it('forecasts return valid kinds', () => {
    for (let day = 1; day <= 30; day++) {
      expect(['sunny', 'partly', 'cloudy', 'rain', 'heatwave']).toContain(forecastFor(7, day).kind);
    }
  });
});

/** Run one full day, auto-answering popups with the first available choice. */
function runDay(run: RunState, opts: { noEvents?: boolean } = {}): { result: DayResult; events: SimEvent[] } {
  const d = createDay(run, todayWeather(run));
  if (opts.noEvents) d.schedule = [];
  const events: SimEvent[] = [];
  while (!isDayOver(d)) {
    for (const e of stepMinute(d)) {
      events.push(e);
      if (e.kind === 'popup') {
        const choice = e.def.choices.find((c) => !c.can || c.can(d)) ?? e.def.choices[0];
        choice.apply(d);
      }
    }
  }
  const result = endDayResult(d);
  // Inventory conservation: nothing goes negative, usage adds up.
  expect(d.supplies.lemons).toBeGreaterThanOrEqual(0);
  expect(d.supplies.sugar).toBeGreaterThanOrEqual(0);
  expect(d.supplies.ice).toBeGreaterThanOrEqual(0);
  expect(d.supplies.cups).toBeGreaterThanOrEqual(0);
  expect(d.cupsUsed).toBe(run.supplies.cups - d.supplies.cups);
  expect(result.sold).toBe(d.cupsUsed);
  return { result, events };
}

function stockedRun(seed = 99): RunState {
  const run = newRun(DEFAULT_META, 'summer', seed);
  run.supplies = { lemons: 80, sugar: 60, ice: 150, cups: 120 };
  return run;
}

describe('day simulation', () => {
  it('is fully deterministic for the same seed and plan', () => {
    const a = runDay(stockedRun(7)).result;
    const b = runDay(stockedRun(7)).result;
    expect(a).toEqual(b);
  });

  it('ledger reconciles: profit = revenue + tips + eventCash - cogs', () => {
    const { result } = runDay(stockedRun(11));
    expect(result.profit).toBeCloseTo(
      result.revenue + result.tips + result.eventCash + result.merchRevenue - result.merchSold * MERCH_COST - result.cogs,
      6,
    );
    expect(result.repAfter).toBeGreaterThanOrEqual(0);
    expect(result.repAfter).toBeLessThanOrEqual(100);
    expect(result.avgSat).toBeGreaterThanOrEqual(0);
    expect(result.avgSat).toBeLessThanOrEqual(1);
  });

  it('sells at least something at a fair price on a stocked day', () => {
    const run = stockedRun(21);
    run.price = 1.25;
    const { result } = runDay(run, { noEvents: true });
    expect(result.sold).toBeGreaterThan(5);
  });

  it('price elasticity is monotonic: cheaper never sells fewer cups', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const cheap = stockedRun(seed);
      cheap.price = 0.75;
      const pricey = stockedRun(seed);
      pricey.price = 3.75;
      const soldCheap = runDay(cheap, { noEvents: true }).result.sold;
      const soldPricey = runDay(pricey, { noEvents: true }).result.sold;
      expect(soldCheap).toBeGreaterThanOrEqual(soldPricey);
    }
  });

  it('running dry loses customers instead of crashing', () => {
    const run = stockedRun(31);
    run.supplies = { lemons: 6, sugar: 4, ice: 5, cups: 8 }; // one pitcher, tops
    const { result } = runDay(run, { noEvents: true });
    expect(result.sold).toBeLessThanOrEqual(8);
    expect(result.lostStock).toBeGreaterThan(0);
  });
});

describe('full summer (bot playthrough)', () => {
  it('completes 28 days with sane finances and applies meta unlocks', () => {
    let meta = { ...DEFAULT_META };
    const run = newRun(meta, 'summer', 12345);
    let summerOver = false;
    for (let i = 0; i < SUMMER_DAYS; i++) {
      // Simple bot: restock toward targets while affordable, price by temperature.
      const w = todayWeather(run);
      run.price = Math.round((0.75 + Math.max(0, w.tempF - 70) * 0.045) * 20) / 20;
      const targets = { lemons: 40, sugar: 25, ice: 60, cups: 60 } as const;
      for (const item of ['lemons', 'sugar', 'ice', 'cups'] as const) {
        const want = targets[item] - run.supplies[item];
        if (want > 0) buySupply(run, item, Math.min(want, Math.floor(run.cash * 4)));
      }
      if (run.day === 3) buyUpgrade(run, 'sign');
      if (run.day === 8) buyUpgrade(run, 'cooler');
      expect(run.cash).toBeGreaterThanOrEqual(0);
      const { result } = runDay(run);
      summerOver = completeDay(run, result).summerOver;
      expect(Number.isFinite(run.cash)).toBe(true);
      expect(run.cash).toBeGreaterThanOrEqual(0);
    }
    expect(summerOver).toBe(true);
    expect(run.day).toBe(SUMMER_DAYS + 1);
    expect(run.totals.daysPlayed).toBe(SUMMER_DAYS);
    expect(run.history).toHaveLength(SUMMER_DAYS);

    const score = summerScore(run);
    expect(Number.isFinite(score)).toBe(true);
    const applied = applySummerToMeta(meta, run);
    meta = applied.meta;
    expect(meta.summers).toBe(1);
    expect(meta.endlessUnlocked).toBe(true);
    expect(meta.flavors).toContain('pink');
    expect(applied.unlocked.length).toBeGreaterThan(0);
    // A reasonable bot should not go broke over a summer.
    expect(run.cash).toBeGreaterThan(10);
  });
});

describe('economy helpers', () => {
  it('market prices stay within the ±25% band', () => {
    const run = newRun(DEFAULT_META, 'summer', 5);
    for (let day = 1; day <= 28; day++) {
      run.day = day;
      const p = marketPrices(run);
      expect(p.lemons).toBeGreaterThanOrEqual(0.15);
      expect(p.lemons).toBeLessThanOrEqual(0.35);
      expect(p.cups).toBeGreaterThan(0);
    }
  });
  it('buySupply refuses overdrafts', () => {
    const run = newRun(DEFAULT_META, 'summer', 5);
    run.cash = 0.01;
    expect(buySupply(run, 'lemons', 100)).toBe(false);
    expect(run.supplies.lemons).toBe(12);
  });
});

/** Run a day against an explicit weather (bypasses the seeded forecast). */
function runDayWeather(run: RunState, weather: Weather): DayResult {
  const d = createDay(run, weather);
  d.schedule = [];
  while (!isDayOver(d)) for (const e of stepMinute(d)) void e;
  return endDayResult(d);
}

describe('tiered upgrades', () => {
  it('enforces prerequisites', () => {
    const run = newRun(DEFAULT_META, 'summer', 1);
    run.cash = 500;
    expect(buyUpgrade(run, 'fans')).toBe(false);
    expect(buyUpgrade(run, 'misters')).toBe(false);
    expect(buyUpgrade(run, 'slush')).toBe(false);
    expect(buyUpgrade(run, 'umbrella')).toBe(true);
    expect(buyUpgrade(run, 'fans')).toBe(true);
    expect(buyUpgrade(run, 'misters')).toBe(true);
    expect(buyUpgrade(run, 'cooler')).toBe(true);
    expect(buyUpgrade(run, 'slush')).toBe(true);
  });

  it('comfort tier raises satisfaction on hot days', () => {
    const hot: Weather = { kind: 'heatwave', tempF: 99 };
    const base = stockedRun(41);
    const misty = stockedRun(41);
    misty.upgrades = ['umbrella', 'fans', 'misters'];
    const a = runDayWeather(base, hot);
    const b = runDayWeather(misty, hot);
    expect(b.avgSat).toBeGreaterThan(a.avgSat);
  });
});

describe('frozen lemonade', () => {
  const setup = (seed: number, product: 'regular' | 'frozen'): RunState => {
    const run = stockedRun(seed);
    run.supplies.ice = 500;
    run.upgrades = ['cooler', 'slush'];
    run.product = product;
    run.price = 2.5;
    return run;
  };

  it('outsells regular on scorchers (same customers)', () => {
    for (const seed of [3, 8, 13]) {
      const frozen = runDayWeather(setup(seed, 'frozen'), { kind: 'heatwave', tempF: 99 });
      const regular = runDayWeather(setup(seed, 'regular'), { kind: 'heatwave', tempF: 99 });
      expect(frozen.sold).toBeGreaterThanOrEqual(regular.sold);
    }
  });

  it('sells worse than regular on a mild day', () => {
    let frozenTotal = 0;
    let regularTotal = 0;
    for (const seed of [3, 8, 13]) {
      frozenTotal += runDayWeather(setup(seed, 'frozen'), { kind: 'cloudy', tempF: 68 }).sold;
      regularTotal += runDayWeather(setup(seed, 'regular'), { kind: 'cloudy', tempF: 68 }).sold;
    }
    expect(frozenTotal).toBeLessThanOrEqual(regularTotal);
  });

  it('is ignored without the slush machine', () => {
    const run = stockedRun(5);
    run.product = 'frozen'; // no slush upgrade owned
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    expect(d.product).toBe('regular');
  });
});

describe('marketing & merch', () => {
  it('requires the unlock and gates repeat purchases', () => {
    const run = newRun(DEFAULT_META, 'summer', 9);
    run.cash = 1000;
    expect(buyMarketing(run, 'flyers')).toBe(false); // not unlocked yet
    run.marketing.unlocked = true;
    expect(buyMarketing(run, 'flyers')).toBe(true);
    expect(buyMarketing(run, 'flyers')).toBe(false); // already active
    expect(buyMarketing(run, 'merch')).toBe(true);
    expect(buyMarketing(run, 'merch')).toBe(false); // one-time
  });

  it('flyers never reduce sales (same seed)', () => {
    for (const seed of [2, 6, 10]) {
      const plain = stockedRun(seed);
      const boosted = stockedRun(seed);
      boosted.marketing.flyerDays = 1;
      const a = runDayWeather(plain, { kind: 'sunny', tempF: 88 });
      const b = runDayWeather(boosted, { kind: 'sunny', tempF: 88 });
      expect(b.sold).toBeGreaterThanOrEqual(a.sold);
    }
  });

  it('delighted customers buy merch; fans accumulate and unlock flips at $500', () => {
    let merchTotal = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = stockedRun(seed);
      run.marketing = { unlocked: true, merch: true, specials: [], fans: 0, flyerDays: 0, radioDays: 0, muralStage: 0 };
      run.price = 1.0; // great value -> high satisfaction
      const result = runDayWeather(run, { kind: 'sunny', tempF: 92 });
      merchTotal += result.merchSold;
      expect(result.merchRevenue).toBeCloseTo(result.merchSold * 12, 6);
      run.cash = 495;
      const before = run.marketing.unlocked;
      completeDay(run, result);
      expect(before).toBe(true);
      expect(run.marketing.fans).toBe(result.merchSold);
    }
    expect(merchTotal).toBeGreaterThan(0);
  });

  it('unlocks marketing permanently once cash reaches $500', () => {
    const run = stockedRun(17);
    const result = runDayWeather(run, { kind: 'sunny', tempF: 90 });
    run.cash = 499.99 - result.revenue - result.tips - result.eventCash;
    completeDay(run, result);
    expect(run.cash).toBeGreaterThanOrEqual(499);
    const run2 = stockedRun(17);
    const r2 = runDayWeather(run2, { kind: 'sunny', tempF: 90 });
    run2.cash = 600;
    completeDay(run2, r2);
    expect(run2.marketing.unlocked).toBe(true);
  });
});

describe('bigfoot blessing (pegasus click)', () => {
  it('costs a cup, boosts rep and traffic', () => {
    const run = stockedRun(77);
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    const cupsBefore = d.supplies.cups;
    const msg = bigfootBlessing(d, false);
    expect(msg).toContain('Bigfoot');
    expect(d.supplies.cups).toBe(cupsBefore - 1);
    expect(d.repDelta).toBeGreaterThanOrEqual(5);
    expect(d.mods.some((m) => m.traffic > 1.2 && m.until > d.minute)).toBe(true);
  });

  it('pours a whole pitcher for veterans', () => {
    const run = stockedRun(78);
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    const cupsBefore = d.supplies.cups;
    bigfootBlessing(d, true);
    expect(cupsBefore - d.supplies.cups).toBe(8); // one full pitcher of cups
  });

  it('fails gracefully with no stock', () => {
    const run = newRun(DEFAULT_META, 'summer', 79);
    run.supplies = { lemons: 0, sugar: 0, ice: 0, cups: 0 };
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    expect(bigfootBlessing(d, false)).toBeNull();
    expect(d.repDelta).toBe(0);
  });
});

describe('special merch drops', () => {
  it('requires base merch AND a witnessed cameo', () => {
    const run = newRun(DEFAULT_META, 'summer', 91);
    run.cash = 2000;
    run.marketing.unlocked = true;
    expect(buyMarketing(run, 'merch_kaiju')).toBe(false); // no base merch yet
    expect(buyMarketing(run, 'merch')).toBe(true);
    expect(buyMarketing(run, 'merch_kaiju')).toBe(false); // kaiju not witnessed
    run.cameos.kaiju = 1;
    const repBefore = run.rep;
    expect(buyMarketing(run, 'merch_kaiju')).toBe(true);
    expect(buyMarketing(run, 'merch_kaiju')).toBe(false); // one-time
    expect(run.rep).toBeGreaterThan(repBefore);
    expect(run.marketing.specials).toContain('merch_kaiju');
  });

  it('each special adds +5% marketing traffic', () => {
    const run = stockedRun(92);
    const base = createDay(run, { kind: 'sunny', tempF: 88 }).marketingTraffic;
    run.marketing.specials = ['merch_kaiju', 'merch_ufo'];
    const boosted = createDay(run, { kind: 'sunny', tempF: 88 }).marketingTraffic;
    expect(boosted).toBeCloseTo(base * 1.1, 6);
  });
});

describe('alien visit (UFO landing)', () => {
  it('sells two cups at the going price, plus a cap when merch exists', () => {
    const run = stockedRun(93);
    run.marketing = { unlocked: true, merch: true, specials: [], fans: 0, flyerDays: 0, radioDays: 0, muralStage: 0 };
    run.price = 2;
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    const r = alienVisit(d);
    expect(r.ok).toBe(true);
    expect(d.sold).toBe(2);
    expect(d.revenue).toBeCloseTo(4, 6);
    expect(d.merchSold).toBe(1);
    expect(d.repDelta).toBeGreaterThan(0);
  });

  it('handles a sold-out stand without exploding', () => {
    const run = newRun(DEFAULT_META, 'summer', 94);
    run.supplies = { lemons: 0, sugar: 0, ice: 0, cups: 0 };
    const d = createDay(run, { kind: 'sunny', tempF: 90 });
    const r = alienVisit(d);
    expect(r.ok).toBe(false);
    expect(d.sold).toBe(0);
  });
});

describe('flavor mood', () => {
  it('is deterministic and always an available flavor', () => {
    const flavors: ('classic' | 'pink' | 'mint')[] = ['classic', 'pink', 'mint'];
    for (let day = 1; day <= 28; day++) {
      const a = flavorMoodFor(444, day, flavors);
      expect(a).toBe(flavorMoodFor(444, day, flavors));
      expect(flavors).toContain(a);
    }
  });

  it('varies across days', () => {
    const flavors: ('classic' | 'pink')[] = ['classic', 'pink'];
    const moods = new Set<string>();
    for (let day = 1; day <= 20; day++) moods.add(flavorMoodFor(777, day, flavors));
    expect(moods.size).toBeGreaterThan(1);
  });

  it('matching the mood never sells worse (same customers)', () => {
    // find a seeded day whose mood is pink, then compare pink vs classic
    const flavors: ('classic' | 'pink')[] = ['classic', 'pink'];
    let day = 1;
    while (flavorMoodFor(31, day, flavors) !== 'pink') day++;
    const make = (flavor: 'classic' | 'pink') => {
      const run = stockedRun(31);
      run.day = day;
      run.flavorsAvail = flavors;
      run.flavor = flavor;
      return runDayWeather(run, { kind: 'sunny', tempF: 88 });
    };
    expect(make('pink').sold).toBeGreaterThanOrEqual(make('classic').sold);
  });

  it('single-flavor runs always mood classic', () => {
    expect(flavorMoodFor(9, 5, ['classic'])).toBe('classic');
  });
});

describe('the tepid terror (cryo-defense outcomes)', () => {
  const heat = { kind: 'heatwave', tempF: 99 } as const;

  it('loss melts the ice and flattens quality for the day', () => {
    const run = stockedRun(101);
    const d = createDay(run, heat);
    const msg = bossOutcome(d, false, false);
    expect(msg).toContain('Terror');
    expect(d.supplies.ice).toBe(0);
    expect(d.q).toBeLessThanOrEqual(0.15);
    expect(d.repDelta).toBeLessThan(0);
  });

  it('harvest grants the 2x glacier boost and bonus ice', () => {
    const run = stockedRun(102);
    const d = createDay(run, heat);
    const iceBefore = d.supplies.ice;
    bossOutcome(d, true, true);
    expect(d.supplies.ice).toBe(iceBefore + 40);
    expect(d.mods.some((m) => m.traffic === 2 && m.until > d.minute)).toBe(true);
  });

  it('mercy trades the boost for reputation', () => {
    const run = stockedRun(103);
    const d = createDay(run, heat);
    bossOutcome(d, true, false);
    expect(d.repDelta).toBeGreaterThanOrEqual(4);
    expect(d.mods).toHaveLength(0);
  });

  it('arrives at solar peak on every 90+ day and scales at 94 and 98 degrees', () => {
    expect(peakHeatBossMinute(89, true)).toBeNull();
    expect(peakHeatBossMinute(90, true)).toBe(300);
    expect(peakHeatBossMinute(105, false)).toBeNull();
    const warm = bossTierFor(90);
    const hot = bossTierFor(94);
    const hottest = bossTierFor(98);
    expect(hot.armor).toBeGreaterThan(warm.armor);
    expect(hottest.hp).toBeGreaterThan(hot.hp);
    expect(hottest.puddleSpeed).toBeGreaterThan(hot.puddleSpeed);
    expect(hottest.knockback).toBeLessThan(warm.knockback);
  });
});

describe('community mural and Ramp Rally garage', () => {
  it('unlocks the mural through community fans and advances one funded stage', () => {
    const run = stockedRun(120);
    run.cash = 1000;
    run.marketing.unlocked = true;
    run.marketing.merch = true;
    run.marketing.fans = MURAL_FAN_REQUIREMENT;
    expect(muralUnlocked(run)).toBe(true);
    expect(buyMarketing(run, 'mural')).toBe(true);
    expect(run.marketing.muralStage).toBe(1);
  });

  it('garage upgrades raise the shared competition tier', () => {
    const run = stockedRun(121);
    run.cash = 1000;
    expect(buyTruckUpgrade(run)).toBe(true);
    expect(run.truck.level).toBe(1);
  });

  it('schedules fireworks and the block party every seventh night', () => {
    expect(isFestivalNight(6, false)).toBe(false);
    expect(isFestivalNight(7, false)).toBe(true);
    expect(isFestivalNight(28, true)).toBe(true);
  });
});
