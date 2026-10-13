export interface RequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
  tokenOverride?: string;
}

/**
 * Auth behaviour for protected calls:
 *  - undefined -> use the token injected by the fixture
 *  - null      -> send no auth header
 *  - string    -> send this token instead
 */
export interface AuthOptions {
  token?: string | null;
  headerName?: string;
}
