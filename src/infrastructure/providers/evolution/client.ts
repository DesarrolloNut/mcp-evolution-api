import { HttpClient, HttpRequestOptions } from '../../http/httpClient.js';

export interface EvolutionClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class EvolutionClient {
  private readonly http: HttpClient;

  constructor(config: EvolutionClientConfig) {
    this.http = new HttpClient(
      config.baseUrl,
      {
        apikey: config.apiKey,
      },
      config.timeoutMs ?? 30000
    );
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.http.get('/instance/fetchInstances');
      return { success: true, message: 'Connected to Evolution API successfully' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to connect to Evolution API: ${msg}` };
    }
  }

  async post<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.http.post<T>(path, options);
  }

  async get<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.http.get<T>(path, options);
  }

  async delete<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.http.delete<T>(path, options);
  }

  async put<T = unknown>(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
    return this.http.put<T>(path, options);
  }
}
