"""Shared exception types for SynqLab."""


class RegistryError(Exception):
    """Raised when the tool registry is malformed or missing required fields."""


class AdapterError(Exception):
    """Raised when a tool adapter fails to execute."""


class StorageError(Exception):
    """Raised when a storage operation (DB or filesystem) fails."""


class ConfigError(Exception):
    """Raised when configuration is missing, malformed, or invalid."""
