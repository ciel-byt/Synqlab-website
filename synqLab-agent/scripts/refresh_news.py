#!/usr/bin/env python
"""Refresh the News tab by hand: fetch the latest posts of an X account and store them in the database.

The deployed server also does this by itself (at startup and every few hours) when X_BEARER_TOKEN is set.
    cd synqLab-agent && .venv/bin/python scripts/refresh_news.py [--handle BiologyAIDaily]

Needs X_BEARER_TOKEN (read from the environment or from ../.env) and SYNQLAB_DB_URL.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from synqlab.news_refresh import refresh  # noqa: E402


def load_env() -> None:
    f = ROOT.parent / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--handle", default=os.environ.get("NEWS_X_HANDLE", "BiologyAIDaily"))
    handle = ap.parse_args().handle.lstrip("@")
    load_env()
    token = os.environ.get("X_BEARER_TOKEN", "").strip()
    if not token:
        sys.exit("X_BEARER_TOKEN is not set (put it in .env at the repo root).")
    print(f"Stored {refresh(handle, token)} posts from @{handle}.")


if __name__ == "__main__":
    main()
