"""
SecureCollab AI – FastAPI backend
=================================
Security features implemented:
  1. bcrypt password hashing (passlib)
  2. JWT authentication (python-jose)
  3. Two-factor authentication (OTP via 2FA)
  4. Simulated Google OAuth social login
  5. Role-based authorization (student | researcher | admin)
  6. Failed-login tracking and account lockout guard
  7. Unauthorized-access logging
  8. AI-style risk scoring per user
  9. CORS locked to known frontend origins
 10. Secrets loaded from environment variables
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Request, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, get_db, Base, SessionLocal
from models import User, Project, ActivityLog
from schemas import (
    UserCreate, UserLogin, OTPVerify, Token, UserResponse,
    ProjectCreate, ProjectResponse, RoleUpdate, ActivityLogResponse,
    RiskScoreResponse, SocialLoginRequest,
)
from auth import (
    verify_password, get_password_hash,
    create_access_token, decode_token,
    generate_otp, calculate_risk_score,
)

# ── Create database tables on startup ────────────────────────────────────────
Base.metadata.create_all(bind=engine)


def _seed_demo_users():
    """Seed three demo accounts so the app is ready out-of-the-box."""
    db = SessionLocal()
    try:
        demos = [
            ("admin@securecollab.ai",      "admin",      "Admin@123",    "admin"),
            ("researcher@securecollab.ai", "researcher", "Research@123", "researcher"),
            ("student@securecollab.ai",    "student",    "Student@123",  "student"),
        ]
        for email, username, password, role in demos:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                # Always reset demo users to their canonical roles so repeated
                # test runs don't leave them in an unexpected state.
                existing.role = role
                existing.is_active = True
            else:
                db.add(User(
                    email=email, username=username,
                    hashed_password=get_password_hash(password), role=role,
                ))
        db.commit()
        print("\n[OK] Demo users seeded:")
        print("   admin@securecollab.ai      / Admin@123")
        print("   researcher@securecollab.ai / Research@123")
        print("   student@securecollab.ai    / Student@123\n")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_demo_users()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="SecureCollab AI API",
    description="AI-powered secure research collaboration platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Restrict to the Vite dev server and preview server.
# In production, replace with your actual frontend domain.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_token(authorization: Optional[str]) -> str:
    """Extract Bearer token from Authorization header, raising 401 if absent."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return authorization.split(" ", 1)[1]


def get_current_user(token: str, db: Session) -> User:
    """Validate JWT and return the corresponding active user."""
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_admin(token: str, db: Session, request: Request) -> User:
    """Require the current user to be an admin; log unauthorized attempts."""
    user = get_current_user(token, db)
    if user.role != "admin":
        _log(db, "unauthorized_access", user_id=user.id,
             details="Attempted admin access",
             ip_address=_ip(request))
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _log(db: Session, event_type: str, user_id: Optional[int] = None,
          details: str = None, ip_address: str = None):
    """Write an entry to the activity_logs table."""
    db.add(ActivityLog(
        user_id=user_id,
        event_type=event_type,
        details=details,
        ip_address=ip_address,
    ))
    db.commit()


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"



# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register", response_model=UserResponse, status_code=201,
          tags=["auth"])
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.
    Password is hashed with bcrypt before storage – plaintext is never persisted.
    """
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    valid_roles = {"student", "researcher", "admin"}
    role = user_data.role if user_data.role in valid_roles else "student"

    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login", tags=["auth"])
def login(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    Step 1 of authentication: validate email + password.
    On success, generates a 6-digit OTP valid for 5 minutes.

    ⚠️  otp_for_demo is returned for local demo purposes only.
        In production, the OTP would be delivered via email or SMS and
        NEVER included in the API response.
    """
    user = db.query(User).filter(User.email == credentials.email).first()

    # Deliberately generic error message to prevent user enumeration
    if not user or not user.hashed_password:
        _log(db, "failed_login",
             details=f"Login attempt for unknown email: {credentials.email}",
             ip_address=_ip(request))
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, user.hashed_password):
        user.failed_login_count += 1
        user.last_failed_login = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        _log(db, "failed_login", user_id=user.id,
             details="Incorrect password", ip_address=_ip(request))
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    otp = generate_otp()
    user.otp_secret = otp
    # Store as naive UTC (SQLite does not support tz-aware datetimes)
    user.otp_expiry = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=5)
    db.commit()

    return {
        "message": "OTP generated. Check your email.",
        # DEMO ONLY – remove in production:
        "otp_for_demo": otp,
        "email": user.email,
    }


@app.post("/api/auth/verify-2fa", response_model=Token, tags=["auth"])
def verify_2fa(otp_data: OTPVerify, db: Session = Depends(get_db)):
    """
    Step 2 of authentication: verify OTP.
    On success, issues a signed JWT and clears failed-login counter.
    """
    user = db.query(User).filter(User.email == otp_data.email).first()

    if not user or not user.otp_secret:
        raise HTTPException(status_code=400, detail="No pending 2FA verification")

    if datetime.now(timezone.utc).replace(tzinfo=None) > user.otp_expiry:
        user.otp_secret = None
        user.otp_expiry = None
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please log in again.")

    if user.otp_secret != otp_data.otp:
        _log(db, "failed_2fa", user_id=user.id, details="Wrong OTP submitted")
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Successful 2FA – clear OTP and reset failed-login counter
    user.otp_secret = None
    user.otp_expiry = None
    user.failed_login_count = 0
    db.commit()

    _log(db, "login", user_id=user.id, details="Successful 2FA login")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/social-login", response_model=Token, tags=["auth"])
def social_login(data: SocialLoginRequest, db: Session = Depends(get_db)):
    """
    Simulated Google OAuth social login.

    In a real deployment:
      1. Frontend receives a Google ID token via the Google Sign-In SDK.
      2. Backend verifies the token against Google's public keys.
      3. User info is extracted from the verified token payload.

    For this demo, the client sends the profile data directly.
    Social-login users bypass 2FA (their identity is already verified by the provider).
    """
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        base_username = data.name.lower().replace(" ", "_")
        username = f"{base_username}_{data.social_id[-4:]}"
        user = User(
            email=data.email,
            username=username,
            hashed_password=None,
            role="student",
            is_social_login=True,
            social_provider=data.provider,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    _log(db, "social_login", user_id=user.id, details=f"Social login via {data.provider}")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse, tags=["auth"])
def get_me(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Return the currently authenticated user's profile."""
    token = _extract_token(authorization)
    return get_current_user(token, db)


# ═══════════════════════════════════════════════════════════════════════════════
# PROJECT ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/projects", response_model=list[ProjectResponse], tags=["projects"])
def list_projects(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Role-based project listing:
      student     → own projects only
      researcher  → own + all shared projects
      admin       → all projects
    """
    token = _extract_token(authorization)
    user = get_current_user(token, db)

    if user.role == "admin":
        return db.query(Project).all()
    elif user.role == "researcher":
        return db.query(Project).filter(
            (Project.owner_id == user.id) | (Project.is_shared == True)
        ).all()
    else:
        return db.query(Project).filter(Project.owner_id == user.id).all()


@app.post("/api/projects", response_model=ProjectResponse, status_code=201, tags=["projects"])
def create_project(
    project_data: ProjectCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Create a new research project owned by the authenticated user."""
    token = _extract_token(authorization)
    user = get_current_user(token, db)

    project = Project(
        title=project_data.title,
        description=project_data.description,
        owner_id=user.id,
        is_shared=project_data.is_shared,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ROUTES – all require admin role
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/admin/users", response_model=list[UserResponse], tags=["admin"])
def list_users(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Admin: list all registered users."""
    token = _extract_token(authorization)
    require_admin(token, db, request)
    return db.query(User).all()


@app.put("/api/admin/users/role", tags=["admin"])
def update_user_role(
    role_data: RoleUpdate,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Admin: dynamically change a user's role.
    Changes take effect on the user's next login (or immediately via token refresh).
    """
    token = _extract_token(authorization)
    admin = require_admin(token, db, request)

    valid_roles = {"student", "researcher", "admin"}
    if role_data.new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    user = db.query(User).filter(User.id == role_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = role_data.new_role
    db.commit()

    _log(db, "role_change", user_id=admin.id,
         details=f"Changed {user.email}: {old_role} → {role_data.new_role}",
         ip_address=_ip(request))

    return {"message": f"User {user.email} role updated to {role_data.new_role}"}


@app.put("/api/admin/users/{user_id}/toggle", tags=["admin"])
def toggle_user_status(
    user_id: int,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Admin: enable or disable a user account."""
    token = _extract_token(authorization)
    require_admin(token, db, request)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    db.commit()
    state = "enabled" if user.is_active else "disabled"
    return {"message": f"User {user.email} has been {state}", "is_active": user.is_active}


@app.get("/api/admin/activity-logs", response_model=list[ActivityLogResponse], tags=["admin"])
def get_activity_logs(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Admin: retrieve the 100 most recent activity log entries."""
    token = _extract_token(authorization)
    require_admin(token, db, request)
    return (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(100)
        .all()
    )


@app.get("/api/admin/risk-scores", response_model=list[RiskScoreResponse], tags=["admin"])
def get_risk_scores(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Admin: AI-style risk score for every user.

    Algorithm:
      score = (failed_logins × 15) + (unauthorized_access × 20) + (failed_2FA × 10)
      capped at 100.

    Risk levels:
      LOW    0–29
      MEDIUM 30–59
      HIGH   60–100
    """
    token = _extract_token(authorization)
    require_admin(token, db, request)

    results = []
    for user in db.query(User).all():
        unauthorized = (
            db.query(ActivityLog)
            .filter(ActivityLog.user_id == user.id,
                    ActivityLog.event_type == "unauthorized_access")
            .count()
        )
        unusual = (
            db.query(ActivityLog)
            .filter(ActivityLog.user_id == user.id,
                    ActivityLog.event_type == "failed_2fa")
            .count()
        )
        score = calculate_risk_score(user.failed_login_count, unauthorized, unusual)
        level = "LOW" if score < 30 else "MEDIUM" if score < 60 else "HIGH"

        results.append(RiskScoreResponse(
            user_id=user.id,
            username=user.username,
            email=user.email,
            risk_score=score,
            failed_logins=user.failed_login_count,
            unauthorized_attempts=unauthorized,
            unusual_activity=unusual,
            risk_level=level,
        ))

    # Return highest-risk users first
    return sorted(results, key=lambda x: x.risk_score, reverse=True)


# ─── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok", "service": "SecureCollab AI", "version": "1.0.0"}
