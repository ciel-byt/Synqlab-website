"""Agent tool: Scientific literature search (PubMed / bioRxiv)."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool
from synqlab.agent.tools._http import get_json

logger = logging.getLogger(__name__)

# PubMed E-utilities base URLs.
_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
_ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


class LiteratureSearchInput(BaseModel):
    """Input schema for literature search."""

    query: str = Field(..., description="Search query (PubMed syntax supported)")
    max_results: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of results to return",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Search PubMed for papers matching the query."""
    query = inputs["query"]
    max_results = inputs.get("max_results", 5)

    try:
        # Step 1: Search for PMIDs.
        search_data = await get_json(
            _ESEARCH,
            params={
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retmode": "json",
                "sort": "relevance",
            },
            timeout=15.0,
        )

        pmids = search_data.get("esearchresult", {}).get("idlist", [])
        if not pmids:
            return ToolResult.ok({"papers": [], "total_found": 0, "query": query})

        # Step 2: Fetch summaries for found PMIDs.
        summary_data = await get_json(
            _ESUMMARY,
            params={
                "db": "pubmed",
                "id": ",".join(pmids),
                "retmode": "json",
            },
            timeout=15.0,
        )

        result_map = summary_data.get("result", {})
        papers = []
        for pmid in pmids:
            paper = result_map.get(pmid, {})
            if not paper:
                continue
            authors = paper.get("authors", [])
            author_names = [a.get("name", "") for a in authors[:3]]
            if len(authors) > 3:
                author_names.append("et al.")

            papers.append({
                "pmid": pmid,
                "title": paper.get("title", ""),
                "authors": ", ".join(author_names),
                "journal": paper.get("fulljournalname", paper.get("source", "")),
                "pub_date": paper.get("pubdate", ""),
                "doi": paper.get("elocationid", ""),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            })

        total = int(search_data.get("esearchresult", {}).get("count", 0))
        return ToolResult.ok({
            "papers": papers,
            "total_found": total,
            "showing": len(papers),
            "query": query,
        })

    except httpx.HTTPError as exc:
        logger.warning("PubMed HTTP error: %s", exc)
        return ToolResult.fail(f"PubMed search error: {exc}")
    except Exception as exc:
        logger.exception("Literature search failed")
        return ToolResult.fail(f"PubMed search error: {exc}")


literature_search_tool = build_tool(AgentToolDef(
    name="search_literature",
    description=(
        "Search PubMed for scientific papers matching a query. Returns "
        "titles, authors, journals, dates, and DOIs. Supports PubMed's "
        "advanced query syntax (e.g. MeSH terms, boolean operators)."
    ),
    input_schema=LiteratureSearchInput,
    call=_call,
    is_read_only=True,
    is_concurrency_safe=True,
    search_hint="pubmed literature paper search citation reference",
))
