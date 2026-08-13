"""
One-time import of your existing JSON anime database into MongoDB, using the
same schema the bot uses (see database.py docstring).

Usage:
    python migrate_json_to_mongo.py path/to/your_database.json

Handles two shapes for `seasons` / `episodes`:
  - a list:            "seasons": [ {...}, {...} ]
  - a dict keyed by number (like your real aot.json): "seasons": {"1": {...}, "2": {...}}

Adjust FIELD_MAP below if your existing JSON uses different key names for
top-level anime fields — no other code needs to change.

This script expects one JSON file containing anime *metadata* (title,
poster, banner, description, year, and optionally embedded seasons). If
your episodes live in separate per-anime files (e.g. json/episodes/aot.json
like your repo), merge each episodes file's "seasons" into the matching
anime object's "seasons" key before running this — or send me both files
and I'll write a merge step for your exact folder layout.

Episode shape produced (matches what the bot/API use):
{
  "episode_number": 1,
  "episodeTitle": "To You, in 2000 Years",
  "servers": {"server1": "https://...", "server2": ""},
  "added_at": <datetime>
}
"""
import sys
import json
import asyncio
from datetime import datetime, timezone

import database as db

# If your existing JSON uses different key names, map them here:
# old_key -> new_key (new_key must match the schema in database.py)
FIELD_MAP = {
    "name": "title",
    "imdb_id": "imdb",
    "poster_url": "poster",
    "banner_url": "banner",
    "desc": "description",
    "release_year": "year",
}


def _remap(obj: dict) -> dict:
    return {FIELD_MAP.get(k, k): v for k, v in obj.items()}


def _iter_numbered(value):
    """Yield (number, item) whether `value` is a list or a dict keyed by
    stringified numbers (like your real seasons/episodes JSON)."""
    if isinstance(value, dict):
        for key in sorted(value.keys(), key=lambda k: int(k) if str(k).isdigit() else 0):
            yield int(key) if str(key).isdigit() else key, value[key]
    elif isinstance(value, list):
        for i, item in enumerate(value, start=1):
            yield i, item


def _normalize_anime(raw: dict) -> dict:
    raw = _remap(raw)
    seasons = []
    for season_num, s in _iter_numbered(raw.get("seasons", {})):
        s = _remap(s)
        episodes = []
        for ep_num, e in _iter_numbered(s.get("episodes", {})):
            e = _remap(e)
            servers = e.get("servers", {})
            episodes.append({
                "episode_number": int(e.get("episode_number", ep_num)),
                "episodeTitle": e.get("episodeTitle", e.get("title", "")),
                "servers": {
                    "server1": servers.get("server1", e.get("video", "")),
                    "server2": servers.get("server2", ""),
                },
                "added_at": datetime.now(timezone.utc),
            })
        seasons.append({
            "season_number": int(s.get("season_number", season_num)),
            "episodes": episodes,
        })

    return {
        "title": raw.get("title", "Untitled"),
        "imdb": raw.get("imdb", ""),
        "poster": raw.get("poster", ""),
        "banner": raw.get("banner", ""),
        "description": raw.get("description", ""),
        "genres": raw.get("genres", []),
        "year": str(raw.get("year", "")),
        "created_at": datetime.now(timezone.utc),
        "seasons": seasons,
    }


async def main(json_path: str):
    with open(json_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    # Support either a bare list, or {"animes": [...]}
    items = raw_data if isinstance(raw_data, list) else raw_data.get("animes", [])
    if not items:
        print("No anime entries found in JSON file.")
        return

    inserted = 0
    for raw in items:
        doc = _normalize_anime(raw)
        existing = await db.animes.find_one({"title": doc["title"]})
        if existing:
            print(f"Skipping (already exists): {doc['title']}")
            continue
        await db.animes.insert_one(doc)
        inserted += 1
        print(f"Imported: {doc['title']} "
              f"({len(doc['seasons'])} season(s))")

    print(f"\nDone. Imported {inserted} of {len(items)} anime into MongoDB.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python migrate_json_to_mongo.py path/to/your_database.json")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
