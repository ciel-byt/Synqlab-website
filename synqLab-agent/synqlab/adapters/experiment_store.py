"""ExperimentStoreAdapter — thin wrapper over storage/service.py."""

from __future__ import annotations

import logging
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


class ExperimentStoreAdapter(BaseAdapter):
    """Adapter for persisting experiment data via the storage service."""

    def __init__(
        self,
        session: Any = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._session = session

    def run(self, request: ToolRequest) -> ToolOutput:
        if self._session is None:
            from synqlab.storage.db import get_session
            self._session = get_session()

        from synqlab.storage.service import record_artifact, attach_tag

        action = request.inputs.get("action", "record_artifact")

        if action == "record_artifact":
            artifact = record_artifact(
                self._session,
                experiment_id=request.experiment_id,
                tool_run_id=request.inputs.get("tool_run_id"),
                artifact_type=request.inputs.get("artifact_type", "json"),
                path=request.inputs.get("path", ""),
                meta=request.inputs.get("meta"),
            )
            return ToolOutput(
                tool_id=request.tool_id,
                outputs={"stored": True, "artifact_id": artifact.id},
                success=True,
            )

        if action == "attach_tag":
            tag = attach_tag(
                self._session,
                artifact_id=request.inputs["artifact_id"],
                key=request.inputs["key"],
                value=request.inputs.get("value"),
            )
            return ToolOutput(
                tool_id=request.tool_id,
                outputs={"tagged": True, "tag_id": tag.id},
                success=True,
            )

        return ToolOutput(
            tool_id=request.tool_id,
            outputs={"stored": False, "error": f"Unknown action: {action}"},
            success=False,
        )

    def capabilities(self) -> list[str]:
        return ["run_logging", "artifact_registration", "candidate_tagging", "provenance_tracking"]
