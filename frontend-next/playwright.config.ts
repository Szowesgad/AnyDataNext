import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/playwright',
  timeout: 30000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});