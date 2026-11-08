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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

const API_REQUEST_TIMEOUT_MS = 15_000;

export type BackendPlace = {
  id: string;
  name: string;
  kindLabel: string;
  rating?: number | null;
  ratingCount?: number | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  distance_km?: number | null;
};

export type BackendRating = {
  restaurant_id: string;
  rating: number;
  rated_at: string;
};

export type BackendRecommendation = BackendPlace & {
  final_score: number;
};

export type BackendRecommendationsResponse = {
  user_id: string;
  method: 'knn_personalized' | 'quality_fallback';
  count: number;
  recommendations: BackendRecommendation[];
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

export class BackendTimeoutError extends BackendError {
  constructor() {
    super('The request timed out. Check your connection and try again.');
    this.name = 'BackendTimeoutError';
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

  const url = `${baseUrl()}${path}`;
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cancelFromCaller = () => controller.abort();
  if (options.signal?.aborted) {
    cancelFromCaller();
  } else {
    options.signal?.addEventListener('abort', cancelFromCaller, { once: true });
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, API_REQUEST_TIMEOUT_MS);
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (caught) {
      if (timedOut || options.signal?.aborted) {
        throw caught;
      }
      payload = undefined;
    }

    if (timedOut) {
      throw new BackendTimeoutError();
    }

    if (!response.ok) {
      const detail =
        typeof payload === 'object' && payload !== null && 'detail' in payload
          ? payload.detail
          : undefined;
      throw new BackendError(errorMessage(response.status, detail), response.status);
    }

    return payload as T;
  } catch (caught) {
    if (timedOut) {
      throw new BackendTimeoutError();
    }
    if (options.signal?.aborted || caught instanceof BackendError) {
      throw caught;
    }
    throw new BackendError('Could not reach the Flavorly server. Check your connection and server URL.');
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    options.signal?.removeEventListener('abort', cancelFromCaller);
  }
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

export function getNearbyBackendPlaces(
  latitude: number,
  longitude: number,
  radiusKm: number,
  limit = 50,
): Promise<{ count: number; places: BackendPlace[] }> {
  const query = [
    `lat=${encodeURIComponent(String(latitude))}`,
    `lon=${encodeURIComponent(String(longitude))}`,
    `radius_km=${encodeURIComponent(String(radiusKm))}`,
    `limit=${encodeURIComponent(String(limit))}`,
  ].join('&');
  return request(`/places/nearby?${query}`);
}

export function getBackendPlaceDetails(placeId: string): Promise<BackendPlace> {
  return request(`/places/details?place_id=${encodeURIComponent(placeId)}`);
}

export function getMyRatings(token: string): Promise<{ user_id: string; ratings: BackendRating[] }> {
  return request('/users/me/ratings', { token });
}

export function saveRestaurantRating(
  token: string,
  restaurantId: string,
  rating: number,
): Promise<{ message: string; restaurant_id: string; rating: number }> {
  return request('/ratings', {
    method: 'POST',
    body: { restaurant_id: restaurantId, rating },
    token,
  });
}

export function deleteRestaurantRating(
  token: string,
  restaurantId: string,
): Promise<{ message: string; restaurant_id: string }> {
  return request(`/ratings?restaurant_id=${encodeURIComponent(restaurantId)}`, {
    method: 'DELETE',
    token,
  });
}

export function getRecommendations(
  token: string,
  coordinates?: { latitude: number; longitude: number },
  radiusKm = 5,
): Promise<BackendRecommendationsResponse> {
  const query = new URLSearchParams({ top_n: '5' });
  const coordinatesValid =
    coordinates != null &&
    Number.isFinite(coordinates.latitude) &&
    Number.isFinite(coordinates.longitude) &&
    Math.abs(coordinates.latitude) <= 90 &&
    Math.abs(coordinates.longitude) <= 180;
  const radiusValid = Number.isFinite(radiusKm) && radiusKm > 0 && radiusKm <= 100;

  if (coordinatesValid && radiusValid) {
    query.set('lat', String(coordinates.latitude));
    query.set('lon', String(coordinates.longitude));
    query.set('radius_km', String(radiusKm));
  }

  return request(`/recommendations/me?${query.toString()}`, { token });
}

export function toAuthUser(user: ApiUser) {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    createdAt: user.created_at,
  };
}
