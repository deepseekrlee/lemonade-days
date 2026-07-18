# 🍋 Lemonade Days: Codex Edition

A richly illustrated, original high-bit pixel-art lemonade stand simulator. Plan your morning, open the stand, and watch a storybook summer roll by — customers wander up, weather turns, an ice cream truck visibly parks across the street, and rare visitors pull up for a cup. Every evening you get an honest little ledger. After 28 days, the summer ends and your score unlocks new recipes and modes.

**Handcrafted high-bit presentation:** gameplay still uses a precise 640×360 logical grid, but the canvas now renders at 1280×720 with detailed original town paintings, luminous day/night color grading, expressive multi-tone characters, a fully remodeled stand, atmospheric particles, and a storybook interface. Procedural animation and canvas effects keep the illustrated world alive without changing the deterministic simulation underneath it.

See [ART_DIRECTION.md](ART_DIRECTION.md) for the visual principles and reproducible environment prompts.

## Play

Once published, play the latest version at:

**https://deepseekrlee.github.io/lemonade-days/**

For a first-timer-friendly explanation of GitHub and future updates, see
[PUBLISHING_FOR_BEGINNERS.md](PUBLISHING_FOR_BEGINNERS.md).

```bash
npm install
npm run dev     # play at localhost:5173
```

Or grab `dist/lemonade-days.html` after a build — the whole game in one offline file.

### Continue the lesson in DrinkBiz

At the end of any game day, choose **Export this day to DrinkBiz**. The downloaded JSON file can be imported from DrinkBiz Settings into a separate practice business, where the player can explore the day's sales, tips, merchandise, ingredient usage, costs, and profit with full bookkeeping reports.

DrinkBiz is the separate, offline-first tracker companion: **https://deepseekrlee.github.io/drinkbiz/**. The bridge is deliberately practice-only and duplicate-safe, so simulated game records never get mixed into a real-business profile.

## How it plays

- **Morning** — check the sky, buy lemons/sugar/ice/cups at wobbling market prices, tune your recipe, set a price, maybe buy an upgrade (they're all visible on the stand).
- **Day** — the sim runs minute-by-minute while the scene animates. React to pop-up events: undercut the ice cream truck, shelter strangers under your umbrella, take the office's bulk order, surge-price the heatwave (they *will* remember).
- **Evening** — a real ledger: revenue, tips, supplies used, missed sales and why, reputation shift, day grade, plus a DrinkBiz practice export.
- **Summer's end** — score = cash + reputation×2 + cups×0.1 + merch fans. Unlocks: Pink Lemonade, Mint Cooler, Endless Mode, a head-start bonus.
- **Upgrade tiers** — the umbrella grows clip-on fans, then a misting rig (own the heatwave); the cooler grows a slush machine that unlocks **Frozen Lemonade**, a premium product above 90°F that flops below 80° and drinks double ice.
- **Marketing** (unlocks at $500 cash, built for the long game) — flyer runs, radio spots, and a one-time **Merch Drop**: delighted customers buy caps & tees, walk around wearing them, and every fan permanently boosts traffic, reputation, and score.
- **The vibes layer** — every day the greens host something: Bigfoot and his sweetheart picnicking, kids playing catch, lemon-people tossing a frisbee, a busker (tip him in his day event and he plays all day), rockstars jamming. Overhead: bird flocks, a LEMONADE banner plane. A towering kaiju regularly looms up from behind the skyline — first visit he sips a tiny cup; after that he shows up **wearing your merch**. And very, very rarely, Bigfoot flies past on a winged unicorn — **click him** to comp a drink for his blessing.
- **Close encounters of the citrus kind** — the first UFO of a run lands on the greens; two aliens waddle over and genuinely buy lemonade (and a cap, if you sell merch — it all hits the ledger). Every later flyby tows a ★★★★★ review banner.
- **The Tepid Terror at solar peak** — on every 90°F+ day, a humidity warning flashes before the 2:00 PM attack. Lord Lukewarm scales through three heat tiers at 90/94/98°F: more armor, more puddle health, faster ooze, weaker knockback, flexing water-biceps, and a truly mean hottest-day face. The Slush Machine adds a charged **Slush Bomb** secondary with triple damage, huge knockback, and a deep slow. Lose (or hide) and Rapid Thaw + The Flatline wreck the day's ice and quality; win and choose a 2× **Glacier Boost** or mercy reputation.
- **Flavor mood + lawn games** — each day the neighborhood secretly favors one of your flavors (small real demand bonus). Divine it by playing: **Lemon Rumble** (a very silly flavor-vs-flavor fighter — throw lemons and ice, charge the water cannon, dodge the sugar bucket, while bigfoots, aliens, and the kaiju cheer from the bleachers) or **Citrus Dash** (a hurdle race). Win or lose, the crowd reveals its favorite. **Chug Duel** is pure glory: steer your drinker under a wandering lemonade-cannon stream and fill up — belly and all — before the rival pair. **Zest vs. Frost** is a ringside lemon-versus-soft-serve boxing match: read glove tells, dodge or block, manage stamina, and counter during the cone's recovery window.
- **Special merch drops** — witnessing each rare visitor unlocks a premium drop in Marketing (Kaiju Collab Tee $250, UFO Tour Cap $300, Sky Legend Snapback $400). Each grants +4 rep on release and +5% traffic forever, and fans start wearing the themed caps around the neighborhood.
- **Ramp Rally + Garage** — a monster-truck jump where the lemonade stand on wheels and the ice cream truck clear rows of lemons. Hold and feather the gas to build speed without overheating; wind adds a little luck. Three garage tiers raise the ceiling, while the rival receives matching waffle tires, tuning, and ice-cream-cone rockets so upgrades never become an automatic win.
- **Community skyline mural** — after the merch line reaches 15 neighborhood fans, fund five community-matched mural stages. Primer, painters, and migrating scaffolding give way to a lemon sun, a community vine, cross-building lettering, bunting, and a signed final painting spanning three facades; each stage permanently nudges traffic.
- **Street cameos and festival nights** — the ice cream truck drives in on animated suspension, opens its serving hatch and awning, then departs. A rare presidential motorcade parks, opens the limo, and escorts the President to the stand for one visible lemonade—with no bonus beyond the fun of seeing it. Every seventh night becomes a skippable fireworks show, food-truck rally, and dancing block party.

## Under the hood

The whole game state derives from a **deterministic, seeded simulation** (`src/game/`), fully unit-tested:

- Same seed → same summer, same customers. Each customer rolls from their own child RNG, which makes price elasticity provably monotonic (a customer who buys at $3 always buys at $1) — there's a test for it.
- Demand = foot-traffic curve × weather × reputation × your upgrades and event choices; purchase = willingness-to-pay vs. price; satisfaction (taste, value, ice!) drives reputation.
- The renderer (`src/render/`) and UI (`src/ui/`) are strictly presentation: original illustrated environment assets, high-resolution canvas character/effect layers, and a WebAudio-synthesized soundtrack. Zero runtime dependencies.

```
src/
├── assets/  original day and night master environment art
├── game/    types, rng, weather, sim, events/data, state, save  ← pure + tested
├── render/  high-resolution canvas scenes, sprites, effects, music/SFX
└── ui/      screens, HUD, mini-games, modals, illustrated styles
```

## Roadmap ideas

- [ ] Daily-challenge seed (same day for everyone — determinism makes this free)
- [ ] Grandmaster Lemon: a chess-club cameo where the flavors play each other (needs a tiny engine — contributions welcome)
- [ ] More events, cameos, locations (park / beach / festival), stand cosmetics
- [ ] Recipe experiments (strawberry, arnold palmer), regular customers with names
- [ ] PWA install + touch polish, gamepad support
- [ ] Achievements; endless-mode leaderboards (local)

## Monetization notes (while staying open source)

The code is MIT — anyone can learn from or fork it. Sustainable options that don't fight the license: sell convenience builds on itch.io / Steam (pay-what-you-want web, paid desktop), a supporter edition with cosmetic stand skins, or commissions/content packs. The environment art is original to this project and the remaining art and audio are rendered from code, so there are no third-party game-asset licenses to clear. The name/branding can be trademarked separately from the MIT code if this grows.

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Changes to `src/game/` need tests (`npm test`); determinism is the contract that keeps the game fair and debuggable.

## License

[MIT](LICENSE)
