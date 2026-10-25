"""Execution engine — wraps timing, exception handling, and storage writes."""

from __future__ import annotations

import dataclasses
import logging
import time
from typing import Any, Optional

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError, StorageError
from synqlab.core.schemas import ExperimentConfig, ToolOutput, ToolRequest
from synqlab.core.tool_definition import ToolDefinition
from synqlab.engine.adapter_resolver import resolve_adapter

logger = logging.getLogger(__name__)


def execute_tool(
    tool_id: str,
    request: ToolRequest,
    config: ExperimentConfig,
    tool_def: ToolDefinition | None = None,
    adapter: BaseAdapter | None = None,
    session: Any | None = None,
) -> ToolOutput:
    """Execute a tool and persist a ToolRun row before and after the call.

    Every call writes two rows:
    - A ``running`` row before execution begins.
    - A ``completed`` or ``failed`` row after execution ends.

    Args:
        tool_id: Registry tool ID.
        request: Canonical tool request.
        config: Active experiment configuration.
        tool_def: Optional pre-loaded ToolDefinition. Required when ``adapter`` is None.
        adapter: Optional pre-instantiated adapter. Resolved from ``tool_def`` if None.
        session: Optional SQLAlchemy session for persistence. If None, storage is skipped
                 (useful in pure unit tests that do not need a DB).

    Returns:
        :class:`ToolOutput` with success/failure status.
    """
    if adapter is None and tool_def is None:
        raise AdapterError(
            "Either 'adapter' or 'tool_def' must be provided to execute_tool."
        )

    if adapter is None:
        adapter = resolve_adapter(tool_def, adapter_kwargs=None)  # type: ignore[arg-type]

    run_id: Optional[str] = None

    # Persist the start-of-run record.
    if session is not None:
        try:
            from synqlab.storage.service import create_tool_run
            run = create_tool_run(
                session,
                experiment_id=request.experiment_id,
                round_id=request.round_id,
                tool_id=tool_id,
                request=request.inputs,
            )
            run_id = run.id
        except Exception as exc:
            logger.warning("Failed to persist tool_run start record: %s", exc)

    start_ns = time.perf_counter_ns()
    output: ToolOutput

    try:
        output = adapter.run(request)
        success = True
        error_msg: Optional[str] = None
    except Exception as exc:
        success = False
        error_msg = str(exc)
        logger.error("Adapter '%s' raised an exception: %s", tool_id, exc)
        output = ToolOutput(
            tool_id=tool_id,
            outputs={},
            success=False,
            error_message=error_msg,
        )

    elapsed_ms = (time.perf_counter_ns() - start_ns) / 1_000_000
    output.latency_ms = elapsed_ms

    # Persist the end-of-run record.
    if session is not None and run_id is not None:
        try:
            from synqlab.storage.service import complete_tool_run
            complete_tool_run(
                session,
                run_id=run_id,
                response=output.outputs if success else None,
                error_message=error_msg,
                latency_ms=elapsed_ms,
            )
        except Exception as exc:
            logger.warning("Failed to persist tool_run completion record: %s", exc)

    logger.info(
        "execute_tool '%s' finished in %.1f ms, success=%s",
        tool_id,
        elapsed_ms,
        success,
    )
    return output
