"""
Pydantic v2 schemas for request validation and response serialization.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# ─── Auth schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: Optional[str] = "student"

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class OTPVerify(BaseModel):
    email: str
    otp: str


class SocialLoginRequest(BaseModel):
    provider: str
    email: EmailStr
    name: str
    social_id: str


class Token(BaseModel):
    access_token: str
    token_type: str


# ─── User response ────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    role: str
    is_active: bool
    is_social_login: bool
    social_provider: Optional[str]
    failed_login_count: int
    created_at: datetime


# ─── Project schemas ──────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_shared: bool = False

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str]
    owner_id: int
    is_shared: bool
    created_at: datetime


# ─── Admin schemas ────────────────────────────────────────────────────────────

class RoleUpdate(BaseModel):
    user_id: int
    new_role: str


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    event_type: str
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


class RiskScoreResponse(BaseModel):
    user_id: int
    username: str
    email: str
    risk_score: float
    failed_logins: int
    unauthorized_attempts: int
    unusual_activity: int
    risk_level: str  # LOW | MEDIUM | HIGH
