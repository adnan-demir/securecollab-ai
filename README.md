# SecureCollab AI – AI Secure Research Collaboration Platform

> A full-stack, security-first web application for university research collaboration with role-based access, multi-factor authentication, social login (Google / GitHub / Microsoft – simulated), backup recovery codes, and a rule-based AI-style risk-scoring engine for threat detection.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Security Features](#security-features)
3. [Authentication Flow](#authentication-flow)
4. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
5. [Backup Recovery Codes](#backup-recovery-codes)
6. [Social Login – Google / GitHub / Microsoft](#social-login--google--github--microsoft)
7. [Authorization & Role System](#authorization--role-system)
8. [AI Suspicious Activity Detection](#ai-suspicious-activity-detection)
9. [Security Dashboard](#security-dashboard)
10. [Technology Stack](#technology-stack)
11. [How to Run Locally](#how-to-run-locally)
12. [How to Run Tests](#how-to-run-tests)
13. [GitHub Actions CI/CD](#github-actions-cicd)
14. [Deployment – Vercel + Railway](#deployment--vercel--railway)
15. [10-Minute Presentation Guide](#10-minute-presentation-guide)
16. [Screenshots](#screenshots)
17. [API Reference](#api-reference)
18. [Bonus Feature Checklist](#bonus-feature-checklist)

---

## Project Overview

**SecureCollab AI** is a secure research collaboration platform where students and researchers create, share, and manage research projects. Admins oversee users, adjust permissions dynamically, and monitor security events through an AI-driven risk dashboard.

**Core capabilities:**
- Secure registration and login with bcrypt-hashed passwords
- Two-step authentication (password + OTP 2FA)
- Backup recovery codes as an alternative second factor
- Simulated Google, GitHub, and Microsoft OAuth social login
- Role-based access control (student / researcher / admin)
- Real-time admin dashboard with user role management
- AI risk-scoring engine analyzing login failures and access violations
- Full audit trail of all security events
- Security Dashboard / deployment-readiness checklist
- Automated testing with Pytest (backend) and Playwright (E2E)
- GitHub Actions CI/CD pipeline

---

## Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt via `passlib` (salted, slow, industry standard) |
| Authentication tokens | JWT signed with HS256, expiring in 60 min |
| Two-factor authentication | 6-digit OTP, expires in 5 min |
| Backup recovery codes | 5 single-use 10-char codes, SHA-256 hashed |
| Social login | Simulated Google / GitHub / Microsoft OAuth |
| Role-based authorization | Middleware guard on every protected endpoint |
| Unauthorized access logging | Every 403 is recorded in the audit log |
| Failed login tracking | Per-user counter used by AI risk engine |
| CORS policy | Restricted to known frontend origins |
| Secret management | All secrets via environment variables, never hard-coded |
| Input validation | Pydantic v2 validators on all API inputs |
| SQL injection prevention | SQLAlchemy ORM with parameterized queries |

---

## Authentication Flow

```
┌──────────┐     ① POST /api/auth/login          ┌─────────┐
│  Browser │──── email + password ──────────────▶│ Backend │
│          │◀─── {email, otp_for_demo} ──────────│         │
│          │                                      │ bcrypt  │
│          │     ② a) POST /api/auth/verify-2fa   │ verify  │
│          │──── {email, otp} ───────────────────▶│         │
│          │                                      │         │
│          │        OR                            │         │
│          │                                      │         │
│          │     ② b) POST /api/auth/verify-      │         │
│          │          recovery-code               │         │
│          │──── {email, code} ─────────────────▶│         │
│          │◀─── {access_token, token_type} ──────│ JWT     │
│          │                                      │ issue   │
│          │     ③ All subsequent requests        └─────────┘
│          │──── Authorization: Bearer <token> ──▶
└──────────┘
```

1. User submits email + password → backend verifies with bcrypt
2. On success, a 6-digit OTP is generated (TTL = 5 min)
3. User submits OTP **or** a backup recovery code → backend issues a signed JWT
4. All protected API calls include the JWT in the `Authorization` header

---

## Two-Factor Authentication (2FA)

SecureCollab AI implements OTP-based 2FA as a second authentication factor:

- After password validation, a random 6-digit code is generated server-side
- In production, this code is delivered via email/SMS (never exposed in the API)
- **Demo mode**: The OTP is returned in the login response and displayed on the 2FA screen to enable testing without an email service
- OTPs expire after **5 minutes**
- Failed OTP attempts are logged as `failed_2fa` events and contribute to the user's AI risk score
- On successful 2FA, the failed login counter resets and a signed JWT is issued

---

## Backup Recovery Codes

An additional authentication method that allows users to bypass OTP 2FA if they lose access to their authenticator:

**How it works:**
1. A logged-in user clicks **"Generate Recovery Codes"** on their Dashboard
2. The backend generates 5 random 10-character alphanumeric codes
3. The codes are SHA-256 hashed and stored in the database; plaintext is returned once and never stored
4. During a future login, if the user cannot receive the OTP, they click **"Use recovery code instead"** on the 2FA page and enter one of the saved codes
5. Each code is **single-use** – it is deleted from the database after successful verification

**Security notes:**
- Recovery codes are high-entropy random strings (not user-chosen), making SHA-256 storage acceptable (not brute-force vulnerable like passwords)
- Generating new codes invalidates all previous codes
- Recovery codes count as a completed second factor; only users who passed password step 1 can use them

**Endpoints:**
- `POST /api/auth/generate-recovery-codes` – requires JWT; returns 5 plaintext codes (shown once)
- `POST /api/auth/verify-recovery-code` – `{email, code}`; requires pending OTP state (step 1 must be completed first)

---

## Social Login – Google / GitHub / Microsoft

The platform includes **simulated OAuth social login** for three providers.

> **All three providers are clearly labelled "Simulated" in the UI.** They do not connect to real OAuth servers. This design demonstrates the correct OAuth architecture while keeping the demo self-contained and stable.

### Simulated flow (demo)

For each provider (Google / GitHub / Microsoft):

1. User clicks the provider button on the Login page
2. A modal displays pre-filled account info with an "amber demo" warning banner
3. Submitting the form calls `POST /api/auth/social-login` with `provider`, `email`, `name`, `social_id`
4. Backend creates/finds the user and issues a JWT (bypassing 2FA – identity is "verified by provider")

### Production flow (what real OAuth would look like)

**Google:**
1. Frontend loads Google Identity Services SDK
2. User clicks → Google consent screen
3. Google returns a signed ID token
4. Backend verifies against Google's public keys (`googleapis.com/oauth2/v3/certs`)
5. User created/updated, JWT issued

**GitHub:**
1. User redirected to `github.com/login/oauth/authorize`
2. GitHub redirects back with `code`
3. Backend exchanges `code` for access token (`github.com/login/oauth/access_token`)
4. Backend fetches user profile (`api.github.com/user`)
5. JWT issued

**Microsoft:**
1. User redirected to Microsoft identity platform (MSAL)
2. Microsoft returns authorization code
3. Backend exchanges for tokens via Azure AD endpoints
4. JWT issued

Social login users are stored with `is_social_login=True` and `social_provider='google'|'github'|'microsoft'`.

---

## Authorization & Role System

Three roles with hierarchical permissions:

| Role | Own Projects | Shared Projects | All Projects | Admin Panel |
|---|:---:|:---:|:---:|:---:|
| student | ✅ | ❌ | ❌ | ❌ |
| researcher | ✅ | ✅ | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ |

**Dynamic role management:**
- Admins can change any user's role live from the Admin Dashboard
- Changes take effect on the user's next API call (JWT role is re-read on token refresh)
- Admins can enable/disable user accounts
- All role changes are logged in the activity audit trail

**Route protection:**
- Frontend: `ProtectedRoute` component checks authentication and role before rendering
- Backend: every endpoint validates the JWT and checks the user's role
- Unauthorized access attempts are logged and increase the user's risk score

---

## AI Suspicious Activity Detection

SecureCollab AI includes an AI-style threat scoring engine that computes a risk score (0–100) for every user:

```
Score = (failed_logins × 15) + (unauthorized_access × 20) + (failed_2fa × 10)
Score is capped at 100.
```

**Risk levels:**
- LOW (0–29): Normal activity
- MEDIUM (30–59): Elevated risk, monitoring recommended
- HIGH (60+): Immediate review recommended

**Events tracked:**
| Event | Weight | Description |
|---|:---:|---|
| `failed_login` | ×15 | Wrong password submitted |
| `unauthorized_access` | ×20 | Attempted to access a forbidden endpoint |
| `failed_2fa` | ×10 | Submitted wrong OTP |

Admins can view the real-time risk dashboard at `/admin` → "AI Risk Scores" tab.

---

## Security Dashboard

The **Security Dashboard** tab in the Admin panel provides an honest, at-a-glance overview of the platform's security posture and deployment readiness. It is designed for instructor review and screenshot documentation.

**It shows:**
- All authentication methods enabled (Email+Password, OTP 2FA, Recovery Codes, Google/GitHub/Microsoft social login)
- Security features status (bcrypt, JWT, CORS, RBAC, AI risk scoring, CI/CD)
- Deployment checklist with honest status labels:
  - `enabled` – fully active
  - `demo` – functional for development; needs configuration for production
  - `pending` – automatically handled by the cloud provider (e.g., HTTPS by Railway/Vercel)
  - `ready` – app is structured for deployment (e.g., `npm run build` produces static dist/)
- Live stats (total users, social login users, failed logins, unauthorized attempts)

> This is a **deployment-readiness checklist**, not a live VPS monitoring dashboard. It honestly reflects the demo/production state of each feature.

Endpoint: `GET /api/admin/security-status` (admin role required)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Uvicorn |
| Database | SQLite (local), upgrade to PostgreSQL for production |
| Auth | JWT (python-jose), bcrypt (passlib), OTP generation, SHA-256 recovery codes |
| Testing (backend) | Pytest, pytest-cov, FastAPI TestClient |
| Testing (E2E) | Playwright |
| CI/CD | GitHub Actions |

---

## How to Run Locally

### Prerequisites
- Python 3.12+
- Node.js 20+

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd "AI Secure Research Collaboration Platform"
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt

# Optional: copy and configure environment variables
cp .env.example .env

python3.12 -m uvicorn main:app --reload --port 8000
```

The backend starts at `http://localhost:8000`.
Three demo users are seeded automatically:

| Email | Password | Role |
|---|---|---|
| admin@securecollab.ai | Admin@123 | admin |
| researcher@securecollab.ai | Research@123 | researcher |
| student@securecollab.ai | Student@123 | student |

Interactive API docs: `http://localhost:8000/api/docs`

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

---

## How to Run Tests

### Backend unit tests

**64 tests · ~96% line coverage**

```bash
cd backend
pip install -r requirements.txt

# Run all tests
python3.12 -m pytest tests/ -v

# Run with coverage report
python3.12 -m pytest tests/ --cov=. --cov-report=term-missing -v

# Run specific test file
python3.12 -m pytest tests/test_auth.py -v
python3.12 -m pytest tests/test_api.py -v
```

### Playwright E2E tests

**10 tests covering the full user journey**

Ensure both backend and frontend are running first, then:

```bash
cd frontend
npm install

# Install Playwright browsers (first time only)
npx playwright install chromium

# Run all E2E tests
npx playwright test

# Run with interactive UI
npx playwright test --ui

# View HTML report
npx playwright show-report
```

---

## GitHub Actions CI/CD

The workflow file is at `.github/workflows/tests.yml` and runs on every `push` and `pull_request`.

**Pipeline steps:**

```
push / pull_request
       │
       ├─ job: backend-tests
       │    ├── Setup Python 3.11
       │    ├── pip install -r requirements.txt
       │    ├── pytest tests/ --cov (generates coverage.xml)
       │    └── Upload coverage artifact
       │
       └─ job: frontend-tests
            ├── Setup Python + Node.js 20
            ├── Install backend + frontend dependencies
            ├── npm run build (verifies frontend compiles)
            ├── Install Playwright browsers
            ├── Start FastAPI backend (background process)
            ├── npx playwright test
            └── Upload Playwright HTML report artifact
```

---

## Deployment – Vercel + Railway

This project is structured for deployment with **Vercel** (frontend) and **Railway** (backend).

### Frontend → Vercel

```bash
# Build static assets
cd frontend
npm run build          # produces frontend/dist/

# Deploy to Vercel (via CLI or GitHub integration)
# vercel.json is not required – Vercel auto-detects Vite/React builds
```

**Vercel settings:**
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment variable: `VITE_API_URL=https://your-backend.railway.app`

See `frontend/.env.example` for all available frontend environment variables.

### Backend → Railway

```bash
# Railway detects Python apps automatically.
# Start command:
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Railway environment variables to set:**

| Variable | Example | Notes |
|---|---|---|
| `SECRET_KEY` | `<256-bit random hex>` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Railway PostgreSQL add-on |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` | Your Vercel frontend URL |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT TTL |

See `backend/.env.example` for all available backend environment variables.

### CORS configuration

The backend's CORS policy is controlled by `ALLOWED_ORIGINS`:

```python
# backend/main.py
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173"
).split(",")
```

**Local development:** defaults allow both Vite dev server ports.

**Production:** set `ALLOWED_ORIGINS=https://your-app.vercel.app` in Railway. Never use `*` in production – it bypasses CORS protection entirely.

### Production security hardening checklist

- [ ] Replace the default `SECRET_KEY` with a cryptographically random 256-bit value
- [ ] Switch `DATABASE_URL` from SQLite to PostgreSQL
- [ ] Set `ALLOWED_ORIGINS` to exact Vercel frontend domain (no wildcards)
- [ ] Remove `otp_for_demo` from the login response and integrate email/SMS (SendGrid, Twilio)
- [ ] Implement real OAuth token verification for Google / GitHub / Microsoft (replace simulated flow)
- [ ] Enable rate limiting (e.g., `slowapi`) on `/api/auth/login` to mitigate brute force
- [ ] Add account lockout after N consecutive failed logins
- [ ] Use `httpOnly` cookies for JWT instead of localStorage to prevent XSS theft
- [ ] Enable HSTS, CSP, X-Frame-Options headers via reverse proxy or Railway/Vercel headers
- [ ] Set up database backups and audit log retention policy
- [ ] Rotate recovery codes periodically and notify users when codes are running low

---

## 10-Minute Presentation Guide

| # | Time | What to show |
|---|---:|---|
| 1 | 0:00–1:00 | **Overview** – explain the problem (secure research collaboration), the tech stack, and the three user roles |
| 2 | 1:00–2:00 | **Registration & Login** – register a new account, show the bcrypt-hashed password never leaving the server |
| 3 | 2:00–3:00 | **2FA + Recovery Codes** – show the OTP screen; demo the "Use recovery code instead" toggle; explain production delivery via email/SMS |
| 4 | 3:00–4:00 | **Social Login (Google / GitHub / Microsoft)** – click each button, walk through the demo modal, explain the real production OAuth flow for each |
| 5 | 4:00–5:00 | **Role-based access** – log in as student, try `/admin` → 403; log in as admin and show full access |
| 6 | 5:00–6:00 | **Admin Dashboard** – change a role live, enable/disable an account, show activity log |
| 7 | 6:00–7:00 | **AI Risk Scores** – trigger failed logins, open risk dashboard, walk through scoring formula |
| 8 | 7:00–8:00 | **Security Dashboard** – show the deployment-readiness checklist; explain demo vs enabled vs pending items |
| 9 | 8:00–9:00 | **Tests** – run `python3.12 -m pytest tests/ -v` (64 tests, 96% coverage) and `npx playwright test` (10 E2E tests) |
| 10 | 9:00–10:00 | **Deployment plan** – walk through the Vercel + Railway deployment section and production hardening checklist |

**Demo credentials:**

```
admin@securecollab.ai      / Admin@123      (admin role)
researcher@securecollab.ai / Research@123   (researcher role)
student@securecollab.ai    / Student@123    (student role)
```

---

## Screenshots

| # | File | Description |
|---|---|---|
| 01 | [screenshots/01-login.png](screenshots/01-login.png) | Login page with email/password + Google/GitHub/Microsoft social login buttons |
| 02 | [screenshots/02-register.png](screenshots/02-register.png) | Registration page |
| 03 | [screenshots/03-2fa.png](screenshots/03-2fa.png) | 2FA page showing OTP + recovery code toggle |
| 04 | [screenshots/04-dashboard.png](screenshots/04-dashboard.png) | Dashboard with recovery code generator panel |
| 05 | [screenshots/05-projects.png](screenshots/05-projects.png) | Projects list |
| 06 | [screenshots/06-admin-dashboard.png](screenshots/06-admin-dashboard.png) | Admin dashboard – Users tab |
| 07 | [screenshots/07-role-management.png](screenshots/07-role-management.png) | Admin changing a user's role |
| 08 | [screenshots/08-unauthorized.png](screenshots/08-unauthorized.png) | 403 Unauthorized page |
| 09 | [screenshots/09-playwright-tests.png](screenshots/09-playwright-tests.png) | Playwright test results (10 passing) |
| 10 | [screenshots/10-github-actions.png](screenshots/10-github-actions.png) | GitHub Actions CI pipeline |
| 11 | [screenshots/11-deployment-dashboard.png](screenshots/11-deployment-dashboard.png) | Security Dashboard / deployment checklist |

---

## API Reference

Interactive Swagger docs: `http://localhost:8000/api/docs`

### Auth endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Validate credentials, generate OTP |
| POST | `/api/auth/verify-2fa` | Verify OTP, receive JWT |
| POST | `/api/auth/verify-recovery-code` | Use backup recovery code instead of OTP |
| POST | `/api/auth/generate-recovery-codes` | Generate 5 backup recovery codes (requires JWT) |
| POST | `/api/auth/social-login` | Social login (Google / GitHub / Microsoft – simulated) |
| GET  | `/api/auth/me` | Get current user profile |

### Project endpoints

| Method | Path | Description |
|---|---|---|
| GET  | `/api/projects` | List projects (role-filtered) |
| POST | `/api/projects` | Create a new project |

### Admin endpoints (admin role required)

| Method | Path | Description |
|---|---|---|
| GET  | `/api/admin/users` | List all users |
| PUT  | `/api/admin/users/role` | Change a user's role |
| PUT  | `/api/admin/users/{id}/toggle` | Enable/disable a user |
| GET  | `/api/admin/activity-logs` | Security audit log |
| GET  | `/api/admin/risk-scores` | AI risk scores per user |
| GET  | `/api/admin/security-status` | Security + deployment readiness dashboard |

---

## Bonus Feature Checklist

This table maps instructor bonus criteria to implemented features:

| Bonus Area | Requirement | Status | Where |
|---|---|:---:|---|
| Social login | Google OAuth | Simulated | Login page, `/api/auth/social-login` |
| Social login | GitHub OAuth | Simulated | Login page, `/api/auth/social-login` |
| Social login | Microsoft OAuth | Simulated | Login page, `/api/auth/social-login` |
| Extra auth method | Backup recovery codes | Implemented | Dashboard → Generate; 2FA page → toggle |
| Deployment readiness | Vercel + Railway docs | Documented | README: Deployment section |
| Deployment readiness | `.env.example` files | Both present | `backend/.env.example`, `frontend/.env.example` |
| Deployment readiness | CORS explanation | Documented | README: CORS section |
| Deployment readiness | Security hardening checklist | 11 items | README: Hardening checklist |
| Security proof | Security Dashboard | Implemented | Admin → Security Dashboard tab |
| Security proof | Auth methods listed | Shown | Security Dashboard |
| Security proof | Failed login tracking | Live data | Security Dashboard stats |
| Security proof | Deployment checklist | Honest labels | Security Dashboard |
| Tests | Backend tests pass | 64/64 | `pytest tests/ -v` |
| Tests | E2E tests pass | 10/10 | `npx playwright test` |
| Tests | Coverage | 96% | `pytest --cov` |
| Tests | Recovery code tests | 6 new tests | `TestRecoveryCodes` class |
| Tests | Social login tests | 4 new tests | `TestSocialLogin` + `TestSecurityStatus` |

---

*Built with FastAPI · React · Tailwind CSS · Playwright · GitHub Actions*
