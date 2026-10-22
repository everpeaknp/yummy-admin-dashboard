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
  finance_reports_enabled: boolean;
  finance_accounting_enabled: boolean;
  billing_mode: string;
  effective_plan: string;
  plan_state: string;
  trial_ends_at?: string | null;
  paid_ends_at?: string | null;
  attendance_enabled?: boolean;
  attendance_mobile_enabled?: boolean;
  attendance_biometric_enabled?: boolean;
  attendance_device_limit?: number;
  attendance_trial_ends_at?: string | null;
  attendance_ends_at?: string | null;
  entitlements?: Record<string, unknown> | null;
  billing_account_id?: number | null;
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
    finance_reports_enabled: boolean;
    finance_accounting_enabled: boolean;
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
  const isFormData =
    hasBody &&
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    cache: "no-store",
    ...(hasBody
      ? { body: isFormData ? options.body as FormData : JSON.stringify(options.body) }
      : {}),
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
        const detailRecord = parsedDetail && typeof parsedDetail === "object" && !Array.isArray(parsedDetail)
          ? parsedDetail as Record<string, unknown>
          : null;
        const detailValidation = detailRecord?.validation_errors;
        const detailMessage =
          (typeof parsedDetail === "string" && parsedDetail) ||
          (typeof detailRecord?.message === "string" && detailRecord.message) ||
          (Array.isArray(detailValidation) && detailValidation.map(String).join(" ")) ||
          (Array.isArray(parsedDetail) && parsedDetail
            .map((item) => item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : String(item))
            .join(" "));
        message =
          (typeof parsedMessage === "string" && parsedMessage) ||
          detailMessage ||
          message;
      }
    } catch {
      // not JSON
    }

    // Never expose database statements, stack traces, or infrastructure
    // details in the admin UI. The backend logs retain the diagnostic error.
    const safeMessage =
      response.status >= 500
        ? "The server could not complete this request. Try again or check the backend logs."
        : (message || "").trim() || `Request failed with status ${response.status}`;
    throw new Error(`[${response.status}] ${path}: ${safeMessage}`);
  }

  return response.json() as Promise<T>;
}

export async function backendFetch<T>(path: string, options: BackendClientOptions = {}): Promise<T> {
  return backendRequest<T>(path, options);
}

export type NotificationSound = "kitchen_bell" | "service_chime";

export type PlatformNotificationSettings = {
  operations_sound: NotificationSound;
  customer_request_sound: NotificationSound;
  updated_at?: string | null;
};

export function getPlatformNotificationSettings(options: BackendClientOptions = {}) {
  return backendFetch<BaseResponse<PlatformNotificationSettings>>("/admin/platform/notification-settings", options);
}

export function updatePlatformNotificationSettings(
  payload: Pick<PlatformNotificationSettings, "operations_sound" | "customer_request_sound">,
  options: BackendClientOptions = {},
) {
  return backendRequest<BaseResponse<PlatformNotificationSettings>>("/admin/platform/notification-settings", {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export type MenuImportPayload = {
  version: 1;
  categories: Array<{ name: string; type: "kitchen" | "bar" | "cafe" }>;
  modifier_groups: Array<{ name: string; required?: boolean; min_selections?: number; max_selections?: number | null; options: Array<{ name: string; price_adjustment?: number; is_default?: boolean }> }>;
  items: Array<{ name: string; price: number; category: string; description?: string | null; modifier_groups?: string[] }>;
};

export type MenuImportResult = {
  valid?: boolean;
  errors?: string[];
  duplicates?: string[];
  summary?: Record<string, number>;
  created?: Record<string, number>;
  skipped_duplicates?: string[];
};

export function importRestaurantMenu(restaurantId: number, payload: MenuImportPayload, confirm: boolean, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<MenuImportResult>>(`/admin/platform/restaurants/${restaurantId}/menu-import`, { ...options, method: "POST", body: { payload, confirm } });
}

export type DashboardPromoBanner = {
  id: number;
  image_url: string;
  mobile_image_url: string;
  desktop_image_url: string;
  alt_text: string;
  action_type: "none" | "external_url" | "internal_path";
  action_value: string | null;
  open_in_new_tab: boolean;
  is_active: boolean;
  sort_order: number;
};

export type BackendRestaurantOption = Pick<
  BackendRestaurant,
  | "id"
  | "name"
  | "address"
  | "phone"
  | "registered_by"
  | "profile_picture"
  | "cover_photo"
  | "timezone"
  | "kot_enabled"
  | "hotel_enabled"
  | "restaurant_enabled"
  | "attendance_enabled"
  | "billing_mode"
  | "plan_state"
  | "trial_ends_at"
  | "paid_ends_at"
>;

export type DashboardPromoBannerUpdatePayload = {
  alt_text?: string;
  action_type?: "none" | "external_url" | "internal_path";
  action_value?: string | null;
  open_in_new_tab?: boolean;
  is_active?: boolean;
  sort_order?: number;
};

const DASHBOARD_BANNERS_PATH = "/admin/platform/dashboard-banners";

export async function getDashboardPromoBanners(
  options: BackendClientOptions = {},
): Promise<BaseResponse<DashboardPromoBanner[]>> {
  return backendFetch<BaseResponse<DashboardPromoBanner[]>>(
    DASHBOARD_BANNERS_PATH,
    options,
  );
}

export async function createDashboardPromoBanner(
  payload: {
    mobileFile: File;
    desktopFile: File;
    altText?: string;
    actionType?: "none" | "external_url" | "internal_path";
    actionValue?: string | null;
    openInNewTab?: boolean;
  },
  options: BackendClientOptions = {},
): Promise<BaseResponse<DashboardPromoBanner>> {
  const form = new FormData();
  form.set("mobile_file", payload.mobileFile);
  form.set("desktop_file", payload.desktopFile);
  form.set("alt_text", payload.altText || "");
  form.set("action_type", payload.actionType || "none");
  if (payload.actionValue) form.set("action_value", payload.actionValue);
  form.set("open_in_new_tab", String(Boolean(payload.openInNewTab)));
  return backendRequest<BaseResponse<DashboardPromoBanner>>(
    DASHBOARD_BANNERS_PATH,
    { ...options, method: "POST", body: form },
  );
}

export async function replaceDashboardPromoBannerImage(
  bannerId: number,
  variant: "mobile" | "desktop",
  file: File,
  options: BackendClientOptions = {},
): Promise<BaseResponse<DashboardPromoBanner>> {
  const form = new FormData();
  form.set("file", file);
  return backendRequest<BaseResponse<DashboardPromoBanner>>(
    `${DASHBOARD_BANNERS_PATH}/${bannerId}/${variant}-image`,
    { ...options, method: "PUT", body: form },
  );
}

export async function updateDashboardPromoBanner(
  bannerId: number,
  payload: DashboardPromoBannerUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<DashboardPromoBanner>> {
  return backendRequest<BaseResponse<DashboardPromoBanner>>(
    `${DASHBOARD_BANNERS_PATH}/${bannerId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function reorderDashboardPromoBanners(
  ids: number[],
  options: BackendClientOptions = {},
): Promise<BaseResponse<DashboardPromoBanner[]>> {
  return backendRequest<BaseResponse<DashboardPromoBanner[]>>(
    `${DASHBOARD_BANNERS_PATH}/reorder`,
    { ...options, method: "PUT", body: { ids } },
  );
}

export async function deleteDashboardPromoBanner(
  bannerId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<null>> {
  return backendRequest<BaseResponse<null>>(
    `${DASHBOARD_BANNERS_PATH}/${bannerId}`,
    { ...options, method: "DELETE" },
  );
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

export async function getPlatformRestaurantOptions(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendRestaurantOption[]>> {
  return backendFetch<BaseResponse<BackendRestaurantOption[]>>(
    "/admin/platform/restaurants/options",
    options,
  );
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
  | "finance_reports_enabled"
  | "finance_accounting_enabled"
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

export type AttendanceEntitlementUpdatePayload = {
  attendance_enabled?: boolean;
  attendance_mobile_enabled?: boolean;
  attendance_biometric_enabled?: boolean;
  attendance_device_limit?: number;
  attendance_trial_ends_at?: string | null;
  attendance_ends_at?: string | null;
};

export async function updateRestaurantAttendanceEntitlement(
  restaurantId: number,
  payload: AttendanceEntitlementUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BackendRestaurant>> {
  return backendRequest<BaseResponse<BackendRestaurant>>(
    `/admin/platform/restaurants/${restaurantId}/attendance-entitlement`,
    {
      ...options,
      method: "PATCH",
      body: payload,
    },
  );
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

// ==========================================
// Lead Generation
// ==========================================

export type LeadRead = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  restaurant_name?: string | null;
  created_at: string;
  is_read: boolean;
};

export async function getLeads(
  options: BackendClientOptions = {},
): Promise<LeadRead[]> {
  return backendFetch<LeadRead[]>("/leads", options);
}

export type LeadStats = {
  menus: number;
  tables: number;
  orders: number;
  menu_setup?: LeadSetupBreakdown | null;
  table_setup?: LeadSetupBreakdown | null;
};

export type LeadSetupBreakdown = {
  total: number;
  default_total: number;
  default_kept: number;
  modified: number;
  extra: number;
  missing_defaults: number;
};

export type LeadRestaurantInfo = {
  name: string;
  phone?: string | null;
  address?: string | null;
  profile_picture?: string | null;
  cover_photo?: string | null;
};

export type LeadDetailRead = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  auth_provider?: string | null;
  photo_url?: string | null;
  created_at: string;
  is_read: boolean;
  restaurant?: LeadRestaurantInfo | null;
  stats: LeadStats;
};

export async function getLead(
  leadId: number,
  options: BackendClientOptions = {},
): Promise<LeadDetailRead> {
  return backendFetch<LeadDetailRead>(`/leads/${leadId}`, options);
}

export async function markLeadsAsRead(
  leadIds: number[],
  options: BackendClientOptions = {},
): Promise<Record<string, unknown>> {
  return backendRequest<Record<string, unknown>>("/leads/mark-read", {
    ...options,
    method: "POST",
    body: { lead_ids: leadIds },
  });
}

export type LeadRecipientRead = {
  id: number;
  email: string;
  name?: string | null;
  is_active: boolean;
};

export type LeadRecipientCreatePayload = {
  email: string;
  name?: string;
};

export async function getLeadRecipients(
  options: BackendClientOptions = {},
): Promise<LeadRecipientRead[]> {
  return backendFetch<LeadRecipientRead[]>("/lead-recipients", options);
}

export async function addLeadRecipient(
  payload: LeadRecipientCreatePayload,
  options: BackendClientOptions = {},
): Promise<LeadRecipientRead> {
  return backendRequest<LeadRecipientRead>("/lead-recipients", {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function removeLeadRecipient(
  recipientId: number,
  options: BackendClientOptions = {},
): Promise<Record<string, unknown>> {
  return backendRequest<Record<string, unknown>>(
    `/lead-recipients/${recipientId}`,
    {
      ...options,
      method: "DELETE",
    },
  );
}

export async function toggleLeadRecipient(
  recipientId: number,
  options: BackendClientOptions = {},
): Promise<LeadRecipientRead> {
  return backendRequest<LeadRecipientRead>(
    `/lead-recipients/${recipientId}/toggle`,
    {
      ...options,
      method: "PATCH",
    },
  );
}

export type UserActivityLogRead = {
  id: number;
  user_id: number;
  action: string;
  entity_type?: string | null;
  entity_id?: number | null;
  details?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
};

export type LeadActivityPageRead = {
  items: UserActivityLogRead[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
};

export async function getLeadActivity(
  leadId: number,
  params: { skip?: number; limit?: number } = {},
  options: BackendClientOptions = {},
): Promise<LeadActivityPageRead> {
  const search = new URLSearchParams();
  if (typeof params.skip === "number") search.set("skip", String(params.skip));
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return backendFetch<LeadActivityPageRead>(`/leads/${leadId}/activity${suffix}`, options);
}

// ==========================================
// Platform Staff
// ==========================================

export type PlatformStaffRead = {
  id: number;
  name: string;
  email: string;
  permissions: string[];
  is_active: boolean;
};

export type PlatformStaffCreate = {
  name: string;
  email: string;
  password?: string;
  permissions: string[];
};

export type PlatformStaffUpdate = {
  name?: string;
  email?: string;
  permissions?: string[];
  is_active?: boolean;
};

export type PlatformStaffPasswordUpdate = {
  new_password: string;
};

export async function getPlatformStaff(
  options: BackendClientOptions = {},
): Promise<PlatformStaffRead[]> {
  return backendFetch<PlatformStaffRead[]>("/platform/staff", options);
}

export async function createPlatformStaff(
  payload: PlatformStaffCreate,
  options: BackendClientOptions = {},
): Promise<PlatformStaffRead> {
  return backendRequest<PlatformStaffRead>("/platform/staff", {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function updatePlatformStaff(
  userId: number,
  payload: PlatformStaffUpdate,
  options: BackendClientOptions = {},
): Promise<PlatformStaffRead> {
  return backendRequest<PlatformStaffRead>(`/platform/staff/${userId}`, {
    ...options,
    method: "PATCH",
    body: payload,
  });
}

export async function updatePlatformStaffPassword(
  userId: number,
  payload: PlatformStaffPasswordUpdate,
  options: BackendClientOptions = {},
): Promise<Record<string, unknown>> {
  return backendRequest<Record<string, unknown>>(
    `/platform/staff/${userId}/password`,
    {
      ...options,
      method: "PATCH",
      body: payload,
    },
  );
}

// ==========================================
// Platform Billing V2
// ==========================================

export type BillingPlanStatus = "active" | "retired" | string;

export type SmsCreditPackage = {
  id: number;
  code: string;
  label: string;
  credits: number;
  price_npr: string;
  unit_price_npr: string;
  is_active: boolean;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SmsCreditPackageCreatePayload = {
  code: string;
  label: string;
  credits: number;
  price_npr: string;
  is_active: boolean;
  display_order: number;
};

export type SmsCreditPackageUpdatePayload = Partial<
  Omit<SmsCreditPackageCreatePayload, "code">
>;

export type PlatformSmsCapacity = {
  generated_at: string;
  provider_balance: {
    available_credits: number;
    safety_buffer_credits: number;
    last_updated_at?: string | null;
    source: "manual_sms_pasal_check" | string;
  };
  recommended_top_up: {
    coverage_target_credits: number;
    restaurant_commitment_credits: number;
    platform_forecast_30d_credits: number;
    safety_buffer_credits: number;
    credits_to_add: number;
  };
  restaurants: {
    total: number;
    with_sms_wallet: number;
    paid_purchase_count: number;
    purchased_credits: number;
    purchased_npr: number;
    available_credits: number;
    reserved_credits: number;
    consumed_credits: number;
    rows: Array<{
      restaurant_id: number;
      restaurant_name: string;
      purchase_count: number;
      purchased_credits: number;
      purchased_npr: number;
      available_credits: number;
      reserved_credits: number;
    }>;
  };
  customers: {
    local_customers: number;
    customer_accounts: number;
    verified_phone_accounts: number;
  };
  forecast: {
    window_days: number;
    customer_accounts_created_7d: number;
    customer_accounts_created_30d: number;
    forecast_customer_accounts_next_30d: number;
    restaurant_customers_created_7d: number;
    restaurant_customers_created_30d: number;
    forecast_restaurant_customers_next_30d: number;
    successful_phone_otp_sms_30d: number;
    new_customer_phone_contacts_30d: number;
    estimated_platform_sms_next_30d: number;
    assumptions: string[];
  };
};

export type PlatformSmsCapacitySettingsPayload = {
  provider_available_credits: number;
  safety_buffer_credits: number;
};
export type BillingVersionStatus = "draft" | "published" | "retired" | string;
export type BillingSubscriptionStatus =
  | "scheduled"
  | "pending_payment"
  | "trialing"
  | "active"
  | "grace"
  | "past_due"
  | "expired"
  | "canceled"
  | string;

export type BillingEntitlementValue = boolean | number | string | null;

export type BillingEntitlementDefinition = {
  key: string;
  label: string;
  description?: string | null;
  module?: string | null;
  value_type: "boolean" | "integer" | "string" | string;
  usage_scope?: "billing_account" | "restaurant" | "subscription" | string | null;
  is_client_visible?: boolean;
  is_enforced?: boolean;
};

export type BillingPlanPrice = {
  id?: number;
  plan_version_id?: number;
  billing_interval_months: number | null;
  price_type: "flat" | "initial" | "renewal" | string;
  amount: number | string | null;
  currency: string;
  tax_inclusive: boolean;
  quote_only: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
  is_active?: boolean;
};

export type BillingPlanVersion = {
  id: number;
  plan_id?: number;
  version_number: number;
  status: BillingVersionStatus;
  subtitle?: string | null;
  marketing_content?: Record<string, unknown> | null;
  effective_from?: string | null;
  published_at?: string | null;
  published_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  lock_version?: number;
  prices?: BillingPlanPrice[];
  entitlements?: Record<string, BillingEntitlementValue>;
};

export type BillingPlan = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  display_order: number;
  is_public: boolean;
  status: BillingPlanStatus;
  created_at?: string | null;
  updated_at?: string | null;
  versions?: BillingPlanVersion[];
  draft_version?: BillingPlanVersion | null;
  published_version?: BillingPlanVersion | null;
  latest_version?: BillingPlanVersion | null;
  current_version?: BillingPlanVersion | null;
};

export type BillingTrialSettings = {
  id?: number;
  trial_enabled: boolean;
  trial_plan_id: number;
  trial_plan_code?: string | null;
  trial_plan_name?: string | null;
  trial_plan_version_id?: number | null;
  trial_days: number;
  configuration_valid: boolean;
  validation_message?: string | null;
  updated_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BillingTrialSettingsUpdatePayload = {
  trial_enabled: boolean;
  trial_plan_id: number;
  trial_days: number;
  reason: string;
};

export type BillingPlanCreatePayload = {
  code: string;
  name: string;
  description?: string | null;
  display_order?: number;
  is_public?: boolean;
};

export type BillingPlanUpdatePayload = Partial<
  Pick<BillingPlan, "name" | "description" | "display_order" | "is_public" | "status">
>;

export type BillingPlanVersionUpdatePayload = {
  subtitle?: string | null;
  marketing_content?: Record<string, unknown> | null;
  effective_from?: string | null;
  lock_version?: number;
};

export type BillingPlanValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type BillingPlanPublishResult = {
  version: BillingPlanVersion;
  validation?: BillingPlanValidation;
  valid?: boolean;
  validation_errors?: string[];
};

export type BillingAddonVersion = {
  id: number;
  addon_id?: number;
  addon_code?: string;
  version_number: number;
  status: BillingVersionStatus;
  effective_from?: string | null;
  published_at?: string | null;
  prices?: BillingPlanPrice[];
  entitlements?: Record<string, BillingEntitlementValue>;
};

export type BillingAddonCreatePayload = {
  code: string;
  name: string;
  description?: string | null;
  is_public?: boolean;
  compatible_plan_codes?: string[];
};

export type BillingAddonUpdatePayload = Partial<
  Pick<BillingAddon, "name" | "description" | "status" | "is_public" | "compatible_plan_codes">
>;

export type BillingAddon = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: BillingPlanStatus;
  is_public?: boolean;
  compatible_plan_codes?: string[];
  versions?: BillingAddonVersion[];
  published_version?: BillingAddonVersion | null;
  current_version?: BillingAddonVersion | null;
};

export type BillingUsageItem = {
  used: number;
  limit: number | null;
  remaining?: number | null;
};

export type BillingSubscriptionAddonAssignment = {
  id?: number;
  addon_id?: number;
  addon_version_id: number;
  selected_price_id?: number | null;
  addon_code?: string | null;
  addon_name?: string | null;
  code?: string | null;
  name?: string | null;
  status?: string;
  started_at?: string | null;
  ends_at?: string | null;
  configuration?: Record<string, unknown> | null;
  prices?: BillingPlanPrice[];
};

export type BillingSubscriptionOverride = {
  id: number;
  entitlement_key: string;
  override_value?: BillingEntitlementValue;
  value?: BillingEntitlementValue;
  reason: string;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
};

export type BillingSubscription = {
  id: number;
  billing_account_id: number;
  billing_account_name?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_user_id?: number | null;
  owner?: { id: number; name: string; email: string } | null;
  restaurant_id?: number | null;
  restaurant_ids?: number[];
  restaurant_name?: string | null;
  restaurant_names?: string[];
  restaurants?: Array<{ id: number; name: string; is_primary?: boolean }>;
  plan_version_id: number;
  selected_price_id?: number | null;
  plan_code?: string | null;
  plan_name?: string | null;
  plan_version_number?: number | null;
  plan_version?: number | BillingPlanVersion | null;
  status: BillingSubscriptionStatus;
  effective_status?: BillingSubscriptionStatus;
  billing_source?: string | null;
  started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  grace_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  notes?: string | null;
  plan_version_prices?: BillingPlanPrice[];
  addons?: BillingSubscriptionAddonAssignment[];
  overrides?: BillingSubscriptionOverride[];
  usage?: Record<string, BillingUsageItem>;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BillingSubscriptionList = {
  items: BillingSubscription[];
  total: number;
};

export type BillingSubscriptionAssignPayload = {
  plan_version_id: number;
  selected_price_id: number;
  status: BillingSubscriptionStatus;
  billing_source?: "manual" | "gateway" | "contract";
  started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  grace_ends_at?: string | null;
  notes?: string | null;
  reason: string;
};

export type RestaurantPlanDirectAssignPayload = {
  plan_version_id: number;
  duration_months: number;
};

export type BillingSubscriptionPeriodAdjustmentPayload = {
  days_delta: number;
  reason?: string;
};

export type BillingSubscriptionUpdatePayload = Partial<
  Pick<
    BillingSubscription,
    | "status"
    | "selected_price_id"
    | "current_period_start"
    | "current_period_end"
    | "grace_ends_at"
    | "cancel_at_period_end"
    | "notes"
  >
> & {
  reason: string;
};

export type BillingOverrideCreatePayload = {
  entitlement_key: string;
  override_value: BillingEntitlementValue;
  reason: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type BillingAddonAssignmentsPayload = {
  addon_version_ids: number[];
  addons?: Array<{
    addon_version_id: number;
    selected_price_id?: number | null;
  }>;
  reason: string;
};

export type PublicBillingCatalog = {
  catalog_version: string;
  currency: string;
  plans: BillingPlan[];
  addons: BillingAddon[];
  trial_offer?: BillingTrialSettings | null;
};

export type BillingInvoice = {
  id: number;
  subscription_id: number;
  billing_account_id?: number;
  billing_account_name?: string | null;
  invoice_number?: string | null;
  status: string;
  currency: string;
  subtotal?: number | string;
  tax_amount?: number | string;
  discount_amount?: number | string;
  total_amount: number | string;
  amount_due?: number | string;
  amount_paid?: number | string;
  due_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  issued_at?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  stored_status?: string;
  line_items?: Array<Record<string, unknown>>;
  source?: "manual" | "contract" | "upgrade" | "renewal" | string;
  checkout_status?: "pending" | "paid" | "failed" | "expired" | "superseded" | "review_required" | string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  payments?: BillingPayment[];
};

export type BillingPayment = {
  id: number;
  invoice_id?: number;
  amount: number | string;
  currency: string;
  payment_method?: string | null;
  reference?: string | null;
  paid_at: string;
  recorded_by?: number | null;
  created_at?: string | null;
  status?: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  reversed_by?: number | null;
};

export type BillingAccount = {
  id: number;
  name: string;
  owner_user_id?: number | null;
  currency: string;
  status: string;
  restaurants: Array<{
    restaurant_id: number;
    restaurant_name?: string | null;
    is_primary: boolean;
  }>;
  current_subscription?: BillingSubscription | null;
};

export type BillingAccountUpdatePayload = {
  name?: string;
  owner_user_id?: number | null;
  reason: string;
};

export type BillingAccountRestaurantsReplacePayload = {
  restaurant_ids: number[];
  primary_restaurant_id: number;
  allow_move?: boolean;
  reason: string;
};

export type BillingUpgradeRequest = {
  id: number;
  billing_account_id: number;
  restaurant_id: number;
  requested_by?: number | null;
  requested_plan_code: string;
  billing_interval_months?: number | null;
  requested_addon_codes: string[];
  message?: string | null;
  status: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  fulfilled_subscription_id?: number | null;
  invoice_id?: number | null;
  completed_at?: string | null;
  created_at: string;
};

export type BillingPromoCode = {
  id: number;
  code: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  applicable_plan_codes: string[];
  billing_interval_months: number[];
  starts_at?: string | null;
  ends_at?: string | null;
  max_redemptions?: number | null;
  per_account_limit: number;
  is_active: boolean;
  redeemed_count: number;
  created_at?: string | null;
};

export type BillingPromoCodeCreatePayload = {
  code?: string | null;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  applicable_plan_codes?: string[];
  billing_interval_months?: number[];
  ends_at?: string | null;
  max_redemptions?: number | null;
  per_account_limit?: number;
  is_active?: boolean;
};

export type BillingAuditLog = {
  id: number;
  billing_account_id?: number | null;
  subscription_id?: number | null;
  entity_type: string;
  entity_id?: number | null;
  action: string;
  reason?: string | null;
  actor_id?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  created_at: string;
};

export type BillingPaymentCreatePayload = {
  amount: number;
  currency: string;
  payment_method: string;
  reference?: string | null;
  paid_at?: string | null;
  reason: string;
};

export type BillingInvoiceCreatePayload = {
  invoice_number: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  due_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
  line_items?: Array<Record<string, unknown>>;
  source?: "manual" | "contract" | "upgrade" | "renewal";
  reason: string;
};

export type BillingContractInvoiceCreatePayload = {
  invoice_number?: string | null;
  tax_rate_percent?: number;
  discount_amount?: number;
  negotiated_base_amount?: number | null;
  negotiated_addon_amounts?: Record<string, number>;
  due_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
  source?: "contract" | "upgrade" | "renewal";
  reason: string;
};

export type BillingUpgradeFulfillPayload = {
  selected_plan_price_id: number;
  selected_addon_price_ids: Record<string, number>;
  billing_source: "manual" | "contract";
  started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  grace_ends_at?: string | null;
  invoice_number?: string | null;
  tax_rate_percent?: number;
  discount_amount?: number;
  negotiated_base_amount?: number | null;
  negotiated_addon_amounts?: Record<string, number>;
  due_at?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  reason: string;
};

export type BillingMetrics = {
  currency: "NPR" | string;
  active_subscriptions: number;
  trialing: number;
  grace_or_past_due: number;
  scheduled: number;
  pending_payment: number;
  estimated_mrr: number | string;
  estimated_arr: number | string;
  outstanding: number | string;
  overdue: number | string;
  payments_last_30_days: number | string;
  canceled_last_30_days: number;
  renewals_next_30_days: number;
  generated_at: string;
};

export function isBackendRouteUnavailable(error: unknown): boolean {
  return error instanceof Error && /^\[(404|405|501)\]/.test(error.message);
}

const PLATFORM_BILLING_PATH = "/admin/platform/billing";

export async function getSmsCreditPackages(
  options: BackendClientOptions = {},
): Promise<BaseResponse<SmsCreditPackage[]>> {
  return backendFetch<BaseResponse<SmsCreditPackage[]>>(
    `${PLATFORM_BILLING_PATH}/sms-credit-packages`,
    options,
  );
}

export async function getPlatformSmsCapacity(
  options: BackendClientOptions = {},
): Promise<BaseResponse<PlatformSmsCapacity>> {
  return backendFetch<BaseResponse<PlatformSmsCapacity>>("/admin/platform/sms-capacity", options);
}

export async function updatePlatformSmsCapacitySettings(
  payload: PlatformSmsCapacitySettingsPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<PlatformSmsCapacitySettingsPayload>> {
  return backendRequest<BaseResponse<PlatformSmsCapacitySettingsPayload>>(
    "/admin/platform/sms-capacity/settings",
    { ...options, method: "PUT", body: payload },
  );
}

export async function createSmsCreditPackage(
  payload: SmsCreditPackageCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<SmsCreditPackage>> {
  return backendRequest<BaseResponse<SmsCreditPackage>>(
    `${PLATFORM_BILLING_PATH}/sms-credit-packages`,
    { ...options, method: "POST", body: payload },
  );
}

export async function updateSmsCreditPackage(
  packageId: number,
  payload: SmsCreditPackageUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<SmsCreditPackage>> {
  return backendRequest<BaseResponse<SmsCreditPackage>>(
    `${PLATFORM_BILLING_PATH}/sms-credit-packages/${packageId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function getPublicBillingCatalog(
  options: BackendClientOptions = {},
): Promise<BaseResponse<PublicBillingCatalog>> {
  return backendFetch<BaseResponse<PublicBillingCatalog>>("/subscriptions/catalog", options);
}

export async function getBillingPlans(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlan[]>> {
  return backendFetch<BaseResponse<BillingPlan[]>>(`${PLATFORM_BILLING_PATH}/plans`, options);
}

export async function getBillingTrialSettings(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingTrialSettings>> {
  return backendFetch<BaseResponse<BillingTrialSettings>>(
    `${PLATFORM_BILLING_PATH}/settings`,
    options,
  );
}

export async function updateBillingTrialSettings(
  payload: BillingTrialSettingsUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingTrialSettings>> {
  return backendRequest<BaseResponse<BillingTrialSettings>>(
    `${PLATFORM_BILLING_PATH}/settings`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function getBillingPlan(
  planId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlan>> {
  return backendFetch<BaseResponse<BillingPlan>>(`${PLATFORM_BILLING_PATH}/plans/${planId}`, options);
}

export async function createBillingPlan(
  payload: BillingPlanCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlan>> {
  return backendRequest<BaseResponse<BillingPlan>>(`${PLATFORM_BILLING_PATH}/plans`, {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function updateBillingPlan(
  planId: number,
  payload: BillingPlanUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlan>> {
  return backendRequest<BaseResponse<BillingPlan>>(`${PLATFORM_BILLING_PATH}/plans/${planId}`, {
    ...options,
    method: "PATCH",
    body: payload,
  });
}

export async function createBillingPlanVersion(
  planId: number,
  payload: { source_version_id?: number | null } = {},
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanVersion>> {
  return backendRequest<BaseResponse<BillingPlanVersion>>(
    `${PLATFORM_BILLING_PATH}/plans/${planId}/versions`,
    { ...options, method: "POST", body: payload },
  );
}

export async function getBillingPlanVersion(
  versionId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanVersion>> {
  return backendFetch<BaseResponse<BillingPlanVersion>>(
    `${PLATFORM_BILLING_PATH}/plan-versions/${versionId}`,
    options,
  );
}

export async function updateBillingPlanVersion(
  versionId: number,
  payload: BillingPlanVersionUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanVersion>> {
  return backendRequest<BaseResponse<BillingPlanVersion>>(
    `${PLATFORM_BILLING_PATH}/plan-versions/${versionId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function updateBillingPlanVersionPrices(
  versionId: number,
  prices: BillingPlanPrice[],
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanVersion>> {
  return backendRequest<BaseResponse<BillingPlanVersion>>(
    `${PLATFORM_BILLING_PATH}/plan-versions/${versionId}/prices`,
    { ...options, method: "PUT", body: { prices } },
  );
}

export async function updateBillingPlanVersionEntitlements(
  versionId: number,
  entitlements: Record<string, BillingEntitlementValue>,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanVersion>> {
  return backendRequest<BaseResponse<BillingPlanVersion>>(
    `${PLATFORM_BILLING_PATH}/plan-versions/${versionId}/entitlements`,
    { ...options, method: "PUT", body: { entitlements } },
  );
}

export async function publishBillingPlanVersion(
  versionId: number,
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPlanPublishResult>> {
  return backendRequest<BaseResponse<BillingPlanPublishResult>>(
    `${PLATFORM_BILLING_PATH}/plan-versions/${versionId}/publish`,
    { ...options, method: "POST", body: { reason } },
  );
}

export async function getBillingEntitlementDefinitions(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingEntitlementDefinition[]>> {
  return backendFetch<BaseResponse<BillingEntitlementDefinition[]>>(
    `${PLATFORM_BILLING_PATH}/entitlement-definitions`,
    options,
  );
}

export async function getBillingAddons(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddon[]>> {
  return backendFetch<BaseResponse<BillingAddon[]>>(`${PLATFORM_BILLING_PATH}/addons`, options);
}

export async function createBillingAddon(
  payload: BillingAddonCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddon>> {
  return backendRequest<BaseResponse<BillingAddon>>(`${PLATFORM_BILLING_PATH}/addons`, {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function updateBillingAddon(
  addonId: number,
  payload: BillingAddonUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddon>> {
  return backendRequest<BaseResponse<BillingAddon>>(`${PLATFORM_BILLING_PATH}/addons/${addonId}`, {
    ...options,
    method: "PATCH",
    body: payload,
  });
}

export async function createBillingAddonVersion(
  addonId: number,
  payload: { source_version_id?: number | null; effective_from?: string | null } = {},
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddonVersion>> {
  return backendRequest<BaseResponse<BillingAddonVersion>>(
    `${PLATFORM_BILLING_PATH}/addons/${addonId}/versions`,
    { ...options, method: "POST", body: payload },
  );
}

export async function getBillingAddonVersion(
  versionId: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddonVersion>> {
  return backendFetch<BaseResponse<BillingAddonVersion>>(
    `${PLATFORM_BILLING_PATH}/addon-versions/${versionId}`,
    options,
  );
}

export async function updateBillingAddonVersion(
  versionId: number,
  payload: { effective_from?: string | null },
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddonVersion>> {
  return backendRequest<BaseResponse<BillingAddonVersion>>(
    `${PLATFORM_BILLING_PATH}/addon-versions/${versionId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function updateBillingAddonVersionPrices(
  versionId: number,
  prices: BillingPlanPrice[],
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddonVersion>> {
  return backendRequest<BaseResponse<BillingAddonVersion>>(
    `${PLATFORM_BILLING_PATH}/addon-versions/${versionId}/prices`,
    { ...options, method: "PUT", body: { prices } },
  );
}

export async function updateBillingAddonVersionEntitlements(
  versionId: number,
  entitlements: Record<string, BillingEntitlementValue>,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAddonVersion>> {
  return backendRequest<BaseResponse<BillingAddonVersion>>(
    `${PLATFORM_BILLING_PATH}/addon-versions/${versionId}/entitlements`,
    { ...options, method: "PUT", body: { entitlements } },
  );
}

export async function publishBillingAddonVersion(
  versionId: number,
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<{ valid: boolean; validation_errors: string[]; version: BillingAddonVersion }>> {
  return backendRequest<BaseResponse<{ valid: boolean; validation_errors: string[]; version: BillingAddonVersion }>>(
    `${PLATFORM_BILLING_PATH}/addon-versions/${versionId}/publish`,
    { ...options, method: "POST", body: { reason } },
  );
}

export async function getBillingSubscriptions(
  params: { restaurantId?: number; status?: string; search?: string } = {},
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription[] | BillingSubscriptionList>> {
  const search = new URLSearchParams();
  if (typeof params.restaurantId === "number") search.set("restaurant_id", String(params.restaurantId));
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return backendFetch<BaseResponse<BillingSubscription[] | BillingSubscriptionList>>(
    `${PLATFORM_BILLING_PATH}/subscriptions${suffix}`,
    options,
  );
}

export async function getBillingAccounts(
  params: { restaurantId?: number } = {},
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAccount[]>> {
  const suffix = typeof params.restaurantId === "number"
    ? `?restaurant_id=${encodeURIComponent(String(params.restaurantId))}`
    : "";
  return backendFetch<BaseResponse<BillingAccount[]>>(`${PLATFORM_BILLING_PATH}/accounts${suffix}`, options);
}

export async function updateBillingAccount(
  billingAccountId: number,
  payload: BillingAccountUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAccount>> {
  return backendRequest<BaseResponse<BillingAccount>>(
    `${PLATFORM_BILLING_PATH}/accounts/${billingAccountId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function replaceBillingAccountRestaurants(
  billingAccountId: number,
  payload: BillingAccountRestaurantsReplacePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAccount>> {
  return backendRequest<BaseResponse<BillingAccount>>(
    `${PLATFORM_BILLING_PATH}/accounts/${billingAccountId}/restaurants`,
    { ...options, method: "PUT", body: payload },
  );
}

export async function getBillingUpgradeRequests(
  requestStatus?: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingUpgradeRequest[]>> {
  const suffix = requestStatus ? `?status=${encodeURIComponent(requestStatus)}` : "";
  return backendFetch<BaseResponse<BillingUpgradeRequest[]>>(
    `${PLATFORM_BILLING_PATH}/upgrade-requests${suffix}`,
    options,
  );
}

export async function reviewBillingUpgradeRequest(
  requestId: number,
  payload: { status: "reviewing" | "approved" | "rejected" | "completed"; reason: string },
  options: BackendClientOptions = {},
): Promise<BaseResponse<Pick<BillingUpgradeRequest, "id" | "status" | "reviewed_by" | "reviewed_at">>> {
  return backendRequest<BaseResponse<Pick<BillingUpgradeRequest, "id" | "status" | "reviewed_by" | "reviewed_at">>>(
    `${PLATFORM_BILLING_PATH}/upgrade-requests/${requestId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function getBillingPromoCodes(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPromoCode[]>> {
  return backendFetch<BaseResponse<BillingPromoCode[]>>(
    `${PLATFORM_BILLING_PATH}/promo-codes`,
    options,
  );
}

export async function createBillingPromoCode(
  payload: BillingPromoCodeCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPromoCode>> {
  return backendRequest<BaseResponse<BillingPromoCode>>(
    `${PLATFORM_BILLING_PATH}/promo-codes`,
    { ...options, method: "POST", body: payload },
  );
}

export async function updateBillingPromoCode(
  promoId: number,
  payload: { is_active?: boolean; ends_at?: string | null; max_redemptions?: number | null; description?: string | null },
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPromoCode>> {
  return backendRequest<BaseResponse<BillingPromoCode>>(
    `${PLATFORM_BILLING_PATH}/promo-codes/${promoId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function resolveBillingUpgradeRequest(
  requestId: number,
  action: "approve" | "reject",
  durationMonths: number | undefined,
  options: BackendClientOptions = {},
): Promise<BaseResponse<{ request_id: number; status: string; subscription?: BillingSubscription }>> {
  return backendRequest<BaseResponse<{ request_id: number; status: string; subscription?: BillingSubscription }>>(
    `${PLATFORM_BILLING_PATH}/upgrade-requests/${requestId}/resolve`,
    { ...options, method: "POST", body: { action, duration_months: durationMonths } },
  );
}

export async function fulfillBillingUpgradeRequest(
  requestId: number,
  payload: BillingUpgradeFulfillPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<{ request: BillingUpgradeRequest; subscription: BillingSubscription; invoice: BillingInvoice }>> {
  return backendRequest<BaseResponse<{ request: BillingUpgradeRequest; subscription: BillingSubscription; invoice: BillingInvoice }>>(
    `${PLATFORM_BILLING_PATH}/upgrade-requests/${requestId}/fulfill`,
    { ...options, method: "POST", body: payload },
  );
}

export async function getBillingAuditLogs(
  billingAccountId?: number,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingAuditLog[]>> {
  const suffix = typeof billingAccountId === "number"
    ? `?billing_account_id=${encodeURIComponent(String(billingAccountId))}`
    : "";
  return backendFetch<BaseResponse<BillingAuditLog[]>>(
    `${PLATFORM_BILLING_PATH}/audits${suffix}`,
    options,
  );
}

export async function assignBillingSubscription(
  billingAccountId: number,
  payload: BillingSubscriptionAssignPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/accounts/${billingAccountId}/subscription`,
    { ...options, method: "POST", body: payload },
  );
}

export async function assignRestaurantPlanDirectly(
  restaurantId: number,
  payload: RestaurantPlanDirectAssignPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/restaurants/${restaurantId}/direct-plan`,
    { ...options, method: "POST", body: payload },
  );
}

export async function adjustBillingSubscriptionPeriod(
  subscriptionId: number,
  payload: BillingSubscriptionPeriodAdjustmentPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/period-adjustment`,
    { ...options, method: "POST", body: payload },
  );
}

export async function updateBillingSubscription(
  subscriptionId: number,
  payload: BillingSubscriptionUpdatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}`,
    { ...options, method: "PATCH", body: payload },
  );
}

export async function updateBillingSubscriptionAddons(
  subscriptionId: number,
  payload: BillingAddonAssignmentsPayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/addons`,
    { ...options, method: "PUT", body: payload },
  );
}

export async function createBillingSubscriptionOverride(
  subscriptionId: number,
  payload: BillingOverrideCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingSubscription>> {
  return backendRequest<BaseResponse<BillingSubscription>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/overrides`,
    { ...options, method: "POST", body: payload },
  );
}

export async function deleteBillingSubscriptionOverride(
  subscriptionId: number,
  overrideId: number,
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/overrides/${overrideId}`,
    { ...options, method: "DELETE", body: { reason } },
  );
}

export async function getBillingInvoices(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingInvoice[]>> {
  return backendFetch<BaseResponse<BillingInvoice[]>>(`${PLATFORM_BILLING_PATH}/invoices`, options);
}

export async function createBillingInvoice(
  subscriptionId: number,
  payload: BillingInvoiceCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingInvoice>> {
  return backendRequest<BaseResponse<BillingInvoice>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/invoices`,
    { ...options, method: "POST", body: payload },
  );
}

export async function createBillingContractInvoice(
  subscriptionId: number,
  payload: BillingContractInvoiceCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingInvoice>> {
  return backendRequest<BaseResponse<BillingInvoice>>(
    `${PLATFORM_BILLING_PATH}/subscriptions/${subscriptionId}/invoices/from-contract`,
    { ...options, method: "POST", body: payload },
  );
}

export async function getBillingPayments(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPayment[]>> {
  return backendFetch<BaseResponse<BillingPayment[]>>(`${PLATFORM_BILLING_PATH}/payments`, options);
}

export async function createBillingPayment(
  invoiceId: number,
  payload: BillingPaymentCreatePayload,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPayment>> {
  return backendRequest<BaseResponse<BillingPayment>>(`${PLATFORM_BILLING_PATH}/invoices/${invoiceId}/payments`, {
    ...options,
    method: "POST",
    body: payload,
  });
}

export async function voidBillingInvoice(
  invoiceId: number,
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingInvoice>> {
  return backendRequest<BaseResponse<BillingInvoice>>(
    `${PLATFORM_BILLING_PATH}/invoices/${invoiceId}/void`,
    { ...options, method: "POST", body: { reason } },
  );
}

export async function reverseBillingPayment(
  paymentId: number,
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingPayment>> {
  return backendRequest<BaseResponse<BillingPayment>>(
    `${PLATFORM_BILLING_PATH}/payments/${paymentId}/reverse`,
    { ...options, method: "POST", body: { reason } },
  );
}

export async function getBillingMetrics(
  options: BackendClientOptions = {},
): Promise<BaseResponse<BillingMetrics>> {
  return backendFetch<BaseResponse<BillingMetrics>>(`${PLATFORM_BILLING_PATH}/metrics`, options);
}

export async function runBillingLifecycle(
  reason: string,
  options: BackendClientOptions = {},
): Promise<BaseResponse<Record<string, unknown>>> {
  return backendRequest<BaseResponse<Record<string, unknown>>>(
    `${PLATFORM_BILLING_PATH}/lifecycle/run`,
    { ...options, method: "POST", body: { reason } },
  );
}

export type HelpGuideSection = {
  title: string;
  body: string;
  bullets: string[];
};

export type HelpGuide = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  sections: HelpGuideSection[];
  estimated_minutes?: number | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
};

export type TutorialVideo = {
  id: number;
  title: string;
  description?: string | null;
  youtube_url: string;
  thumbnail_url?: string | null;
  is_main: boolean;
  category: string;
  duration_minutes?: number | null;
  sort_order: number;
  is_published: boolean;
};

export type HelpCenterSettings = {
  heading: string;
  subheading: string;
  support_message: string;
  whatsapp_number?: string | null;
  phone_number?: string | null;
  email?: string | null;
  support_hours?: string | null;
  feedback_enabled: boolean;
};

export type HelpCenter = {
  settings: HelpCenterSettings;
  guides: HelpGuide[];
  videos: TutorialVideo[];
};

export type HelpGuidePayload = Omit<HelpGuide, "id">;
export type TutorialVideoPayload = Omit<TutorialVideo, "id">;

const HELP_CENTER_ADMIN_PATH = "/admin/platform/help-center";

export function getHelpCenter(options: BackendClientOptions = {}) {
  return backendFetch<BaseResponse<HelpCenter>>(HELP_CENTER_ADMIN_PATH, options);
}

export function updateHelpCenterSettings(payload: HelpCenterSettings, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<HelpCenterSettings>>(`${HELP_CENTER_ADMIN_PATH}/settings`, {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export function createHelpGuide(payload: HelpGuidePayload, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<HelpGuide>>(`${HELP_CENTER_ADMIN_PATH}/guides`, {
    ...options,
    method: "POST",
    body: payload,
  });
}

export function updateHelpGuide(id: number, payload: Partial<HelpGuidePayload>, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<HelpGuide>>(`${HELP_CENTER_ADMIN_PATH}/guides/${id}`, {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export function deleteHelpGuide(id: number, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<null>>(`${HELP_CENTER_ADMIN_PATH}/guides/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function createTutorialVideo(payload: TutorialVideoPayload, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<TutorialVideo>>("/tutorial-videos", {
    ...options,
    method: "POST",
    body: payload,
  });
}

export function updateTutorialVideo(id: number, payload: Partial<TutorialVideoPayload>, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<TutorialVideo>>(`/tutorial-videos/${id}`, {
    ...options,
    method: "PUT",
    body: payload,
  });
}

export function deleteTutorialVideo(id: number, options: BackendClientOptions = {}) {
  return backendRequest<BaseResponse<Record<string, never>>>(`/tutorial-videos/${id}`, {
    ...options,
    method: "DELETE",
  });
}
