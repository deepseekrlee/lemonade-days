# Contributing to Lemonade Days

## Setup

```bash
npm install
npm run dev
```

Quality bar (CI runs the same):

```bash
npm run typecheck && npm test && npm run build
```

Ground rules:

- **The sim stays deterministic.** Anything in `src/game/` that consumes randomness must draw from the seeded RNG that's passed in — never `Math.random()`. Cosmetic wiggle in the renderer may use `Math.random()` freely.
- **Sim changes need tests.** Especially anything touching demand, pricing, or the ledger.
- **Keep it chill.** New events and copy should be warm and low-stakes; the game never punishes harshly.
- **Zero runtime dependencies** is a feature. Art is drawn in `scene.ts`, music is synthesized in `audio.ts` — please don't add asset files or engines without an issue discussion first.
- New day-events go in `src/game/data.ts` (self-contained: condition + choices + effects). New upgrades likewise, plus a few pixels in `scene.ts` so they show on the stand.

## Good first contributions

A new day-event, a new upgrade with its pixel art, weather variety, or a stand cosmetic. Open an issue for anything bigger.
