/**
 * Thin fetch wrapper for The Barber's Hub REST API (see /server).
 * The session token lives in localStorage and is sent as a Bearer token.
 */

export const API_URL = (
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000"
).replace(/\/$/, "");

const TOKEN_KEY = "barbershub_token";
export const AUTH_CHANGED_EVENT = "barbershub:auth-changed";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode); session lasts for this page only */
  }
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // A rejected token means the session is over; drop it so the UI signs out.
    if (response.status === 401 && token) setToken(null);
    throw new ApiError(
      (data && typeof data.error === "string" && data.error) ||
        response.statusText ||
        "Request failed",
      response.status,
    );
  }
  return data as T;
}

const withQuery = (
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) => {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
};

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>("GET", withQuery(path, params)),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
  /** Uploads an image (admin only) and returns its public URL. */
  upload: async (file: File, folder: string) => {
    const form = new FormData();
    form.append("folder", folder); // must precede the file for the server to read it
    form.append("file", file);
    const { url } = await request<{ url: string }>("POST", "/admin/uploads", form);
    return url;
  },
};

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error && error.message ? error.message : fallback;
}
