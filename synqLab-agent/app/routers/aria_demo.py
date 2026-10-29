"""Aria workspace for the demo (signed-in users only).

The demo is a replay of recorded results, not a live model. Data files live in synqlab/seed/:
  aria_families.json  - 2,415 protein families with a 2D embedding position (for the map)
  aria_samples.json   - a few real sample proteins per family
  aria_runs.json      - recorded per-round results for the four tuned families
Models and versions the user creates are stored in `aria_models` / `aria_model_versions`; their metrics are
filled in server-side from the recorded runs (never from the client). Uploaded tables are saved under the
artifact dir. Requests ("describe your problem") are stored in `site_requests`.
All routes are behind the normal JWT guard (no public access).
"""

from __future__ import annotations

import io
import json
import os
import re
import uuid
import zlib
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from synqlab.storage.db import get_session
from synqlab.storage.models import AriaChat, AriaChatMessage, AriaModel, AriaModelVersion, SiteRequest

_UPLOAD_MAX = 5 * 1024 * 1024

router = APIRouter(prefix="/api/aria", tags=["aria-demo"])

_SEED = Path(__file__).resolve().parents[2] / "synqlab" / "seed"
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@lru_cache(maxsize=4)
def _raw(name: str) -> bytes:
    path = _SEED / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Demo data not available.")
    return path.read_bytes()


@router.get("/families")
def families() -> Response:
    return Response(_raw("aria_families.json"), media_type="application/json")


@router.get("/samples")
def samples() -> Response:
    return Response(_raw("aria_samples.json"), media_type="application/json")


@router.get("/stats/{pfam}")
def family_stats(pfam: str) -> dict:
    """Real summary statistics of a protein family (from the embedding metadata)."""
    stats = json.loads(_raw("aria_family_stats.json"))
    if pfam not in stats:
        raise HTTPException(status_code=404, detail="Family not found.")
    return stats[pfam]


@router.get("/runs")
def runs() -> Response:
    return Response(_raw("aria_runs.json"), media_type="application/json")


def _recorded() -> dict:
    return json.loads(_raw("aria_runs.json"))


def _mock_round(fam: dict, r: int) -> dict:
    """Illustrative metrics for a round beyond the recorded ones: the last recorded gain keeps shrinking (demo only)."""
    last = fam["max_rounds"]
    cur, prev = fam["rounds"][str(last)], fam["rounds"][str(last - 1)] if last >= 1 else fam["rounds"]["0"]
    out = {}
    for k, v in cur.items():
        gain = (v - prev.get(k, v)) or (abs(v) * 0.01)
        k_extra = r - last
        val = v + gain * sum(0.6 ** i for i in range(1, k_extra + 1))
        val += (((zlib.crc32(f"{k}{r}".encode()) % 1000) / 1000) - 0.5) * abs(gain) * 0.15  # small wobble, deterministic per run
        hi = 1.0 if k == "tm" else 100.0
        out[k] = round(min(max(val, 0.0), hi), 3 if k == "tm" else 1)
    return out


def _uid(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Sign in to use Aria.")
    return uid


def _version_out(m: AriaModel, v: AriaModelVersion, base: dict | None) -> dict:
    return {
        "id": v.id, "model_id": m.id, "model": m.name, "version": v.version, "rounds": v.rounds,
        "data_source": m.data_source, "family": m.family, "problem": m.problem,
        "upload": ({k: m.upload.get(k) for k in ("filename", "rows", "seq_col", "label_col")} if m.upload else None),
        "status": v.status, "metrics": v.metrics, "base": base, "usage": v.usage, "simulated": bool(v.simulated),
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


def _base_for(m: AriaModel) -> dict | None:
    if m.data_source != "our-data" or not m.family:
        return None
    fam = _recorded()["families"].get(m.family)
    return fam["rounds"]["0"] if fam else None


@router.get("/models")
def list_models(request: Request) -> list[dict]:
    uid = _uid(request)
    db = get_session()
    try:
        models = {m.id: m for m in db.query(AriaModel).filter(AriaModel.owner_id == uid).all()}
        vers = db.query(AriaModelVersion).filter(AriaModelVersion.model_id.in_(list(models))).all() if models else []
        rows = [_version_out(models[v.model_id], v, _base_for(models[v.model_id])) for v in vers]
        rows.sort(key=lambda r: (r["created_at"] or "", r["version"]), reverse=True)
        return rows
    finally:
        db.close()


class TrainIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    data_source: str = Field(pattern="^(our-data|upload)$")
    family: str | None = Field(default=None, max_length=20)
    problem: str | None = Field(default=None, max_length=2000)
    rounds: int = Field(default=1, ge=1, le=20)
    upload_id: str | None = Field(default=None, max_length=64)
    seq_col: str | None = Field(default=None, max_length=200)
    label_col: str | None = Field(default=None, max_length=200)
    model_id: str | None = None  # continue an existing model with more rounds


@router.post("/models", status_code=201)
def create_model(body: TrainIn, request: Request) -> list[dict]:
    """Create a model (or add rounds to one). Recorded runs fill the metrics; uploads are queued."""
    uid = _uid(request)
    rec = _recorded()["families"]
    db = get_session()
    try:
        if body.model_id:
            m = db.get(AriaModel, body.model_id)
            if m is None or m.owner_id != uid:
                raise HTTPException(status_code=404, detail="Model not found.")
        else:
            upload = None
            if body.data_source == "upload":
                if not body.upload_id or not re.fullmatch(r"[a-f0-9]{32}", body.upload_id):
                    raise HTTPException(status_code=422, detail="Upload a table first.")
                meta_path = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "/app/data/agent_artifacts")) / "aria_uploads" / uid / f"{body.upload_id}.json"
                if not meta_path.exists():
                    raise HTTPException(status_code=422, detail="Upload not found. Upload the table again.")
                upload = json.loads(meta_path.read_text())
                upload["seq_col"], upload["label_col"] = body.seq_col, body.label_col
            elif body.family not in rec:
                raise HTTPException(status_code=422, detail="This family has no recorded run yet. Request it instead.")
            m = AriaModel(owner_id=uid, name=body.name.strip(), data_source=body.data_source,
                          family=body.family if body.data_source == "our-data" else None,
                          problem=body.problem, upload=upload)
            db.add(m)
            db.flush()

        existing = db.query(AriaModelVersion).filter(AriaModelVersion.model_id == m.id).all()
        out: list[AriaModelVersion] = []
        if m.data_source == "upload":
            if existing:
                raise HTTPException(status_code=409, detail="This model is already queued.")
            out.append(AriaModelVersion(model_id=m.id, version=1, rounds=body.rounds, status="queued", metrics=None))
        else:
            fam = rec[m.family]
            have = max([v.rounds for v in existing], default=0)
            # Rounds with a recorded run replay real results. Rounds beyond that are illustrative (demo), flagged simulated.
            for r in range(have + 1, have + body.rounds + 1):
                if r <= fam["max_rounds"]:
                    out.append(AriaModelVersion(model_id=m.id, version=r, rounds=r, status="ready", metrics=fam["rounds"][str(r)]))
                else:
                    out.append(AriaModelVersion(model_id=m.id, version=r, rounds=r, status="ready", metrics=_mock_round(fam, r), simulated=True))
        for v in out:
            db.add(v)
        db.commit()
        base = _base_for(m)
        return [_version_out(m, v, base) for v in out]
    finally:
        db.close()


class UseIn(BaseModel):
    usage: str | None = Field(default=None, pattern="^(standalone|agent)$")


class DeleteIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=500)


@router.post("/versions/delete")
def delete_versions(body: DeleteIn, request: Request) -> dict:
    """Delete model versions (and their chats). A model with no versions left is deleted too."""
    uid = _uid(request)
    db = get_session()
    try:
        vs = [v for v in db.query(AriaModelVersion).filter(AriaModelVersion.id.in_(body.ids)).all()
              if (m := db.get(AriaModel, v.model_id)) is not None and m.owner_id == uid]
        model_ids = {v.model_id for v in vs}
        for v in vs:
            for c in db.query(AriaChat).filter(AriaChat.version_id == v.id).all():
                db.query(AriaChatMessage).filter(AriaChatMessage.chat_id == c.id).delete()
                db.delete(c)
            db.delete(v)
        db.flush()
        removed_models = 0
        for mid in model_ids:
            if db.query(AriaModelVersion).filter(AriaModelVersion.model_id == mid).count() == 0:
                db.query(AriaModel).filter(AriaModel.id == mid).delete()
                removed_models += 1
        db.commit()
        return {"deleted": len(vs), "models_removed": removed_models}
    finally:
        db.close()


@router.post("/versions/{version_id}/use")
def set_usage(version_id: str, body: UseIn, request: Request) -> dict:
    """Use a version standalone, or assign it to the SynqLab agent (one agent version at a time)."""
    uid = _uid(request)
    db = get_session()
    try:
        v = db.get(AriaModelVersion, version_id)
        m = db.get(AriaModel, v.model_id) if v else None
        if v is None or m is None or m.owner_id != uid:
            raise HTTPException(status_code=404, detail="Version not found.")
        if v.status != "ready" and body.usage:
            raise HTTPException(status_code=409, detail="This version is not ready yet.")
        if body.usage == "agent":
            mine = [x.id for x in db.query(AriaModel).filter(AriaModel.owner_id == uid).all()]
            for o in db.query(AriaModelVersion).filter(AriaModelVersion.model_id.in_(mine), AriaModelVersion.usage == "agent").all():
                o.usage = None
        v.usage = body.usage
        db.commit()
        return {"ok": True}
    finally:
        db.close()


def _load_upload(uid: str, upload_id: str):
    import pandas as pd
    if not re.fullmatch(r"[a-f0-9]{32}", upload_id):
        raise HTTPException(status_code=422, detail="Bad upload id.")
    d = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "/app/data/agent_artifacts")) / "aria_uploads" / uid
    for ext in ("csv", "tsv", "xlsx"):
        f = d / f"{upload_id}.{ext}"
        if f.exists():
            raw = f.read_bytes()
            return pd.read_excel(io.BytesIO(raw)) if ext == "xlsx" else pd.read_csv(io.BytesIO(raw), sep="\t" if ext == "tsv" else None, engine="python")
    raise HTTPException(status_code=404, detail="Upload not found.")


@router.get("/uploads/{upload_id}/stats")
def upload_stats(upload_id: str, request: Request, seq: str, label: str | None = None) -> dict:
    """Summary of an uploaded table: sequence lengths, amino-acid mix, duplicates, and the measurement column."""
    import numpy as np
    uid = _uid(request)
    df = _load_upload(uid, upload_id)
    if seq not in df.columns:
        raise HTTPException(status_code=422, detail="Unknown sequence column.")
    s = df[seq].dropna().astype(str).str.strip().str.upper()
    valid = s[s.str.fullmatch(r"[ACDEFGHIKLMNPQRSTVWY]+")]
    out: dict = {"rows": int(len(df)), "sequences": int(len(s)), "valid": int(len(valid)), "invalid": int(len(s) - len(valid)),
                 "missing": int(df[seq].isna().sum()), "duplicates": int(s.duplicated().sum())}
    if len(valid):
        L = valid.str.len().to_numpy()
        h, _ = np.histogram(L, bins=10, range=(float(L.min()), float(L.max()) + 1e-9))
        out["len"] = {"min": int(L.min()), "p50": int(np.median(L)), "max": int(L.max()), "hist": [int(x) for x in h]}
        counts = {a: 0 for a in "ACDEFGHIKLMNPQRSTVWY"}
        for a in "ACDEFGHIKLMNPQRSTVWY":
            counts[a] = int(valid.str.count(a).sum())
        tot = sum(counts.values()) or 1
        out["aa"] = [[a, round(100 * c / tot, 1)] for a, c in counts.items()]
        out["props"] = {"cys": int(valid.str.count("C").median())}
    if label and label in df.columns:
        v = pd_numeric(df[label]).dropna()
        if len(v):
            h, _ = np.histogram(v, bins=10)
            out["label"] = {"name": label, "n": int(len(v)), "min": float(v.min()), "p50": float(v.median()), "max": float(v.max()), "hist": [int(x) for x in h]}
    return out


def pd_numeric(s):
    import pandas as pd
    return pd.to_numeric(s, errors="coerce")


@router.post("/uploads", status_code=201)
async def upload_table(request: Request, file: UploadFile = File(...)) -> dict:
    """Save a CSV/Excel table and return a preview. The file stays on the server; nothing is trained on it here."""
    uid = _uid(request)
    name = (file.filename or "table").strip()
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext not in ("csv", "tsv", "xlsx"):
        raise HTTPException(status_code=422, detail="Upload a .csv, .tsv or .xlsx file.")
    raw = await file.read(_UPLOAD_MAX + 1)
    if len(raw) > _UPLOAD_MAX:
        raise HTTPException(status_code=413, detail="File is larger than 5 MB.")
    import pandas as pd
    try:
        df = pd.read_excel(io.BytesIO(raw)) if ext == "xlsx" else pd.read_csv(io.BytesIO(raw), sep="\t" if ext == "tsv" else None, engine="python")
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read that file as a table.")
    if df.empty or len(df.columns) < 1:
        raise HTTPException(status_code=422, detail="The table is empty.")
    uid_dir = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "/app/data/agent_artifacts")) / "aria_uploads" / uid
    uid_dir.mkdir(parents=True, exist_ok=True)
    upload_id = uuid.uuid4().hex
    (uid_dir / f"{upload_id}.{ext}").write_bytes(raw)
    cols = [str(c) for c in df.columns]
    meta = {"upload_id": upload_id, "filename": name[:200], "rows": int(len(df)), "columns": cols}
    (uid_dir / f"{upload_id}.json").write_text(json.dumps(meta))
    preview = df.head(5).astype(str).values.tolist()
    return {**meta, "preview": preview}



class RequestIn(BaseModel):
    email: str = Field(max_length=200)
    name: str | None = Field(default=None, max_length=200)
    org: str | None = Field(default=None, max_length=200)
    problem: str = Field(min_length=10, max_length=4000)
    data_description: str | None = Field(default=None, max_length=4000)
    family: str | None = Field(default=None, max_length=20)
    source: str = Field(default="aria-demo", pattern="^aria-demo$")


@router.post("/requests", status_code=201)
def create_request(body: RequestIn) -> dict:
    if not _EMAIL.match(body.email.strip()):
        raise HTTPException(status_code=422, detail="Please enter a valid email.")
    db = get_session()
    try:
        db.add(SiteRequest(
            email=body.email.strip(), name=body.name, org=body.org, problem=body.problem.strip(),
            data_description=body.data_description, family=body.family, source=body.source,
        ))
        db.commit()
    finally:
        db.close()
    return {"ok": True}
