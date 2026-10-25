"""Public news for the marketing site: a static copy of the latest posts of one X account.

GET /api/public/news reads the `site_news` table only. Nothing here calls X and nothing refreshes by itself.
To update the posts, run `python scripts/refresh_news.py` (it uses X_BEARER_TOKEN from .env and replaces the rows).
Post text is third-party content: it is shown as text only.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from synqlab.storage.db import get_session
from synqlab.storage.models import SiteNews

router = APIRouter(prefix="/api/public/news", tags=["public"])


def _handle() -> str:
    return os.environ.get("NEWS_X_HANDLE", "BiologyAIDaily").lstrip("@")


@router.get("")
def news() -> dict:
    db = get_session()
    try:
        rows = db.query(SiteNews).order_by(SiteNews.position.asc()).all()
        return {
            "handle": _handle(),
            "posts": [
                {"id": r.id, "text": r.text, "created_at": r.created_at, "url": r.url,
                 "image": f"/api/public/news/image/{r.id}" if r.image else None}
                for r in rows
            ],
        }
    finally:
        db.close()


@router.get("/image/{post_id}")
def image(post_id: str) -> Response:
    if not post_id.isdigit():
        raise HTTPException(status_code=404, detail="Not found.")
    db = get_session()
    try:
        r = db.get(SiteNews, post_id)
        if r is None or not r.image:
            raise HTTPException(status_code=404, detail="Not found.")
        return Response(r.image, media_type=r.image_type or "image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
    finally:
        db.close()
