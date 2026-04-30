export type BaseResponse<T> = {
  status: string;
  message: string;
  data: T;
};

export type DashboardTrendComparison = {
  value: number;
  delta_percent: number;
  direction: "UP" | "DOWN" | "SAME";
};

export type AdminDashboardV2Response = {
  meta: {
    date: string;
    currency: string;
    outlet_name: string;
    last_updated: string;
    from_time: string;
    to_time: string;
    access_level: "full" | "limited";
    access_note?: string | null;
  };
  health: {
    active_orders: number;
    kot_pending: number;
    kot_delayed: number;
    cancelled_today: number;
    refunded_today: number;
    alerts: Array<{
      type: string;
      severity: string;
      message: string;
    }>;
  };
  kpis: {
    gross_sales: number;
    net_sales: number;
    total_orders: number;
    average_order_value: number;
    total_discounts: number;
    total_tax_collected: number;
    cash_sales: number;
    non_cash_sales: number;
  };
  trends: {
    sales_vs_yesterday: DashboardTrendComparison;
    orders_vs_yesterday: DashboardTrendComparison;
  };
  breakdowns: {
    payment_split: Array<{ method: string; amount: number }>;
    order_status: Array<{ status: string; count: number }>;
    top_items: Array<{
      item_id: number;
      name: string;
      quantity: number;
      revenue: number;
    }>;
  };
  quick_insights: Array<{
    type: string;
    message: string;
  }>;
  receivables?: {
    credit_sales: number;
    total_outstanding: number;
    credit_orders_count: number;
  } | null;
};

export type BackendRestaurant = {
  id: number;
  name: string;
  address: string;
  phone: string;
  description?: string | null;
  profile_picture?: string | null;
  cover_photo?: string | null;
  pan_number?: string | null;
  registered_by: number;
  kot_enabled: boolean;
  tax_enabled: boolean;
  timezone: string;
  payment_qrs: Array<{ name: string; payload: string }>;
  kot_station_config?: Record<string, unknown> | null;
  local_pos_ip?: string | null;
  fonepay_enabled?: boolean;
  fonepay_pid?: string | null;
  fonepay_username?: string | null;
  hotel_enabled: boolean;
  restaurant_enabled: boolean;
  billing_mode: string;
  effective_plan: string;
  plan_state: string;
  trial_ends_at?: string | null;
  paid_ends_at?: string | null;
  entitlements?: Record<string, unknown> | null;
};

export type BackendUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  primary_role?: string | null;
  created_by?: number | null;
  restaurant_id?: number | null;
  permissions?: string[];
  has_password?: boolean;
  custom_role_id?: number | null;
};

export type PermissionRead = {
  key: string;
  module: string;
  description?: string | null;
  title?: string | null;
  allowed_actions?: string[];
  restricted_actions?: string[];
  blocked_when_missing?: string[];
  frontend_features?: string[];
  backend_scopes?: string[];
  risk_level?: string | null;
  status?: string | null;
  reserved_reason?: string | null;
};

export type RoleRead = {
  id: number;
  name: string;
  description?: string | null;
  is_system_role: boolean;
  permissions: string[];
};

export type UserCreatePayload = {
  name: string;
  email: string;
  password?: string;
  role: string;
  roles?: string[];
  primary_role?: string | null;
  restaurant_id?: number | null;
  permissions?: string[];
  custom_role_id?: number | null;
};

export type UserUpdatePayload = {
  name?: string;
  email?: string;
  role?: string;
  roles?: string[];
  primary_role?: string | null;
  restaurant_id?: number | null;
  permissions?: string[];
  custom_role_id?: number | null;
};

export type RoleCreatePayload = {
  name: string;
  description?: string | null;
  permissions: string[];
};

export type RoleUpdatePayload = {
  name?: string;
  description?: string | null;
  permissions?: string[] | null;
};

export type RestaurantAdminItem = {
  id: number;
  name: string;
  email: string;
  is_owner: boolean;
  added_at: string;
  added_by?: number | null;
};

export type AdminInvitePayload = {
  name: string;
  email: string;
  password: string;
};

export type PlatformDashboardResponse = {
  generated_at: string;
  currency: string;
  kpis: Array<{
    label: string;
    value: number;
    formatted_value: string;
    delta?: string | null;
    trend?: string | null;
  }>;
  billing_mode_breakdown: Array<{
    label: string;
    value: number;
    formatted_value: string;
    color?: string | null;
  }>;
  module_breakdown: Array<{
    label: string;
    value: number;
    formatted_value: string;
    color?: string | null;
  }>;
  monthly_growth: Array<{
    label: string;
    value: number;
    formatted_value: string;
    color?: string | null;
  }>;
  recent_restaurants: Array<{
    id: number;
    name: string;
    billing_mode: string;
    plan_state: string;
    hotel_enabled: boolean;
    restaurant_enabled: boolean;
    created_at?: string | null;
  }>;
  insights: string[];
};

type BackendClientOptions = {
  baseUrl?: string;
  token?: string;
};

const LOCAL_PROXY_BASE_URL = "/api/backend";
export const DEFAULT_BACKEND_URL =
  "https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io";

function getBaseUrl(baseUrl?: string) {
  const directBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  const resolvedBaseUrl = baseUrl || LOCAL_PROXY_BASE_URL || directBackendUrl;
  return resolvedBaseUrl.replace(/\/$/, "");
}

async function backendRequest<T>(
  path: string,
  options: BackendClientOptions & {
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const url = `${getBaseUrl(options.baseUrl)}${path}`;
  const hasBody = options.body !== undefined;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    cache: "no-store",
    ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    // Backend often returns JSON like:
    // {"status":"error","message":"Internal server error","errors":[]}
    // or FastAPI-style {"detail":"..."}.
    let message = errorText;
    try {
      const parsed: unknown = JSON.parse(errorText);
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const parsedMessage = record.message;
        const parsedDetail = record.detail;
        message =
          (typeof parsedMessage === "string" && parsedMessage) ||
          (typeof parsedDetail === "string" && parsedDetail) ||
          message;
      }
    } catch {
      // not JSON
    }

    const safeMessage =
      (message || "").trim() || `Request failed with status ${response.status}`;
    throw new Error(`[${response.status}] ${path}: ${safeMessage}`);
  }

  return response.json() as Promise<T>;
}

export async function backendFetch<T>(path: string, options: BackendClientOptions = {}): Promise<T> {
  return backendRequest<T>(path, options);
}

export type RedisHealthRead = {
  status: string;
  redis?: string;
  detail?: string;
};

export async function getRedisHealth(options: BackendClientOptions = {}): Promise<RedisHealthRead> {
  return backendFetch<RedisHealthRead>("/health/redis", options);
}

export async function getAdminDashboardV2(
  restaurantId?: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<AdminDashboardV2Response>> {
  const searchParams = new URLSearchParams();
  if (typeof restaurantId === "number") {
    searchParams.set("restaurant_id", String(restaurantId));
  }

  const query = searchParams.toString();
  const path = query ? `/admin/dashboard/v2?${query}` : "/admin/dashboard/v2";

  return backendFetch<BaseResponse<AdminDashboardV2Response>>(path, options);
}

export async function getRestaurants(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendRestaurant[]>> {
  return backendFetch<BaseResponse<BackendRestaurant[]>>("/restaurants", options);
}

export async function getRestaurant(
  restaurantId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendRestaurant>> {
  return backendFetch<BaseResponse<BackendRestaurant>>(`/restaurants/${restaurantId}`, options);
}

export type RestaurantUpdatePayload = Partial<Pick<
  BackendRestaurant,
  | "name"
  | "address"
  | "phone"
  | "description"
  | "profile_picture"
  | "cover_photo"
  | "pan_number"
  | "billing_mode"
  | "kot_enabled"
  | "tax_enabled"
  | "timezone"
  | "hotel_enabled"
  | "restaurant_enabled"
  | "kot_station_config"
  | "local_pos_ip"
  | "trial_ends_at"
  | "paid_ends_at"
>> & {
  payment_qrs?: Array<{ name: string; payload: string }>;
};

export async function updateRestaurant(
  restaurantId: number,
  payload: RestaurantUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendRestaurant>> {
  return backendRequest<BaseResponse<BackendRestaurant>>(`/restaurants/${restaurantId}`, {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export async function getPlatformDashboard(
  options: BackendClientOptions = {},
): Promise<BaseResponse<PlatformDashboardResponse>> {
  return backendFetch<BaseResponse<PlatformDashboardResponse>>("/admin/platform/dashboard", options);
}

export async function getUsers(
  search: string | undefined,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendUser[]>> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return backendFetch<BaseResponse<BackendUser[]>>(`/users/all${query}`, options);
}

export async function createUser(
  payload: UserCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendUser>> {
  return backendRequest<BaseResponse<BackendUser>>("/users", {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function updateUser(
  userId: number,
  payload: UserUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendUser>> {
  return backendRequest<BaseResponse<BackendUser>>(`/users/${userId}`, {
    ...options,
    method: "PATCH",
    body: payload,
  });
}

export async function deleteUser(
  userId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(`/users/${userId}`, {
    ...options,
    method: "DELETE",
  });
}

export async function updateUserPermissions(
  userId: number,
  permissionKeys: string[],
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(`/users/${userId}/permissions/`, {
    ...options,
    method: "POST",
    body: { permission_keys: permissionKeys },
  });
}

export async function getPermissionsCatalog(
  options: BackendClientOptions = {},
): Promise<BaseResponse<PermissionRead[]>> {
  return backendFetch<BaseResponse<PermissionRead[]>>("/roles/permissions", options);
}

export async function getBuiltInRoles(
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, string[]>>> {
  return backendFetch<BaseResponse<Record<string, string[]>>>("/roles/built-in", options);
}

export async function getRoles(
  options: BackendClientOptions = {},
): Promise<BaseResponse<RoleRead[]>> {
  return backendFetch<BaseResponse<RoleRead[]>>("/roles", options);
}

export async function createRole(
  payload: RoleCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<RoleRead>> {
  return backendRequest<BaseResponse<RoleRead>>("/roles", {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function updateRole(
  roleId: number,
  payload: RoleUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<RoleRead>> {
  return backendRequest<BaseResponse<RoleRead>>(`/roles/${roleId}`, {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export async function deleteRole(
  roleId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(`/roles/${roleId}`, {
    ...options,
    method: "DELETE",
  });
}

export async function getRestaurantAdmins(
  restaurantId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<RestaurantAdminItem[]>> {
  return backendFetch<BaseResponse<RestaurantAdminItem[]>>(`/restaurant/${restaurantId}/admins`, options);
}

export async function addRestaurantAdmin(
  restaurantId: number,
  payload: AdminInvitePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(`/restaurant/${restaurantId}/admins`, {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function removeRestaurantAdmin(
  restaurantId: number,
  userId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(
    `/restaurant/${restaurantId}/admins/${userId}`,
    {
      ...options,
      method: "DELETE",
    },
  );
}
