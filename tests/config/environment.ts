import * as path from 'path';
import * as dotenv from 'dotenv';
import { EnvironmentName } from '../enums/environment-name.enum';
import { EnvironmentConfig } from '../interfaces/environment.interface';

/**
 * Singleton that resolves the active environment (TEST_ENV=dev|prod),
 * loads tests/config/.env.<env> and exposes a validated config.
 * Real environment variables (e.g. CI secrets) always win over the file values.
 */
export class EnvironmentConfigLoader {
  private static instance: EnvironmentConfigLoader | null = null;
  public readonly config: EnvironmentConfig;

  private constructor() {
    const envName: EnvironmentName = EnvironmentConfigLoader.resolveEnvName();
    // An unset GitHub secret arrives as an empty string; treat it as "not provided"
    // so the value from the .env file is used (dotenv never overrides existing vars).
    for (const key of ['BASE_URL', 'API_TOKEN', 'REQUEST_TIMEOUT_MS']) {
      if ((process.env[key] ?? '').trim() === '') {
        delete process.env[key];
      }
    }
    dotenv.config({ path: path.resolve(__dirname, `.env.${envName}`), quiet: true });

    this.config = {
      name: envName,
      baseUrl: EnvironmentConfigLoader.required('BASE_URL').replace(/\/+$/, ''),
      apiToken: EnvironmentConfigLoader.required('API_TOKEN'),
      requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 10000),
    };
  }

  public static getInstance(): EnvironmentConfigLoader {
    if (EnvironmentConfigLoader.instance === null) {
      EnvironmentConfigLoader.instance = new EnvironmentConfigLoader();
    }
    return EnvironmentConfigLoader.instance;
  }

  private static resolveEnvName(): EnvironmentName {
    const raw: string = (process.env.TEST_ENV ?? EnvironmentName.DEV).toLowerCase();
    const allowed: string[] = Object.values(EnvironmentName);
    if (!allowed.includes(raw)) {
      throw new Error(`Invalid TEST_ENV "${raw}". Allowed values: ${allowed.join(', ')}.`);
    }
    return raw as EnvironmentName;
  }

  private static required(key: string): string {
    const value: string | undefined = process.env[key];
    if (value === undefined || value.trim() === '') {
      throw new Error(`Missing required environment variable "${key}".`);
    }
    return value.trim();
  }
}
