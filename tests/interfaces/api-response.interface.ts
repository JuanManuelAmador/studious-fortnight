export interface ApiResponse<T> {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  /** Parsed JSON body, or null when the response has no body (e.g. 204). */
  body: T;
  durationMs: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}
