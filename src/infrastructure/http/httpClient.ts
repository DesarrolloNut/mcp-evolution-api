export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

export class HttpError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(status: number, message: string, responseBody: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {},
    private readonly defaultTimeoutMs: number = 30000
  ) {}

  async get<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST' });
  }

  async put<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT' });
  }

  async delete<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  async request<T = unknown>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const method = options.method || 'GET';
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const url = this.buildUrl(path, options.query);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    let bodyInit: string | undefined;
    if (options.body !== undefined && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      bodyInit = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: bodyInit,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms: ${method} ${path}`);
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error (${method} ${path}): ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      throw new HttpError(res.status, extractApiMessage(parsed, res.status), parsed);
    }

    return parsed as T;
  }

  private buildUrl(path: string, query?: HttpRequestOptions['query']): string {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    const relativePath = path.replace(/^\/+/, '');
    const url = new URL(relativePath, base);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractApiMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const candidate = obj.message ?? obj.error ?? (obj.response as Record<string, unknown>)?.message;
    if (Array.isArray(candidate)) return candidate.map((c) => String(c)).join('; ');
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') return JSON.stringify(candidate);
  }
  if (typeof body === 'string' && body.trim()) return body;
  return `HTTP request failed with status ${status}`;
}
