"""
Authentication Middleware for CCB Web Server

Provides FastAPI middleware for Bearer token authentication.
"""
from __future__ import annotations

from functools import wraps
from typing import Optional, List, Callable, Any

try:
    from fastapi import Request, HTTPException, Depends
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False

from auth_provider import OAuth2Provider, TokenInfo, TokenScope, get_oauth2_provider


if HAS_FASTAPI:
    # Security scheme for Swagger UI
    security = HTTPBearer(auto_error=False)


    class AuthMiddleware:
        """
        Authentication middleware for FastAPI.

        Usage:
            auth = AuthMiddleware()

            @app.get("/protected")
            async def protected_route(token: TokenInfo = Depends(auth.require_auth)):
                return {"user": token.user}

            @app.get("/admin")
            async def admin_route(token: TokenInfo = Depends(auth.require_scope(TokenScope.ADMIN))):
                return {"admin": True}
        """

        def __init__(self, provider: Optional[OAuth2Provider] = None):
            """
            Initialize the middleware.

            Args:
                provider: Optional OAuth2 provider (uses global if not provided)
            """
            self.provider = provider or get_oauth2_provider()

        async def get_token(
            self,
            credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        ) -> Optional[TokenInfo]:
            """
            Get token info from request (optional).

            Returns None if no token provided.
            """
            if not credentials:
                return None

            token = credentials.credentials
            return self.provider.validate_token(token)

        async def require_auth(
            self,
            credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        ) -> TokenInfo:
            """
            Require authentication.

            Raises HTTPException if not authenticated.
            """
            if not credentials:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            token = credentials.credentials
            token_info = self.provider.validate_token(token)

            if not token_info:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return token_info

        def require_scope(self, *required_scopes: TokenScope) -> Callable:
            """
            Create a dependency that requires specific scopes.

            Usage:
                @app.get("/admin")
                async def admin(token: TokenInfo = Depends(auth.require_scope(TokenScope.ADMIN))):
                    pass
            """
            async def dependency(
                credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
            ) -> TokenInfo:
                if not credentials:
                    raise HTTPException(
                        status_code=401,
                        detail="Authentication required",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                token = credentials.credentials
                token_info = self.provider.validate_token(token)

                if not token_info:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid or expired token",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                # Check scopes
                for scope in required_scopes:
                    if not self.provider.has_scope(token_info, scope):
                        raise HTTPException(
                            status_code=403,
                            detail=f"Insufficient permissions. Required scope: {scope.value}",
                        )

                return token_info

            return dependency


    def create_auth_routes(app: Any, provider: Optional[OAuth2Provider] = None):
        """
        Add authentication routes to a FastAPI app.

        Routes:
            POST /api/auth/token - Create a new token
            POST /api/auth/revoke - Revoke a token
            GET /api/auth/me - Get current user info
        """
        from fastapi import Body
        from pydantic import BaseModel

        provider = provider or get_oauth2_provider()
        auth = AuthMiddleware(provider)

        class TokenRequest(BaseModel):
            username: str
            password: str
            scopes: Optional[List[str]] = None

        class TokenResponse(BaseModel):
            access_token: str
            token_type: str = "bearer"
            expires_in: int
            scopes: List[str]

        class RevokeRequest(BaseModel):
            token: str

        @app.post("/api/auth/token", response_model=TokenResponse)
        async def create_token(request: TokenRequest):
            """Create a new access token."""
            # Authenticate user
            user = provider.authenticate_user(request.username, request.password)
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid username or password",
                )

            # Parse requested scopes
            scopes = None
            if request.scopes:
                scopes = [TokenScope(s) for s in request.scopes if s in [e.value for e in TokenScope]]

            # Create token
            token = provider.create_token(user.username, scopes)
            if not token:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create token",
                )

            # Get token info for response
            token_info = provider.validate_token(token)

            return TokenResponse(
                access_token=token,
                expires_in=int(token_info.expires_at - token_info.created_at),
                scopes=[s.value for s in token_info.scopes],
            )

        @app.post("/api/auth/revoke")
        async def revoke_token(
            request: RevokeRequest,
            current_token: TokenInfo = Depends(auth.require_auth),
        ):
            """Revoke an access token."""
            success = provider.revoke_token(request.token)
            return {"revoked": success}

        @app.get("/api/auth/me")
        async def get_current_user(
            token: TokenInfo = Depends(auth.require_auth),
        ):
            """Get current user information."""
            return {
                "user": token.user,
                "scopes": [s.value for s in token.scopes],
                "expires_at": token.expires_at,
            }

        @app.get("/api/auth/tokens")
        async def list_tokens(
            token: TokenInfo = Depends(auth.require_auth),
        ):
            """List all active tokens for current user."""
            tokens = provider.list_user_tokens(token.user)
            return {
                "tokens": [
                    {
                        "token_id": t.token_id,
                        "scopes": [s.value for s in t.scopes],
                        "created_at": t.created_at,
                        "expires_at": t.expires_at,
                        "last_used_at": t.last_used_at,
                    }
                    for t in tokens
                ]
            }

else:
    # Stub classes when FastAPI is not available
    class AuthMiddleware:
        def __init__(self, provider=None):
            raise ImportError("FastAPI is required for AuthMiddleware")

    def create_auth_routes(app, provider=None):
        raise ImportError("FastAPI is required for auth routes")
