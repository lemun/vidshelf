import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test against the full docker compose stack:
 *   docker compose up --build -d && npm run test:browser
 * BASE_URL can point at another deployment (e.g. the Vite dev server on :5173).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
