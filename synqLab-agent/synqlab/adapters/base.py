"""BaseAdapter ABC — every tool adapter must inherit from this."""

from __future__ import annotations

import abc
import logging
from typing import Any

from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


class BaseAdapter(abc.ABC):
    """Abstract base class for all SynqLab tool adapters."""

    def __init__(self, **kwargs: Any) -> None:
        pass

    @abc.abstractmethod
    def run(self, request: ToolRequest) -> ToolOutput:
        """Execute the tool and return a :class:`ToolOutput`."""

    def healthcheck(self) -> bool:
        """Return True if the adapter is ready to serve requests."""
        return True

    def capabilities(self) -> list[str]:
        """Return the list of capability tags for this adapter."""
        return []

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}()"
