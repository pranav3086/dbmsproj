import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run the real stack — MySQL, the API server and the website — against an
// isolated copy of the database (a10e_hospital / a10e_api), rebuilt before every run, so your
// own demo data is untouched. Needs the MySQL server: npm run db:server
// Uses the installed Google Chrome by default; set E2E_CHANNEL="" to use Playwright's Chromium.
const channel = process.env.E2E_CHANNEL ?? 'chrome'
const E2E_DB = { prefix: 'a10e', appUser: 'a10e_app', appPassword: 'a10e-Test#2026', apiPort: 3011 }

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', ...(channel ? { channel } : {}) },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'node scripts/e2e-api.mjs',
      url: `http://127.0.0.1:${E2E_DB.apiPort}/api/auth/session`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DB_PREFIX: E2E_DB.prefix, DB_APP_USER: E2E_DB.appUser, DB_APP_PASSWORD: E2E_DB.appPassword,
        API_PORT: String(E2E_DB.apiPort), ALLOWED_ORIGINS: 'http://localhost:5174',
      },
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PORT: String(E2E_DB.apiPort) },
    },
  ],
})
