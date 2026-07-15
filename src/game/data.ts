import { cents, chance, clamp } from './rng';
import type { CameoId, DayRuntime, FlavorId, GameEventDef, MarketingAction, Recipe, UpgradeId } from './types';

export const DAY_MINUTES = 600; // 9:00 -> 19:00
export const SUMMER_DAYS = 28;
export const START_CASH = 20;
export const START_REP = 30;
export const MAX_PRICE = 5;
export const MERCH_PRICE = 12;
export const MERCH_COST = 5;
export const MARKETING_UNLOCK_CASH = 500;
export const MURAL_FAN_REQUIREMENT = 15;
export const MURAL_STAGE_COSTS = [90, 125, 165, 215, 275] as const;

export interface TruckUpgradeDef { level: number; name: string; desc: string; cost: number; }
export const TRUCK_UPGRADES: TruckUpgradeDef[] = [
  { level: 1, name: 'Peel-Tread Tires', desc: 'More grip and faster engine cooling. The ice cream rival adds waffle-tread tires too.', cost: 65 },
  { level: 2, name: 'Citrus Supercharger', desc: 'A higher speed ceiling and a wider sweet spot. The rival tunes up to match.', cost: 130 },
  { level: 3, name: 'Zest-Jet Boosters', desc: 'Lemon-shaped rockets raise the jump ceiling. The rival bolts on ice-cream-cone rockets.', cost: 240 },
];

export interface BossTier {
  tier: 1 | 2 | 3;
  name: string;
  armor: number;
  hp: number;
  suitSpeed: number;
  puddleSpeed: number;
  knockback: number;
}

/** Tepid Terror difficulty scales at the exact heat thresholds shown to players. */
export function bossTierFor(tempF: number): BossTier {
  if (tempF >= 98) return { tier: 3, name: 'BOILING MAD', armor: 10, hp: 9, suitSpeed: 20, puddleSpeed: 35, knockback: 25 };
  if (tempF >= 94) return { tier: 2, name: 'MUSCLE MELT', armor: 8, hp: 7, suitSpeed: 17, puddleSpeed: 30, knockback: 31 };
  return { tier: 1, name: 'STEAMY', armor: 6, hp: 5, suitSpeed: 14, puddleSpeed: 25, knockback: 38 };
}

export function isFestivalNight(day: number, summerOver: boolean): boolean {
  return day % 7 === 0 || summerOver;
}

export interface MarketingDef { id: MarketingAction; name: string; desc: string; cost: number; icon: string; cameo?: CameoId; hint?: string; }
export const MARKETING: MarketingDef[] = [
  { id: 'flyers', name: 'Flyer Run', desc: '+25% foot traffic today.', cost: 20, icon: '📄' },
  { id: 'radiospot', name: 'Radio Spot', desc: '+15% foot traffic for 3 days.', cost: 75, icon: '📻' },
  { id: 'merch', name: 'Merch Drop', desc: 'One-time. Delighted customers buy caps & tees ($%MP each). Every fan wearing your merch permanently boosts traffic, rep, and score.'.replace('%MP', String(MERCH_PRICE)), cost: 150, icon: '🧢' },
];

/** Special-edition drops. Each unlocks after you SPOT the visitor in question. */
export const SPECIAL_MERCH: MarketingDef[] = [
  { id: 'merch_kaiju', name: 'Kaiju Collab Tee', icon: '🦖', cost: 250, cameo: 'kaiju', hint: 'Spot the enormous regular first…', desc: 'Limited run. Dropping it delights the neighborhood: +4 rep now, +5% traffic forever. Fans may rock kaiju-teal caps.' },
  { id: 'merch_ufo', name: 'UFO Tour Cap', icon: '🛸', cost: 300, cameo: 'ufo', hint: 'Serve some out-of-town visitors first…', desc: 'Five stars across the galaxy: +4 rep now, +5% traffic forever. Fans may rock saucer-purple caps.' },
  { id: 'merch_pegasus', name: 'Sky Legend Snapback', icon: '🦄', cost: 400, cameo: 'pegasus', hint: 'Catch the flying legend first…', desc: 'The rarest drop of all: +4 rep now, +5% traffic forever. Fans may rock legend-pink caps.' },
];

/** Standard unit costs; daily market prices wobble around these. */
export const COSTS = { lemons: 0.25, sugar: 0.15, ice: 0.08, cups: 0.05 } as const;
export const IDEAL = { lemons: 6, sugar: 4 } as const;

export function cupsPerPitcher(upgrades: UpgradeId[]): number {
  return upgrades.includes('pitcher') ? 12 : 8;
}

export function lemonsPerPitcher(recipe: Recipe, upgrades: UpgradeId[]): number {
  return Math.max(2, recipe.lemons - (upgrades.includes('juicer') ? 1 : 0));
}

/** Recipe quality 0..1 — how good the lemonade actually is. */
export function recipeQuality(recipe: Recipe, flavor: FlavorId, tempF: number): number {
  const strength = clamp(1 - Math.abs(recipe.lemons - IDEAL.lemons) / IDEAL.lemons, 0, 1);
  const sweet = clamp(1 - Math.abs(recipe.sugar - IDEAL.sugar) / IDEAL.sugar, 0, 1);
  let q = 0.55 * strength + 0.45 * sweet;
  if (flavor === 'pink') q += 0.04;
  if (flavor === 'mint') q += tempF >= 88 ? 0.1 : -0.03;
  return clamp(q, 0, 1);
}

export interface UpgradeDef { id: UpgradeId; name: string; desc: string; cost: number; icon: string; requires?: UpgradeId; }

export const UPGRADES: UpgradeDef[] = [
  { id: 'sign', name: 'Hand-painted Sign', desc: 'More passers-by notice the stand.', cost: 12, icon: '🪧' },
  { id: 'cooler', name: 'Ice Cooler', desc: 'Only 25% of ice melts overnight (instead of half).', cost: 18, icon: '🧊' },
  { id: 'radio', name: 'Tape-deck Radio', desc: 'Chill tunes. People linger and stop more.', cost: 22, icon: '📻' },
  { id: 'umbrella', name: 'Big Umbrella', desc: 'Shade + shelter. Softens rain days, unlocks a rainy-day move.', cost: 25, icon: '⛱️' },
  { id: 'juicer', name: 'Hand Juicer', desc: 'Squeeze more from less: every pitcher uses 1 fewer lemon.', cost: 30, icon: '🍋' },
  { id: 'pitcher', name: 'Party Pitcher', desc: 'Pitchers pour 12 cups instead of 8.', cost: 35, icon: '🫗' },
  { id: 'lights', name: 'Fairy Lights', desc: 'Cozy glow. Evening customers stop way more often.', cost: 40, icon: '✨' },
  { id: 'fans', name: 'Clip-on Fans', desc: 'Tier 2 of the umbrella. A breeze on 90°+ days: happier customers, more heat-day traffic.', cost: 45, icon: '🌀', requires: 'umbrella' },
  { id: 'misters', name: 'Misting Rig', desc: 'Tier 3. Maximum cooling — scorchers become your best days.', cost: 80, icon: '💦', requires: 'fans' },
  { id: 'slush', name: 'Slush Machine', desc: 'Tier 2 of the cooler. Unlocks FROZEN lemonade: premium on 90°+ days, a flop below 80°, drinks double ice.', cost: 60, icon: '🍧', requires: 'cooler' },
];

export const FLAVORS: Record<FlavorId, { name: string; desc: string; icon: string }> = {
  classic: { name: 'Classic', desc: 'The one and only.', icon: '🍋' },
  pink: { name: 'Pink Lemonade', desc: 'A little fancy. Slightly better vibes all around.', icon: '🌸' },
  mint: { name: 'Mint Cooler', desc: 'Shines on scorching days, a bit odd on mild ones.', icon: '🌿' },
};

export function gradeFor(profit: number): string {
  if (profit >= 40) return 'S';
  if (profit >= 25) return 'A';
  if (profit >= 12) return 'B';
  if (profit >= 4) return 'C';
  return 'D';
}

export function scoreGrade(score: number): string {
  if (score >= 500) return 'S';
  if (score >= 380) return 'A';
  if (score >= 260) return 'B';
  if (score >= 160) return 'C';
  return 'D';
}

// --- Day-event helpers (used by event effects) ---

/** Serve up to n cups immediately (bulk orders, comped cups). Returns cups actually served. */
export function serveBulk(d: DayRuntime, n: number, priceEach: number, sat: number): number {
  let served = 0;
  const perPitcher = cupsPerPitcher(d.upgrades);
  const lemonsNeed = lemonsPerPitcher(d.recipe, d.upgrades);
  for (let i = 0; i < n; i++) {
    if (d.supplies.cups <= 0) break;
    if (d.pitcherLeft <= 0) {
      if (d.supplies.lemons >= lemonsNeed && d.supplies.sugar >= d.recipe.sugar) {
        d.supplies.lemons -= lemonsNeed;
        d.supplies.sugar -= d.recipe.sugar;
        d.lemonsUsed += lemonsNeed;
        d.sugarUsed += d.recipe.sugar;
        d.pitcherLeft = perPitcher;
      } else break;
    }
    d.pitcherLeft--;
    d.supplies.cups--;
    d.cupsUsed++;
    const ice = Math.min(d.recipe.icePerCup, d.supplies.ice);
    d.supplies.ice -= ice;
    d.iceUsed += ice;
    d.sold++;
    d.revenue += priceEach;
    d.satSum += sat;
    d.satN++;
    served++;
  }
  return served;
}

/**
 * The player clicked the flying pegasus and handed Bigfoot a drink.
 * Costs real stock (a cup — or a whole pitcher for veteran players),
 * blesses the stand with reputation and a traffic surge.
 */
export function bigfootBlessing(d: DayRuntime, generous: boolean): string | null {
  const cups = generous ? cupsPerPitcher(d.upgrades) : 1;
  const served = serveBulk(d, cups, 0, 1);
  if (served === 0) return null;
  d.mods.push({ until: d.minute + 150, traffic: generous ? 1.4 : 1.3, price: 1 });
  d.repDelta += generous ? 8 : 5;
  return generous
    ? 'Bigfoot chugs the whole pitcher mid-flight. The neighborhood is BUZZING.'
    : 'Bigfoot sips gratefully from the sky. Word spreads fast.';
}

/** Two aliens waddle up from the landed saucer and buy, at full price. */
export function alienVisit(d: DayRuntime): { ok: boolean; text: string } {
  const price = priceNowOf(d);
  const served = serveBulk(d, 2, price, 0.95);
  if (served === 0) return { ok: false, text: 'The aliens found you sold out. They filed a polite complaint.' };
  let text = `Two aliens bought ${served} cup${served > 1 ? 's' : ''} of lemonade. Interstellar money is still money.`;
  if (d.merch) {
    d.merchSold++;
    d.merchRevenue += MERCH_PRICE;
    text = 'The aliens bought lemonade AND a cap. Your brand is now interplanetary.';
  }
  d.repDelta += 2;
  return { ok: true, text };
}

/**
 * Cryo-Defense aftermath (The Tepid Terror).
 * Loss: Rapid Thaw melts all ice and The Flatline crushes quality for the
 * rest of the day (floored, not zeroed — kids get a rough day, not a dead one).
 * Win + harvest: GLACIER BOOST — 2x foot traffic for 90 minutes and +40 ice.
 * Win + mercy: the crowd notices. Reputation blooms.
 */
export function bossOutcome(d: DayRuntime, won: boolean, harvest: boolean): string {
  if (!won) {
    d.supplies.ice = 0;
    d.q = Math.min(d.q, 0.15);
    d.repDelta -= 2;
    return 'The Tepid Terror thawed everything. Lukewarm, flat lemonade… all day long.';
  }
  if (harvest) {
    d.mods.push({ until: d.minute + 90, traffic: 2, price: 1 });
    d.supplies.ice += 40;
    d.repDelta += 2;
    return 'GLACIER BOOST! You harvested the frozen terror: +40 ice and the whole block wants a frosty cup!';
  }
  d.repDelta += 4;
  return 'You let him drip away to fight another day. The crowd respects your mercy.';
}

const mod = (d: DayRuntime, mins: number, traffic: number, price = 1) =>
  d.mods.push({ until: d.minute + mins, traffic, price });

export const EVENTS: GameEventDef[] = [
  {
    id: 'truck', icon: '🍦', title: 'Ice Cream Truck',
    text: 'A jingling ice cream truck parks across the street. The crowd is drifting toward it.',
    when: (d) => d.weather.kind === 'sunny' || d.weather.kind === 'heatwave',
    choices: [
      { label: 'Undercut it', hint: '-25% price for 2h, more traffic', apply: (d) => { mod(d, 120, 1.25, 0.75); return 'You slash prices. The crowd swings back your way.'; } },
      { label: 'Hold the line', hint: 'Lose some traffic, keep your dignity', apply: (d) => { mod(d, 90, 0.85); d.repDelta += 1; return 'You wave at the truck driver. Respect.'; } },
    ],
  },
  {
    id: 'shower', icon: '🌦️', title: 'Surprise Shower',
    text: 'Fat summer raindrops start plopping onto the sidewalk out of nowhere.',
    when: (d) => d.weather.kind === 'partly' || d.weather.kind === 'cloudy',
    choices: [
      { label: 'Keep selling', hint: 'Traffic drops for an hour', apply: (d) => { mod(d, 60, 0.5); return 'You sell on through the drizzle.'; } },
      { label: 'Shelter folks under the umbrella', hint: 'Needs Big Umbrella · +rep', can: (d) => d.upgrades.includes('umbrella'), apply: (d) => { mod(d, 60, 0.85); d.repDelta += 3; return 'Strangers huddle under your umbrella. New friends.'; } },
      { label: 'Take a zen break', hint: 'Basically pause sales for ~50 min', apply: (d) => { mod(d, 50, 0.05); return 'You watch the rain. It is honestly pretty nice.'; } },
    ],
  },
  {
    id: 'busker', icon: '🎸', title: 'Busker Ben',
    text: 'A guitarist sets up nearby and starts playing something warm and lazy.',
    when: (d) => d.minute < 420,
    choices: [
      { label: 'Tip him $4 to stay', hint: 'Big traffic boost for 2.5h', apply: (d) => { d.cashDelta -= 4; mod(d, 150, 1.25); return 'Ben nods and settles in. The corner feels alive.'; } },
      { label: 'Just enjoy the music', hint: 'Small short boost', apply: (d) => { mod(d, 40, 1.05); return 'A few songs later, he wanders off.'; } },
    ],
  },
  {
    id: 'dog', icon: '🐕', title: 'Golden Retriever Incident',
    text: 'A very good dog crashes into the table. The current pitcher goes flying.',
    when: (d) => d.pitcherLeft > 0,
    choices: [
      { label: 'Laugh it off, pour him water', hint: 'Lose the pitcher · +rep', apply: (d) => { d.pitcherLeft = 0; d.repDelta += 2; return 'The dog is thrilled. Onlookers are charmed.'; } },
      { label: 'Shoo! Save the pitcher!', hint: 'Keep the pitcher · -rep', apply: (d) => { d.repDelta -= 2; return 'You catch it mid-air. The dog looks betrayed. So do the onlookers.'; } },
    ],
  },
  {
    id: 'influencer', icon: '🤳', title: 'Local Foodie Stops By',
    text: '"Okay this is cute. Mind if I film a taste test for my followers?"',
    when: (d) => d.q >= 0.65,
    choices: [
      { label: 'Comp her a cup', hint: 'Guaranteed feature if you can pour one', apply: (d) => { const ok = serveBulk(d, 1, 0, 0.9) === 1; if (!ok) { d.repDelta -= 1; return 'You are out of lemonade. Awkward.'; } mod(d, 90, 1.5); d.repDelta += 4; return 'She loves it. Your corner starts buzzing.'; } },
      { label: 'Play it cool', hint: 'She might film anyway', apply: (d) => { if (chance(d.rng, 0.5)) { mod(d, 60, 1.25); return 'She films anyway and vibes with it.'; } d.repDelta -= 1; return 'She shrugs and moves on.'; } },
    ],
  },
  {
    id: 'heatspike', icon: '🥵', title: 'Afternoon Scorcher',
    text: 'The temperature lurches upward. People are visibly wilting.',
    when: (d) => d.weather.tempF >= 93,
    choices: [
      { label: 'Surge pricing (+40% for 2h)', hint: 'Money now, goodwill later', apply: (d) => { mod(d, 120, 1, 1.4); d.repDelta -= 4; return 'You raise prices. People pay it... and remember it.'; } },
      { label: 'Keep prices fair', hint: '+rep', apply: (d) => { d.repDelta += 4; return 'Word spreads that your stand plays fair.'; } },
    ],
  },
  {
    id: 'bigorder', icon: '📦', title: 'Office Big Order',
    text: 'Someone from the office down the block wants 12 cups for a meeting — at a 20% bulk discount.',
    when: (d) => d.minute < 480,
    choices: [
      { label: 'Take the order', hint: 'Instant bulk sale if you have stock', apply: (d) => { const price = cents(priceNowOf(d) * 0.8); const n = serveBulk(d, 12, price, 0.7); return n > 0 ? `You pour ${n} cups. Easy money.` : 'You are out of stock. They order pizza instead.'; } },
      { label: 'Decline', hint: 'Save stock for the street', apply: () => 'You keep your stock for the regulars.' },
    ],
  },
  {
    id: 'rival', icon: '🧒', title: 'Rival Kid',
    text: 'A kid sets up a competing stand two doors down. Cardboard sign. Fierce eyes.',
    when: (d) => d.minute < 420,
    choices: [
      { label: 'Price war', hint: '-30% price, +20% traffic for 2h', apply: (d) => { mod(d, 120, 1.2, 0.7); return 'Prices drop on both stands. The neighborhood wins.'; } },
      { label: 'Team up', hint: 'Split the corner · +rep', apply: (d) => { mod(d, 120, 1.15); d.repDelta += 3; return 'You form a lemonade cartel. Adorable and effective.'; } },
    ],
  },
];

/** Current effective price including active modifiers. */
export function priceNowOf(d: DayRuntime): number {
  let p = d.price;
  for (const m of d.mods) if (m.until > d.minute) p *= m.price;
  return cents(clamp(p, 0.25, MAX_PRICE * 1.5));
}

export function trafficMultOf(d: DayRuntime): number {
  let t = 1;
  for (const m of d.mods) if (m.until > d.minute) t *= m.traffic;
  return t;
}
