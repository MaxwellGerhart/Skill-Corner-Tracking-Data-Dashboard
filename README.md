# Skill-Corner-Tracking-Data-Dashboard

Exploring [SkillCorner's open football data](https://github.com/SkillCorner/opendata) (A-League 2024/25) to answer: **how can we evaluate players off the ball?**

## Notebooks

| Notebook | What it does |
|---|---|
| [`notebooks/01_skillcorner_eda.ipynb`](notebooks/01_skillcorner_eda.ipynb) | Exploratory pass over the open data: broadcast tracking, dynamic events and phases of play for the 20 matches, plus season aggregates. Downloads what it needs into `data/` on the first run (about 175 MB) and reuses the cached files after. |
| [`notebooks/01_off_ball_player_evaluation.ipynb`](notebooks/01_off_ball_player_evaluation.ipynb) | Downloads SkillCorner's season-level off-ball run data, explains its structure, cleans it into a simple table, checks the numbers, and charts how often vs. how dangerously attackers make runs. Written for non-coders. |

Outputs are saved to `data/processed/` (`off_ball_runs_clean.csv`, `off_ball_runs_chart.png`).

## Running it

1. One-time setup (in a terminal, from this folder):
   ```
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```
2. Open the notebook in VS Code, click **Run All**, and pick the `.venv` kernel when asked.

Data © SkillCorner, shared through its open-data initiative with PySport.

## Web app (SvelteKit + Tailwind CSS)

The dashboard is a [SvelteKit](https://svelte.dev/docs/kit) app written in TypeScript, styled with [Tailwind CSS](https://tailwindcss.com) v4.

```
npm install        # one-time: install dependencies
npm run dev        # start the dev server at http://localhost:5173
npm run build      # production build
npm run check      # type-check the project
```

### Match replays (tracking data)

The **Matches** pages replay a full match from SkillCorner's broadcast tracking data (every player and the ball, 10 times a second) with toggleable layers: trails, Voronoi, pitch control, formation lines, estimated orientation and vision cones, the broadcast camera footprint and camera follow, off-camera (extrapolated) players, a vertical pitch, and SkillCorner's off-ball runs.

### Database (TiDB)

The dashboard reads all of its data from a TiDB Cloud database: the season off-ball-run tables, match metadata, events, and full tracking (one row per player per frame, ~1.4M rows per match). Tracking is served to the match viewer one minute at a time by `/api/matches/[id]/frames/[chunk]`.

1. Add the connection string to `.env` (gitignored). Use a project database such as `skillcorner`, not a system schema like `sys`:
   ```
   SKILLCORNER_TIDB_URL=mysql://<user>:<password>@<host>:4000/skillcorner
   ```
   The app and the loader read this from this project's `.env` file first, so a connection exported in your shell for another project is never used.
2. Load the data (downloads any missing SkillCorner files first; re-running replaces what it loads):
   ```
   .venv\Scripts\python scripts\load_tidb.py --season            # season tables
   .venv\Scripts\python scripts\load_tidb.py 1925299             # one or more matches
   .venv\Scripts\python scripts\load_tidb.py --season --all      # everything in the open-data repo
   .venv\Scripts\python scripts\load_tidb.py --goals-only        # recompute goals only (no tracking reload)
   ```
3. Club crests (13 small WebP images, stored in the `team_logos` table and served by `/api/teams/[id]/logo`):
   ```
   .venv\Scripts\python scripts\fetch_logos.py
   ```
   The crests are the clubs' trademarks, taken from Wikipedia's non-free files and used only to identify teams; each row records its source file page.
4. Player headshots (small WebP images in `player_headshots`, served by `/api/players/[id]/headshot`; players without one get an initials avatar):
   ```
   .venv\Scripts\python scripts\fetch_headshots.py
   ```
   Personal, non-commercial practice use only — the photos are FotMob's (one is from Wikimedia Commons, with its licence stored), so don't redistribute them or deploy the site publicly with them. Downloaded pages and images are cached in `data/raw/headshots_cache/` (gitignored), so re-runs don't re-fetch.

Deployed builds have no `.env`, so set `SKILLCORNER_TIDB_URL` as a secret on the host. Pages are now rendered on request (not prerendered), so the deployment target needs a server runtime.

Pages live in `src/routes/`. Tailwind is loaded globally from `src/routes/layout.css`, so Tailwind classes work in any `.svelte` file.
