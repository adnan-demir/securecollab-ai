"""
SQLAlchemy ORM models for SecureCollab AI.
Defines User, Project, and ActivityLog tables.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    # Nullable for social-login users who have no local password
    hashed_password = Column(String, nullable=True)
    # Roles: student | researcher | admin
    role = Column(String, default="student", nullable=False)
    is_active = Column(Boolean, default=True)
    is_social_login = Column(Boolean, default=False)
    social_provider = Column(String, nullable=True)

    # 2FA OTP fields
    otp_secret = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    # Backup recovery codes: JSON list of SHA-256 hashed single-use codes
    recovery_codes = Column(Text, nullable=True)

    # Security tracking for AI risk scoring
    failed_login_count = Column(Integer, default=0)
    last_failed_login = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    projects = relationship("Project", back_populates="owner")
    activity_logs = relationship("ActivityLog", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    # Shared projects are visible to researchers and admins
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    owner = relationship("User", back_populates="projects")


class ActivityLog(Base):
    """
    Security audit log. Tracks logins, failures, unauthorized access attempts.
    Used by the AI risk-scoring engine to calculate user threat scores.
    """
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Event types: login | failed_login | failed_2fa | unauthorized_access
    #              social_login | role_change | logout
    event_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="activity_logs")
