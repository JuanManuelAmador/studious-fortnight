import { defineConfig } from '@playwright/test';
import { EnvironmentConfigLoader } from './tests/config/environment';
import { EnvironmentConfig } from './tests/interfaces/environment.interface';

const env: EnvironmentConfig = EnvironmentConfigLoader.getInstance().config;

export default defineConfig({
  testDir: './tests/api',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        detail: true,
        environmentInfo: {
          TEST_ENV: env.name,
          BASE_URL: env.baseUrl,
          NODE_VERSION: process.version,
        },
      },
    ],
  ],
  projects: [{ name: `api-${env.name}` }],
});
