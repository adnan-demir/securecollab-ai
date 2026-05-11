import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for SecureCollab AI E2E tests.
 *
 * The frontend dev server is started automatically by Playwright.
 * The FastAPI backend must be running separately on port 8000:
 *   cd backend && uvicorn main:app --port 8000
 *
 * In CI (GitHub Actions), both servers are started in the workflow before Playwright runs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,        // Tests share DB state – run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace:   'on-first-retry',
    screenshot: 'only-on-failure',
    // Generous timeout for CI environments
    actionTimeout:     15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start Vite dev server automatically
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
