type ApiUser = {
  id: string;
  username: string;
  email: string;
  created_at: string;
};

type RegisterResponse = {
  message: string;
  user: ApiUser;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
};

type ProfileResponse = {
  message: string;
  user: ApiUser;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
};

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

function baseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!configured) {
    throw new BackendError('Set EXPO_PUBLIC_API_BASE_URL to connect to the Flavorly server.');
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new BackendError('EXPO_PUBLIC_API_BASE_URL must be a valid absolute URL.');
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && __DEV__)) {
    throw new BackendError('The Flavorly server must use HTTPS outside trusted development.');
  }

  return configured.replace(/\/+$/, '');
}

function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string') {
          return item.msg;
        }
        return undefined;
      })
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(' ') : undefined;
  }
  return undefined;
}

function errorMessage(status: number, detail?: unknown): string {
  const message = detailMessage(detail);
  if (message) {
    return message;
  }
  if (status === 400) {
    return 'The request could not be completed. Check the information and try again.';
  }
  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }
  if (status === 409) {
    return 'That username or email is already in use.';
  }
  if (status === 422) {
    return 'Some information is invalid. Check the requirements and try again.';
  }
  if (status >= 500) {
    return 'The server could not complete your request. Try again later.';
  }
  return `The server returned an unexpected response (${status}).`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (caught) {
    if (caught instanceof BackendError) {
      throw caught;
    }
    throw new BackendError('Could not reach the Flavorly server. Check your connection and server URL.');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? payload.detail
        : undefined;
    throw new BackendError(errorMessage(response.status, detail), response.status);
  }

  return payload as T;
}

export function register(username: string, email: string, password: string): Promise<RegisterResponse> {
  return request('/auth/register', {
    method: 'POST',
    body: { username, email, password },
  });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function getCurrentUser(token: string): Promise<ApiUser> {
  return request('/users/me', { token });
}

export function updateCurrentUser(
  token: string,
  changes: { username?: string; email?: string },
): Promise<ProfileResponse> {
  return request('/users/me', { method: 'PATCH', body: changes, token });
}

export function updatePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return request('/users/me/password', {
    method: 'PATCH',
    body: { current_password: currentPassword, new_password: newPassword },
    token,
  });
}

export function toAuthUser(user: ApiUser) {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    createdAt: user.created_at,
  };
}
