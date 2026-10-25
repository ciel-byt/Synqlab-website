"""Agent tool: Generate and persist markdown research reports."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class WriteReportInput(BaseModel):
    """Input schema for writing a research report."""

    title: str = Field(..., description="Report title")
    content: str = Field(
        ...,
        description="Report content in Markdown format",
    )
    report_type: str = Field(
        default="analysis",
        description="Report type: 'analysis', 'summary', 'comparison', 'protocol'",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Persist a markdown report as an agent artifact."""
    title = inputs["title"]
    content = inputs["content"]
    report_type = inputs.get("report_type", "analysis")

    # Build full report markdown with header.
    full_content = f"# {title}\n\n*Type: {report_type}*\n\n{content}"

    # Persist via save_artifact infrastructure.
    try:
        from synqlab.agent.models import AgentArtifact
        from synqlab.storage.db import get_session as get_db_session

        size_bytes = len(full_content.encode("utf-8"))
        db = get_db_session()
        try:
            artifact = AgentArtifact(
                session_id=ctx.session_id,
                name=f"{title.lower().replace(' ', '_')}.md",
                artifact_type="markdown_report",
                content_type="text/markdown",
                content=full_content,
                metadata_json={"report_type": report_type, "title": title},
                size_bytes=size_bytes,
            )
            db.add(artifact)
            db.commit()
            db.refresh(artifact)

            return ToolResult.ok({
                "artifact_id": artifact.id,
                "title": title,
                "report_type": report_type,
                "content": full_content,
                "format": "markdown",
                "size_bytes": size_bytes,
                "status": "persisted",
            })
        except Exception as exc:
            db.rollback()
            logger.warning("Failed to persist report to DB: %s", exc)
            # Fall back to inline-only response.
            return ToolResult.ok({
                "title": title,
                "report_type": report_type,
                "content": full_content,
                "format": "markdown",
                "status": "generated",
            })
        finally:
            db.close()

    except ImportError:
        # DB not available — return inline only.
        return ToolResult.ok({
            "title": title,
            "report_type": report_type,
            "content": full_content,
            "format": "markdown",
            "status": "generated",
        })


write_report_tool = build_tool(AgentToolDef(
    name="write_report",
    description=(
        "Generate a formatted research report in Markdown and save it as a "
        "persistent artifact. Use this to produce structured summaries, "
        "analysis reports, experimental protocols, or comparison tables. "
        "The report will be saved to the session and displayed with full "
        "Markdown rendering."
    ),
    input_schema=WriteReportInput,
    call=_call,
    search_hint="write report markdown summary analysis document",
))
