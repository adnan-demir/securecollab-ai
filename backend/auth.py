"""
Authentication utilities for SecureCollab AI.
Covers:
  - bcrypt password hashing via passlib
  - JWT creation and decoding via python-jose
  - OTP generation for 2FA
  - Backup recovery codes (SHA-256 hashed, single-use)
  - AI-style risk-score calculation
"""
import hashlib
import os
import random
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

# SECRET_KEY should be set via environment variable in production.
# Never hard-code secrets in source code for real deployments.
SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE-ME-in-production-use-a-256-bit-random-string")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# bcrypt is the recommended algorithm for password hashing (slow by design)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─── Password helpers ─────────────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a plain-text password with bcrypt (includes automatic salt)."""
    return pwd_context.hash(password)


# ─── JWT helpers ──────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT.
    The 'sub' claim should be the user's string ID.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT. Returns the payload dict or None if invalid/expired.
    Handles JWTError so callers don't need to catch it.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# ─── 2FA OTP helpers ──────────────────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP for two-factor authentication."""
    return "".join(random.choices(string.digits, k=length))


# ─── Recovery code helpers ────────────────────────────────────────────────────

def generate_recovery_codes(count: int = 5) -> list[str]:
    """
    Generate N single-use recovery codes.
    Each code is 10 uppercase alphanumeric characters.
    Recovery codes are high-entropy random strings, so SHA-256 is acceptable
    (unlike passwords, they are not user-chosen and cannot be dictionary-attacked).
    """
    alphabet = string.ascii_uppercase + string.digits
    return ["".join(secrets.choice(alphabet) for _ in range(10)) for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    """SHA-256 hash a recovery code for safe storage."""
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()


def verify_recovery_code(plain_code: str, stored_hashes: list[str]) -> str | None:
    """
    Check whether plain_code matches any stored hash.
    Returns the matching hash string if found, else None.
    """
    code_hash = hash_recovery_code(plain_code)
    return code_hash if code_hash in stored_hashes else None


# ─── AI Risk Score ────────────────────────────────────────────────────────────

def calculate_risk_score(
    failed_logins: int,
    unauthorized_attempts: int,
    unusual_activity: int = 0,
) -> float:
    """
    AI-style threat risk score (0–100).

    Weights (tunable):
      - Each failed login:           +15 pts   (brute-force signal)
      - Each unauthorized access:    +20 pts   (privilege escalation signal)
      - Each unusual activity event: +10 pts   (anomaly signal)

    Score is capped at 100 to keep it on a percentage scale.
    """
    score = (failed_logins * 15) + (unauthorized_attempts * 20) + (unusual_activity * 10)
    return min(float(score), 100.0)
