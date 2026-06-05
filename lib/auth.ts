import { type BaseResponse } from "@/lib/backend-api";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  userName: string;
  email: string;
  userRole: string;
  userRoles: string[];
  primaryRole?: string | null;
  restaurantId?: number | null;
  permissions: string[];
  hasPassword: boolean;
};

function getSuperadminEmailAllowlist(): string[] {
  const raw = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAILS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperadminSession(session: Pick<AuthSession, "email" | "primaryRole" | "userRoles">): boolean {
  const primary = (session.primaryRole || "").toLowerCase();
  const roles = (session.userRoles || []).map((r) => String(r || "").toLowerCase());
  if (primary === "superadmin" || roles.includes("superadmin")) {
    return true;
  }

  // Optional fallback for legacy environments. Disabled by default.
  const allowFallback =
    String(process.env.NEXT_PUBLIC_ALLOW_SUPERADMIN_EMAIL_FALLBACK || "").toLowerCase() === "true";
  if (!allowFallback) return false;

  // Backwards-compatible fallback when backend does not expose superadmin identity yet.
  const allow = getSuperadminEmailAllowlist();
  if (allow.length === 0) return false;
  return allow.includes((session.email || "").trim().toLowerCase());
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  user_id: number;
  user_name: string;
  email: string;
  user_role: string;
  user_roles: string[];
  primary_role?: string | null;
  restaurant_id?: number | null;
  permissions: string[];
  has_password: boolean;
};

const AUTH_STORAGE_KEY = "yummy_auth_session";
const AUTH_PROXY_BASE_URL = "/api/backend";
const DIRECT_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://api.yummyever.com";

function proxyBackendUrl() {
  return AUTH_PROXY_BASE_URL.replace(/\/$/, "");
}

function directBackendUrl() {
  const raw = DIRECT_BACKEND_URL.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, "");
}

async function postLogin(
  baseUrl: string,
  route: string,
  username: string,
  secret: string,
) {
  return fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username,
      password: secret,
      grant_type: "password",
    }),
  });
}

async function loginRequestWithFallback(
  username: string,
  password: string,
) {
  const candidates = [
    { base: proxyBackendUrl(), route: "/auth/superadmin/login" },
    { base: proxyBackendUrl(), route: "/auth/login" },
    { base: directBackendUrl(), route: "/auth/superadmin/login" },
    { base: directBackendUrl(), route: "/auth/login" },
  ];

  let lastResponse: Response | null = null;
  let lastNetworkError: unknown = null;

  for (const c of candidates) {
    try {
      const response = await postLogin(c.base, c.route, username, password);
      lastResponse = response;
      if (response.ok) return response;
      // Move to fallback on upstream/proxy failures and missing routes.
      if ([404, 502, 503, 504].includes(response.status)) continue;
      return response;
    } catch (err) {
      lastNetworkError = err;
      continue;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastNetworkError || new Error("Login request failed");
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStoredAuthSession()?.accessToken || null;
}

export function saveAuthSession(response: LoginResponse): AuthSession {
  const session: AuthSession = {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    tokenType: response.token_type,
    userId: response.user_id,
    userName: response.user_name,
    email: response.email,
    userRole: response.user_role,
    userRoles: response.user_roles || [],
    primaryRole: response.primary_role || null,
    restaurantId: response.restaurant_id ?? null,
    permissions: response.permissions || [],
    hasPassword: response.has_password,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.setItem("accessToken", session.accessToken);
    window.localStorage.setItem("refreshToken", session.refreshToken);
    // Let same-tab subscribers (useSyncExternalStore) react to auth changes.
    window.dispatchEvent(new Event("yummy-auth"));
  }

  return session;
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.dispatchEvent(new Event("yummy-auth"));
}

export async function loginWithPassword(email: string, password: string) {
  // Preserve original input first; on auth failure we retry once with trimmed values
  // to handle accidental leading/trailing whitespace from paste/autofill.
  const rawUsername = email;
  const trimmedUsername = email.trim();
  const rawPassword = password;
  const trimmedPassword = password.trim();

  let response = await loginRequestWithFallback(rawUsername, rawPassword);
  if (
    !response.ok &&
    response.status === 401 &&
    (rawUsername !== trimmedUsername || rawPassword !== trimmedPassword)
  ) {
    response = await loginRequestWithFallback(trimmedUsername, trimmedPassword);
  }

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const parsed = JSON.parse(errorText) as {
        detail?: string;
        message?: string;
      };
      const message = parsed?.detail || parsed?.message;
      throw new Error(message || "Login failed");
    } catch {
      throw new Error(errorText || "Login failed");
    }
  }

  return response.json() as Promise<BaseResponse<LoginResponse>>;
}

export async function refreshAuthToken(refreshToken: string) {
  const response = await fetch(`${proxyBackendUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Token refresh failed");
  }

  return response.json() as Promise<BaseResponse<LoginResponse>>;
}

export async function logoutSession() {
  const session = getStoredAuthSession();
  if (!session) {
    clearAuthSession();
    return;
  }

  try {
    await fetch(`${proxyBackendUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } finally {
    clearAuthSession();
  }
}
