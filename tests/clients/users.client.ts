import { APIRequestContext } from '@playwright/test';
import { BaseApiClient } from './base-api.client';
import { AUTH_HEADER, Endpoints } from '../config/constants';
import { ApiResponse } from '../interfaces/api-response.interface';
import { EnvironmentConfig } from '../interfaces/environment.interface';
import { AuthOptions, RequestOptions } from '../interfaces/request-options.interface';
import { CreateUserRequest, ErrorResponse, UpdateUserRequest, User } from '../interfaces/user.interface';

/**
 * User CRUD client. One instance per Playwright worker (singleton), so parallel
 * workers never share state. Exposes HTTP operations only - no assertions.
 */
export class UsersClient extends BaseApiClient {
  private static instance: UsersClient | null = null;

  private constructor(request: APIRequestContext, config: EnvironmentConfig, authToken: string) {
    super(request, config, authToken);
  }

  public static getInstance(request: APIRequestContext, config: EnvironmentConfig, authToken: string): UsersClient {
    if (UsersClient.instance === null) {
      UsersClient.instance = new UsersClient(request, config, authToken);
    }
    return UsersClient.instance;
  }

  public static resetInstance(): void {
    UsersClient.instance = null;
  }

  public async getAll(): Promise<ApiResponse<User[]>> {
    return this.get<User[]>(Endpoints.USERS);
  }

  public async getByEmail(email: string): Promise<ApiResponse<User | ErrorResponse>> {
    return this.get<User | ErrorResponse>(this.userPath(email));
  }

  public async create(payload: CreateUserRequest): Promise<ApiResponse<User | ErrorResponse>> {
    return this.post<User | ErrorResponse>(Endpoints.USERS, { data: payload });
  }

  /**
   * Sends an arbitrary body (invalid payloads, malformed JSON).
   * Strings are sent as a raw Buffer so Playwright does not JSON-encode them again.
   */
  public async createRaw(body: string | Record<string, unknown>): Promise<ApiResponse<User | ErrorResponse>> {
    return this.post<User | ErrorResponse>(Endpoints.USERS, {
      data: typeof body === 'string' ? Buffer.from(body, 'utf-8') : body,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  public async update(email: string, payload: UpdateUserRequest): Promise<ApiResponse<User | ErrorResponse>> {
    return this.put<User | ErrorResponse>(this.userPath(email), { data: payload });
  }

  public async updateRaw(email: string, body: Record<string, unknown>): Promise<ApiResponse<User | ErrorResponse>> {
    return this.put<User | ErrorResponse>(this.userPath(email), { data: body });
  }

  /**
   * Protected endpoint. By default the fixture-injected token is sent in the
   * "Authentication" header. Override via `auth` to test missing/invalid tokens.
   */
  public async delete(email: string, auth: AuthOptions = {}): Promise<ApiResponse<ErrorResponse | null>> {
    const options: RequestOptions = {};
    if (auth.token === undefined) {
      options.authenticated = true;
    } else if (auth.token !== null) {
      options.headers = { [auth.headerName ?? AUTH_HEADER]: auth.token };
    }
    return this.httpDelete<ErrorResponse | null>(this.userPath(email), options);
  }

  private userPath(email: string): string {
    return `${Endpoints.USERS}/${encodeURIComponent(email)}`;
  }
}
