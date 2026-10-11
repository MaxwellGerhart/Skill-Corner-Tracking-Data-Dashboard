"""
Fetch the 13 A-League Men club crests from Wikipedia, compress them, and store them in
TiDB (table team_logos) for the dashboard to serve.

The crests are the clubs' trademarks and are held on Wikipedia as non-free files; they
are used here only to identify teams. Each row records the source file page.

Usage (from the project root):
    .venv\\Scripts\\python scripts\\fetch_logos.py
"""

from __future__ import annotations

import io
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from load_tidb import connect  # noqa: E402  (same .env-only connection as the loader)

USER_AGENT = "SkillCornerDashboard/0.1 (internal analytics; club crests for team identification)"
MAX_SIZE = 160  # px, longest side — crests are shown at ≤ 40 px, so this covers 4x displays
WEBP_QUALITY = 80

# SkillCorner team name (as in obr_aggregates / matches) → English Wikipedia article.
ARTICLES = {
    "Adelaide United Football Club": "Adelaide United FC",
    "Auckland FC": "Auckland FC",
    "Brisbane Roar FC": "Brisbane Roar FC",
    "Central Coast Mariners Football Club": "Central Coast Mariners FC",
    "Macarthur FC": "Macarthur FC",
    "Melbourne City FC": "Melbourne City FC",
    "Melbourne Victory Football Club": "Melbourne Victory FC",
    "Newcastle United Jets FC": "Newcastle Jets FC",
    "Perth Glory Football Club": "Perth Glory FC",
    "Sydney Football Club": "Sydney FC",
    "Wellington Phoenix FC": "Wellington Phoenix FC",
    "Western Sydney Wanderers FC": "Western Sydney Wanderers FC",
    "Western United": "Western United FC",
}

DDL = """
CREATE TABLE IF NOT EXISTS team_logos (
  team_id BIGINT NOT NULL PRIMARY KEY CLUSTERED,
  team_name VARCHAR(128) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  image MEDIUMBLOB NOT NULL,
  source_url VARCHAR(512) NOT NULL,
  license_note VARCHAR(255) NOT NULL,
  fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)"""


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def crest_thumbnails() -> dict[str, tuple[str, str]]:
    """Article title → (PNG thumbnail URL, file page URL), via the Wikipedia API."""
    params = {
        "action": "query",
        "format": "json",
        "redirects": 1,
        "prop": "pageimages",
        "piprop": "thumbnail|name",
        "pithumbsize": 330,
        "pilicense": "any",  # crests are non-free files, which the default 'free' filter skips
        "titles": "|".join(ARTICLES.values()),
    }
    data = json.loads(get("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)))
    # Map redirected titles back to the titles we asked for.
    back = {r["to"]: r["from"] for r in data["query"].get("redirects", [])}
    out = {}
    for page in data["query"]["pages"].values():
        title = back.get(page["title"], page["title"])
        if "thumbnail" in page:
            file_page = "https://en.wikipedia.org/wiki/File:" + urllib.parse.quote(page["pageimage"])
            out[title] = (page["thumbnail"]["source"], file_page)
    return out


def compress(png: bytes) -> tuple[bytes, int, int]:
    img = Image.open(io.BytesIO(png)).convert("RGBA")
    img.thumbnail((MAX_SIZE, MAX_SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue(), img.width, img.height


def main() -> None:
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(DDL)
        cur.execute("SELECT DISTINCT team_id, team_name FROM obr_aggregates")
        team_ids = {name: tid for tid, name in cur.fetchall()}

    thumbs = crest_thumbnails()
    total_in = total_out = 0
    for team_name, article in ARTICLES.items():
        if team_name not in team_ids:
            print(f"  skip {team_name}: not in the season data")
            continue
        if article not in thumbs:
            print(f"  MISSING crest for {article}")
            continue
        url, file_page = thumbs[article]
        png = get(url)
        webp, w, h = compress(png)
        total_in += len(png)
        total_out += len(webp)
        with conn.cursor() as cur:
            cur.execute(
                "REPLACE INTO team_logos (team_id, team_name, mime, width, height, image, source_url, license_note)"
                " VALUES (%s, %s, 'image/webp', %s, %s, %s, %s, %s)",
                (team_ids[team_name], team_name, w, h, webp, file_page, "Club trademark; Wikipedia non-free file; team identification only"),
            )
        print(f"  {team_name}: {len(png) / 1024:.0f} KB PNG -> {len(webp) / 1024:.1f} KB WebP ({w}x{h})")
        time.sleep(1)  # be gentle with Wikimedia's servers
    print(f"Total {total_in / 1024:.0f} KB -> {total_out / 1024:.0f} KB")
    conn.close()


if __name__ == "__main__":
    main()
