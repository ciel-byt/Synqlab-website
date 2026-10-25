"""FluorescenceLabelIngestAdapter — reads CSV/XLSX and registers labels in the Knowledge Store."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


class FluorescenceLabelIngestAdapter(BaseAdapter):
    """Adapter for ingesting fluorescence label datasets.

    Reads a CSV/XLSX file and registers each row in the Knowledge Store.
    """

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    def run(self, request: ToolRequest) -> ToolOutput:
        file_path: str = request.inputs.get("file_path", "")
        sequence_column: str = request.inputs.get("sequence_column", "sequence")
        label_column: str = request.inputs.get("label_column", "brightness")
        project_id: str = request.inputs.get("project_id", "default")

        path = Path(file_path)
        if not path.exists():
            raise AdapterError(f"Dataset file not found: {path}")

        try:
            import pandas as pd  # type: ignore[import]

            if path.suffix.lower() in {".xlsx", ".xls"}:
                df = pd.read_excel(path)
            elif path.suffix.lower() == ".csv":
                df = pd.read_csv(path)
            else:
                raise AdapterError(f"Unsupported file format: {path.suffix}")

            if sequence_column not in df.columns:
                raise AdapterError(
                    f"Sequence column '{sequence_column}' not found. "
                    f"Available columns: {list(df.columns)}"
                )
            if label_column not in df.columns:
                raise AdapterError(
                    f"Label column '{label_column}' not found. "
                    f"Available columns: {list(df.columns)}"
                )

            df = df[[sequence_column, label_column]].dropna()
            records = df.to_dict(orient="records")
        except AdapterError:
            raise
        except Exception as exc:
            raise AdapterError(f"Failed to read dataset: {exc}") from exc

        try:
            from synqlab.knowledge_store.store import KnowledgeStore

            ks = KnowledgeStore()
            artifact_id = ks.register(
                kind="dataset",
                name=f"Fluorescence dataset from {path.name}",
                scope=f"project:{project_id}",
                task_type="gfp11_brightness",
                payload={
                    "format": path.suffix.lstrip("."),
                    "path": str(path),
                    "columns": {"sequence": sequence_column, "label": label_column},
                    "n_total": len(records),
                },
                tags=["fluorescence", "brightness", project_id],
            )
        except Exception as exc:
            raise AdapterError(f"KnowledgeStore registration failed: {exc}") from exc

        logger.info(
            "FluorescenceLabelIngestAdapter: registered %d records from %s (artifact=%s).",
            len(records),
            path.name,
            artifact_id,
        )
        return ToolOutput(
            tool_id=request.tool_id,
            outputs={"artifact_id": artifact_id, "n_registered": len(records)},
            success=True,
        )

    def capabilities(self) -> list[str]:
        return ["dataset_registration", "label_ingestion"]
