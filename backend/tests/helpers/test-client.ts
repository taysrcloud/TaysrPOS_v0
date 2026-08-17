export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export class TestApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.POS_API_URL || 'http://127.0.0.1:4401/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async get<T = any>(path: string, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', headers }, token);
  }

  async post<T = any>(path: string, body?: any, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers }, token);
  }

  async put<T = any>(path: string, body?: any, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, headers }, token);
  }

  async patch<T = any>(path: string, body?: any, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, headers }, token);
  }

  async delete<T = any>(path: string, token?: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE', headers }, token);
  }

  private async request<T>(path: string, init: RequestInit, token?: string): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, { ...init, headers: reqHeaders });
    let body: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json().catch(() => ({}));
    } else {
      body = await response.text().catch(() => '');
    }

    return {
      status: response.status,
      body,
      headers: response.headers,
    };
  }
}

export function createApiClient(baseUrl?: string): TestApiClient {
  return new TestApiClient(baseUrl);
}

export const api = new TestApiClient();
