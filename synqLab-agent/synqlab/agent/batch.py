"""Batch processor for CSV/FASTA inputs through pipeline definitions.

Fans out each input row/sequence into a separate pipeline run,
executing in parallel with configurable concurrency.
"""

from __future__ import annotations

import asyncio
import csv
import io
import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator

from synqlab.agent.pipeline import PipelineDefinition, PipelineEngine

logger = logging.getLogger(__name__)


# ── Events ──────────────────────────────────────────────────────────────────


class BatchEventType(str, Enum):
    BATCH_STARTED = "batch_started"
    ITEM_STARTED = "item_started"
    ITEM_COMPLETED = "item_completed"
    ITEM_FAILED = "item_failed"
    BATCH_DONE = "batch_done"


@dataclass
class BatchEvent:
    type: BatchEventType
    index: int = -1
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type.value, "index": self.index, "data": self.data}


@dataclass
class BatchItemResult:
    index: int
    status: str  # completed | failed
    inputs: dict[str, Any] = field(default_factory=dict)
    outputs: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    duration_ms: float = 0


# ── Parsers ─────────────────────────────────────────────────────────────────


def parse_csv(content: str) -> list[dict[str, str]]:
    """Parse CSV content into a list of row dicts."""
    reader = csv.DictReader(io.StringIO(content))
    return [dict(row) for row in reader]


def parse_fasta(content: str) -> list[dict[str, str]]:
    """Parse FASTA content into a list of {name, sequence} dicts."""
    sequences: list[dict[str, str]] = []
    current_name = ""
    current_seq: list[str] = []

    for line in content.strip().splitlines():
        line = line.strip()
        if line.startswith(">"):
            if current_name:
                sequences.append({
                    "name": current_name,
                    "sequence": "".join(current_seq),
                })
            current_name = line[1:].strip()
            current_seq = []
        elif line and not line.startswith(";"):
            current_seq.append(re.sub(r"\s", "", line).upper())

    if current_name:
        sequences.append({
            "name": current_name,
            "sequence": "".join(current_seq),
        })

    return sequences


def detect_format(content: str) -> str:
    """Detect file format from content. Returns 'csv', 'fasta', or 'unknown'."""
    stripped = content.strip()
    if stripped.startswith(">"):
        return "fasta"
    # Check if it looks like CSV (has commas and at least 2 lines).
    lines = stripped.splitlines()
    if len(lines) >= 2 and "," in lines[0]:
        return "csv"
    return "unknown"


# ── Batch processor ─────────────────────────────────────────────────────────


class BatchProcessor:
    """Processes batch inputs (CSV/FASTA) through a pipeline definition."""

    def __init__(
        self,
        definition: PipelineDefinition,
        context: Any = None,
        tool_registry: dict[str, Any] | None = None,
        max_concurrency: int = 5,
    ):
        self.definition = definition
        self.context = context
        self.tool_registry = tool_registry or {}
        self.max_concurrency = max_concurrency
        self.results: list[BatchItemResult] = []

    async def process_csv(
        self,
        csv_content: str,
        param_mapping: dict[str, str] | None = None,
    ) -> AsyncGenerator[BatchEvent, None]:
        """Parse CSV, map columns to parameters, execute pipeline for each row."""
        rows = parse_csv(csv_content)
        if not rows:
            yield BatchEvent(type=BatchEventType.BATCH_DONE, data={"error": "No rows in CSV"})
            return

        # Auto-map columns to first node's parameters if no mapping given.
        if not param_mapping:
            first_node = self.definition.nodes[0] if self.definition.nodes else None
            if first_node:
                param_mapping = {}
                csv_cols = set(rows[0].keys())
                for param_name in first_node.parameters:
                    if param_name in csv_cols:
                        param_mapping[param_name] = param_name

        items = []
        for row in rows:
            mapped: dict[str, Any] = {}
            if param_mapping:
                for param, col in param_mapping.items():
                    mapped[param] = row.get(col, "")
            else:
                mapped = dict(row)
            items.append(mapped)

        async for event in self._run_batch(items):
            yield event

    async def process_fasta(
        self,
        fasta_content: str,
        sequence_param: str = "sequence",
    ) -> AsyncGenerator[BatchEvent, None]:
        """Parse FASTA, create one pipeline run per sequence."""
        sequences = parse_fasta(fasta_content)
        if not sequences:
            yield BatchEvent(type=BatchEventType.BATCH_DONE, data={"error": "No sequences in FASTA"})
            return

        items = [{sequence_param: s["sequence"], "name": s["name"]} for s in sequences]

        async for event in self._run_batch(items):
            yield event

    async def _run_batch(
        self,
        items: list[dict[str, Any]],
    ) -> AsyncGenerator[BatchEvent, None]:
        """Execute pipeline for each item with concurrency limit."""
        total = len(items)
        yield BatchEvent(
            type=BatchEventType.BATCH_STARTED,
            data={"total_items": total, "max_concurrency": self.max_concurrency},
        )

        semaphore = asyncio.Semaphore(self.max_concurrency)
        self.results = []
        completed = 0
        failed = 0

        async def run_with_sem(index: int, inputs: dict[str, Any]) -> BatchItemResult:
            async with semaphore:
                return await self._run_single(index, inputs)

        # Launch all tasks.
        tasks = [
            asyncio.create_task(run_with_sem(i, item))
            for i, item in enumerate(items)
        ]

        # Yield events as tasks complete.
        for coro in asyncio.as_completed(tasks):
            result = await coro
            self.results.append(result)

            if result.status == "completed":
                completed += 1
                yield BatchEvent(
                    type=BatchEventType.ITEM_COMPLETED,
                    index=result.index,
                    data={
                        "outputs": result.outputs,
                        "duration_ms": result.duration_ms,
                        "progress": f"{completed + failed}/{total}",
                    },
                )
            else:
                failed += 1
                yield BatchEvent(
                    type=BatchEventType.ITEM_FAILED,
                    index=result.index,
                    data={
                        "error": result.error,
                        "duration_ms": result.duration_ms,
                        "progress": f"{completed + failed}/{total}",
                    },
                )

        # Sort results by index.
        self.results.sort(key=lambda r: r.index)

        yield BatchEvent(
            type=BatchEventType.BATCH_DONE,
            data={
                "total": total,
                "completed": completed,
                "failed": failed,
                "results": [
                    {
                        "index": r.index,
                        "status": r.status,
                        "outputs": r.outputs,
                        "error": r.error,
                    }
                    for r in self.results
                ],
            },
        )

    async def _run_single(
        self,
        index: int,
        inputs: dict[str, Any],
    ) -> BatchItemResult:
        """Execute one pipeline run for a single input."""
        start = time.monotonic()

        try:
            # Clone the pipeline definition and inject inputs.
            import copy
            defn = copy.deepcopy(self.definition)

            # Inject inputs into the first node's parameters.
            if defn.nodes:
                for key, value in inputs.items():
                    if key in defn.nodes[0].parameters or key == "sequence":
                        defn.nodes[0].parameters[key] = value

            engine = PipelineEngine(
                definition=defn,
                context=self.context,
                tool_registry=self.tool_registry,
            )

            final_outputs: dict[str, Any] = {}
            async for event in engine.execute():
                if event.type.value == "pipeline_done":
                    final_outputs = event.data.get("results", {})

            duration = round((time.monotonic() - start) * 1000, 1)

            return BatchItemResult(
                index=index,
                status="completed",
                inputs=inputs,
                outputs=final_outputs,
                duration_ms=duration,
            )

        except Exception as exc:
            duration = round((time.monotonic() - start) * 1000, 1)
            logger.exception("Batch item %d failed", index)
            return BatchItemResult(
                index=index,
                status="failed",
                inputs=inputs,
                error=str(exc),
                duration_ms=duration,
            )
