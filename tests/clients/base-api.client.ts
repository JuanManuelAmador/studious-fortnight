import { APIRequestContext, APIResponse, test } from '@playwright/test';
import { allure } from 'allure-playwright';
import { Logger } from '../config/logger';
import { ApiResponse } from '../interfaces/api-response.interface';
import { EnvironmentConfig } from '../interfaces/environment.interface';
import { HttpMethod } from '../enums/http-method.enum';
import { RequestOptions } from '../interfaces/request-options.interface';
import { AUTH_HEADER } from '../config/constants';

export abstract class BaseApiClient {
  protected constructor(
    protected readonly request: APIRequestContext,
    protected readonly config: EnvironmentConfig,
    protected readonly authToken: string,
  ) { }

  protected get<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>(HttpMethod.GET, path, options);
  }

  protected post<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>(HttpMethod.POST, path, options);
  }

  protected put<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>(HttpMethod.PUT, path, options);
  }

  protected httpDelete<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.send<T>(HttpMethod.DELETE, path, options);
  }

  /**
   * Full URL is built manually: Playwright's baseURL drops the /dev|/prod prefix
   * whenever the path starts with "/".
   */
  protected buildUrl(path: string): string {
    return `${this.config.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  protected buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (options.authenticated === true) {
      headers[AUTH_HEADER] = options.tokenOverride ?? this.authToken;
    }
    return headers;
  }

  private async send<T>(method: HttpMethod, path: string, options: RequestOptions): Promise<ApiResponse<T>> {
    const url: string = this.buildUrl(path);
    const label: string = `${method} ${url}`;
    const stepNumber: number = Logger.start(label);

    return test.step(label, async (): Promise<ApiResponse<T>> => {
      const started: number = Date.now();
      const headers: Record<string, string> = this.buildHeaders(options);
      try {
        const response: APIResponse = await this.request.fetch(url, {
          method,
          data: options.data,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          failOnStatusCode: false,
          timeout: this.config.requestTimeoutMs,
        });
        const result: ApiResponse<T> = await this.toApiResponse<T>(response, started);
        await this.attachExchange(method, url, options, headers, result);
        Logger.success(stepNumber, `${result.status} ${response.statusText()} in ${result.durationMs}ms`);
        return result;
      } catch (error: unknown) {
        const message: string = error instanceof Error ? error.message : String(error);
        Logger.failure(stepNumber, `${label} threw: ${message}`);
        throw error;
      }
    });
  }

  private async toApiResponse<T>(response: APIResponse, started: number): Promise<ApiResponse<T>> {
    const text: string = await response.text();
    let body: unknown = null;
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return {
      status: response.status(),
      ok: response.ok(),
      headers: response.headers(),
      body: body as T,
      durationMs: Date.now() - started,
    };
  }

  private async attachExchange<T>(
    method: HttpMethod,
    url: string,
    options: RequestOptions,
    headers: Record<string, string>,
    result: ApiResponse<T>,
  ): Promise<void> {
    const maskedHeaders: Record<string, string> = { ...headers };
    if (AUTH_HEADER in maskedHeaders) {
      maskedHeaders[AUTH_HEADER] = '***';
    }
    await allure.attachment(
      'request',
      JSON.stringify({ method, url, headers: maskedHeaders, body: options.data ?? null }, null, 2),
      'application/json',
    );
    await allure.attachment(
      'response',
      JSON.stringify({ status: result.status, durationMs: result.durationMs, body: result.body }, null, 2),
      'application/json',
    );
  }
}
