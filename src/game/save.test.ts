import { describe, expect, it } from 'vitest';
import { exportSave, importSave } from './save';
import { DEFAULT_META, newRun } from './state';

describe('save import/export', () => {
  it('round-trips a save file', () => {
    const run = newRun(DEFAULT_META, 'summer', 777);
    const save = { version: 1 as const, meta: { ...DEFAULT_META, summers: 2 }, run };
    const restored = importSave(exportSave(save));
    expect(restored.meta.summers).toBe(2);
    expect(restored.run?.seed).toBe(777);
    expect(restored.run?.supplies.lemons).toBe(12);
  });
  it('rejects foreign JSON', () => {
    expect(() => importSave('{"foo":1}')).toThrow('Lemonade Days');
    expect(() => importSave('not json')).toThrow('valid JSON');
  });
  it('drops corrupt runs but keeps meta', () => {
    const restored = importSave(JSON.stringify({ app: 'lemonade-days', meta: { summers: 3 }, run: { seed: 'bad' } }));
    expect(restored.meta.summers).toBe(3);
    expect(restored.run).toBeNull();
  });
});

describe('v0.1 save migration', () => {
  it('fills product and marketing defaults on old runs', () => {
    const oldRun = {
      seed: 42, mode: 'summer', day: 9, cash: 88.5, rep: 55,
      supplies: { lemons: 10, sugar: 5, ice: 12, cups: 20 },
      upgrades: ['sign', 'cooler'], flavor: 'pink',
      recipe: { lemons: 6, sugar: 4, icePerCup: 1 }, price: 1.75,
      totals: { sold: 100, revenue: 150, tips: 10, profit: 90, bestDay: 20, daysPlayed: 8 },
      history: [],
    };
    const restored = importSave(JSON.stringify({ app: 'lemonade-days', meta: {}, run: oldRun }));
    expect(restored.run?.product).toBe('regular');
    expect(restored.run?.marketing).toEqual({ unlocked: false, merch: false, specials: [], fans: 0, flyerDays: 0, radioDays: 0, muralStage: 0 });
    expect(restored.run?.truck).toEqual({ level: 0, bestJump: 0, wins: 0 });
    expect(restored.run?.cameos).toEqual({ kaiju: 0, ufo: 0, pegasus: 0 });
    expect(restored.run?.cash).toBe(88.5);
  });
});
