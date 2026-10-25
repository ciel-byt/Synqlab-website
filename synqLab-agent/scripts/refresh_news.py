#!/usr/bin/env python
"""Refresh the static News tab: fetch the latest posts of an X account and store them in the database.

Run it only when you want new posts (nothing runs it automatically):
    cd synqLab-agent && .venv/bin/python scripts/refresh_news.py [--handle BiologyAIDaily]

Needs X_BEARER_TOKEN (read from the environment or from ../.env) and SYNQLAB_DB_URL. Keeps the 10 newest distinct
original posts (no retweets, replies or repeats) and the first photo of each (video posts keep their preview image).
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from synqlab.storage.db import get_session  # noqa: E402
from synqlab.storage.models import SiteNews  # noqa: E402

API = "https://api.twitter.com/2"


def load_env() -> None:
    f = ROOT.parent / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def call(path: str, token: str) -> dict:
    req = urllib.request.Request(f"{API}{path}", headers={"Authorization": f"Bearer {token}", "User-Agent": "synqlab-news"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def clean(post: dict) -> str:
    text = post.get("text", "")
    for u in (post.get("entities") or {}).get("urls", []):
        disp = u.get("display_url", "")
        text = text.replace(u["url"], "" if disp.startswith("pic.") else u.get("expanded_url", u["url"]))
    return re.sub(r"https://t\.co/\w+", "", html.unescape(text)).strip()


def download(url: str) -> tuple[bytes, str] | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "synqlab-news"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read(3_000_000)
            return data, r.headers.get_content_type() or "image/jpeg"
    except Exception as e:  # noqa: BLE001
        print("  image skipped:", e)
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--handle", default=os.environ.get("NEWS_X_HANDLE", "BiologyAIDaily"))
    handle = ap.parse_args().handle.lstrip("@")
    load_env()
    token = os.environ.get("X_BEARER_TOKEN", "").strip()
    if not token:
        sys.exit("X_BEARER_TOKEN is not set (put it in .env at the repo root).")
    uid = call(f"/users/by/username/{handle}", token)["data"]["id"]
    d = call(f"/users/{uid}/tweets?max_results=20&exclude=retweets,replies&tweet.fields=created_at,entities,attachments"
             "&expansions=attachments.media_keys&media.fields=type,url,preview_image_url", token)
    media = {m["media_key"]: m for m in (d.get("includes") or {}).get("media", [])}
    posts, seen = [], set()
    for p in d.get("data", []):
        text = clean(p)
        key = re.sub(r"\W+", " ", text.lower())[:100]
        if not key or key in seen:
            continue
        seen.add(key)
        img = None
        for mk in (p.get("attachments") or {}).get("media_keys", []):
            m = media.get(mk, {})
            src = m.get("url") if m.get("type") == "photo" else m.get("preview_image_url")
            if src:
                img = download(src)
                break
        posts.append((p["id"], text, p.get("created_at"), f"https://x.com/{handle}/status/{p['id']}", img))
        if len(posts) == 10:
            break
    db = get_session()
    try:
        db.query(SiteNews).delete()
        for i, (pid, text, created, url, img) in enumerate(posts):
            db.add(SiteNews(id=pid, position=i, text=text, created_at=created, url=url,
                            image=img[0] if img else None, image_type=img[1] if img else None))
        db.commit()
    finally:
        db.close()
    print(f"Stored {len(posts)} posts from @{handle} ({sum(1 for p in posts if p[4])} with an image).")


if __name__ == "__main__":
    main()
