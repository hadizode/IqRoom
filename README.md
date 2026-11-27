# IqRoom

Escape-room game studio + Telegram Mini App bot, merged into one repository.

## Layout

- `studio/` — Konva-based escape-room Design Studio (Vite + React). Also builds the play-only Mini App front-end.
- `bot/` — Telegram bot on the tgcloud platform (`tgcloud/` modules) with the Mini App front-end served from `bot/app`.

## How they connect

The game designed in the studio is the Mini App. `studio/public/play/` holds the
exported game data (`project.json` + assets file). Running:

```
npm run build:play
```

builds the play-only front-end **directly into `bot/app/`** (including
`bot/app/play/` data), which is exactly the folder `bot/tgcloud.jsonc` serves as
the Mini App. `npx tgcloud push` (from `bot/`, or `npm run push` at the root)
then deploys bot code + the built game.

## Commands (repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Run the Design Studio dev server |
| `npm run build:play` | Build the Mini App (play-only) into `bot/app/` |
| `npm run push` | Deploy bot modules + built Mini App (`tgcloud push`) |
| `npm run deploy` | Build + push |
| `npm run status` | Compare local bot code with the cloud |

## Editing a game

Design in the studio (`npm run dev`), export the project bundle, and place the
split output in `studio/public/play/` (`scripts/split-project.mjs`), then
`npm run deploy`.
