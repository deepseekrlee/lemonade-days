import type { RNG } from './rng';

export type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'rain' | 'heatwave';
export interface Weather { kind: WeatherKind; tempF: number; }

export type FlavorId = 'classic' | 'pink' | 'mint';
export type ProductId = 'regular' | 'frozen';
export type UpgradeId =
  | 'sign' | 'cooler' | 'radio' | 'umbrella' | 'juicer' | 'pitcher' | 'lights'
  | 'fans' | 'misters' | 'slush';
export type GameMode = 'summer' | 'endless';
export type MarketingAction = 'flyers' | 'radiospot' | 'merch' | 'merch_kaiju' | 'merch_ufo' | 'merch_pegasus' | 'mural';
export type CameoId = 'kaiju' | 'ufo' | 'pegasus';

/** Per-pitcher lemons/sugar, per-cup ice. */
export interface Recipe { lemons: number; sugar: number; icePerCup: number; }
export interface Supplies { lemons: number; sugar: number; ice: number; cups: number; }

export interface MarketingState {
  /** Sticky: once cash touches $500, marketing stays available. */
  unlocked: boolean;
  merch: boolean;
  /** Special-edition drops (unlocked by witnessing rare cameos). */
  specials: MarketingAction[];
  /** People who own your caps/tees. Permanent traffic + rep + score. */
  fans: number;
  flyerDays: number;
  radioDays: number;
  /** Five player-and-community funded stages painted across the skyline. */
  muralStage: number;
}

export interface TruckState {
  /** Garage tier, 0..3. The rival scales with it, so skill still decides rallies. */
  level: number;
  bestJump: number;
  wins: number;
}

export interface RunState {
  seed: number;
  mode: GameMode;
  day: number;
  cash: number;
  rep: number; // 0..100 neighborhood reputation
  supplies: Supplies;
  upgrades: UpgradeId[];
  flavor: FlavorId;
  product: ProductId;
  recipe: Recipe;
  price: number;
  marketing: MarketingState;
  truck: TruckState;
  /** How many times each rare visitor has been spotted this run. */
  cameos: Record<CameoId, number>;
  /** Flavors that existed when this run started (mood pool). */
  flavorsAvail: FlavorId[];
  /** Today's divined crowd favorite, if a lawn game revealed it. */
  hint: { day: number; flavor: FlavorId } | null;
  /** Tepid Terror encounters so far this run (first heatwave always triggers one). */
  bossFights: number;
  totals: { sold: number; revenue: number; tips: number; profit: number; bestDay: number; daysPlayed: number };
  history: { day: number; sold: number; profit: number; grade: string }[];
}

export interface MetaState {
  bestScore: number;
  summers: number;
  endlessUnlocked: boolean;
  flavors: FlavorId[];
  headStart: boolean;
  /** Super Showdown toggle: the heatwave boss event (revert-friendly). */
  boss: boolean;
  audio: { music: boolean; sfx: boolean };
}

export interface DayResult {
  day: number;
  weather: Weather;
  sold: number;
  revenue: number;
  tips: number;
  eventCash: number;
  merchSold: number;
  merchRevenue: number; // gross; net = merchRevenue - merchSold * MERCH_COST
  cogs: number;
  profit: number;
  lostStock: number;
  lostPrice: number;
  walkbys: number;
  avgSat: number;
  repBefore: number;
  repAfter: number;
  grade: string;
  notes: string[];
}

export interface Mod { until: number; traffic: number; price: number; }

export interface GameEventDef {
  id: string;
  icon: string;
  title: string;
  text: string;
  when: (d: DayRuntime) => boolean;
  choices: {
    label: string;
    hint?: string;
    can?: (d: DayRuntime) => boolean;
    apply: (d: DayRuntime) => string;
  }[];
}

export interface DayRuntime {
  daySeed: number;
  rng: RNG;
  minute: number;
  weather: Weather;
  price: number;
  recipe: Recipe;
  flavor: FlavorId;
  product: ProductId;
  /** Today's secret crowd-favorite flavor. */
  mood: FlavorId;
  q: number;
  supplies: Supplies;
  upgrades: UpgradeId[];
  rep: number;
  /** Traffic multiplier from flyers/radio/fans, fixed for the day. */
  marketingTraffic: number;
  merch: boolean;
  /** Bonus merch-purchase probability from special drops. */
  merchChance: number;
  merchSold: number;
  merchRevenue: number;
  pitcherLeft: number;
  sold: number;
  revenue: number;
  tips: number;
  cashDelta: number;
  lemonsUsed: number;
  sugarUsed: number;
  iceUsed: number;
  cupsUsed: number;
  lostStock: number;
  lostPrice: number;
  walkbys: number;
  satSum: number;
  satN: number;
  repDelta: number;
  mods: Mod[];
  schedule: { minute: number; defId: string }[];
  priceChanges: number;
}

export type SimEvent =
  | { kind: 'arrive'; minute: number; outcome: 'bought' | 'pricey' | 'walkby' | 'stockout'; paid: number; tip: number; sat: number; warm: boolean; merch: boolean }
  | { kind: 'mix'; minute: number }
  | { kind: 'popup'; minute: number; def: GameEventDef }
  | { kind: 'note'; minute: number; text: string };
