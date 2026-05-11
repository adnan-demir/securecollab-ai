# SecureCollab AI – AI Secure Research Collaboration Platform

> A full-stack, security-first web application for university research collaboration with role-based access, multi-factor authentication, social login, and a rule-based AI-style risk-scoring engine for threat detection.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Security Features](#security-features)
3. [Authentication Flow](#authentication-flow)
4. [Two-Factor Authentication (2FA)](#two-factor-authentication-2fa)
5. [Social Login (Google OAuth)](#social-login-google-oauth)
6. [Authorization & Role System](#authorization--role-system)
7. [AI Suspicious Activity Detection](#ai-suspicious-activity-detection)
8. [Technology Stack](#technology-stack)
9. [How to Run Locally](#how-to-run-locally)
10. [How to Run Tests](#how-to-run-tests)
11. [GitHub Actions CI/CD](#github-actions-cicd)
12. [Deployment & Security Notes](#deployment--security-notes)
13. [10-Minute Presentation Guide](#10-minute-presentation-guide)
14. [Screenshots](#screenshots)
15. [API Reference](#api-reference)

---

## Project Overview

**SecureCollab AI** is a secure research collaboration platform where students and researchers create, share, and manage research projects. Admins oversee users, adjust permissions dynamically, and monitor security events through an AI-driven risk dashboard.

**Core capabilities:**
- Secure registration and login with bcrypt-hashed passwords
- Two-step authentication (password + OTP 2FA)
- Simulated Google OAuth social login
- Role-based access control (student / researcher / admin)
- Real-time admin dashboard with user role management
- AI risk-scoring engine analyzing login failures and access violations
- Full audit trail of all security events
- Automated testing with Pytest (backend) and Playwright (E2E)
- GitHub Actions CI/CD pipeline

---

## Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt via `passlib` (salted, slow, industry standard) |
| Authentication tokens | JWT signed with HS256, expiring in 60 min |
| Two-factor authentication | 6-digit OTP, expires in 5 min |
| Social login | Simulated Google OAuth (production-ready design) |
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
│          │     ② POST /api/auth/verify-2fa      │ verify  │
│          │──── {email, otp} ───────────────────▶│         │
│          │◀─── {access_token, token_type} ──────│ JWT     │
│          │                                      │ issue   │
│          │     ③ All subsequent requests        └─────────┘
│          │──── Authorization: Bearer <token> ──▶
└──────────┘
```

1. User submits email + password → backend verifies with bcrypt
2. On success, a 6-digit OTP is generated (TTL = 5 min)
3. User submits OTP → backend issues a signed JWT
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

## Social Login (Google OAuth)

The platform includes a **simulated Google OAuth** flow for demonstration:

**Simulated flow (demo):**
1. User clicks "Continue with Google"
2. A modal displays pre-filled Google account info
3. Submitting the form calls `POST /api/auth/social-login`
4. Backend creates/finds the user and issues a JWT directly (bypassing 2FA, as the identity is verified by the provider)

**Production flow (how it would work with real Google OAuth):**
1. Frontend loads the Google Identity Services SDK
2. User clicks "Sign in with Google" → Google's consent screen appears
3. Google returns a signed ID token to the frontend
4. Frontend sends the ID token to the backend
5. Backend verifies the token signature against Google's public keys (`googleapis.com/oauth2/v3/certs`)
6. User identity is extracted from the verified token payload
7. A local user record is created/updated and a JWT is issued

Social login users are flagged with `is_social_login=True` and `social_provider='google'` in the database.

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
- 🟢 **LOW** (0–29): Normal activity
- 🟡 **MEDIUM** (30–59): Elevated risk, monitoring recommended
- 🔴 **HIGH** (60+): Immediate review recommended

**Events tracked:**
| Event | Weight | Description |
|---|:---:|---|
| `failed_login` | ×15 | Wrong password submitted |
| `unauthorized_access` | ×20 | Attempted to access a forbidden endpoint |
| `failed_2fa` | ×10 | Submitted wrong OTP |

Admins can view the real-time risk dashboard at `/admin` → "AI Risk Scores" tab.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Uvicorn |
| Database | SQLite (local), upgrade to PostgreSQL for production |
| Auth | JWT (python-jose), bcrypt (passlib), OTP generation |
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

**52 tests · ~95% line coverage**

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

**Artifacts produced:**
- `backend-coverage` – pytest XML coverage report
- `playwright-report` – interactive HTML report (retained 14 days)
- `playwright-screenshots` – failure screenshots (on failure only)

---

## Deployment & Security Notes

### Environment variables

All secrets must be set via environment variables before deploying:

```bash
# Generate a strong secret key:
python -c "import secrets; print(secrets.token_hex(32))"

export SECRET_KEY="<generated-value>"
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export ALLOWED_ORIGINS="https://yourdomain.com"
```

### Security hardening checklist

- [ ] Replace the default `SECRET_KEY` with a cryptographically random 256-bit value
- [ ] Switch `DATABASE_URL` from SQLite to PostgreSQL for production
- [ ] Enable HTTPS via a reverse proxy (Nginx + Let's Encrypt)
- [ ] Set `ALLOWED_ORIGINS` to your exact frontend domain (no wildcards)
- [ ] Remove `otp_for_demo` from the login response and integrate a real email/SMS provider (SendGrid, Twilio)
- [ ] Enable rate limiting (e.g., slowapi) on `/api/auth/login` to mitigate brute force
- [ ] Add account lockout after N consecutive failed logins
- [ ] Use `httpOnly` cookies for the JWT instead of localStorage to prevent XSS theft
- [ ] Enable HSTS, CSP, and X-Frame-Options headers via the reverse proxy
- [ ] Integrate real Google OAuth using the `google-auth` library and verify ID tokens server-side
- [ ] Set up database backups and audit log retention policy

### Running behind Nginx (example)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Frontend (static build)
    location / {
        root /var/www/securecollab/dist;
        try_files $uri /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## 10-Minute Presentation Guide

Use this outline to walk through the project in a live demo:

| # | Time | What to show |
|---|---:|---|
| 1 | 0:00–1:00 | **Overview** – explain the problem (secure research collaboration), the tech stack (FastAPI + React), and the three user roles |
| 2 | 1:00–2:30 | **Registration & Login** – register a new account, show the bcrypt-hashed password never leaving the server, then log in |
| 3 | 2:30–3:30 | **2FA** – show the OTP screen; explain that in production the code would arrive via email/SMS, not in the API response |
| 4 | 3:30–4:30 | **Simulated Google OAuth** – click "Continue with Google", walk through the modal, explain this is a demo simulation and describe the real production flow (Google Identity Services SDK → backend token verification) |
| 5 | 4:30–5:30 | **Role-based access** – log in as student, try to reach `/admin` → hit the 403 Unauthorized page; then log in as admin and show full access |
| 6 | 5:30–6:30 | **Admin Dashboard** – show user list, change a role live, enable/disable an account |
| 7 | 6:30–7:30 | **AI Risk Scores** – trigger a few failed logins, open the risk dashboard, walk through the scoring formula (`failed_logins×15 + unauthorized×20 + failed_2fa×10`) |
| 8 | 7:30–8:30 | **Tests** – run `python3.12 -m pytest tests/ -v` (52 tests) and `npx playwright test` (10 E2E tests); both pass |
| 9 | 8:30–9:30 | **GitHub Actions** – show the CI pipeline on GitHub, explain what each job validates |
| 10 | 9:30–10:00 | **Production hardening checklist** – walk through the 11 items in the Deployment section (real OAuth, httpOnly cookies, rate limiting, etc.) |

**Demo credentials to have open and ready:**

```
admin@securecollab.ai    / Admin@123      (admin role)
researcher@securecollab.ai / Research@123  (researcher role)
student@securecollab.ai  / Student@123   (student role)
```

---

## Screenshots

> Take these screenshots while the app is running, save them in the `screenshots/` directory, and push to GitHub.

| # | File | Description |
|---|---|---|
| 01 | [screenshots/01-login.png](screenshots/01-login.png) | Login page with email/password form and Google OAuth button |
| 02 | [screenshots/02-register.png](screenshots/02-register.png) | Registration page with role selector |
| 03 | [screenshots/03-2fa.png](screenshots/03-2fa.png) | 2FA verification page showing demo OTP |
| 04 | [screenshots/04-dashboard.png](screenshots/04-dashboard.png) | User dashboard with role badge and security status |
| 05 | [screenshots/05-projects.png](screenshots/05-projects.png) | Projects list and create project form |
| 06 | [screenshots/06-admin-dashboard.png](screenshots/06-admin-dashboard.png) | Admin dashboard – Users tab |
| 07 | [screenshots/07-role-management.png](screenshots/07-role-management.png) | Admin changing a user's role |
| 08 | [screenshots/08-unauthorized.png](screenshots/08-unauthorized.png) | 403 Unauthorized page |
| 09 | [screenshots/09-playwright-tests.png](screenshots/09-playwright-tests.png) | Playwright test results (all 10 passing) |
| 10 | [screenshots/10-github-actions.png](screenshots/10-github-actions.png) | GitHub Actions CI pipeline passing |
| 11 | [screenshots/11-deployment-dashboard.png](screenshots/11-deployment-dashboard.png) | AI Risk Scores panel in Admin dashboard |

---

## API Reference

Interactive Swagger docs are available at `http://localhost:8000/api/docs` when the backend is running.

### Auth endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Validate credentials, generate OTP |
| POST | `/api/auth/verify-2fa` | Verify OTP, receive JWT |
| POST | `/api/auth/social-login` | Social login (Google OAuth simulated) |
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

---

*Built with FastAPI · React · Tailwind CSS · Playwright · GitHub Actions*
