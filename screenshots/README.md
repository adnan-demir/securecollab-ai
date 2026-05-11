# Screenshots

Take these screenshots while the application is running and save them here.

## Required screenshots

| # | Filename | What to capture |
|---|---|---|
| 01 | `01-login.png` | The `/login` page with email/password form and "Continue with Google" button visible |
| 02 | `02-register.png` | The `/register` page with the role selector dropdown expanded |
| 03 | `03-2fa.png` | The `/verify-2fa` page showing the demo OTP code in the hint text |
| 04 | `04-dashboard.png` | The `/dashboard` logged in as admin (shows role badge and security status) |
| 05 | `05-projects.png` | The `/projects` page with the "Create Project" form open |
| 06 | `06-admin-dashboard.png` | The `/admin` page – Users tab with all three demo users listed |
| 07 | `07-role-management.png` | Admin changing a user's role via the dropdown (show the dropdown open) |
| 08 | `08-unauthorized.png` | The `/unauthorized` 403 page (log in as student and navigate to `/admin`) |
| 09 | `09-playwright-tests.png` | Terminal showing all 10 Playwright tests passing |
| 10 | `10-github-actions.png` | GitHub Actions CI pipeline showing green checks on both jobs |
| 11 | `11-deployment-dashboard.png` | Admin → "AI Risk Scores" tab with at least one user showing a non-zero score |

---

## How to take screenshots

### Step 1 — Start the backend

```bash
cd backend
python3.12 -m uvicorn main:app --reload --port 8000
```

Three demo accounts are seeded automatically:

| Email | Password | Role |
|---|---|---|
| admin@securecollab.ai | Admin@123 | admin |
| researcher@securecollab.ai | Research@123 | researcher |
| student@securecollab.ai | Student@123 | student |

### Step 2 — Start the frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Step 3 — Capture each screenshot

- **01-login**: open http://localhost:5173/login (no auth needed)
- **02-register**: open http://localhost:5173/register, click the role dropdown
- **03-2fa**: log in with any demo account — the OTP appears on the 2FA screen
- **04-dashboard**: complete login as `admin@securecollab.ai`
- **05-projects**: navigate to `/projects`, click "New Project" or "Create"
- **06-admin-dashboard**: navigate to `/admin` (must be logged in as admin)
- **07-role-management**: on the Admin Users tab, open a role dropdown for any non-admin user
- **08-unauthorized**: log in as `student@securecollab.ai`, navigate to http://localhost:5173/admin
- **09-playwright-tests**: run `cd frontend && npx playwright test` and screenshot the terminal output
- **10-github-actions**: push the code to GitHub, then screenshot the Actions tab showing both jobs green
- **11-deployment-dashboard**: on the Admin page, click the "AI Risk Scores" tab; to get a non-zero score, fail a login attempt first

### Step 4 — Playwright screenshot (09)

```bash
cd frontend
npx playwright test
```

Screenshot the terminal showing `10 passed`.

### Step 5 — GitHub Actions screenshot (10)

Push to GitHub and open the **Actions** tab. Wait for both jobs (Backend Tests and Frontend Build & Playwright E2E) to show green checkmarks, then take the screenshot.
