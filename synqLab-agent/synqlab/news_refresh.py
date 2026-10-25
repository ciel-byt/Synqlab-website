"""Fetch the latest posts of an X account into the News tab (site_news table).

Used by scripts/refresh_news.py (by hand) and by the server's background refresh (app/main.py).
Keeps the 10 newest distinct original posts (no retweets, replies or repeats) and the first photo of each
(video posts keep their preview image). An empty or failed fetch never wipes the stored news.
"""

from __future__ import annotations

import html
import json
import logging
import re
import urllib.request

from synqlab.storage.db import get_session
from synqlab.storage.models import SiteNews

API = "https://api.twitter.com/2"
log = logging.getLogger(__name__)


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
        log.warning("news image skipped: %s", e)
        return None


def refresh(handle: str, token: str) -> int:
    """Replace the stored news with the account's latest posts. Returns how many were stored."""
    handle = handle.lstrip("@")
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
    if not posts:
        return 0
    db = get_session()
    try:
        db.query(SiteNews).delete()
        for i, (pid, text, created, url, img) in enumerate(posts):
            db.add(SiteNews(id=pid, position=i, text=text, created_at=created, url=url,
                            image=img[0] if img else None, image_type=img[1] if img else None))
        db.commit()
    finally:
        db.close()
    return len(posts)
