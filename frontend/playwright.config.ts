import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. CI starts the FastAPI backend (sqlite) on :8000 and builds the
 * frontend with VITE_BACKEND_URL=http://localhost:8000; Playwright then serves
 * the static build and drives a real browser through the stack.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 3000 --strictPort',
        url: 'http://localhost:3000',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: { VITE_BACKEND_URL: 'http://localhost:8000' },
      },
});
