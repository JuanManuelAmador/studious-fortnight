import { EnvironmentName } from '../enums/environment-name.enum';

export interface EnvironmentConfig {
  name: EnvironmentName;
  baseUrl: string;
  apiToken: string;
  requestTimeoutMs: number;
}
