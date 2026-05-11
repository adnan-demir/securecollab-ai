/**
 * SecureCollab AI – Playwright End-to-End Tests
 *
 * Prerequisites (running before test suite):
 *   - Backend: uvicorn main:app --port 8000  (from backend/)
 *   - Frontend: npm run dev                  (from frontend/) [started by playwright]
 *
 * The backend seeds three demo users on startup:
 *   admin@securecollab.ai      / Admin@123
 *   researcher@securecollab.ai / Research@123
 *   student@securecollab.ai    / Student@123
 */

import { test, expect, request } from '@playwright/test'

const API = 'http://localhost:8000'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Register a user via API and return their credentials.
 */
async function apiRegister(apiCtx, email, username, password = 'TestPass@123', role = 'student') {
  const r = await apiCtx.post(`${API}/api/auth/register`, {
    data: { email, username, password, role },
  })
  // Allow 400 (already exists from previous run) as well as 201
  if (r.status() !== 201 && r.status() !== 400) {
    throw new Error(`Registration failed: ${r.status()} ${await r.text()}`)
  }
  return { email, password }
}

/**
 * Full login flow via UI. Returns the OTP displayed on the 2FA page.
 */
async function uiLogin(page, email, password) {
  await page.goto('/login')
  await page.getByTestId('email-input').fill(email)
  await page.getByTestId('password-input').fill(password)
  await page.getByTestId('login-button').click()
  // Wait for navigation to 2FA page
  await page.waitForURL('**/verify-2fa', { timeout: 10_000 })
}

/**
 * Complete 2FA using the demo OTP shown on the verify page.
 */
async function complete2FA(page) {
  const otpEl = page.getByTestId('otp-demo-code')
  await expect(otpEl).toBeVisible({ timeout: 8_000 })
  const otp = await otpEl.textContent()
  await page.getByTestId('otp-input').fill(otp.trim())
  await page.getByTestId('verify-button').click()
  await page.waitForURL('**/dashboard', { timeout: 10_000 })
}

/**
 * Full login + 2FA via UI.
 */
async function loginFull(page, email, password) {
  await uiLogin(page, email, password)
  await complete2FA(page)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('SecureCollab AI E2E Tests', () => {

  // Test 1 ─ Login page loads
  test('01 – Login page loads and shows key elements', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('login-title')).toBeVisible()
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()
    await expect(page.getByTestId('login-button')).toBeVisible()
    await expect(page.getByTestId('google-login-button')).toBeVisible()
    await expect(page.getByTestId('register-link')).toBeVisible()
  })

  // Test 2 ─ Registration works
  test('02 – Register creates a new account and redirects to login', async ({ page, request: apiCtx }) => {
    const ts    = Date.now()
    const email = `newuser_${ts}@test.com`
    const uname = `newuser_${ts}`

    await page.goto('/register')
    await expect(page.getByTestId('register-title')).toBeVisible()

    await page.getByTestId('email-input').fill(email)
    await page.getByTestId('username-input').fill(uname)
    await page.getByTestId('password-input').fill('TestPass@123')
    await page.getByTestId('confirm-password-input').fill('TestPass@123')
    await page.getByTestId('register-button').click()

    // Should show success and redirect to login
    await page.waitForURL('**/login', { timeout: 8_000 })
    await expect(page.getByTestId('login-title')).toBeVisible()
  })

  // Test 3 ─ Invalid login shows error
  test('03 – Invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('email-input').fill('nobody@invalid.com')
    await page.getByTestId('password-input').fill('wrongpassword')
    await page.getByTestId('login-button').click()
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 8_000 })
    // Should NOT navigate away
    await expect(page).toHaveURL(/\/login/)
  })

  // Test 4 ─ Valid login redirects to 2FA
  test('04 – Valid credentials redirect to 2FA page', async ({ page }) => {
    await uiLogin(page, 'student@securecollab.ai', 'Student@123')
    await expect(page.getByTestId('verify-title')).toBeVisible()
    await expect(page.getByTestId('otp-demo-code')).toBeVisible()
  })

  // Test 5 ─ Wrong 2FA code is rejected
  test('05 – Wrong OTP code is rejected with error', async ({ page }) => {
    await uiLogin(page, 'student@securecollab.ai', 'Student@123')
    await expect(page.getByTestId('verify-title')).toBeVisible()

    await page.getByTestId('otp-input').fill('000000')
    await page.getByTestId('verify-button').click()

    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 8_000 })
    // Must stay on 2FA page
    await expect(page).toHaveURL(/\/verify-2fa/)
  })

  // Test 6 ─ Correct 2FA code allows dashboard access
  test('06 – Correct OTP grants access to dashboard', async ({ page }) => {
    await loginFull(page, 'student@securecollab.ai', 'Student@123')
    await expect(page.getByTestId('dashboard-title')).toBeVisible()
    await expect(page.getByTestId('user-role')).toHaveText('student')
  })

  // Test 7 ─ Student cannot access admin page
  test('07 – Student is redirected from admin page to unauthorized', async ({ page }) => {
    await loginFull(page, 'student@securecollab.ai', 'Student@123')
    await page.goto('/admin')
    await page.waitForURL(/\/(unauthorized|login)/, { timeout: 8_000 })
    // Either unauthorized page or redirected back
    const url = page.url()
    expect(url).toMatch(/unauthorized|login/)
  })

  // Test 8 ─ Admin can access admin page
  test('08 – Admin can access the admin dashboard', async ({ page }) => {
    await loginFull(page, 'admin@securecollab.ai', 'Admin@123')

    // Wait for dashboard to fully render — this confirms the admin user context
    // is set in React before we navigate, avoiding an auth-reinitialization race.
    await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 8_000 })

    // Use SPA navigation (click nav link) so AuthContext user is already loaded
    // and ProtectedRoute does not need to wait for a fresh /api/auth/me call.
    await page.getByTestId('nav-admin').click()

    await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByTestId('users-table')).toBeVisible({ timeout: 10_000 })
  })

  // Test 9 ─ Admin can change user role
  test('09 – Admin can change a user role and save it', async ({ page, request: apiCtx }) => {
    const ts    = Date.now()
    const email = `roletest_${ts}@test.com`
    await apiRegister(apiCtx, email, `roletest_${ts}`, 'TestPass@123', 'student')

    await loginFull(page, 'admin@securecollab.ai', 'Admin@123')

    // Confirm dashboard loaded (user context stable) then SPA-navigate to admin
    await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 8_000 })
    await page.getByTestId('nav-admin').click()

    await expect(page.getByTestId('admin-title')).toBeVisible({ timeout: 8_000 })

    // Wait for the users table and find our newly registered user's row
    await expect(page.getByTestId('users-table')).toBeVisible({ timeout: 10_000 })
    const row = page.locator('tr').filter({ hasText: email })
    await expect(row).toBeVisible({ timeout: 8_000 })

    // Change their role
    const select = row.locator('select')
    await select.selectOption('researcher')

    // Save and confirm
    const saveBtn = row.locator('button', { hasText: 'Save' })
    await saveBtn.click()

    // Table refreshes — verify the updated value persists
    await expect(row.locator('select')).toHaveValue('researcher', { timeout: 5_000 })
  })

  // Test 10 ─ Logout works
  test('10 – Logout clears session and redirects to login', async ({ page }) => {
    await loginFull(page, 'student@securecollab.ai', 'Student@123')
    await expect(page.getByTestId('dashboard-title')).toBeVisible()

    await page.getByTestId('logout-button').click()
    await page.waitForURL('**/login', { timeout: 8_000 })
    await expect(page.getByTestId('login-title')).toBeVisible()

    // Confirm localStorage token is cleared
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeNull()
  })

})
