"""Skill system — markdown-based extensible workflows for agents.

Mirrors Claude Code's SKILL.md pattern: each skill is a markdown file with
YAML frontmatter that extends agent behavior at runtime.

- ``Skill`` dataclass holds parsed metadata + body
- ``parse_skill_file()`` parses a ``.skill.md`` file
- ``SkillLoader`` scans directories for skill definitions
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Skill dataclass
# ---------------------------------------------------------------------------

@dataclass
class Skill:
    """A single agent skill — parsed from a .skill.md file or DB record."""

    id: str
    name: str
    description: str
    version: str = "1.0.0"
    author: str = "SynqLab Core"
    tags: list[str] = field(default_factory=list)
    agent_types: list[str] = field(default_factory=lambda: ["general"])
    tools: list[str] = field(default_factory=list)
    autonomy_default: str = "autonomous"
    body: str = ""  # markdown instructions
    source_path: str = ""  # filesystem path (empty for DB-sourced)
    source: str = "core"  # "core" or "user"

    def to_system_prompt_extension(self) -> str:
        """Format this skill as a system prompt appendix."""
        return (
            f"\n\n---\n## Active Skill: {self.name}\n"
            f"Version: {self.version} | Author: {self.author}\n\n"
            f"{self.body}"
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "author": self.author,
            "tags": self.tags,
            "agent_types": self.agent_types,
            "tools": self.tools,
            "autonomy_default": self.autonomy_default,
            "body": self.body,
            "source": self.source,
        }

    def matches_query(self, query: str) -> bool:
        """Check if this skill matches a search query (case-insensitive)."""
        q = query.lower()
        return (
            q in self.name.lower()
            or q in self.description.lower()
            or any(q in tag.lower() for tag in self.tags)
        )


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_skill_file(path: str) -> Skill:
    """Parse a .skill.md file into a Skill object.

    Expected format::

        ---
        name: Protein Optimization
        description: Multi-round sequence optimization
        version: 1.0.0
        author: SynqLab Core
        tags: [protein, optimization]
        agent_types: [general]
        tools: [sequence_generation, protein_folding, stability_analysis]
        autonomy_default: supervised
        ---

        # Protein Optimization Workflow
        ... markdown body ...

    Raises:
        ValueError: If the file has no valid YAML frontmatter.
    """
    text = Path(path).read_text(encoding="utf-8")

    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError(f"No valid YAML frontmatter in {path}")

    raw_yaml = match.group(1)
    body = text[match.end():].strip()

    try:
        meta = yaml.safe_load(raw_yaml)
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML in {path}: {exc}") from exc

    if not isinstance(meta, dict):
        raise ValueError(f"Frontmatter is not a dict in {path}")

    name = meta.get("name", "")
    if not name:
        raise ValueError(f"Missing required 'name' field in {path}")

    # Generate a stable ID from file path.
    skill_id = meta.get("id", "")
    if not skill_id:
        skill_id = hashlib.sha256(path.encode()).hexdigest()[:12]

    return Skill(
        id=skill_id,
        name=name,
        description=meta.get("description", ""),
        version=str(meta.get("version", "1.0.0")),
        author=meta.get("author", "SynqLab Core"),
        tags=meta.get("tags", []),
        agent_types=meta.get("agent_types", ["general"]),
        tools=meta.get("tools", []),
        autonomy_default=meta.get("autonomy_default", "autonomous"),
        body=body,
        source_path=str(path),
        source="core",
    )


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class SkillLoader:
    """Discovers and loads skills from filesystem directories."""

    def __init__(self, directories: list[str] | None = None):
        if directories is None:
            # Default: core skills directory next to this file.
            core_dir = str(Path(__file__).parent / "skills")
            directories = [core_dir]
        self.directories = directories
        self._cache: dict[str, Skill] = {}

    def scan(self) -> list[Skill]:
        """Scan all directories for *.skill.md files and cache results."""
        self._cache.clear()
        for directory in self.directories:
            dir_path = Path(directory)
            if not dir_path.is_dir():
                logger.debug("Skill directory does not exist: %s", directory)
                continue

            for skill_file in dir_path.rglob("*.skill.md"):
                try:
                    skill = parse_skill_file(str(skill_file))
                    self._cache[skill.id] = skill
                    logger.info("Loaded skill: %s (%s)", skill.name, skill.id)
                except (ValueError, OSError) as exc:
                    logger.warning("Skipping invalid skill file %s: %s", skill_file, exc)

        return list(self._cache.values())

    def get_skill(self, skill_id: str) -> Skill | None:
        """Get a skill by ID (scan first if cache is empty)."""
        if not self._cache:
            self.scan()
        return self._cache.get(skill_id)

    def get_all_skills(self) -> list[Skill]:
        """Return all cached skills (scan first if empty)."""
        if not self._cache:
            self.scan()
        return list(self._cache.values())

    def get_skills_for_agent_type(self, agent_type: str) -> list[Skill]:
        """Return skills compatible with a given agent type."""
        return [
            s for s in self.get_all_skills()
            if agent_type in s.agent_types or "all" in s.agent_types
        ]

    def search_skills(self, query: str) -> list[Skill]:
        """Fuzzy search skills by name, description, or tags."""
        return [s for s in self.get_all_skills() if s.matches_query(query)]

    def add_db_skills(self, db_skills: list[Skill]) -> None:
        """Merge DB-sourced skills into the cache (user skills)."""
        for skill in db_skills:
            self._cache[skill.id] = skill


# ---------------------------------------------------------------------------
# Module-level singleton (initialized lazily)
# ---------------------------------------------------------------------------

_global_loader: SkillLoader | None = None


def get_skill_loader() -> SkillLoader:
    """Get or create the global SkillLoader singleton."""
    global _global_loader
    if _global_loader is None:
        _global_loader = SkillLoader()
        _global_loader.scan()
    return _global_loader
