/**
 * Thin HTTP client for the Evolution API v2.
 *
 * Responsibilities:
 *  - Inject the `apikey` header on every request.
 *  - Build URLs from the configured base URL + query params.
 *  - Parse JSON responses and surface API errors as a typed error.
 *  - Resolve the target instance (explicit arg or configured default).
 *
 * The API key is never included in error messages or logs.
 */

import type { EvolutionConfig } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface RequestOptions {
  /** JSON body (object) for POST/PUT/DELETE. */
  body?: unknown;
  /** Query string params. Undefined/null values are skipped. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/** Error thrown when the Evolution API responds with a non-2xx status. */
export class EvolutionApiError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(status: number, message: string, responseBody: unknown) {
    super(message);
    this.name = "EvolutionApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export class EvolutionClient {
  constructor(private readonly config: EvolutionConfig) {}

  /**
   * Resolve the instance name to operate on: explicit value wins, otherwise the
   * configured default. Throws a clear error if neither is available.
   */
  resolveInstance(explicit?: string): string {
    const inst = explicit?.trim() || this.config.defaultInstance;
    if (!inst) {
      throw new Error(
        "No instance provided and EVOLUTION_DEFAULT_INSTANCE is not set. " +
          "Pass `instance` in the tool call or configure a default.",
      );
    }
    return inst;
  }

  get<T = unknown>(path: string, opts: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, opts);
  }

  post<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, opts);
  }

  put<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", path, opts);
  }

  delete<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, opts);
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);

    const headers: Record<string, string> = {
      apikey: this.config.apiKey,
      Accept: "application/json",
    };

    let bodyInit: string | undefined;
    if (opts.body !== undefined && method !== "GET") {
      headers["Content-Type"] = "application/json";
      bodyInit = JSON.stringify(opts.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: bodyInit,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after ${this.config.timeoutMs}ms: ${method} ${path}`);
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Network error calling Evolution API (${method} ${path}): ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : null;

    if (!res.ok) {
      throw new EvolutionApiError(res.status, extractApiMessage(parsed, res.status), parsed);
    }

    return parsed as T;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const base = this.config.baseUrl.endsWith("/") ? this.config.baseUrl : `${this.config.baseUrl}/`;
    const relativePath = path.replace(/^\/+/, "");
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
    // Some endpoints may return plain text; preserve it.
    return text;
  }
}

/** Pull a human-readable message out of Evolution's error response shapes. */
function extractApiMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const candidate = obj.message ?? obj.error ?? (obj.response as Record<string, unknown>)?.message;
    if (Array.isArray(candidate)) return candidate.map((c) => String(c)).join("; ");
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") return JSON.stringify(candidate);
  }
  if (typeof body === "string" && body.trim()) return body;
  return `Evolution API returned HTTP ${status}`;
}
