"""Query CLI — argparse wrapper for synqlab.query.api."""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger(__name__)


def _get_session() -> Any:
    from synqlab.storage.db import get_session
    return get_session()


def cmd_get_experiment(args: argparse.Namespace) -> None:
    session = _get_session()
    from synqlab.query.api import get_experiment
    exp = get_experiment(session, args.experiment_id)
    if exp is None:
        print(f"Experiment '{args.experiment_id}' not found.")
        sys.exit(1)
    print(json.dumps({"id": exp.id, "name": exp.name, "status": exp.status}, indent=2))


def cmd_list_runs(args: argparse.Namespace) -> None:
    session = _get_session()
    from synqlab.query.api import list_runs
    runs = list_runs(session, args.experiment_id)
    output = [
        {
            "run_id": r.id,
            "tool_id": r.tool_id,
            "round_id": r.round_id,
            "status": r.status,
            "latency_ms": r.latency_ms,
        }
        for r in runs
    ]
    print(json.dumps(output, indent=2))


def cmd_list_candidates(args: argparse.Namespace) -> None:
    session = _get_session()
    from synqlab.query.api import list_candidates
    artifacts = list_candidates(session, args.experiment_id)
    output = [
        {"artifact_id": a.id, "type": a.artifact_type, "path": a.path}
        for a in artifacts
    ]
    print(json.dumps(output, indent=2))


def cmd_filter_by_tag(args: argparse.Namespace) -> None:
    session = _get_session()
    from synqlab.query.api import filter_by_tag
    artifacts = filter_by_tag(session, args.key, args.value)
    output = [
        {"artifact_id": a.id, "type": a.artifact_type, "path": a.path}
        for a in artifacts
    ]
    print(json.dumps(output, indent=2))


def cmd_top_k(args: argparse.Namespace) -> None:
    session = _get_session()
    from synqlab.query.api import top_k
    results = top_k(session, args.experiment_id, args.k)

    if not results:
        print(f"No scored runs found for experiment '{args.experiment_id}'.")
        return

    col_width = 36
    print(f"{'run_id':<{col_width}} {'tool_id':<16} {'confidence':>12} {'ddg':>8}")
    print("-" * (col_width + 40))
    for r in results:
        resp = r.get("response", {})
        confidence = r.get("confidence", resp.get("confidence", "—"))
        ddg = resp.get("ddg", "—")
        print(f"{r['run_id']:<{col_width}} {r['tool_id']:<16} {str(confidence):>12} {str(ddg):>8}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="synqlab-query",
        description="SynqLab query CLI — inspect experiments, runs, and candidates.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # get-experiment
    p = sub.add_parser("get-experiment", help="Show experiment metadata.")
    p.add_argument("--experiment-id", required=True)
    p.set_defaults(func=cmd_get_experiment)

    # list-runs
    p = sub.add_parser("list-runs", help="List all tool runs for an experiment.")
    p.add_argument("--experiment-id", required=True)
    p.set_defaults(func=cmd_list_runs)

    # list-candidates
    p = sub.add_parser("list-candidates", help="List all artifacts for an experiment.")
    p.add_argument("--experiment-id", required=True)
    p.set_defaults(func=cmd_list_candidates)

    # filter-by-tag
    p = sub.add_parser("filter-by-tag", help="Filter artifacts by tag key/value.")
    p.add_argument("--key", required=True)
    p.add_argument("--value", default=None)
    p.set_defaults(func=cmd_filter_by_tag)

    # top-k
    p = sub.add_parser("top-k", help="Show top-k candidates by confidence score.")
    p.add_argument("--experiment-id", required=True)
    p.add_argument("--k", type=int, default=5)
    p.set_defaults(func=cmd_top_k)

    return parser


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
