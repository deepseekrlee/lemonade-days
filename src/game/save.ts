import { DEFAULT_META } from './state';
import type { MetaState, RunState } from './types';

const KEY = 'lemonade-days-codex.save.v2';
const LEGACY_KEY = 'lemonade-days.save.v1';

export interface SaveFile { version: 1; meta: MetaState; run: RunState | null; }

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function normalizeMeta(raw: unknown): MetaState {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const audio = (typeof r.audio === 'object' && r.audio !== null ? r.audio : {}) as Record<string, unknown>;
  const flavors = Array.isArray(r.flavors) ? r.flavors.filter((f): f is MetaState['flavors'][number] => f === 'classic' || f === 'pink' || f === 'mint') : [];
  return {
    bestScore: num(r.bestScore, 0),
    summers: num(r.summers, 0),
    endlessUnlocked: r.endlessUnlocked === true,
    flavors: flavors.length ? flavors : ['classic'],
    headStart: r.headStart === true,
    boss: r.boss !== false,
    audio: { music: audio.music !== false, sfx: audio.sfx !== false },
  };
}

function normalizeRun(raw: unknown): RunState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as RunState;
  // Trust shape loosely but verify the load-bearing numbers.
  if (!Number.isFinite(r.seed) || !Number.isFinite(r.day) || !Number.isFinite(r.cash)) return null;
  if (r.mode !== 'summer' && r.mode !== 'endless') return null;
  if (!r.supplies || !r.recipe || !Array.isArray(r.upgrades) || !r.totals) return null;
  // v0.1 saves predate product + marketing — fill safe defaults.
  const partial = r as Partial<RunState>;
  const mkt = (typeof partial.marketing === 'object' && partial.marketing !== null ? partial.marketing : {}) as Partial<RunState['marketing']>;
  const cameos = (typeof partial.cameos === 'object' && partial.cameos !== null ? partial.cameos : {}) as Partial<RunState['cameos']>;
  return {
    ...r,
    product: partial.product === 'frozen' ? 'frozen' : 'regular',
    marketing: {
      unlocked: mkt.unlocked === true,
      merch: mkt.merch === true,
      specials: Array.isArray(mkt.specials)
        ? mkt.specials.filter((v): v is RunState['marketing']['specials'][number] =>
            v === 'merch_kaiju' || v === 'merch_ufo' || v === 'merch_pegasus')
        : [],
      fans: num(mkt.fans, 0),
      flyerDays: num(mkt.flyerDays, 0),
      radioDays: num(mkt.radioDays, 0),
      muralStage: Math.max(0, Math.min(5, Math.floor(num(mkt.muralStage, 0)))),
    },
    truck: {
      level: Math.max(0, Math.min(3, Math.floor(num(partial.truck?.level, 0)))),
      bestJump: Math.max(0, num(partial.truck?.bestJump, 0)),
      wins: Math.max(0, Math.floor(num(partial.truck?.wins, 0))),
    },
    cameos: { kaiju: num(cameos.kaiju, 0), ufo: num(cameos.ufo, 0), pegasus: num(cameos.pegasus, 0) },
    flavorsAvail: Array.isArray(partial.flavorsAvail) && partial.flavorsAvail.length
      ? partial.flavorsAvail.filter((f): f is RunState['flavorsAvail'][number] => f === 'classic' || f === 'pink' || f === 'mint')
      : ['classic'],
    hint: (typeof partial.hint === 'object' && partial.hint !== null && Number.isFinite((partial.hint as { day?: number }).day))
      ? (partial.hint as RunState['hint'])
      : null,
    bossFights: num(partial.bossFights, 0),
  };
}

export function loadSave(): SaveFile {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return { version: 1, meta: { ...DEFAULT_META }, run: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { version: 1, meta: normalizeMeta(parsed.meta), run: normalizeRun(parsed.run) };
  } catch {
    return { version: 1, meta: { ...DEFAULT_META }, run: null };
  }
}

export function writeSave(save: SaveFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage full or blocked — game keeps working, just won't persist */
  }
}

export const exportSave = (save: SaveFile): string => JSON.stringify({ app: 'lemonade-days', ...save }, null, 2);

export function importSave(text: string): SaveFile {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  const p = parsed as Record<string, unknown>;
  if (typeof parsed !== 'object' || parsed === null || p.app !== 'lemonade-days') {
    throw new Error('That does not look like a Lemonade Days save.');
  }
  return { version: 1, meta: normalizeMeta(p.meta), run: normalizeRun(p.run) };
}
