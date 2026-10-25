"""Chat with an Aria model version (demo).

There is no live model. A request is matched to the closest of 12 recorded prompts for the family, and the reply
replays what the chosen version (round) really generated for that prompt: sequence, predicted structure, scores,
domain hit. Sequence properties are computed from the sequence here. GO and EC are inherited from the family
annotation and are labelled as predicted (demo). Chats and messages are saved per user.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from synqlab.storage.db import get_session
from synqlab.storage.models import AriaChat, AriaChatMessage, AriaModel, AriaModelVersion

router = APIRouter(prefix="/api/aria", tags=["aria-chat"])
_SEED = Path(__file__).resolve().parents[2] / "synqlab" / "seed"
_CHAT = _SEED / "aria_chat"


@lru_cache(maxsize=1)
def _index() -> dict:
    return json.loads((_CHAT / "index.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _stats() -> dict:
    return json.loads((_SEED / "aria_family_stats.json").read_text(encoding="utf-8"))


# ---- sequence properties (computed from the sequence) -------------------------------------------------
_POS = {"K": 10.0, "R": 12.0, "H": 5.98}
_NEG = {"D": 4.05, "E": 4.45, "C": 9.0, "Y": 10.0}
_KD = {"A": 1.8, "R": -4.5, "N": -3.5, "D": -3.5, "C": 2.5, "Q": -3.5, "E": -3.5, "G": -0.4, "H": -3.2, "I": 4.5,
       "L": 3.8, "K": -3.9, "M": 1.9, "F": 2.8, "P": -1.6, "S": -0.8, "T": -0.7, "W": -0.9, "Y": -1.3, "V": 4.2}


def _charge(seq: str, ph: float = 7.4) -> float:
    c = 1 / (1 + 10 ** (ph - 9.0)) - 1 / (1 + 10 ** (2.0 - ph))
    for a, pk in _POS.items():
        c += seq.count(a) / (1 + 10 ** (ph - pk))
    for a, pk in _NEG.items():
        c -= seq.count(a) / (1 + 10 ** (pk - ph))
    return c


def _props(seq: str) -> dict:
    return {"length": len(seq), "charge": round(_charge(seq)), "gravy": round(sum(_KD.get(a, 0) for a in seq) / max(1, len(seq)), 2), "cys": seq.count("C")}


# ---- request matching ---------------------------------------------------------------------------------
def _spec_num(spec: dict, key: str) -> float | None:
    m = re.search(r"[+-]?\d+", spec.get(key, ""))
    return float(m.group()) if m else None


def _match(text: str, scenarios: list[dict], used: set[str]) -> dict:
    t = text.lower()
    length = None
    for m in re.finditer(r"(\d{2,3})\s*(aa|residues?|amino)?", t):
        if 20 <= int(m.group(1)) <= 600:
            length = int(m.group(1)); break
    ch = re.search(r"charge[^0-9+-]{0,12}([+-]?\d+)", t) or re.search(r"(?<![\w.])([+-]\d+)(?![\w.])", t)
    charge = float(ch.group(1)) if ch else None
    best, best_s = None, 1e9
    for sc in scenarios:
        sp = sc["spec"]
        s = 0.0
        if length is not None:
            v = _spec_num(sp, "Length")
            s += abs(v - length) / 50 if v is not None else 2
        if charge is not None:
            v = _spec_num(sp, "Net charge at pH 7.4")
            s += abs(v - charge) / 4 if v is not None else 2  # prefer prompts that actually specify a charge
        for word, key in (("stable", "Stability"), ("soluble", "Aggregation propensity"), ("hydrophobic", "Hydrophobicity")):
            if word in t:
                val = sp.get(key, "").lower()
                s -= 0.5 if (word == "soluble" and "low" in val) or (word != "soluble" and word in val) else -0.5
        if sc["id"] in used:
            s += 0.6  # prefer a result the chat has not shown yet
        if s < best_s:
            best, best_s = sc, s
    return best


# ---- helpers ------------------------------------------------------------------------------------------
def _uid(request: Request) -> str:
    uid = getattr(request.state, "user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Sign in to use Aria.")
    return uid


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _version(db, uid: str, version_id: str):
    v = db.get(AriaModelVersion, version_id)
    m = db.get(AriaModel, v.model_id) if v else None
    if v is None or m is None or m.owner_id != uid:
        raise HTTPException(status_code=404, detail="Model version not found.")
    return v, m


def _chat_ok(m: AriaModel, v: AriaModelVersion) -> bool:
    return v.status == "ready" and m.data_source == "our-data" and m.family in _index()


def _card(m: AriaModel, v: AriaModelVersion, sc: dict) -> dict:
    r = min(v.rounds, 3)
    res = sc["rounds"][str(r)]
    props = _props(res["seq"])
    sp = sc["spec"]
    checks = []
    if (L := _spec_num(sp, "Length")) is not None:
        checks.append({"label": "Length", "requested": f"{int(L)}", "actual": f"{props['length']}", "ok": abs(props["length"] - L) <= 0.1 * L})
    if (C := _spec_num(sp, "Net charge at pH 7.4")) is not None:
        checks.append({"label": "Net charge", "requested": f"{int(C):+d}", "actual": f"{props['charge']:+d}", "ok": abs(props["charge"] - C) <= 2})
    st = _stats().get(m.family, {})
    go = [g[0] for g in st.get("go", {}).get("top", [])[:2]]
    ec = [e[0] for e in st.get("ec", {}).get("top", [])[:1]]
    return {
        "version_id": v.id, "model": m.name, "version": v.version, "family": m.family,
        "scenario_id": sc["id"], "prompt": sc["prompt"], "spec": sp,
        "result": {k: res[k] for k in ("seq", "plddt", "gate", "filter", "reasons", "tm", "hit", "evalue", "identity", "pdb")},
        "props": props, "checks": checks,
        "reference": {"acc": sc["reference"]["acc"]},
        "go": go, "ec": ec,
    }


class MsgIn(BaseModel):
    text: str | None = Field(default=None, max_length=2000)
    scenario_id: str | None = Field(default=None, max_length=40)
    compare_version_id: str | None = Field(default=None, max_length=64)


class ChatIn(BaseModel):
    version_id: str = Field(max_length=64)


def _chat_out(c: AriaChat, m: AriaModel, v: AriaModelVersion) -> dict:
    return {"id": c.id, "title": c.title, "version_id": v.id, "model": m.name, "version": v.version, "family": m.family,
            "created_at": c.created_at.isoformat(), "updated_at": c.updated_at.isoformat()}


@router.get("/chat/scenarios/{pfam}")
def scenarios(pfam: str) -> list[dict]:
    fam = _index().get(pfam)
    if not fam:
        raise HTTPException(status_code=404, detail="No chat data for this family.")
    return [{"id": s["id"], "label": s["label"], "prompt": s["prompt"].split("\n", 1)[-1].replace("\n", "; ").replace("- ", "")} for s in fam["scenarios"]]


@router.get("/chat/pdb/{pid}", response_class=PlainTextResponse)
def pdb(pid: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{12}", pid):
        raise HTTPException(status_code=404, detail="Not found.")
    f = _CHAT / "pdb" / f"{pid}.pdb"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Not found.")
    return f.read_text()


@router.get("/chats")
def list_chats(request: Request) -> list[dict]:
    uid = _uid(request)
    db = get_session()
    try:
        out = []
        for c in db.query(AriaChat).filter(AriaChat.owner_id == uid).order_by(AriaChat.updated_at.desc()).all():
            v = db.get(AriaModelVersion, c.version_id)
            m = db.get(AriaModel, v.model_id) if v else None
            if v and m:
                out.append(_chat_out(c, m, v))
        return out
    finally:
        db.close()


@router.post("/chats", status_code=201)
def create_chat(body: ChatIn, request: Request) -> dict:
    uid = _uid(request)
    db = get_session()
    try:
        v, m = _version(db, uid, body.version_id)
        if not _chat_ok(m, v):
            raise HTTPException(status_code=409, detail="Chat is not available for this model yet.")
        c = AriaChat(owner_id=uid, version_id=v.id, title="New chat")
        db.add(c)
        db.commit()
        return _chat_out(c, m, v)
    finally:
        db.close()


@router.get("/chats/{chat_id}")
def get_chat(chat_id: str, request: Request) -> dict:
    uid = _uid(request)
    db = get_session()
    try:
        c = db.get(AriaChat, chat_id)
        if c is None or c.owner_id != uid:
            raise HTTPException(status_code=404, detail="Chat not found.")
        v = db.get(AriaModelVersion, c.version_id)
        m = db.get(AriaModel, v.model_id)
        msgs = db.query(AriaChatMessage).filter(AriaChatMessage.chat_id == c.id).order_by(AriaChatMessage.created_at).all()
        return {"chat": _chat_out(c, m, v), "messages": [{"id": x.id, "role": x.role, "text": x.text, "payload": x.payload, "created_at": x.created_at.isoformat()} for x in msgs]}
    finally:
        db.close()


@router.patch("/chats/{chat_id}")
def change_model(chat_id: str, body: ChatIn, request: Request) -> dict:
    """Switch which model version a chat talks to (Model 1)."""
    uid = _uid(request)
    db = get_session()
    try:
        c = db.get(AriaChat, chat_id)
        if c is None or c.owner_id != uid:
            raise HTTPException(status_code=404, detail="Chat not found.")
        v, m = _version(db, uid, body.version_id)
        if not _chat_ok(m, v):
            raise HTTPException(status_code=409, detail="Chat is not available for this model yet.")
        c.version_id = v.id
        db.commit()
        return _chat_out(c, m, v)
    finally:
        db.close()


@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str, request: Request) -> dict:
    uid = _uid(request)
    db = get_session()
    try:
        c = db.get(AriaChat, chat_id)
        if c is None or c.owner_id != uid:
            raise HTTPException(status_code=404, detail="Chat not found.")
        db.query(AriaChatMessage).filter(AriaChatMessage.chat_id == c.id).delete()
        db.delete(c)
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.post("/chats/{chat_id}/messages", status_code=201)
def send(chat_id: str, body: MsgIn, request: Request) -> list[dict]:
    uid = _uid(request)
    if not (body.text or body.scenario_id):
        raise HTTPException(status_code=422, detail="Write a request or pick a scenario.")
    db = get_session()
    try:
        c = db.get(AriaChat, chat_id)
        if c is None or c.owner_id != uid:
            raise HTTPException(status_code=404, detail="Chat not found.")
        v, m = _version(db, uid, c.version_id)
        scs = _index()[m.family]["scenarios"]
        prev = db.query(AriaChatMessage).filter(AriaChatMessage.chat_id == c.id, AriaChatMessage.role == "assistant").all()
        used = {card["scenario_id"] for p in prev for card in (p.payload or {}).get("cards", [])}
        if body.scenario_id:
            sc = next((s for s in scs if s["id"] == body.scenario_id), None)
            if sc is None:
                raise HTTPException(status_code=404, detail="Scenario not found.")
        else:
            sc = _match(body.text or "", scs, used)
        cards = [_card(m, v, sc)]
        if body.compare_version_id:
            v2, m2 = _version(db, uid, body.compare_version_id)
            if not _chat_ok(m2, v2) or m2.family != m.family:
                raise HTTPException(status_code=409, detail="The other version must be a ready model on the same family.")
            cards.append(_card(m2, v2, sc))
        user_text = body.text or next(s["label"] for s in scs if s["id"] == sc["id"])
        um = AriaChatMessage(chat_id=c.id, role="user", text=user_text)
        names = " and ".join(f"{x['model']} v{x['version']}" for x in cards)
        am = AriaChatMessage(chat_id=c.id, role="assistant", payload={"cards": cards},
                             text=f"Here is what {names} generated for the closest matching request: {sc['label']}.")
        db.add(um); db.flush()
        am.created_at = _now()
        db.add(am)
        c.updated_at = _now()
        if c.title == "New chat":  # name the chat after its first request, like any chat app
            c.title = (user_text[:48] + ("…" if len(user_text) > 48 else "")) or "New chat"
        db.commit()
        return [{"id": x.id, "role": x.role, "text": x.text, "payload": x.payload, "created_at": x.created_at.isoformat()} for x in (um, am)]
    finally:
        db.close()
