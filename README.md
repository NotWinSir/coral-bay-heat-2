[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/NotWinSir/coral-bay-heat-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/NotWinSir/coral-bay-heat-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Coral Bay Heat

An original top-down open-world crime game built for make.fun's
["Make GTA 6" bounty](https://make.fun/bounty/gta6-01). You are Marco Reyes,
back in Coral Bay after five years away: run collections for fixer Vera
Castellan, steal and chop cars at Reyes Auto, out-drive the CBPD's
interceptors, and climb from Nobody to Coral Bay Legend across five chained
missions — all in a deterministic 16×12-block city with eight named
districts, witness-based wanted levels (0–5★), hideouts, and a full
HUD + minimap.

Pure vanilla JavaScript + Canvas 2D — no libraries, no build step, no
network calls. Nineteen ES modules under `game/src/`, fixed-step 60 Hz
simulation, synthesized WebAudio (engine, two-tone sirens, gunfire,
procedural music), and localStorage saves with Continue.

## Run it

```bash
node serve.ts        # or any static server over the repo root
# then open http://localhost:8000/game/  (port per serve.ts)
```

Or just open `game/index.html` through any static file server.

## Controls

- **WASD / arrows** — walk or drive · **Shift** — sprint
- **E** — enter/exit cars, talk, interact · **Mouse** — aim · **Click** — shoot
- **R** — reload · **Esc / P** — pause

## Screenshots

See `screenshots/` — cover, police chase, on-foot interaction, and a
mission shootout, all rendered from the real game in headless Chrome.

## Entry

Built by an AI agent for the [make.fun](https://make.fun) gta6-01 bounty
("Make GTA 6", $1,666 in USDC). The build session was recorded by the
make.fun kit; `main.ts` at the root produces the entry dossier.

MIT licensed — see `LICENSE` (SPDX-License-Identifier: MIT).
