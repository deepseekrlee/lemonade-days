import {
  COSTS, FLAVORS, MARKETING, MARKETING_UNLOCK_CASH, MERCH_COST, MURAL_FAN_REQUIREMENT, MURAL_STAGE_COSTS,
  SPECIAL_MERCH, SUMMER_DAYS, TRUCK_UPGRADES, UPGRADES, alienVisit, bigfootBlessing, bossOutcome,
  bossTierFor, cupsPerPitcher, isFestivalNight, lemonsPerPitcher, priceNowOf, recipeQuality, scoreGrade,
} from '../game/data';
import { cents, clamp, mulberry32 } from '../game/rng';
import { createDay, endDayResult, isDayOver, setPriceMidDay, stepMinute } from '../game/sim';
import {
  applySummerToMeta, buyMarketing, buySupply, buyTruckUpgrade, buyUpgrade, completeDay, marketPrices,
  muralUnlocked, newRun, peakHeatBossMinute, repLabel, summerScore, todayWeather, tomorrowForecast,
} from '../game/state';
import { exportSave, importSave, loadSave, writeSave, type SaveFile } from '../game/save';
import {
  buildDrinkBizPracticeDay,
  exportDrinkBizPracticeDay,
  type DrinkBizPracticeDayExport,
} from '../game/drinkbiz';
import { WEATHER_ICON, WEATHER_LABEL } from '../game/weather';
import type {
  DayResult, DayRuntime, FlavorId, GameEventDef, GameMode, MarketingAction, ProductId, Recipe, RunState, Supplies, UpgradeId,
} from '../game/types';
import { Scene } from '../render/scene';
import { flavorMoodFor } from '../game/mood';
import { runMinigame, type MiniKind } from './minigames';
import { AudioEngine } from '../render/audio';
import { FestivalScene } from '../render/festival';
import { TOWN_DAY_URL } from '../render/art';

const $ = (sel: string, root: ParentNode): HTMLElement => {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el as HTMLElement;
};

const money = (n: number): string => `$${n.toFixed(2)}`;

function servableCups(s: Supplies, recipe: Recipe, upgrades: UpgradeId[], pitcherLeft: number): number {
  const lemonsNeed = lemonsPerPitcher(recipe, upgrades);
  const pitchers = Math.min(Math.floor(s.lemons / lemonsNeed), Math.floor(s.sugar / recipe.sugar));
  return Math.min(s.cups, pitcherLeft + pitchers * cupsPerPitcher(upgrades));
}

function clock(minute: number): string {
  const h = 9 + Math.floor(minute / 60);
  const mm = (minute % 60).toString().padStart(2, '0');
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
}

function tasteHint(q: number): string {
  if (q >= 0.8) return 'Chef’s kiss 💛';
  if (q >= 0.6) return 'Tasty';
  if (q >= 0.4) return 'Drinkable';
  return 'Uh oh…';
}

function priceHint(price: number, tempF: number): string {
  const fair = 0.8 + Math.max(0, tempF - 68) * 0.045;
  if (price < fair * 0.8) return 'a steal';
  if (price < fair * 1.15) return 'fair';
  if (price < fair * 1.6) return 'premium';
  return 'ambitious!';
}

export class UI {
  private root: HTMLElement;
  private save: SaveFile;
  private audio = new AudioEngine();
  private scene: Scene | null = null;
  private day: DayRuntime | null = null;
  private drinkBizDay: DrinkBizPracticeDayExport | null = null;
  private actions: Record<string, (x?: string) => void> = {};
  private raf = 0;
  private bossMinute: number | null = null;
  private bossWarned = false;
  private bossDone = false;
  private motorcadeMinute: number | null = null;
  private motorcadeSeen = false;
  private last = 0;
  private acc = 0;
  private speed = 1;
  private paused = false;
  private screen = 'title';
  private hud: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = loadSave();
    this.audio.setPrefs(this.save.meta.audio.music, this.save.meta.audio.sfx);
    root.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest('[data-a]');
      if (!(btn instanceof HTMLElement) || btn.hasAttribute('disabled')) return;
      this.audio.ensure();
      this.audio.click();
      const fn = this.actions[btn.dataset.a ?? ''];
      if (fn) fn(btn.dataset.x);
    });
    window.addEventListener('keydown', (ev) => {
      if (this.screen !== 'day' || this.day === null) return;
      if (ev.key === ' ') { ev.preventDefault(); this.actions['pause']?.(); }
      if (ev.key === '1' || ev.key === '2' || ev.key === '3') this.actions['speed']?.({ '1': '1', '2': '2', '3': '4' }[ev.key]);
    });
    this.title();
  }

  private persist(): void { writeSave(this.save); }

  private stopLoop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private toast(text: string): void {
    let host = this.root.querySelector('.toasts');
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; this.root.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  private modal(html: string): HTMLElement {
    this.closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="modal">${html}</div>`;
    this.root.appendChild(overlay);
    return overlay;
  }

  private closeModal(): void { this.root.querySelector('.overlay')?.remove(); }

  // ------------------------------------------------------------- title

  private title(): void {
    this.stopLoop();
    this.screen = 'title';
    const m = this.save.meta;
    this.root.innerHTML = `
      <div class="screen title-screen">
        <div class="title-bg" aria-hidden="true"><img src="${TOWN_DAY_URL}" alt="" /></div>
        <div class="logo"><span>LEMONADE</span><span class="logo2">DAYS</span></div>
        <p class="tagline">CODEX EDITION · a handcrafted pixel-art summer story</p>
        <div class="menu">
          ${this.save.run ? `<button class="big" data-a="continue">▶ Continue — Day ${this.save.run.day}${this.save.run.mode === 'summer' ? ` of ${SUMMER_DAYS}` : ' (endless)'}</button>` : ''}
          <button class="big" data-a="new">🍋 New Summer</button>
          <button class="big ${m.endlessUnlocked ? '' : 'locked'}" data-a="endless">${m.endlessUnlocked ? '🌇 Endless Mode' : '🔒 Endless Mode'}</button>
          <button data-a="howto">How to play</button>
          <button data-a="settings">Settings</button>
        </div>
        <p class="footnote">${m.summers > 0 ? `summers completed: ${m.summers} · best score: ${m.bestScore}` : 'your first summer awaits'}</p>
        <p class="footnote dim">everything runs on your device · no accounts, no tracking</p>
      </div>`;
    this.actions = {
      continue: () => this.morning(),
      new: () => {
        if (this.save.run && !window.confirm('Start a new summer? Your current run will be abandoned.')) return;
        this.startRun('summer');
      },
      endless: () => {
        if (!this.save.meta.endlessUnlocked) { this.toast('Finish one summer to unlock Endless Mode.'); return; }
        if (this.save.run && !window.confirm('Start endless mode? Your current run will be abandoned.')) return;
        this.startRun('endless');
      },
      howto: () => this.howTo(),
      settings: () => this.settings(),
    };
  }

  private startRun(mode: GameMode): void {
    this.save.run = newRun(this.save.meta, mode);
    this.persist();
    this.morning();
  }

  // ----------------------------------------------------------- morning

  private morning(): void {
    this.stopLoop();
    const run = this.save.run;
    if (!run) { this.title(); return; }
    this.screen = 'morning';
    this.persist();
    const w = todayWeather(run);
    const fc = tomorrowForecast(run);
    const mkt = marketPrices(run);
    const q = recipeQuality(run.recipe, run.flavor, w.tempF);
    const canPour = servableCups(run.supplies, run.recipe, run.upgrades, 0);
    const lemonsNeed = lemonsPerPitcher(run.recipe, run.upgrades);
    const frozen = run.upgrades.includes('slush') && run.product === 'frozen';
    const icePerCup = frozen ? Math.max(2, run.recipe.icePerCup * 2) : run.recipe.icePerCup;
    const costPerCup =
      (lemonsNeed * COSTS.lemons + run.recipe.sugar * COSTS.sugar) / cupsPerPitcher(run.upgrades) +
      icePerCup * COSTS.ice + COSTS.cups;
    const scrollY = window.scrollY;

    const supplyRow = (item: keyof Supplies, label: string, icon: string): string => `
      <div class="row">
        <span class="row-l">${icon} ${label}</span>
        <span class="row-m">×${run.supplies[item]}</span>
        <span class="row-p">${money(mkt[item])}/ea</span>
        <span class="row-b">
          <button data-a="buy" data-x="${item}:1">+1</button>
          <button data-a="buy" data-x="${item}:10">+10</button>
          <button data-a="buy" data-x="${item}:25">+25</button>
        </span>
      </div>`;

    const stepper = (label: string, value: string, a: string, hint = ''): string => `
      <div class="row">
        <span class="row-l">${label}</span>
        <span class="row-b"><button data-a="${a}" data-x="-1">−</button>
        <span class="val">${value}</span>
        <button data-a="${a}" data-x="1">+</button></span>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </div>`;

    const flavorBtns = this.save.meta.flavors
      .map((f) => `<button class="chip ${run.flavor === f ? 'on' : ''}" data-a="flavor" data-x="${f}">${FLAVORS[f].icon} ${FLAVORS[f].name}</button>`)
      .join('');

    const upgCards = UPGRADES.map((u) => {
      const owned = run.upgrades.includes(u.id);
      const reqDef = u.requires ? UPGRADES.find((r) => r.id === u.requires) : undefined;
      const missingReq = reqDef && !run.upgrades.includes(reqDef.id);
      let action = '<div class="upg-own">OWNED</div>';
      if (!owned) {
        action = missingReq
          ? `<button disabled>Needs ${reqDef.name}</button>`
          : `<button data-a="upg" data-x="${u.id}" ${run.cash < u.cost ? 'disabled' : ''}>Buy ${money(u.cost)}</button>`;
      }
      return `<div class="upg ${owned ? 'owned' : ''}">
        <div class="upg-t">${u.icon} ${u.name}${u.requires ? ' <span class="hint">· tier</span>' : ''}</div>
        <div class="upg-d">${u.desc}</div>
        ${action}
      </div>`;
    }).join('');

    const mstate = run.marketing;
    const mktRows = MARKETING.map((mdef) => {
      let state = `<button data-a="mkt" data-x="${mdef.id}" ${run.cash < mdef.cost ? 'disabled' : ''}>${money(mdef.cost)}</button>`;
      if (mdef.id === 'flyers' && mstate.flyerDays > 0) state = '<span class="upg-own">POSTED ✓</span>';
      if (mdef.id === 'radiospot' && mstate.radioDays > 0) state = `<span class="upg-own">ON AIR (${mstate.radioDays}d)</span>`;
      if (mdef.id === 'merch' && mstate.merch) state = `<span class="upg-own">FANS: ${mstate.fans} 🧢</span>`;
      return `<div class="upg">
        <div class="upg-t">${mdef.icon} ${mdef.name}</div>
        <div class="upg-d">${mdef.desc}</div>
        ${state}
      </div>`;
    }).join('');
    const specialRows = SPECIAL_MERCH.map((mdef) => {
      const owned = mstate.specials.includes(mdef.id);
      const witnessed = mdef.cameo ? run.cameos[mdef.cameo] > 0 : true;
      let state: string;
      if (owned) state = '<span class="upg-own">DROPPED ✓ (+5% traffic)</span>';
      else if (!mstate.merch) state = '<button disabled>Needs Merch Drop</button>';
      else if (!witnessed) state = `<button disabled>???</button>`;
      else state = `<button data-a="mkt" data-x="${mdef.id}" ${run.cash < mdef.cost ? 'disabled' : ''}>${money(mdef.cost)}</button>`;
      const body = witnessed || owned ? mdef.desc : (mdef.hint ?? 'Keep your eyes open…');
      const title = witnessed || owned ? `${mdef.icon} ${mdef.name}` : '❓ Mystery Drop';
      return `<div class="upg ${owned ? 'owned' : ''}">
        <div class="upg-t">${title} <span class="hint">· special</span></div>
        <div class="upg-d">${body}</div>
        ${state}
      </div>`;
    }).join('');
    const muralStage = Math.max(0, Math.min(5, mstate.muralStage));
    const muralReady = muralUnlocked(run);
    const muralCost = muralStage < 5 ? MURAL_STAGE_COSTS[muralStage] : 0;
    const muralAction = muralStage >= 5
      ? '<span class="upg-own">COMPLETE - +8% TRAFFIC</span>'
      : muralReady
        ? `<button data-a="mkt" data-x="mural" ${run.cash < muralCost ? 'disabled' : ''}>Fund stage ${muralStage + 1} - ${money(muralCost)}</button>`
        : `<button disabled>Reach ${MURAL_FAN_REQUIREMENT} merch fans</button>`;
    const muralCard = mstate.merch ? `<div class="upg ${muralStage >= 5 ? 'owned' : ''}">
      <div class="upg-t">Community Skyline Mural <span class="hint">stage ${muralStage}/5</span></div>
      <div class="upg-d">The neighborhood matches your contribution. Painters build the lemonade crest across two buildings; every stage adds traffic.</div>
      <div class="mural-pips">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= muralStage ? 'on' : ''}"></i>`).join('')}</div>
      ${muralAction}
    </div>` : '';
    const mktBlock = mstate.unlocked
      ? `<h3>📣 Marketing</h3><div class="upgs">${mktRows}${muralCard}${mstate.merch ? specialRows : ''}</div>`
      : `<h3>📣 Marketing</h3><div class="upg-d dim">Unlocks once you're holding ${money(MARKETING_UNLOCK_CASH)} cash. Dream big.</div>`;

    this.root.innerHTML = `
      <div class="screen morning">
        <header class="mhead">
          <div>
            <div class="mday">Day ${run.day}${run.mode === 'summer' ? ` <span class="dim">of ${SUMMER_DAYS}</span>` : ' <span class="dim">· endless</span>'}</div>
            <div class="dim">${repLabel(run.rep)} · rep ${Math.round(run.rep)}</div>
          </div>
          <div class="mcash">${money(run.cash)}</div>
        </header>

        <div class="cols">
          <section class="panel">
            <h3>☀ Weather</h3>
            <div class="wx">${WEATHER_ICON[w.kind]} <b>${WEATHER_LABEL[w.kind]}</b>, ${w.tempF}°F</div>
            <div class="dim">Tomorrow: ${WEATHER_ICON[fc.kind]} ${WEATHER_LABEL[fc.kind]}, ~${fc.tempF}°F <span class="hint">(forecast)</span></div>
            <h3>🛒 Market</h3>
            ${supplyRow('lemons', 'Lemons', '🍋')}
            ${supplyRow('sugar', 'Sugar', '🧂')}
            ${supplyRow('ice', 'Ice', '🧊')}
            ${supplyRow('cups', 'Cups', '🥤')}
          </section>

          <section class="panel">
            <h3>🥤 Recipe — ${FLAVORS[run.flavor].name}</h3>
            <div class="chips">${flavorBtns}</div>
            ${run.upgrades.includes('slush') ? `<div class="chips">
              <button class="chip ${run.product === 'regular' ? 'on' : ''}" data-a="product" data-x="regular">🥤 Regular</button>
              <button class="chip ${run.product === 'frozen' ? 'on' : ''}" data-a="product" data-x="frozen">🍧 Frozen</button>
              <span class="hint">frozen: premium at 90°F+, flop below 80°, double ice</span>
            </div>` : ''}
            ${stepper('Lemons / pitcher', String(run.recipe.lemons), 'reclem')}
            ${stepper('Sugar / pitcher', String(run.recipe.sugar), 'recsug')}
            ${stepper('Ice / cup', String(run.recipe.icePerCup), 'recice')}
            ${run.hint && run.hint.day === run.day ? `<div class="kv"><span>🗣️ Word on the street</span><b>${FLAVORS[run.hint.flavor].icon} ${FLAVORS[run.hint.flavor].name}</b></div>` : ''}
            <div class="kv"><span>Taste check</span><b>${tasteHint(q)}</b></div>
            <div class="kv"><span>Cost per cup</span><b>${money(costPerCup)}</b></div>
            <h3>💰 Price</h3>
            ${stepper('Per cup', money(run.price), 'price', `${priceHint(run.price, w.tempF)}`)}
            <div class="kv"><span>You can pour</span><b>~${canPour} cups</b></div>
          </section>

          <section class="panel">
            <h3>🔧 Upgrades</h3>
            <div class="upgs">${upgCards}</div>
            ${mktBlock}
          </section>
        </div>

        <footer class="mfoot">
          <button data-a="title">← Title</button>
          <button data-a="games">🎪 Lawn Games</button>
          ${run.mode === 'endless' ? '<button data-a="retire">Retire stand</button>' : ''}
          <button class="big go" data-a="start">Open the stand ▶</button>
        </footer>
      </div>`;
    window.scrollTo(0, scrollY);

    const rerender = () => this.morning();
    this.actions = {
      buy: (x) => {
        const [item, qty] = (x ?? '').split(':');
        if (!buySupply(run, item as keyof Supplies, Number(qty))) this.toast('Not enough cash.');
        rerender();
      },
      reclem: (x) => { run.recipe.lemons = clamp(run.recipe.lemons + Number(x), 2, 12); rerender(); },
      recsug: (x) => { run.recipe.sugar = clamp(run.recipe.sugar + Number(x), 0, 10); rerender(); },
      recice: (x) => { run.recipe.icePerCup = clamp(run.recipe.icePerCup + Number(x), 0, 3); rerender(); },
      price: (x) => { run.price = cents(clamp(run.price + Number(x) * 0.25, 0.25, 5)); rerender(); },
      flavor: (x) => { run.flavor = x as FlavorId; rerender(); },
      product: (x) => { run.product = x as ProductId; rerender(); },
      mkt: (x) => {
        const id = x as MarketingAction;
        if (buyMarketing(run, id)) {
          if (id.startsWith('merch_')) this.toast('Special drop is LIVE — +4 rep, +5% traffic forever!');
          if (id === 'mural') this.toast(run.marketing.muralStage === 5 ? 'The skyline mural is complete! The whole neighborhood celebrates.' : `Mural stage ${run.marketing.muralStage}/5 is going up.`);
        } else {
          this.toast('Not enough cash.');
        }
        rerender();
      },
      upg: (x) => { if (!buyUpgrade(run, x as UpgradeId)) this.toast('Not enough cash.'); rerender(); },
      start: () => this.startDay(),
      games: () => this.lawnGames(),
      title: () => this.title(),
      retire: () => { if (window.confirm('Retire this stand and bank your score?')) this.summerEnd(); },
      settings: () => this.settings(),
    };
  }

  // -------------------------------------------------------- lawn games

  private lawnGames(): void {
    const run = this.save.run;
    if (!run) return;
    const canDivine = run.flavorsAvail.length >= 2;
    const hintKnown = run.hint?.day === run.day;
    const divineNote = !canDivine
      ? '<p class="dim">Finish a summer to unlock more flavors — then the crowd will have opinions worth divining.</p>'
      : hintKnown
        ? `<p class="dim">Today's verdict is in: <b>${FLAVORS[run.hint!.flavor].name}</b>. Play again just for fun!</p>`
        : '<p class="dim">Win or lose, the crowd reveals which flavor they secretly favor today.</p>';
    const overlay = this.modal(`
      <h2>🎪 Lawn Games</h2>
      ${divineNote}
      <div class="ev-choices">
        <button class="ev-choice" data-g="rumble" ${canDivine ? '' : 'disabled'}><b>🥊 Lemon Rumble</b><span class="hint">flavor face-off · throw lemons & ice, dodge the sugar bucket</span></button>
        <button class="ev-choice" data-g="dash" ${canDivine ? '' : 'disabled'}><b>🏁 Citrus Dash</b><span class="hint">flavor face-off · hurdle race, jump the ice</span></button>
        <button class="ev-choice" data-g="chug"><b>🔫 Chug Duel</b><span class="hint">just for glory · catch the lemonade stream, fill up first</span></button>
        <button class="ev-choice" data-g="ramp"><b>🏎️ Ramp Rally</b><span class="hint">hold the gas, manage engine heat, and clear more lemons than the ice cream truck</span></button>
        <button class="ev-choice" data-g="boxing"><b>🥊 Zest vs. Frost</b><span class="hint">ringside showdown · read the cone’s tells, dodge, block, and counterpunch</span></button>
        <button class="ev-choice" id="lg-garage"><b>🔧 Rally Garage · tier ${run.truck.level}/3</b><span class="hint">upgrades raise the ceiling; the rival upgrades too</span></button>
      </div>
      <div class="ev-choices"><button class="ev-choice" id="lg-close"><b>Back</b></button></div>`);
    $('#lg-close', overlay).addEventListener('click', () => this.closeModal());
    $('#lg-garage', overlay).addEventListener('click', () => this.garage());
    overlay.querySelectorAll('[data-g]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.ensure();
        this.launchGame((btn as HTMLElement).dataset.g as MiniKind);
      });
    });
  }

  private launchGame(kind: MiniKind): void {
    const run = this.save.run;
    if (!run) return;
    this.closeModal();
    const others = run.flavorsAvail.filter((f) => f !== run.flavor);
    const otherFlavor = others.length ? others[Math.floor(Math.random() * others.length)] : 'pink';
    const divination = kind === 'rumble' || kind === 'dash';
    const mood = divination ? flavorMoodFor(run.seed, run.day, run.flavorsAvail) : null;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<div class="modal game"><div class="mg-host"></div></div>';
    this.root.appendChild(overlay);
    runMinigame($('.mg-host', overlay), kind, {
      playerFlavor: run.flavor,
      otherFlavor,
      moodFlavor: mood,
      truckLevel: run.truck.level,
      sfx: {
        click: () => this.audio.click(),
        coin: () => this.audio.coin(),
        chime: () => this.audio.chime(),
        dayEnd: () => this.audio.dayEnd(),
      },
      onDone: (result) => {
        overlay.remove();
        if (!result.quit) {
          if (kind === 'ramp') {
            run.truck.bestJump = Math.max(run.truck.bestJump, result.value ?? 0);
            if (result.won) run.truck.wins++;
          }
          if (divination && mood && run.hint?.day !== run.day) {
            run.hint = { day: run.day, flavor: mood };
          }
          if (result.won) {
            run.rep = Math.min(100, run.rep + 1);
            this.toast('The crowd loved the show! +1 reputation.');
          }
          this.persist();
        }
        this.morning();
      },
    });
  }

  private garage(): void {
    const run = this.save.run;
    if (!run) return;
    this.closeModal();
    const next = TRUCK_UPGRADES.find((u) => u.level === run.truck.level + 1);
    const owned = TRUCK_UPGRADES.filter((u) => u.level <= run.truck.level);
    const overlay = this.modal(`
      <h2>🔧 Ramp Rally Garage</h2>
      <p>Your lemonade stand on wheels is tier <b>${run.truck.level}/3</b>. Every upgrade improves control and raises the possible jump distance—but the ice cream truck gets a matching rival part, so timing still wins.</p>
      ${owned.map((u) => `<div class="note">✓ ${u.name}</div>`).join('') || '<div class="note dim">Stock chassis. Brave, but wobbly.</div>'}
      <div class="lrow"><span>Rally wins</span><b>${run.truck.wins}</b></div>
      <div class="lrow"><span>Best jump</span><b>${run.truck.bestJump} lemons</b></div>
      ${next ? `<div class="upg"><div class="upg-t">Next: ${next.name}</div><div class="upg-d">${next.desc}</div><button id="garage-buy" ${run.cash < next.cost ? 'disabled' : ''}>Install ${money(next.cost)}</button></div>` : '<div class="upg owned"><div class="upg-t">MAXED OUT</div><div class="upg-d">Zest-Jets armed. The rival has matching cone rockets. May the best launch win.</div></div>'}
      <div class="ev-choices"><button class="ev-choice" id="garage-back"><b>Back to games</b></button></div>`);
    $('#garage-back', overlay).addEventListener('click', () => { this.closeModal(); this.lawnGames(); });
    const buy = overlay.querySelector('#garage-buy');
    buy?.addEventListener('click', () => {
      if (buyTruckUpgrade(run)) {
        this.persist();
        this.audio.chime();
        this.toast('Garage upgrade installed. The rival is tuning up too!');
      }
      this.garage();
    });
  }

  // --------------------------------------------------------------- day

  private startDay(): void {
    const run = this.save.run;
    if (!run) return;
    const w = todayWeather(run);
    if (servableCups(run.supplies, run.recipe, run.upgrades, 0) === 0) {
      this.toast('You can’t pour a single cup — buy some supplies first!');
      return;
    }
    this.persist();
    this.day = createDay(run, w);
    this.bossMinute = peakHeatBossMinute(w.tempF, this.save.meta.boss);
    this.bossWarned = false;
    this.bossDone = false;
    const cameoRng = mulberry32((this.day.daySeed ^ 0x50524553) >>> 0);
    this.motorcadeMinute = run.day >= 3 && cameoRng() < 0.08 ? 150 + Math.floor(cameoRng() * 260) : null;
    this.motorcadeSeen = false;
    this.screen = 'day';
    this.speed = 1;
    this.paused = false;
    this.root.innerHTML = `
      <div class="screen day">
        <div class="hudbar">
          <span class="chip" id="h-clock">9:00 AM</span>
          <span class="chip" id="h-cash">$0.00</span>
          <span class="chip" id="h-sold">🥤 0</span>
          <span class="chip" id="h-stock">stock 0</span>
          <span class="chip" id="h-ice">🧊 0</span>
          <span class="chip btn" data-a="pricebtn" id="h-price">$0.00 ✏️</span>
          <span class="spacer"></span>
          <span class="chip btn" data-a="speed" data-x="1" id="h-s1">1×</span>
          <span class="chip btn" data-a="speed" data-x="2" id="h-s2">2×</span>
          <span class="chip btn" data-a="speed" data-x="4" id="h-s4">4×</span>
          <span class="chip btn" data-a="pause" id="h-pause">⏸</span>
        </div>
        <div class="stage"><canvas id="game-canvas"></canvas></div>
        <div class="daybar dim">day ${run.day} · ${WEATHER_ICON[w.kind]} ${WEATHER_LABEL[w.kind]} ${w.tempF}°F · press space to pause</div>
      </div>`;
    const canvas = $('#game-canvas', this.root) as HTMLCanvasElement;
    this.scene = new Scene(canvas);
    const worldPos = (ev: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - rect.left) / rect.width) * 640, y: ((ev.clientY - rect.top) / rect.height) * 360 };
    };
    canvas.addEventListener('pointermove', (ev) => {
      const p = worldPos(ev);
      canvas.style.cursor = this.scene?.pegasusAt(p.x, p.y) ? 'pointer' : 'default';
    });
    canvas.addEventListener('pointerdown', (ev) => {
      const p = worldPos(ev);
      if (!this.day || !this.scene?.pegasusAt(p.x, p.y)) return;
      const generous = this.save.meta.summers >= 1 || this.save.run?.mode === 'endless';
      const msg = bigfootBlessing(this.day, generous);
      if (msg) {
        this.scene.blessPegasus();
        this.audio.chime();
        this.toast(msg);
      } else {
        this.toast('Bigfoot looks thirsty… but you are out of lemonade!');
      }
    });
    const CAP_TINTS: Record<string, string> = { merch_kaiju: '#4bc7b8', merch_ufo: '#8f86c9', merch_pegasus: '#f2b8c6' };
    this.scene.setDay(w, run.upgrades, run.flavor, run.price, {
      fanChance: Math.min(0.35, run.marketing.fans * 0.015),
      frozen: run.upgrades.includes('slush') && run.product === 'frozen',
      capColors: ['#f2d24b', ...run.marketing.specials.map((sid) => CAP_TINTS[sid]).filter(Boolean)],
      kaijuSeen: run.cameos.kaiju,
      ufoLanded: run.cameos.ufo > 0,
      muralStage: run.marketing.muralStage,
      motorcadeMinute: this.motorcadeMinute,
      hooks: {
        onCameo: (kind) => {
          run.cameos[kind]++;
          if (run.cameos[kind] === 1) {
            const lines = {
              kaiju: 'Something ENORMOUS is strolling behind the skyline…',
              ufo: 'A saucer just landed on the greens?!',
              pegasus: 'Is that… Bigfoot? On a flying unicorn? CLICK HIM!',
            } as const;
            this.toast(lines[kind]);
            this.audio.chime();
          }
        },
        alienSale: () => {
          if (!this.day) return { ok: false };
          const r = alienVisit(this.day);
          this.toast(r.text);
          if (r.ok) this.audio.coin();
          return { ok: r.ok };
        },
      },
    });
    this.audio.setRain(w.kind === 'rain');
    this.hud = {
      clock: $('#h-clock', this.root), cash: $('#h-cash', this.root), sold: $('#h-sold', this.root),
      stock: $('#h-stock', this.root), ice: $('#h-ice', this.root), price: $('#h-price', this.root),
      pause: $('#h-pause', this.root), s1: $('#h-s1', this.root), s2: $('#h-s2', this.root), s4: $('#h-s4', this.root),
    };
    this.actions = {
      pause: () => { this.paused = !this.paused; this.hud.pause.textContent = this.paused ? '▶' : '⏸'; },
      speed: (x) => { this.speed = Number(x); this.markSpeed(); },
      pricebtn: () => this.priceModal(),
    };
    this.markSpeed();
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private markSpeed(): void {
    for (const s of ['1', '2', '4']) this.hud[`s${s}`]?.classList.toggle('on', this.speed === Number(s));
  }

  private tick = (ts: number): void => {
    const d = this.day;
    const run = this.save.run;
    if (!d || !run) return;
    const dt = Math.min(120, ts - this.last);
    this.last = ts;
    if (!this.paused) {
      this.acc += dt;
      const msPerMin = 90 / this.speed;
      while (this.acc >= msPerMin && !isDayOver(d) && !this.paused) {
        this.acc -= msPerMin;
        const evts = stepMinute(d);
        this.scene?.onSimEvents(evts);
        for (const e of evts) {
          if (e.kind === 'arrive' && e.outcome === 'bought') this.audio.coin();
          if (e.kind === 'popup') { this.showEvent(e.def); break; }
        }
      }
      if (this.motorcadeMinute !== null && !this.motorcadeSeen && d.minute >= this.motorcadeMinute) {
        this.motorcadeSeen = true;
        this.audio.chime();
        this.toast('Presidential motorcade! The President stopped for one lemonade. No bonus—just history.');
      }
      if (this.bossMinute !== null && !this.bossWarned && d.minute >= this.bossMinute - 20) {
        this.bossWarned = true;
        this.audio.chime();
        this.toast('💧 HUMIDITY WARNING: something tepid this way comes…');
      }
      if (this.bossMinute !== null && !this.bossDone && d.minute >= this.bossMinute) {
        this.bossDone = true;
        this.paused = true;
        this.hud.pause.textContent = '▶';
        this.bossIntro();
      }
      this.updateHud(d, run);
      if (isDayOver(d)) { this.finishDay(); return; }
    }
    this.scene?.render(d.minute, dt, this.paused);
    this.raf = requestAnimationFrame(this.tick);
  };

  private updateHud(d: DayRuntime, run: RunState): void {
    this.hud.clock.textContent = clock(d.minute);
    this.hud.cash.textContent = money(run.cash + d.revenue + d.tips + d.cashDelta);
    this.hud.sold.textContent = `🥤 ${d.sold}`;
    this.hud.stock.textContent = `stock ${servableCups(d.supplies, d.recipe, d.upgrades, d.pitcherLeft)}`;
    this.hud.ice.textContent = `🧊 ${d.supplies.ice}`;
    const p = priceNowOf(d);
    this.hud.price.textContent = `${money(p)} ✏️`;
    this.scene?.setPrice(p);
  }

  private showEvent(def: GameEventDef): void {
    const d = this.day;
    if (!d) return;
    this.paused = true;
    this.audio.chime();
    if (def.id === 'truck') this.scene?.iceCreamTruck(d.minute, 120);
    const overlay = this.modal(`
      <div class="ev-icon">${def.icon}</div>
      <h2>${def.title}</h2>
      <p>${def.text}</p>
      <div class="ev-choices">
        ${def.choices.map((c, i) => {
          const ok = !c.can || c.can(d);
          return `<button class="ev-choice" data-i="${i}" ${ok ? '' : 'disabled'}>
            <b>${c.label}</b>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</button>`;
        }).join('')}
      </div>`);
    overlay.querySelectorAll('.ev-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number((btn as HTMLElement).dataset.i);
        const outcome = def.choices[i].apply(d);
        if (def.id === 'busker') this.scene?.buskerCameo(i === 0);
        this.closeModal();
        this.toast(outcome);
        this.paused = false;
        this.hud.pause.textContent = '⏸';
      });
    });
  }

  private priceModal(): void {
    const d = this.day;
    if (!d) return;
    this.paused = true;
    let p = d.price;
    const overlay = this.modal(`
      <h2>Chalkboard price</h2>
      <p class="dim">Raising the price a lot mid-day annoys people a little.</p>
      <div class="pricebox">
        <button id="p-minus">−25¢</button>
        <span id="p-val" class="bigval">${money(p)}</span>
        <button id="p-plus">+25¢</button>
      </div>
      <div class="ev-choices"><button id="p-set" class="ev-choice"><b>Set price</b></button></div>`);
    const val = $('#p-val', overlay);
    $('#p-minus', overlay).addEventListener('click', () => { p = cents(clamp(p - 0.25, 0.25, 5)); val.textContent = money(p); });
    $('#p-plus', overlay).addEventListener('click', () => { p = cents(clamp(p + 0.25, 0.25, 5)); val.textContent = money(p); });
    $('#p-set', overlay).addEventListener('click', () => {
      setPriceMidDay(d, p);
      this.closeModal();
      this.paused = false;
      this.hud.pause.textContent = '⏸';
    });
  }

  private finishDay(): void {
    this.stopLoop();
    const d = this.day;
    const run = this.save.run;
    if (!d || !run) return;
    this.audio.dayEnd();
    this.audio.setRain(false);
    const result = endDayResult(d);
    this.drinkBizDay = buildDrinkBizPracticeDay(run, d, result);
    run.supplies = { ...d.supplies };
    const { summerOver } = completeDay(run, result);
    this.day = null;
    this.scene = null;
    this.persist();
    if (isFestivalNight(result.day, summerOver)) this.nightFestival(result, summerOver);
    else this.evening(result, summerOver);
  }

  private downloadDrinkBizDay(): void {
    const payload = this.drinkBizDay;
    if (!payload) {
      this.toast('Finish a day before exporting to DrinkBiz.');
      return;
    }
    const blob = new Blob([exportDrinkBizPracticeDay(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lemonade-days-run-${payload.source.runId}-day-${payload.source.day}.drinkbiz.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast('DrinkBiz practice day exported!');
  }

  // ------------------------------------------------------- tepid terror

  private bossIntro(): void {
    const tempF = this.day?.weather.tempF ?? 90;
    const tier = bossTierFor(tempF);
    const powered = tier.tier >= 2 ? ' He flexes a pair of sloshing water-biceps.' : '';
    const furious = tier.tier >= 3 ? ' His face twists into a furious, tooth-gritted scowl.' : '';
    const slush = this.save.run?.upgrades.includes('slush')
      ? '<p class="boss-tip"><b>SLUSH BOMB READY:</b> its meter charges with time and every hit. Press SPACE or tap the meter when full for triple damage, huge knockback, and a deep freeze.</p>'
      : '';
    const overlay = this.modal(`
      <div class="ev-icon">🥤</div>
      <h2>THE TEPID TERROR</h2>
      <div class="heat-tier tier-${tier.tier}">${tempF}°F · ${tier.name} · HEAT TIER ${tier.tier}</div>
      <p><i>Born in a glass left on a hot dashboard for three days, Lord Lukewarm hates everything crisp and refreshing.</i></p>
      <p>At exactly <b>2:00 PM</b>, the sun hits its peak. He's oozing toward your <b>lemonade vats</b> in his scratched tumbler suit.${powered}${furious} If he reaches them: Rapid Thaw. The Flatline. Lukewarm everything.</p>
      ${slush}
      <div class="ev-choices">
        <button class="ev-choice" id="boss-fight"><b>🧊 DEFEND THE VATS!</b><span class="hint">tap to hurl ice — knock him back and freeze him</span></button>
        <button class="ev-choice" id="boss-hide"><b>😨 Hide under the counter</b><span class="hint">he ruins today's batch unopposed</span></button>
      </div>`);
    $('#boss-fight', overlay).addEventListener('click', () => {
      this.closeModal();
      this.launchBoss();
    });
    $('#boss-hide', overlay).addEventListener('click', () => {
      this.closeModal();
      this.resolveBoss(false, false);
    });
  }

  private launchBoss(): void {
    const run = this.save.run;
    if (!run || !this.day) return;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = '<div class="modal game"><div class="mg-host"></div></div>';
    this.root.appendChild(overlay);
    runMinigame($('.mg-host', overlay), 'cryo', {
      playerFlavor: run.flavor,
      otherFlavor: 'pink',
      moodFlavor: null,
      bossTemp: this.day.weather.tempF,
      hasSlush: run.upgrades.includes('slush'),
      winChoices: [
        { id: 'harvest', label: '🧊 Harvest the frozen terror', hint: '+40 ice · GLACIER BOOST: 2× rush for 90 min' },
        { id: 'mercy', label: '🕊️ Let him thaw and go', hint: '+4 reputation' },
      ],
      sfx: {
        click: () => this.audio.click(),
        coin: () => this.audio.coin(),
        chime: () => this.audio.chime(),
        dayEnd: () => this.audio.dayEnd(),
      },
      onDone: (result) => {
        overlay.remove();
        // quitting mid-fight leaves the vats unguarded — same as hiding
        this.resolveBoss(!result.quit && result.won, result.choice === 'harvest');
      },
    });
  }

  private resolveBoss(won: boolean, harvest: boolean): void {
    const run = this.save.run;
    if (!run || !this.day) return;
    const msg = bossOutcome(this.day, won, harvest);
    run.bossFights++;
    this.persist();
    this.toast(msg);
    if (won) this.audio.dayEnd();
    this.paused = false;
    this.hud.pause.textContent = '⏸';
  }

  // ----------------------------------------------------- festival nights

  private nightFestival(result: DayResult, summerOver: boolean): void {
    const run = this.save.run;
    if (!run) { this.evening(result, summerOver); return; }
    this.screen = 'festival';
    this.root.innerHTML = `
      <div class="screen festival">
        <div class="festival-head">
          <div><span class="eyebrow">DAY ${result.day} AFTER DARK</span><h2>FOOD TRUCK RALLY & BLOCK PARTY</h2></div>
          <p>Every seventh night, the street stays open late. Food trucks roll in, the neighborhood dances, and fireworks take over the skyline.</p>
        </div>
        <div class="stage festival-stage"><canvas id="festival-canvas"></canvas></div>
        <button class="big go festival-skip" data-a="festival-next">Continue to the day report ▶</button>
      </div>`;
    const canvas = $('#festival-canvas', this.root) as HTMLCanvasElement;
    const scene = new FestivalScene(canvas, result.day, run.marketing.muralStage);
    const loop = (ts: number): void => {
      scene.render(ts);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.actions = {
      'festival-next': () => {
        this.stopLoop();
        this.evening(result, summerOver);
      },
    };
  }

  // ------------------------------------------------------------ evening

  private evening(r: DayResult, summerOver: boolean): void {
    this.screen = 'evening';
    const row = (label: string, val: string, cls = ''): string =>
      `<div class="lrow ${cls}"><span>${label}</span><b>${val}</b></div>`;
    this.root.innerHTML = `
      <div class="screen evening">
        <div class="panel ledger">
          <div class="stamp grade-${r.grade}">${r.grade}</div>
          <h2>Day ${r.day} — closing time</h2>
          <div class="dim">${WEATHER_ICON[r.weather.kind]} ${WEATHER_LABEL[r.weather.kind]}, ${r.weather.tempF}°F</div>
          ${row('Cups sold', String(r.sold))}
          ${row('Revenue', money(r.revenue))}
          ${row('Tips', `+${money(r.tips)}`)}
          ${r.eventCash !== 0 ? row('Day events', `${r.eventCash > 0 ? '+' : '−'}${money(Math.abs(r.eventCash))}`) : ''}
          ${r.merchSold > 0 ? row(`Merch (${r.merchSold} sold)`, `+${money(r.merchRevenue - r.merchSold * MERCH_COST)}`) : ''}
          ${row('Supplies used', `−${money(r.cogs)}`, 'red')}
          ${row('Day profit', money(r.profit), `total ${r.profit >= 0 ? 'green' : 'red'}`)}
          <div class="lrow dim"><span>Missed: price</span><b>${r.lostPrice}</b></div>
          <div class="lrow dim"><span>Missed: sold out</span><b>${r.lostStock}</b></div>
          ${row('Reputation', `${Math.round(r.repBefore)} → ${Math.round(r.repAfter)} (${repLabel(r.repAfter)})`)}
          ${r.notes.map((n) => `<div class="note">☞ ${n}</div>`).join('')}
          <button class="big" data-a="drinkbiz-export">📒 Export this day to DrinkBiz</button>
          <a class="big" href="https://deepseekrlee.github.io/drinkbiz/" target="_blank" rel="noopener">Open DrinkBiz companion ↗</a>
          <p class="dim">Creates a practice-business summary using the game’s standard ingredient costs. It never mixes with real records unless you import it.</p>
          <button class="big go" data-a="next">${summerOver ? '🌇 Finish the summer' : 'Next morning ▶'}</button>
        </div>
      </div>`;
    this.actions = {
      'drinkbiz-export': () => this.downloadDrinkBizDay(),
      next: () => (summerOver ? this.summerEnd() : this.morning()),
    };
  }

  // --------------------------------------------------------- summer end

  private summerEnd(): void {
    const run = this.save.run;
    if (!run) { this.title(); return; }
    const score = summerScore(run);
    const applied = applySummerToMeta(this.save.meta, run);
    this.save.meta = applied.meta;
    this.save.run = null;
    this.persist();
    const bars = run.history
      .map((h) => `<div class="bar" style="height:${clamp(6 + h.profit * 1.4, 3, 56)}px" title="Day ${h.day}: $${h.profit.toFixed(2)}"></div>`)
      .join('');
    this.root.innerHTML = `
      <div class="screen summerend">
        <div class="panel">
          <div class="stamp grade-${scoreGrade(score)}">${scoreGrade(score)}</div>
          <h2>${run.mode === 'summer' ? 'Summer complete!' : 'Stand retired'}</h2>
          <div class="score">${score}<span class="dim"> pts</span></div>
          <div class="lrow"><span>Final cash</span><b>${money(run.cash)}</b></div>
          <div class="lrow"><span>Reputation ×2</span><b>${Math.round(run.rep)} × 2</b></div>
          <div class="lrow"><span>Cups sold ×0.1</span><b>${run.totals.sold}</b></div>
          ${run.marketing.fans > 0 ? `<div class="lrow"><span>Merch fans ×1</span><b>${run.marketing.fans} 🧢</b></div>` : ''}
          <div class="lrow"><span>Best day</span><b>${money(run.totals.bestDay)}</b></div>
          <div class="bars">${bars}</div>
          ${applied.unlocked.length ? `<h3>Unlocked</h3>${applied.unlocked.map((u) => `<div class="note">★ ${u}</div>`).join('')}` : ''}
          <div class="menu">
            <button class="big go" data-a="again">🍋 New Summer</button>
            ${this.save.meta.endlessUnlocked ? '<button class="big" data-a="endless">🌇 Endless Mode</button>' : ''}
            <button data-a="title">Title screen</button>
          </div>
        </div>
      </div>`;
    this.actions = {
      again: () => this.startRun('summer'),
      endless: () => this.startRun('endless'),
      title: () => this.title(),
    };
  }

  // ------------------------------------------------------------ modals

  private howTo(): void {
    const overlay = this.modal(`
      <h2>How to play</h2>
      <p>☀ Each <b>morning</b>: check the weather, stock up, tune your recipe, set a price.</p>
      <p>🥤 Then <b>open the stand</b> and watch the day roll by. Hot days sell more. Rain… doesn't.</p>
      <p>⚡ <b>React</b> to whatever the day throws at you — every choice nudges traffic, price, or reputation.</p>
      <p>🧊 Ice melts overnight and lemons wilt, so don't over-buy. A good recipe (≈6 lemons, 4 sugar) earns tips and rep.</p>
      <p>🏎️ Visit <b>Lawn Games</b> for Ramp Rally. Hold the gas to build speed, release to cool the engine, and use the Garage to raise both trucks' competitive ceiling.</p>
      <p>🦹 On any 90°F+ day, the Tepid Terror attacks at 2:00 PM. The hotter the day, the stronger he gets. A Slush Machine unlocks the charged SPACE-bar secondary.</p>
      <p>🎆 Every seventh day ends after dark with fireworks, a food-truck rally, and the neighborhood block party.</p>
      <p>🌇 After ${SUMMER_DAYS} days the summer ends and your score unlocks new recipes and modes.</p>
      <div class="ev-choices"><button class="ev-choice" id="ht-ok"><b>Got it</b></button></div>`);
    $('#ht-ok', overlay).addEventListener('click', () => this.closeModal());
  }

  private settings(): void {
    const m = this.save.meta;
    const overlay = this.modal(`
      <h2>Settings</h2>
      <div class="lrow"><span>Music</span><button id="s-music">${m.audio.music ? 'ON' : 'OFF'}</button></div>
      <div class="lrow"><span>Sound effects</span><button id="s-sfx">${m.audio.sfx ? 'ON' : 'OFF'}</button></div>
      <div class="lrow"><span>Super Showdown <span class="hint">(heatwave boss event)</span></span><button id="s-boss">${m.boss ? 'ON' : 'OFF'}</button></div>
      <div class="lrow"><span>Backup</span><span><button id="s-exp">Export</button> <button id="s-imp">Import</button></span></div>
      <input type="file" id="s-file" accept=".json,application/json" style="display:none" />
      ${this.save.run ? '<div class="lrow"><span>Current run</span><button id="s-abandon">Abandon</button></div>' : ''}
      <div class="lrow"><span>Everything</span><button id="s-reset">Reset all</button></div>
      <p class="dim">Lemonade Days · open source (MIT) · all data stays in this browser.</p>
      <div class="ev-choices"><button class="ev-choice" id="s-ok"><b>Done</b></button></div>`);
    $('#s-ok', overlay).addEventListener('click', () => this.closeModal());
    $('#s-music', overlay).addEventListener('click', (e) => {
      m.audio.music = !m.audio.music;
      (e.target as HTMLElement).textContent = m.audio.music ? 'ON' : 'OFF';
      this.audio.ensure();
      this.audio.setPrefs(m.audio.music, m.audio.sfx);
      this.persist();
    });
    $('#s-sfx', overlay).addEventListener('click', (e) => {
      m.audio.sfx = !m.audio.sfx;
      (e.target as HTMLElement).textContent = m.audio.sfx ? 'ON' : 'OFF';
      this.audio.setPrefs(m.audio.music, m.audio.sfx);
      this.persist();
    });
    $('#s-boss', overlay).addEventListener('click', (e) => {
      m.boss = !m.boss;
      (e.target as HTMLElement).textContent = m.boss ? 'ON' : 'OFF';
      this.persist();
    });
    $('#s-exp', overlay).addEventListener('click', () => {
      const blob = new Blob([exportSave(this.save)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lemonade-days-save.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    const file = $('#s-file', overlay) as HTMLInputElement;
    $('#s-imp', overlay).addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      void f.text().then((text) => {
        try {
          this.save = importSave(text);
          this.persist();
          this.toast('Save imported!');
          this.closeModal();
          this.title();
        } catch (err) {
          this.toast(err instanceof Error ? err.message : 'Could not read that file.');
        }
      });
    });
    overlay.querySelector('#s-abandon')?.addEventListener('click', () => {
      if (!window.confirm('Abandon the current run?')) return;
      this.save.run = null;
      this.persist();
      this.closeModal();
      this.title();
    });
    $('#s-reset', overlay).addEventListener('click', () => {
      if (!window.confirm('Reset EVERYTHING — runs, unlocks, best score?')) return;
      this.save = { version: 1, meta: { bestScore: 0, summers: 0, endlessUnlocked: false, flavors: ['classic'], headStart: false, boss: true, audio: { music: true, sfx: true } }, run: null };
      this.persist();
      this.closeModal();
      this.title();
    });
  }
}
