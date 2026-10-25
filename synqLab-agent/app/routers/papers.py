"""Public research list for the marketing site.

Public (no auth): served under /api/public/. Rows live in `site_papers`; the seed file
synqlab/seed/site_papers.json inserts any slug that is missing, so new entries can be added
to the file or directly in the database. Existing rows are never overwritten.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from synqlab.storage.db import get_session
from synqlab.storage.models import SitePaper

router = APIRouter(prefix="/api/public/papers", tags=["public"])

_SEED = Path(__file__).resolve().parents[2] / "synqlab" / "seed" / "site_papers.json"
_FIELDS = ("slug", "title", "authors", "venue", "year", "kind", "topic", "url", "doi", "abstract", "body", "limits", "sort")


def _ensure_seeded(db) -> None:
    if not _SEED.exists():
        return
    have = {s for (s,) in db.query(SitePaper.slug).all()}
    rows = json.loads(_SEED.read_text(encoding="utf-8"))
    new = [r for r in rows if r["slug"] not in have]
    for r in new:
        db.add(SitePaper(**{k: r.get(k) for k in _FIELDS}))
    if new:
        db.commit()


def _out(p: SitePaper) -> dict:
    return {k: getattr(p, k) for k in _FIELDS if k != "sort"}


@router.get("")
def list_papers() -> list[dict]:
    db = get_session()
    try:
        _ensure_seeded(db)
        rows = db.query(SitePaper).order_by(SitePaper.year.desc(), SitePaper.sort.asc()).all()
        return [_out(p) for p in rows]
    finally:
        db.close()


@router.get("/{slug}")
def get_paper(slug: str) -> dict:
    db = get_session()
    try:
        _ensure_seeded(db)
        p = db.get(SitePaper, slug)
        if p is None:
            raise HTTPException(status_code=404, detail="Paper not found.")
        return _out(p)
    finally:
        db.close()
