"""
Load the SkillCorner open data into TiDB, where the dashboard reads it from.

Connection: SKILLCORNER_TIDB_URL in this project's .env file, e.g.
    SKILLCORNER_TIDB_URL=mysql://<user>:<password>@<host>:4000/skillcorner
Only the .env file is read (not shell environment variables), so a connection string
from another project can never be picked up by accident. The database in the URL is
created if it doesn't exist; MySQL system schemas (sys, mysql, ...) are refused.

Usage (from the project root):
    .venv\\Scripts\\python scripts\\load_tidb.py --season               season off-ball-run tables
    .venv\\Scripts\\python scripts\\load_tidb.py 1925299 [more ids]      matches, events and tracking
    .venv\\Scripts\\python scripts\\load_tidb.py --season --all          everything in the open-data repo
    .venv\\Scripts\\python scripts\\load_tidb.py --goals-only            recompute goals for every loaded match

Tables:
    obr_aggregates, off_ball_runs_clean      season data (raw SkillCorner CSV + the notebook's cleaned table)
    matches, match_players, match_goals      one row per match / player / goal
    dynamic_events, phases_of_play           SkillCorner CSVs as published, plus match_id
    tracking_frames                          one row per frame: ball, camera footprint, possession
    tracking_positions                       one row per player per frame (~1.4M rows per match)

Re-running replaces the data for the matches (or season) being loaded.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import ssl
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlparse

import pandas as pd
import pymysql

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "matches"
ENV_FILE = ROOT / ".env"
ENV_KEY = "SKILLCORNER_TIDB_URL"
SYSTEM_SCHEMAS = {"sys", "mysql", "information_schema", "performance_schema", "metrics_schema", "lightning_task_info"}

REPO_RAW = "https://raw.githubusercontent.com/SkillCorner/opendata/master/data"
REPO_MEDIA = "https://media.githubusercontent.com/media/SkillCorner/opendata/master/data"

FPS = 10
BATCH_ROWS = 20_000

# Formation lines are drawn through players of the same line, so every role maps to one.
LINE_BY_ROLE = {
    "GK": "GK",
    "LCB": "DEF", "RCB": "DEF", "CB": "DEF", "LB": "DEF", "RB": "DEF", "LWB": "DEF", "RWB": "DEF",
    "LDM": "MID", "RDM": "MID", "DM": "MID", "CM": "MID", "LCM": "MID", "RCM": "MID",
    "LM": "MID", "RM": "MID", "AM": "MID", "LAM": "MID", "RAM": "MID",
    "LW": "ATT", "RW": "ATT", "CF": "ATT", "LF": "ATT", "RF": "ATT", "ST": "ATT",
}


# ---------- Connection ----------


def read_env_url() -> str:
    if not ENV_FILE.exists():
        sys.exit(f"No .env file at {ENV_FILE}. Add {ENV_KEY}=mysql://user:password@host:4000/skillcorner")
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(f"{ENV_KEY}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{ENV_KEY} is not set in {ENV_FILE}")


def connect() -> pymysql.connections.Connection:
    url = urlparse(read_env_url())
    database = url.path.lstrip("/") or "skillcorner"
    if database.lower() in SYSTEM_SCHEMAS:
        sys.exit(f"Refusing to write to system schema '{database}'. Point {ENV_KEY} at e.g. /skillcorner.")
    print(f"TiDB: {unquote(url.username or '')} @ {url.hostname}:{url.port or 4000} / {database}")
    # TiDB Cloud Serverless requires TLS; the default context verifies against the OS store.
    conn = pymysql.connect(
        host=url.hostname,
        port=url.port or 4000,
        user=unquote(url.username or ""),
        password=unquote(url.password or ""),
        ssl=ssl.create_default_context(),
        autocommit=True,
        charset="utf8mb4",
        local_infile=False,
    )
    with conn.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{database}`")
    conn.select_db(database)
    return conn


# ---------- Generic helpers ----------


def sql_type(series: pd.Series) -> str:
    values = series.dropna()
    if pd.api.types.is_bool_dtype(series) or (len(values) and set(values.unique()) <= {True, False}):
        return "BOOLEAN"
    if pd.api.types.is_integer_dtype(series):
        return "BIGINT"
    if pd.api.types.is_float_dtype(series):
        return "DOUBLE"
    longest = values.map(lambda v: len(str(v))).max() if len(values) else 0
    return "VARCHAR(128)" if longest <= 120 else "TEXT"


def py_value(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):  # numpy scalar
        return v.item()
    return v


def insert_rows(conn, table: str, columns: list[str], rows, label: str | None = None) -> int:
    """Batched multi-row INSERT; pymysql folds executemany into large VALUES statements."""
    cols = ", ".join(f"`{c}`" for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT INTO `{table}` ({cols}) VALUES ({placeholders})"
    total = 0
    batch = []
    started = time.time()
    with conn.cursor() as cur:
        for row in rows:
            batch.append(row)
            if len(batch) >= BATCH_ROWS:
                cur.executemany(sql, batch)
                total += len(batch)
                batch.clear()
                if label:
                    print(f"\r  {label}: {total:,} rows ({total / (time.time() - started):,.0f}/s)", end="", flush=True)
        if batch:
            cur.executemany(sql, batch)
            total += len(batch)
    if label:
        print(f"\r  {label}: {total:,} rows in {time.time() - started:.0f}s" + " " * 20)
    return total


def create_table_from_df(conn, table: str, df: pd.DataFrame, primary_key: list[str], indexes: list[list[str]] = ()) -> None:
    defs = []
    for col in df.columns:
        kind = sql_type(df[col])
        if col in primary_key and kind == "TEXT":
            kind = "VARCHAR(128)"
        null = " NOT NULL" if col in primary_key else ""
        defs.append(f"`{col}` {kind}{null}")
    defs.append(f"PRIMARY KEY ({', '.join(f'`{c}`' for c in primary_key)}) CLUSTERED")
    for idx in indexes:
        defs.append(f"KEY `ix_{'_'.join(idx)}` ({', '.join(f'`{c}`' for c in idx)})")
    with conn.cursor() as cur:
        cur.execute(f"CREATE TABLE IF NOT EXISTS `{table}` (\n  " + ",\n  ".join(defs) + "\n)")


TYPE_RANK = {"BOOLEAN": 0, "BIGINT": 1, "DOUBLE": 2, "VARCHAR(128)": 3, "TEXT": 4}


def ensure_columns(conn, table: str, df: pd.DataFrame) -> None:
    """Add or widen columns so this file fits a table created from an earlier file.

    Each match's CSV is typed on its own, so a column that is all-empty (DOUBLE) in one
    match can hold text in the next.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns"
            " WHERE table_schema = DATABASE() AND table_name = %s",
            (table,),
        )
        existing = {}
        for name, data_type, length in cur.fetchall():
            data_type = data_type.lower()
            existing[name] = (
                "BOOLEAN" if data_type == "tinyint" else "BIGINT" if data_type == "bigint" else "DOUBLE" if data_type == "double"
                else "TEXT" if "text" in data_type else "VARCHAR(128)" if data_type == "varchar" and (length or 0) <= 128 else "TEXT"
            )
        for col in df.columns:
            wanted = sql_type(df[col])
            if col not in existing:
                cur.execute(f"ALTER TABLE `{table}` ADD COLUMN `{col}` {wanted} NULL")
            elif TYPE_RANK[wanted] > TYPE_RANK[existing[col]]:
                cur.execute(f"ALTER TABLE `{table}` MODIFY COLUMN `{col}` {wanted} NULL")


def delete_match(conn, table: str, match_id: int) -> None:
    # Small batches keep each transaction well inside TiDB Serverless limits.
    with conn.cursor() as cur:
        while cur.execute(f"DELETE FROM `{table}` WHERE match_id = %s LIMIT 50000", (match_id,)):
            pass


def load_frame_table(conn, table: str, df: pd.DataFrame, primary_key: list[str], match_id: int | None = None, indexes=()) -> None:
    create_table_from_df(conn, table, df, primary_key, indexes)
    ensure_columns(conn, table, df)
    if match_id is None:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM `{table}`")
    else:
        delete_match(conn, table, match_id)
    rows = ([py_value(v) for v in r] for r in df.itertuples(index=False, name=None))
    insert_rows(conn, table, list(df.columns), rows, label=table)


# ---------- Season ----------


def load_season(conn) -> None:
    print("Season tables")
    raw = pd.read_csv(ROOT / "data" / "raw" / "aus1league_obraggregates_20242025.csv")
    load_frame_table(conn, "obr_aggregates", raw, ["player_id", "position_group", "team_id"])
    clean = pd.read_csv(ROOT / "data" / "processed" / "off_ball_runs_clean.csv")
    load_frame_table(conn, "off_ball_runs_clean", clean, ["player", "team", "position"])


# ---------- Matches ----------


def download(url: str, dest: Path) -> None:
    print(f"  downloading {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url) as response, open(tmp, "wb") as out:
        shutil.copyfileobj(response, out)
    tmp.replace(dest)


def ensure_raw_files(match_id: int) -> Path:
    folder = RAW_DIR / str(match_id)
    files = {
        f"{match_id}_match.json": REPO_RAW,
        f"{match_id}_dynamic_events.csv": REPO_RAW,
        f"{match_id}_phases_of_play.csv": REPO_RAW,
        f"{match_id}_tracking_extrapolated.jsonl": REPO_MEDIA,  # stored with Git LFS
    }
    for name, base in files.items():
        path = folder / name
        legacy = ROOT / "data" / "raw" / name
        if not path.exists() and legacy.exists():
            folder.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(legacy, path)
        if not path.exists():
            download(f"{base}/matches/{match_id}/{name}", path)
    return folder


def build_players(match: dict, events: pd.DataFrame, tracked_ids: set[int]) -> list[dict]:
    home_id = match["home_team"]["id"]
    # Substitutes are listed with role "SUB"; their most common on-pitch role comes from events.
    event_roles = (
        events.dropna(subset=["player_id", "player_position"])
        .groupby("player_id")["player_position"]
        .agg(lambda s: Counter(s).most_common(1)[0][0])
        .to_dict()
    )
    players = []
    for p in match["players"]:
        role = p["player_role"]["acronym"]
        if role == "SUB":
            role = event_roles.get(float(p["id"]), event_roles.get(p["id"], "SUB"))
        total = p["playing_time"]["total"] or {}
        players.append(
            {
                "player_id": p["id"],
                "team": "home" if p["team_id"] == home_id else "away",
                "team_id": p["team_id"],
                "name": f'{p["first_name"]} {p["last_name"]}'.strip(),
                "short_name": p["short_name"],
                "number": p["number"],
                "role": role,
                "line": LINE_BY_ROLE.get(role, "MID"),
                "start_frame": total.get("start_frame"),
                "end_frame": total.get("end_frame"),
                "goals": p["goal"],
                "own_goals": p["own_goal"],
                "tracked": p["id"] in tracked_ids,
            }
        )
    # Slot = the player's index in the viewer's frame layout: tracked players only,
    # home then away, starters first, then by shirt number.
    tracked = sorted((p for p in players if p["tracked"]), key=lambda p: (p["team"] != "home", p["start_frame"] or 0, p["number"] or 0))
    for slot, p in enumerate(tracked):
        p["slot"] = slot
    for p in players:
        p.setdefault("slot", None)
        del p["tracked"]
    return players


def find_goals(match, events):
    """Goals placed on the tracking timeline, in order, plus any the events can't place.

    The score columns (team_score / opponent_team_score) say which team scored and in what
    order, but only update on the next event after a goal. Within each window between
    score changes the frame comes from the possession SkillCorner flags as ending in a goal
    (game_interruption_after = goal_for / goal_against), else the scoring team's last shot.
    Goals in the official score that the events never reflect (e.g. a stoppage-time goal
    with no event after it) are returned with frame None rather than given an invented time.
    """
    home_id = match['home_team']['id']
    side = lambda tid: 'home' if int(tid) == home_id else 'away'
    ev = events.sort_values('frame_start')
    shots = ev[ev['end_type'] == 'shot']
    flagged = ev[(ev['event_type'] == 'player_possession') & ev['game_interruption_after'].isin(['goal_for', 'goal_against'])]

    # Score change points: (frame of first event showing the new score, scoring side).
    changes, prev = [], {'home': 0, 'away': 0}
    for _, r in ev.dropna(subset=['team_score', 'opponent_team_score']).iterrows():
        mine, theirs = side(r['team_id']), 'away' if side(r['team_id']) == 'home' else 'home'
        now = {mine: int(r['team_score']), theirs: int(r['opponent_team_score'])}
        for team in ('home', 'away'):
            for _ in range(now[team] - prev[team]):
                changes.append((int(r['frame_start']), team))
        prev = now
    # Goals the score columns never caught up with (no event after them).
    tail = {t: match[f'{t}_team_score'] - sum(1 for _, x in changes if x == t) for t in ('home', 'away')}

    def place(team, lo, hi):
        cands = flagged[(flagged['frame_end'] > lo) & (flagged['frame_end'] <= hi)]
        if len(cands):
            r = cands.iloc[-1]
            frame = int(r['frame_end'])
            if side(r['team_id']) == team and r['game_interruption_after'] == 'goal_for':
                # The flagged possession can end in the assist; the scoring shot follows within seconds.
                near = shots[(shots['team_id'] == r['team_id']) & (shots['frame_start'] >= frame - 30) & (shots['frame_start'] <= frame + 60)]
                if len(near):
                    r = near.iloc[-1]
                    frame = int(r['frame_end'])
                return {'frame': frame, 'team': team, 'player': r['player_name'], 'minute': int(r['minute_start']) + 1}
            # Flags that disagree with the scoring side are usually own goals; the scorer isn't recorded.
            return {'frame': frame, 'team': team, 'player': None, 'minute': int(r['minute_start']) + 1}
        team_shots = shots[(shots['team_id'].map(side) == team) & (shots['frame_end'] > lo) & (shots['frame_end'] <= hi)]
        if len(team_shots):
            r = team_shots.iloc[-1]
            return {'frame': int(r['frame_end']), 'team': team, 'player': r['player_name'], 'minute': int(r['minute_start']) + 1}
        return None

    goals, lo = [], -1
    for frame, team in changes:
        g = place(team, lo, frame)
        goals.append(g or {'frame': None, 'team': team, 'player': None, 'minute': None})
        if g:
            lo = g['frame']
    last = lo
    for team in ('home', 'away'):
        for _ in range(max(0, tail[team])):
            g = place(team, last, float('inf'))
            if g and all(g['frame'] != x['frame'] for x in goals):
                goals.append(g)
                last = max(last, g['frame'])
            else:
                goals.append({'frame': None, 'team': team, 'player': None, 'minute': None})
    # The placed event's player isn't always the credited scorer (deflections, own goals);
    # only keep a name the match file credits with a goal.
    credited = {p['short_name'] for p in match['players'] if p['goal']}
    for g in goals:
        if g['player'] not in credited:
            g['player'] = None
    return sorted(goals, key=lambda g: (g['frame'] is None, g['frame'] or 0))


DDL = {
    "matches": """
        CREATE TABLE IF NOT EXISTS matches (
          match_id BIGINT NOT NULL PRIMARY KEY CLUSTERED,
          date_time DATETIME NOT NULL,
          competition VARCHAR(128),
          round_name VARCHAR(64),
          stadium VARCHAR(128),
          home_team_id BIGINT, home_name VARCHAR(128), home_short_name VARCHAR(64), home_acronym VARCHAR(8), home_score INT,
          away_team_id BIGINT, away_name VARCHAR(128), away_short_name VARCHAR(64), away_acronym VARCHAR(8), away_score INT,
          pitch_length DOUBLE, pitch_width DOUBLE,
          fps INT,
          n_frames INT,
          periods JSON,
          home_side JSON
        )""",
    "match_players": """
        CREATE TABLE IF NOT EXISTS match_players (
          match_id BIGINT NOT NULL,
          player_id BIGINT NOT NULL,
          slot INT NULL,
          team ENUM('home', 'away') NOT NULL,
          team_id BIGINT,
          name VARCHAR(128),
          short_name VARCHAR(64),
          number INT,
          role VARCHAR(8),
          line ENUM('GK', 'DEF', 'MID', 'ATT'),
          start_frame INT NULL,
          end_frame INT NULL,
          goals INT,
          own_goals INT,
          PRIMARY KEY (match_id, player_id) CLUSTERED
        )""",
    "match_goals": """
        CREATE TABLE IF NOT EXISTS match_goals (
          match_id BIGINT NOT NULL,
          seq INT NOT NULL,
          frame INT NULL,
          team ENUM('home', 'away') NOT NULL,
          player VARCHAR(128) NULL,
          minute INT NULL,
          PRIMARY KEY (match_id, seq) CLUSTERED
        )""",
    "tracking_frames": """
        CREATE TABLE IF NOT EXISTS tracking_frames (
          match_id BIGINT NOT NULL,
          frame INT NOT NULL,
          period TINYINT NULL,
          ts_seconds DOUBLE NULL,
          ball_x FLOAT NULL, ball_y FLOAT NULL, ball_z FLOAT NULL,
          ball_detected BOOLEAN NULL,
          possession ENUM('home', 'away') NULL,
          possession_player_id BIGINT NULL,
          cam_tl_x FLOAT NULL, cam_tl_y FLOAT NULL,
          cam_bl_x FLOAT NULL, cam_bl_y FLOAT NULL,
          cam_br_x FLOAT NULL, cam_br_y FLOAT NULL,
          cam_tr_x FLOAT NULL, cam_tr_y FLOAT NULL,
          PRIMARY KEY (match_id, frame) CLUSTERED
        )""",
    "tracking_positions": """
        CREATE TABLE IF NOT EXISTS tracking_positions (
          match_id BIGINT NOT NULL,
          frame INT NOT NULL,
          player_id BIGINT NOT NULL,
          x FLOAT NOT NULL,
          y FLOAT NOT NULL,
          is_detected BOOLEAN NOT NULL,
          PRIMARY KEY (match_id, frame, player_id) CLUSTERED
        )""",
}


def ensure_schema(conn) -> None:
    with conn.cursor() as cur:
        # match_goals was first keyed by frame, which can't hold a goal with no known frame.
        cur.execute(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'match_goals' AND column_name = 'seq'"
        )
        if not cur.fetchone()[0]:
            cur.execute("DROP TABLE IF EXISTS match_goals")
        for ddl in DDL.values():
            cur.execute(ddl)


def store_goals(conn, match_id: int, match: dict, events: pd.DataFrame) -> list[dict]:
    goals = find_goals(match, events)
    delete_match(conn, "match_goals", match_id)
    insert_rows(
        conn,
        "match_goals",
        ["match_id", "seq", "frame", "team", "player", "minute"],
        ([match_id, i, g["frame"], g["team"], g["player"], g["minute"]] for i, g in enumerate(goals)),
    )
    return goals


def refresh_goals(conn, match_ids: list[int]) -> None:
    """Recompute match_goals from the raw files without reloading tracking."""
    ensure_schema(conn)
    for match_id in match_ids:
        folder = ensure_raw_files(match_id)
        match = json.loads((folder / f"{match_id}_match.json").read_text(encoding="utf-8"))
        events = pd.read_csv(folder / f"{match_id}_dynamic_events.csv", low_memory=False)
        goals = store_goals(conn, match_id, match, events)
        placed = sum(g["frame"] is not None for g in goals)
        print(f"  {match_id}: {len(goals)} goals ({placed} placed on the timeline)")


def round_label(rnd: dict) -> str:
    # A few matches carry an empty round name but still have the round number.
    return rnd.get("name") or (f"Round {rnd['round_number']}" if rnd.get("round_number") else "")


def parse_timestamp(ts: str | None) -> float | None:
    if not ts:
        return None
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def load_match(conn, match_id: int) -> None:
    print(f"Match {match_id}")
    folder = ensure_raw_files(match_id)
    match = json.loads((folder / f"{match_id}_match.json").read_text(encoding="utf-8"))
    events = pd.read_csv(folder / f"{match_id}_dynamic_events.csv", low_memory=False)
    phases = pd.read_csv(folder / f"{match_id}_phases_of_play.csv", low_memory=False)
    tracking_path = folder / f"{match_id}_tracking_extrapolated.jsonl"

    ensure_schema(conn)

    # Tracking: stream the 97 MB file once, collecting frame rows and position rows.
    frame_rows: list[tuple] = []
    tracked_ids: set[int] = set()
    n_frames = 0

    def position_rows():
        nonlocal n_frames
        with open(tracking_path, encoding="utf-8") as fh:
            for line in fh:
                f = json.loads(line)
                n_frames = max(n_frames, f["frame"] + 1)
                if f["period"] is None:
                    continue
                ball = f["ball_data"]
                cam = f["image_corners_projection"]
                group = f["possession"]["group"]
                frame_rows.append(
                    (
                        match_id, f["frame"], f["period"], parse_timestamp(f["timestamp"]),
                        ball["x"], ball["y"], ball["z"], ball["is_detected"],
                        "home" if group == "home team" else "away" if group == "away team" else None,
                        f["possession"]["player_id"],
                        cam["x_top_left"], cam["y_top_left"], cam["x_bottom_left"], cam["y_bottom_left"],
                        cam["x_bottom_right"], cam["y_bottom_right"], cam["x_top_right"], cam["y_top_right"],
                    )
                )
                for p in f["player_data"]:
                    tracked_ids.add(p["player_id"])
                    yield (match_id, f["frame"], p["player_id"], p["x"], p["y"], bool(p["is_detected"]))

    delete_match(conn, "tracking_positions", match_id)
    insert_rows(
        conn, "tracking_positions", ["match_id", "frame", "player_id", "x", "y", "is_detected"], position_rows(), label="tracking_positions"
    )
    delete_match(conn, "tracking_frames", match_id)
    insert_rows(
        conn,
        "tracking_frames",
        ["match_id", "frame", "period", "ts_seconds", "ball_x", "ball_y", "ball_z", "ball_detected", "possession", "possession_player_id",
         "cam_tl_x", "cam_tl_y", "cam_bl_x", "cam_bl_y", "cam_br_x", "cam_br_y", "cam_tr_x", "cam_tr_y"],
        iter(frame_rows),
        label="tracking_frames",
    )

    players = build_players(match, events, tracked_ids)
    delete_match(conn, "match_players", match_id)
    cols = ["player_id", "slot", "team", "team_id", "name", "short_name", "number", "role", "line", "start_frame", "end_frame", "goals", "own_goals"]
    insert_rows(conn, "match_players", ["match_id", *cols], ([match_id, *[p[c] for c in cols]] for p in players))

    goals = store_goals(conn, match_id, match, events)

    load_frame_table(conn, "dynamic_events", events, ["match_id", "event_id"], match_id, indexes=[["match_id", "event_type"], ["match_id", "frame_start"]])
    if "match_id" not in phases:
        phases.insert(0, "match_id", match_id)
    load_frame_table(conn, "phases_of_play", phases, ["match_id", "index"], match_id)

    with conn.cursor() as cur:
        cur.execute("DELETE FROM matches WHERE match_id = %s", (match_id,))
        cur.execute(
            """INSERT INTO matches VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                match_id,
                match["date_time"].replace("T", " ").rstrip("Z"),
                match["competition_edition"]["name"],
                round_label(match["competition_round"]),
                match["stadium"]["name"],
                match["home_team"]["id"], match["home_team"]["name"], match["home_team"]["short_name"], match["home_team"]["acronym"], match["home_team_score"],
                match["away_team"]["id"], match["away_team"]["name"], match["away_team"]["short_name"], match["away_team"]["acronym"], match["away_team_score"],
                match["pitch_length"], match["pitch_width"],
                FPS,
                n_frames,
                json.dumps([{"period": p["period"], "startFrame": p["start_frame"], "endFrame": p["end_frame"]} for p in match["match_periods"]]),
                json.dumps(match["home_team_side"]),
            ),
        )
    print(f"  {len(players)} players, {len(goals)} goals, {len(events):,} events")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ids", nargs="*", type=int, help="SkillCorner match ids")
    parser.add_argument("--season", action="store_true", help="load the season off-ball-run tables")
    parser.add_argument("--all", action="store_true", help="every match in the open-data repository")
    parser.add_argument("--goals-only", action="store_true", help="only recompute match_goals for the given matches (or every loaded match)")
    args = parser.parse_args()

    ids = args.ids
    if args.all:
        with urllib.request.urlopen(f"{REPO_RAW}/matches.json") as response:
            ids = [m["id"] for m in json.load(response)]
    if not ids and not args.season and not args.goals_only:
        parser.error("give match ids, --all, and/or --season")

    conn = connect()
    try:
        if args.goals_only:
            if not ids:
                with conn.cursor() as cur:
                    cur.execute("SELECT match_id FROM matches ORDER BY match_id")
                    ids = [r[0] for r in cur.fetchall()]
            refresh_goals(conn, ids)
            return
        if args.season:
            load_season(conn)
        for match_id in ids:
            load_match(conn, match_id)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
