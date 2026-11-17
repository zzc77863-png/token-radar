# Token Radar — pre-token protocols ranked by implied launch value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/zzc77863-png/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/zzc77863-png/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar reads a sealed DefiLlama snapshot of every protocol, finds the ones that record no token, prices each launch off its own category's comparables, and hands in a web dashboard with the ranked board, a detail view for every protocol, and the steps to farm it. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## The model — radar-2

No flat multiple of TVL. Each category is priced off the median market-cap per dollar of TVL of its token-bearing protocols, shrunk toward the global median so a thin category cannot set its own price. Growth, survival and chain breadth then adjust that base:

```
implied = TVL × category multiple × (1 + clamp(7d, −60, 120)% × 0.35) × maturity × breadth
```

The board covers all 40 watchlist protocols and adds every other rankable pre-token protocol the snapshot carries (158 early finds), ranked by implied value — 198 rows in all. A protocol is said to record no token, never to have none.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Open `out/dashboard/index.html` in a browser; it renders with no network.

## Layout

- `main.ts` — entrypoint: reads the snapshot, scores the board, writes the output
- `lib/model.ts` — the radar-2 model, comparables, farm plans
- `dashboard/` — the static page (index.html, app.css, app.js)
- `screenshots/` — board, detail view, filtered view
- `vendor/makefun-board.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=d5a50dzy&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
