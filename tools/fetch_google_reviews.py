"""Refresh data/reviews.json from Radlay's Google Maps listing, then rebuild the pages.

    SERPAPI_KEY=... python tools/fetch_google_reviews.py

The key is read from the environment only; never commit it. Reviews are copied as written.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

DATA_ID = "0x1931a5c3f8e1fcfb:0x564f882ad0242a38"  # Radlay Automation, 5 Isobels Ln, Harare
PLACE_ID = "ChIJ-_zh-MOlMRkROCok0CqIT1Y"
OUT = Path(__file__).resolve().parent.parent / "data" / "reviews.json"


def serp(params):
    key = os.environ.get("SERPAPI_KEY")
    if not key:
        sys.exit("Set SERPAPI_KEY in the environment first.")
    url = "https://serpapi.com/search.json?" + urllib.parse.urlencode({**params, "api_key": key})
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.load(r)
    if data.get("error"):
        sys.exit(data["error"])
    return data


def main():
    d = serp({"engine": "google_maps_reviews", "data_id": DATA_ID, "sort_by": "qualityScore", "hl": "en"})
    place = d.get("place_info", {})
    reviews = []
    for r in d.get("reviews", []):
        user = r.get("user", {})
        when = datetime.fromisoformat(r["iso_date"].replace("Z", "+00:00")).strftime("%b %Y") if r.get("iso_date") else ""
        reviews.append({
            "name": user.get("name", "").strip(),
            "photo": user.get("thumbnail"),
            "local_guide": bool(user.get("local_guide")),
            "rating": r.get("rating"),
            "text": (r.get("snippet") or "").strip(),
            "when": when,
            "link": r.get("link"),
        })
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "source": "Google Maps",
        "fetched": datetime.now().strftime("%Y-%m-%d"),
        "rating": place.get("rating"),
        "count": place.get("reviews"),
        "place_url": f"https://www.google.com/maps/place/?q=place_id:{PLACE_ID}",
        "reviews": reviews,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(reviews)} reviews, {place.get('rating')} from {place.get('reviews')})")


if __name__ == "__main__":
    main()
