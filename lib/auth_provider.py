"""
OAuth2 Authentication Provider for CCB

Provides token-based authentication for the Web API.
"""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any


class TokenScope(Enum):
    """Available token scopes."""
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    EXECUTE = "execute"


@dataclass
class TokenInfo:
    """Information about an access token."""
    token_id: str
    user: str
    scopes: List[TokenScope]
    created_at: float
    expires_at: float
    last_used_at: Optional[float] = None
    revoked: bool = False


@dataclass
class UserInfo:
    """Information about a user."""
    username: str
    password_hash: str
    scopes: List[TokenScope] = field(default_factory=list)
    enabled: bool = True
    created_at: float = 0.0


class OAuth2Provider:
    """
    OAuth2 authentication provider.

    Features:
    - Token creation and validation
    - Scope-based authorization
    - Token revocation
    - User management
    """

    # Default token expiry (24 hours)
    DEFAULT_EXPIRY_HOURS = 24

    def __init__(
        self,
        db_path: Optional[str] = None,
        secret_key: Optional[str] = None,
    ):
        """
        Initialize the OAuth2 provider.

        Args:
            db_path: Path to SQLite database
            secret_key: Secret key for token generation
        """
        if db_path is None:
            db_path = str(Path.home() / ".ccb_config" / "auth.db")

        self.db_path = db_path
        self.secret_key = secret_key or self._load_or_create_secret()

        self._init_db()

    def _load_or_create_secret(self) -> str:
        """Load or create the secret key."""
        secret_path = Path.home() / ".ccb_config" / ".auth_secret"

        if secret_path.exists():
            return secret_path.read_text().strip()

        # Generate new secret
        secret = secrets.token_hex(32)
        secret_path.parent.mkdir(parents=True, exist_ok=True)
        secret_path.write_text(secret)
        secret_path.chmod(0o600)

        return secret

    def _init_db(self) -> None:
        """Initialize the SQLite database."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    scopes TEXT,
                    enabled INTEGER DEFAULT 1,
                    created_at REAL
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS tokens (
                    token_id TEXT PRIMARY KEY,
                    token_hash TEXT NOT NULL,
                    user TEXT NOT NULL,
                    scopes TEXT,
                    created_at REAL,
                    expires_at REAL,
                    last_used_at REAL,
                    revoked INTEGER DEFAULT 0
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_user
                ON tokens(user)
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_tokens_hash
                ON tokens(token_hash)
            """)

            conn.commit()

            # Create default admin user if not exists
            cursor = conn.execute("SELECT COUNT(*) FROM users")
            if cursor.fetchone()[0] == 0:
                self.create_user("admin", "admin", [TokenScope.ADMIN, TokenScope.READ, TokenScope.WRITE, TokenScope.EXECUTE])

    def _hash_password(self, password: str) -> str:
        """Hash a password."""
        return hashlib.sha256((password + self.secret_key).encode()).hexdigest()

    def _hash_token(self, token: str) -> str:
        """Hash a token."""
        return hashlib.sha256((token + self.secret_key).encode()).hexdigest()

    def create_user(
        self,
        username: str,
        password: str,
        scopes: Optional[List[TokenScope]] = None,
    ) -> bool:
        """
        Create a new user.

        Args:
            username: Username
            password: Password
            scopes: List of scopes for the user

        Returns:
            True if user was created
        """
        if scopes is None:
            scopes = [TokenScope.READ]

        password_hash = self._hash_password(password)
        scopes_str = ",".join(s.value for s in scopes)

        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO users (username, password_hash, scopes, enabled, created_at)
                    VALUES (?, ?, ?, 1, ?)
                """, (username, password_hash, scopes_str, time.time()))
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def authenticate_user(self, username: str, password: str) -> Optional[UserInfo]:
        """
        Authenticate a user.

        Args:
            username: Username
            password: Password

        Returns:
            UserInfo if authentication successful, None otherwise
        """
        password_hash = self._hash_password(password)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT username, password_hash, scopes, enabled, created_at
                FROM users WHERE username = ? AND password_hash = ? AND enabled = 1
            """, (username, password_hash))

            row = cursor.fetchone()
            if not row:
                return None

            username, _, scopes_str, enabled, created_at = row
            scopes = [TokenScope(s) for s in scopes_str.split(",") if s]

            return UserInfo(
                username=username,
                password_hash="",  # Don't expose
                scopes=scopes,
                enabled=bool(enabled),
                created_at=created_at,
            )

    def create_token(
        self,
        user: str,
        scopes: Optional[List[TokenScope]] = None,
        expiry_hours: Optional[float] = None,
    ) -> Optional[str]:
        """
        Create an access token.

        Args:
            user: Username
            scopes: List of scopes (defaults to user's scopes)
            expiry_hours: Token expiry in hours

        Returns:
            The access token string, or None if user not found
        """
        # Verify user exists
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT scopes FROM users WHERE username = ? AND enabled = 1",
                (user,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            user_scopes = [TokenScope(s) for s in row[0].split(",") if s]

        # Use user's scopes if not specified
        if scopes is None:
            scopes = user_scopes
        else:
            # Ensure requested scopes are subset of user's scopes
            scopes = [s for s in scopes if s in user_scopes]

        # Generate token
        token = secrets.token_urlsafe(32)
        token_id = secrets.token_hex(8)
        token_hash = self._hash_token(token)

        expiry = expiry_hours or self.DEFAULT_EXPIRY_HOURS
        expires_at = time.time() + (expiry * 3600)
        scopes_str = ",".join(s.value for s in scopes)

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT INTO tokens (token_id, token_hash, user, scopes, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (token_id, token_hash, user, scopes_str, time.time(), expires_at))
            conn.commit()

        return token

    def validate_token(self, token: str) -> Optional[TokenInfo]:
        """
        Validate an access token.

        Args:
            token: The access token

        Returns:
            TokenInfo if valid, None otherwise
        """
        token_hash = self._hash_token(token)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT token_id, user, scopes, created_at, expires_at, last_used_at, revoked
                FROM tokens WHERE token_hash = ?
            """, (token_hash,))

            row = cursor.fetchone()
            if not row:
                return None

            token_id, user, scopes_str, created_at, expires_at, last_used_at, revoked = row

            # Check if revoked
            if revoked:
                return None

            # Check if expired
            if time.time() > expires_at:
                return None

            scopes = [TokenScope(s) for s in scopes_str.split(",") if s]

            # Update last used
            conn.execute(
                "UPDATE tokens SET last_used_at = ? WHERE token_id = ?",
                (time.time(), token_id)
            )
            conn.commit()

            return TokenInfo(
                token_id=token_id,
                user=user,
                scopes=scopes,
                created_at=created_at,
                expires_at=expires_at,
                last_used_at=last_used_at,
                revoked=False,
            )

    def revoke_token(self, token: str) -> bool:
        """
        Revoke an access token.

        Args:
            token: The access token

        Returns:
            True if token was revoked
        """
        token_hash = self._hash_token(token)

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "UPDATE tokens SET revoked = 1 WHERE token_hash = ?",
                (token_hash,)
            )
            conn.commit()
            return cursor.rowcount > 0

    def revoke_user_tokens(self, user: str) -> int:
        """
        Revoke all tokens for a user.

        Args:
            user: Username

        Returns:
            Number of tokens revoked
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "UPDATE tokens SET revoked = 1 WHERE user = ? AND revoked = 0",
                (user,)
            )
            conn.commit()
            return cursor.rowcount

    def list_user_tokens(self, user: str) -> List[TokenInfo]:
        """
        List all active tokens for a user.

        Args:
            user: Username

        Returns:
            List of TokenInfo
        """
        tokens = []
        now = time.time()

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                SELECT token_id, user, scopes, created_at, expires_at, last_used_at, revoked
                FROM tokens WHERE user = ? AND revoked = 0 AND expires_at > ?
            """, (user, now))

            for row in cursor:
                token_id, user, scopes_str, created_at, expires_at, last_used_at, revoked = row
                scopes = [TokenScope(s) for s in scopes_str.split(",") if s]

                tokens.append(TokenInfo(
                    token_id=token_id,
                    user=user,
                    scopes=scopes,
                    created_at=created_at,
                    expires_at=expires_at,
                    last_used_at=last_used_at,
                    revoked=bool(revoked),
                ))

        return tokens

    def cleanup_expired_tokens(self) -> int:
        """
        Clean up expired tokens.

        Returns:
            Number of tokens deleted
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM tokens WHERE expires_at < ?",
                (time.time(),)
            )
            conn.commit()
            return cursor.rowcount

    def has_scope(self, token_info: TokenInfo, required_scope: TokenScope) -> bool:
        """
        Check if a token has a required scope.

        Args:
            token_info: Token information
            required_scope: Required scope

        Returns:
            True if token has the scope
        """
        # Admin scope grants all permissions
        if TokenScope.ADMIN in token_info.scopes:
            return True

        return required_scope in token_info.scopes


# Singleton instance
_oauth2_provider: Optional[OAuth2Provider] = None


def get_oauth2_provider() -> OAuth2Provider:
    """Get the global OAuth2 provider instance."""
    global _oauth2_provider
    if _oauth2_provider is None:
        _oauth2_provider = OAuth2Provider()
    return _oauth2_provider
