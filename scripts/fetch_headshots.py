"""
Find a headshot for every player in the dashboard, compress it, and store it in TiDB
(table player_headshots). Personal, non-commercial practice project — don't redistribute.

Sources, in order:
  1. FotMob current squads: the public squad page of every A-League Men club, matched
     on date of birth + name. (FotMob's /api/ is disallowed by robots.txt and isn't used.)
  2. FotMob's 2024/25 minutes-played list (the static file its season stats page links
     to), matched on name with team as a tie-break — covers players who have since left.
  Both give a FotMob player id; the photo comes from FotMob's image CDN.
  3. Wikimedia Commons, via Wikidata (date of birth + name), for anyone still missing.
     Freely licensed; author and licence are stored for attribution.
Players with neither keep the dashboard's initials avatar.

Usage (from the project root):
    .venv\\Scripts\\python scripts\\fetch_headshots.py
"""

from __future__ import annotations

import gzip
import io
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import pymysql
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_tidb import RAW_DIR, connect  # noqa: E402

USER_AGENT = "Mozilla/5.0 (compatible; SkillCornerDashboard/0.1; personal practice project)"
CACHE = Path(__file__).resolve().parent.parent / "data" / "raw" / "headshots_cache"  # gitignored (data/raw)
SIZE = 160  # px square; shown at ≤ 48 px
WEBP_QUALITY = 70
PAGE_DELAY = 3.0  # seconds between page requests
IMAGE_DELAY = 0.5

FOTMOB = "https://www.fotmob.com"
FOTMOB_IMG = "https://images.fotmob.com/image_resources/playerimages/{}.png"
LEAGUE = 113  # A-League Men on FotMob
SEASON_2425 = 23989  # FotMob's id for the 2024/25 A-League Men season

DDL = """
CREATE TABLE IF NOT EXISTS player_headshots (
  player_id BIGINT NOT NULL PRIMARY KEY CLUSTERED,
  source ENUM('fotmob', 'wikimedia') NOT NULL,
  mime VARCHAR(32) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  image MEDIUMBLOB NOT NULL,
  source_url VARCHAR(512) NOT NULL,
  credit VARCHAR(512) NULL,
  license VARCHAR(128) NULL,
  fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)"""


# ---------- HTTP with a local cache, so re-runs don't re-hit anyone's servers ----------


def fetch(url: str, delay: float) -> bytes | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / re.sub(r"[^A-Za-z0-9._-]+", "_", url)[-180:]
    if key.exists():
        data = key.read_bytes()
        return data or None
    time.sleep(delay)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):
            key.write_bytes(b"")  # remember "no image" too
            return None
        raise
    if data[:2] == bytes([0x1F, 0x8B]):  # some static files are served pre-gzipped
        data = gzip.decompress(data)
    key.write_bytes(data)
    return data


def next_data(html: bytes) -> dict:
    m = re.search(rb'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else {}


# ---------- Names ----------


def norm(name: str) -> list[str]:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return [t for t in re.split(r"[^a-z]+", s) if t]


def names_match(a: str, b: str) -> bool:
    """Same person if the surnames agree and the first names agree or one is an initial."""
    ta, tb = norm(a), norm(b)
    if not ta or not tb:
        return False
    if ta == tb or set(ta) <= set(tb) or set(tb) <= set(ta):
        return True
    return ta[-1] == tb[-1] and (ta[0][0] == tb[0][0])


def slug(name: str) -> str:
    return "-".join(norm(name))


# ---------- Our players ----------


def our_players(conn) -> list[dict]:
    players: dict[int, dict] = {}
    with conn.cursor() as cur:
        cur.execute("SELECT DISTINCT player_id, player_name, player_short_name, player_birthdate FROM obr_aggregates")
        for pid, name, short, dob in cur.fetchall():
            players[int(pid)] = {"id": int(pid), "name": name, "short": short, "dob": str(dob)[:10] if dob else None, "teams": set()}
        cur.execute("SELECT player_id, team_name FROM obr_aggregates")
        for pid, team in cur.fetchall():
            players[int(pid)]["teams"].add(team)
        cur.execute(
            "SELECT DISTINCT mp.player_id, mp.name, mp.short_name, IF(mp.team = 'home', m.home_name, m.away_name)"
            " FROM match_players mp JOIN matches m ON m.match_id = mp.match_id"
        )
        for pid, name, short, team in cur.fetchall():
            players.setdefault(int(pid), {"id": int(pid), "name": name, "short": short, "dob": None, "teams": set()})["teams"].add(team)
    # Birthdays for match-only players come from the raw match files.
    for path in RAW_DIR.glob("*/*_match.json"):
        for p in json.loads(path.read_text(encoding="utf-8"))["players"]:
            rec = players.get(p["id"])
            if rec and not rec["dob"] and p.get("birthday"):
                rec["dob"] = p["birthday"][:10]
    return list(players.values())


# ---------- FotMob ----------


def fotmob_teams() -> dict[str, str]:
    """team id → name, for every club in the 2024/25 and current A-League Men seasons."""
    teams = {}
    for url in (f"{FOTMOB}/leagues/{LEAGUE}/fixtures/a-league?season=2024%2F2025", f"{FOTMOB}/leagues/{LEAGUE}/fixtures/a-league"):
        data = next_data(fetch(url, PAGE_DELAY) or b"")
        for side in re.findall(r'"(?:home|away)":\s*\{"name":\s*"([^"]+)",\s*"shortName":\s*"[^"]*",\s*"id":\s*"?(\d+)', json.dumps(data)):
            teams[side[1]] = side[0]
    return teams


def fotmob_squad_members() -> list[dict]:
    members = []
    for team_id, team_name in sorted(fotmob_teams().items()):
        data = next_data(fetch(f"{FOTMOB}/teams/{team_id}/squad/{slug(team_name)}", PAGE_DELAY) or b"")
        team = (data.get("props", {}).get("pageProps", {}).get("fallback", {}) or {}).get(f"team-{team_id}", {})
        groups = (team.get("squad") or {}).get("squad") or []
        n = 0
        for g in groups:
            if g.get("title") == "coach":
                continue
            for m in g.get("members", []):
                members.append({"fotmob_id": m["id"], "name": m["name"], "dob": m.get("dateOfBirth"), "team": team_name})
                n += 1
        print(f"  FotMob {team_name}: {n} players")
    return members


def fotmob_season_players() -> list[dict]:
    """Everyone with minutes in FotMob's 2024/25 A-League Men season."""
    url = f"https://data.fotmob.com/stats/{LEAGUE}/season/{SEASON_2425}/mins_played.json"
    data = json.loads(fetch(url, PAGE_DELAY) or b"{}")
    rows = (data.get("TopLists") or [{}])[0].get("StatList", [])
    return [{"fotmob_id": r["ParticiantId"], "name": r["ParticipantName"], "team": r.get("TeamName", "")} for r in rows]


def team_overlap(fotmob_team: str, our_teams: set[str]) -> bool:
    words = set(norm(fotmob_team)) - {"fc", "united", "city"}
    return any(words & set(norm(t)) for t in our_teams)


# ---------- Wikidata / Commons ----------


def wikidata_candidates(dobs: list[str]) -> list[dict]:
    """Footballers born on any of these dates who have a Commons image."""
    out = []
    for i in range(0, len(dobs), 40):
        values = " ".join(f'"{d}T00:00:00Z"^^xsd:dateTime' for d in dobs[i : i + 40])
        q = f"""
        SELECT ?p ?pLabel ?dob ?img WHERE {{
          VALUES ?dob {{ {values} }}
          ?p wdt:P569 ?dob ; wdt:P106 wd:Q937857 ; wdt:P18 ?img .
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}"""
        data = fetch("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(q), PAGE_DELAY)
        for b in json.loads(data)["results"]["bindings"]:
            out.append({"name": b["pLabel"]["value"], "dob": b["dob"]["value"][:10], "img": b["img"]["value"]})
    return out


def commons_info(file_url: str) -> tuple[str, str | None, str | None]:
    """(thumbnail URL, credit, licence) for a Special:FilePath image URL."""
    title = "File:" + urllib.parse.unquote(file_url.rsplit("/", 1)[1])
    params = {
        "action": "query", "format": "json", "titles": title, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 400,
    }
    data = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params), 1.0))
    info = next(iter(data["query"]["pages"].values()))["imageinfo"][0]
    meta = info.get("extmetadata", {})
    artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip() or None
    lic = meta.get("LicenseShortName", {}).get("value")
    return info["thumburl"], artist, lic


# ---------- Images ----------


def to_webp(raw: bytes, crop_portrait: bool) -> tuple[bytes, int, int]:
    img = Image.open(io.BytesIO(raw))
    img = img.convert("RGBA")
    if crop_portrait:
        # Commons photos vary; a centred square from the top of the frame usually holds the head.
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        img = img.crop((left, 0, left + side, side))
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue(), img.width, img.height


def main() -> None:
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(DDL)
    players = our_players(conn)
    print(f"{len(players)} players to find")

    found: dict[int, dict] = {}

    # 1. FotMob current squads.
    members = fotmob_squad_members()
    by_dob: dict[str, list[dict]] = {}
    for m in members:
        if m["dob"]:
            by_dob.setdefault(m["dob"], []).append(m)
    for p in players:
        cands = by_dob.get(p["dob"] or "", [])
        hit = next((m for m in cands if names_match(p["name"], m["name"])), None)
        if not hit and not p["dob"]:
            hit = next((m for m in members if norm(m["name"]) == norm(p["name"])), None)
        if hit:
            found[p["id"]] = {"source": "fotmob", "url": FOTMOB_IMG.format(hit["fotmob_id"]), "credit": "FotMob", "license": None}
    print(f"FotMob squad matches: {len(found)}")

    # 2. FotMob 2024/25 season list (players who have left since).
    season = fotmob_season_players()
    for p in players:
        if p["id"] in found:
            continue
        cands = [r for r in season if names_match(p["name"], r["name"])]
        if len(cands) > 1:
            cands = [r for r in cands if team_overlap(r["team"], p["teams"])]
        if len(cands) == 1:
            found[p["id"]] = {"source": "fotmob", "url": FOTMOB_IMG.format(cands[0]["fotmob_id"]), "credit": "FotMob", "license": None}
    print(f"After FotMob season list: {len(found)}")

    # 3. Wikimedia Commons for the rest.
    rest = [p for p in players if p["id"] not in found and p["dob"]]
    wd = wikidata_candidates(sorted({p["dob"] for p in rest}))
    for p in rest:
        hit = next((c for c in wd if c["dob"] == p["dob"] and names_match(p["name"], c["name"])), None)
        if hit:
            found[p["id"]] = {"source": "wikimedia", "url": hit["img"], "credit": None, "license": None}
    print(f"After Wikimedia: {len(found)}")

    # 4. Download, compress, store.
    stored = {"fotmob": 0, "wikimedia": 0}
    raw_bytes = out_bytes = 0
    for p in players:
        f = found.get(p["id"])
        if not f:
            continue
        url, credit, lic = f["url"], f["credit"], f["license"]
        if f["source"] == "wikimedia":
            url, credit, lic = commons_info(f["url"])
        raw = fetch(url, IMAGE_DELAY)
        if not raw:
            continue
        try:
            webp, w, h = to_webp(raw, crop_portrait=f["source"] == "wikimedia")
        except Exception as e:  # unreadable image
            print(f"  skip {p['name']}: {e}")
            continue
        raw_bytes += len(raw)
        out_bytes += len(webp)
        try:
            conn.ping(reconnect=False)
        except pymysql.err.Error:  # the fetch phase can outlast TiDB's idle timeout
            conn = connect()
        with conn.cursor() as cur:
            cur.execute(
                "REPLACE INTO player_headshots (player_id, source, mime, width, height, image, source_url, credit, license)"
                " VALUES (%s, %s, 'image/webp', %s, %s, %s, %s, %s, %s)",
                (p["id"], f["source"], w, h, webp, f["url"] if f["source"] == "wikimedia" else url, (credit or "")[:500] or None, lic),
            )
        stored[f["source"]] += 1
    total = sum(stored.values())
    print(
        f"Stored {total}/{len(players)} headshots ({stored['fotmob']} FotMob, {stored['wikimedia']} Wikimedia); "
        f"{raw_bytes / 1e6:.1f} MB downloaded -> {out_bytes / 1e6:.2f} MB WebP"
    )
    conn.close()


if __name__ == "__main__":
    main()
