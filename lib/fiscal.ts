import type { BaseResponse } from "@/lib/backend-api";

export type FiscalRegistrationType = "unverified" | "pan_only" | "vat";
export type FiscalBillingMode = "legacy_flexible" | "pan_invoice" | "vat_external" | "vat_ebilling";
export type FiscalComplianceStatus =
  | "unverified"
  | "setup_required"
  | "pending_ird"
  | "ready_for_activation"
  | "active"
  | "suspended";
export type CbmsEnvironment = "test" | "production";

export type FiscalReadiness = { is_ready: boolean; blockers: string[] };

export type FiscalProfile = {
  id: number;
  restaurant_id: number;
  registration_type: FiscalRegistrationType;
  fiscal_billing_mode: FiscalBillingMode;
  compliance_status: FiscalComplianceStatus;
  legal_name: string | null;
  registered_address: string | null;
  seller_pan: string | null;
  ird_software_listing_number: string | null;
  ird_permission_number: string | null;
  ird_permission_date: string | null;
  approved_software_name: string | null;
  approved_software_version: string | null;
  abbreviated_invoice_approved: boolean;
  cloud_agreement_reference: string | null;
  next_invoice_seed: number;
  activation_effective_at: string | null;
  readiness: FiscalReadiness;
};

export type FiscalProfileDraft = {
  registration_type: FiscalRegistrationType;
  fiscal_billing_mode: FiscalBillingMode;
  legal_name?: string | null;
  registered_address?: string | null;
  seller_pan?: string | null;
  ird_software_listing_number?: string | null;
  ird_permission_number?: string | null;
  ird_permission_date?: string | null;
  approved_software_name?: string | null;
  approved_software_version?: string | null;
  abbreviated_invoice_approved?: boolean;
  cloud_agreement_reference?: string | null;
  next_invoice_seed?: number;
  activation_effective_at?: string | null;
};

export type FiscalValidationResult = FiscalReadiness & { profile?: FiscalProfile };

export type CbmsConfig = {
  username: string | null;
  environment: CbmsEnvironment;
  realtime_required: boolean;
  has_password: boolean;
  last_tested_at: string | null;
  last_test_result: string | null;
};

export type CbmsConfigInput = {
  username: string;
  password?: string;
  environment: CbmsEnvironment;
  realtime_required: boolean;
};

export type CbmsStatus = {
  configured?: boolean;
  environment?: CbmsEnvironment;
  realtime_required?: boolean;
  has_password?: boolean;
  username?: string | null;
  last_success_at?: string | null;
  last_failure_message?: string | null;
  pending_count?: number;
  failed_count?: number;
  config?: CbmsConfig | null;
};

export const REGISTRATION_LABELS: Record<FiscalRegistrationType, string> = {
  unverified: "Unverified",
  pan_only: "PAN only",
  vat: "VAT registered",
};

export const BILLING_MODE_LABELS: Record<FiscalBillingMode, string> = {
  legacy_flexible: "Legacy flexible receipt",
  pan_invoice: "PAN invoice",
  vat_external: "VAT with external invoicing",
  vat_ebilling: "Yummy VAT e-billing",
};

export const STATUS_LABELS: Record<FiscalComplianceStatus, string> = {
  unverified: "Unverified",
  setup_required: "Setup required",
  pending_ird: "Pending IRD",
  ready_for_activation: "Ready for activation",
  active: "Active",
  suspended: "Suspended",
};

function query(restaurantId: number) {
  return `?restaurant_id=${encodeURIComponent(String(restaurantId))}`;
}

function unwrap<T>(body: BaseResponse<T> | T): T {
  if (body && typeof body === "object" && "data" in body && "status" in body) {
    return (body as BaseResponse<T>).data;
  }
  return body as T;
}

async function request<T>(
  path: string,
  restaurantId: number,
  options: { method?: "PUT" | "POST"; body?: unknown; token?: string } = {},
): Promise<T> {
  const base = "/api/backend";
  const response = await fetch(`${base}${path}${query(restaurantId)}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    cache: "no-store",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (body && typeof body.message === "string" && body.message) ||
      (typeof body.detail === "string" && body.detail) ||
      `Request failed with status ${response.status}`;
    throw new Error(`[${response.status}] ${message}`);
  }
  return unwrap<T>(body);
}

export const fiscalApi = {
  getProfile(restaurantId: number, token?: string) {
    return request<FiscalProfile | null>("/fiscal/profile", restaurantId, { token });
  },
  async getProfileOrLegacy(restaurantId: number, token?: string) {
    try {
      return await this.getProfile(restaurantId, token);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) return null;
      throw error;
    }
  },
  updateProfile(restaurantId: number, payload: FiscalProfileDraft, token?: string) {
    return request<FiscalProfile>("/fiscal/profile", restaurantId, { method: "PUT", body: payload, token });
  },
  validateProfile(restaurantId: number, token?: string) {
    return request<FiscalValidationResult>("/fiscal/profile/validate", restaurantId, { method: "POST", body: {}, token });
  },
  activateProfile(restaurantId: number, token?: string) {
    return request<FiscalProfile>("/fiscal/profile/activate", restaurantId, { method: "POST", body: {}, token });
  },
  async getCbmsStatus(restaurantId: number, token?: string) {
    return request<CbmsStatus>("/fiscal/cbms/status", restaurantId, { token });
  },
  updateCbmsConfig(restaurantId: number, payload: CbmsConfigInput, token?: string) {
    return request<CbmsConfig>("/fiscal/cbms/config", restaurantId, { method: "PUT", body: payload, token });
  },
  reconcileCbms(restaurantId: number, token?: string) {
    return request<CbmsStatus>("/fiscal/cbms/reconcile", restaurantId, { method: "POST", body: {}, token });
  },
};
