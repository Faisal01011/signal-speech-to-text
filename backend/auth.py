"""
Verifies Supabase-issued JWTs so protected endpoints know who's calling.

Supabase signs user session tokens with keys published at a JWKS endpoint
(https://<project>.supabase.co/auth/v1/.well-known/jwks.json). We fetch
and cache those keys, then verify the token's signature on every request
rather than trusting the token blindly.
"""

import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")  # e.g. https://xxxx.supabase.co
if not SUPABASE_URL:
    print("[warning] SUPABASE_URL not set — auth-protected endpoints will fail")

JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None
_jwk_client = PyJWKClient(JWKS_URL) if JWKS_URL else None

bearer_scheme = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials) -> dict:
    """Verifies a Supabase JWT and returns its decoded claims."""
    if not _jwk_client:
        raise HTTPException(status_code=500, detail="Auth is not configured on the server (missing SUPABASE_URL)")

    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    """
    FastAPI dependency: extracts and verifies the bearer token from the
    Authorization header, returns the Supabase user's UUID (the `sub` claim).
    Use as: user_id: str = Depends(get_current_user_id)
    """
    payload = verify_token(credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user id")
    return user_id
