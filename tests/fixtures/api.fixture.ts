import { APIRequestContext, test as base } from '@playwright/test';
import { UsersClient } from '../clients/users.client';
import { EnvironmentConfigLoader } from '../config/environment';
import { Logger } from '../config/logger';
import { EnvironmentConfig } from '../interfaces/environment.interface';

export class UserTracker {
  private readonly tracked: Set<string> = new Set<string>();

  public track(email: string): string {
    this.tracked.add(email);
    return email;
  }

  public get emails(): string[] {
    return Array.from(this.tracked);
  }
}

interface WorkerFixtures {
  environment: EnvironmentConfig;
  /** Token injected into protected endpoints (from .env / GitHub secret). */
  authToken: string;
  apiContext: APIRequestContext;
  /** Per-worker singleton client. */
  usersClient: UsersClient;
}

interface TestFixtures {
  createdUsers: UserTracker;
  stepLogger: void;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  environment: [
    async ({ }, use: (value: EnvironmentConfig) => Promise<void>): Promise<void> => {
      await use(EnvironmentConfigLoader.getInstance().config);
    },
    { scope: 'worker' },
  ],

  authToken: [
    async ({ environment }, use: (value: string) => Promise<void>): Promise<void> => {
      await use(environment.apiToken);
    },
    { scope: 'worker' },
  ],

  apiContext: [
    async ({ playwright }, use: (value: APIRequestContext) => Promise<void>): Promise<void> => {
      const context: APIRequestContext = await playwright.request.newContext({
        extraHTTPHeaders: { Accept: 'application/json' },
      });
      await use(context);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  usersClient: [
    async ({ apiContext, environment, authToken }, use: (value: UsersClient) => Promise<void>): Promise<void> => {
      await use(UsersClient.getInstance(apiContext, environment, authToken));
      UsersClient.resetInstance();
    },
    { scope: 'worker' },
  ],

  /** Auto fixture: prints test boundaries so the last executed step is obvious in the logs. */
  stepLogger: [
    async ({ }, use: () => Promise<void>, testInfo): Promise<void> => {
      Logger.reset();
      console.log(`\n===== START: ${testInfo.title} =====`);
      await use();
      console.log(`===== END (${testInfo.status ?? 'unknown'}): ${testInfo.title} =====`);
    },
    { auto: true },
  ],

  createdUsers: async ({ usersClient }, use: (value: UserTracker) => Promise<void>): Promise<void> => {
    const tracker: UserTracker = new UserTracker();
    await use(tracker);
    Logger.info(`Cleanup: deleting ${tracker.emails.length} user(s) created by the test`);
    await Promise.all(tracker.emails.map((email: string) => usersClient.delete(email)));
  },
});

export { expect } from '@playwright/test';
