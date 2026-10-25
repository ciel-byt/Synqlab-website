"""Auth module exception types."""


class AuthError(Exception):
    """Base exception for auth failures."""


class ExpiredTokenError(AuthError):
    """Raised when a JWT token has expired."""


class InvalidTokenError(AuthError):
    """Raised when a JWT token is invalid."""
