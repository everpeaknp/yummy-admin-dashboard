"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import RestaurantAvatar from "@/components/RestaurantAvatar";
import RestaurantSubscriptionCard from "@/components/RestaurantSubscriptionCard";
import {
  getRestaurant,
  updateRestaurant,
  updateRestaurantAttendanceEntitlement,
  type BackendRestaurant,
  type RestaurantUpdatePayload,
} from "@/lib/backend-api";
import { canManageRestaurants, getStoredAuthSession } from "@/lib/auth";

type RestaurantFormState = {
  name: string;
  address: string;
  phone: string;
  description: string;
  pan_number: string;
  timezone: string;
  local_pos_ip: string;
  billing_mode: "paid" | "free" | "trial_paid";
  restaurant_enabled: boolean;
  hotel_enabled: boolean;
  finance_reports_enabled: boolean;
  finance_accounting_enabled: boolean;
  kot_enabled: boolean;
  tax_enabled: boolean;
  trial_ends_at: string;
  paid_ends_at: string;
};

type AttendanceFormState = {
  attendance_enabled: boolean;
  attendance_mobile_enabled: boolean;
  attendance_biometric_enabled: boolean;
  attendance_device_limit: string;
  attendance_trial_ends_at: string;
  attendance_ends_at: string;
};

type OperationalFlagKey =
  | "restaurant_enabled"
  | "hotel_enabled"
  | "finance_reports_enabled"
  | "finance_accounting_enabled"
  | "kot_enabled"
  | "tax_enabled";

const emptyForm: RestaurantFormState = {
  name: "",
  address: "",
  phone: "",
  description: "",
  pan_number: "",
  timezone: "UTC",
  local_pos_ip: "",
  billing_mode: "paid",
  restaurant_enabled: true,
  hotel_enabled: false,
  finance_reports_enabled: true,
  finance_accounting_enabled: true,
  kot_enabled: true,
  tax_enabled: true,
  trial_ends_at: "",
  paid_ends_at: "",
};

const emptyAttendanceForm: AttendanceFormState = {
  attendance_enabled: false,
  attendance_mobile_enabled: false,
  attendance_biometric_enabled: false,
  attendance_device_limit: "0",
  attendance_trial_ends_at: "",
  attendance_ends_at: "",
};

function formatDateTimeInput(value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(value: string) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function toFormState(restaurant: BackendRestaurant): RestaurantFormState {
  return {
    name: restaurant.name || "",
    address: restaurant.address || "",
    phone: restaurant.phone || "",
    description: restaurant.description || "",
    pan_number: restaurant.pan_number || "",
    timezone: restaurant.timezone || "UTC",
    local_pos_ip: restaurant.local_pos_ip || "",
    billing_mode: (restaurant.billing_mode as RestaurantFormState["billing_mode"]) || "paid",
    restaurant_enabled: Boolean(restaurant.restaurant_enabled),
    hotel_enabled: Boolean(restaurant.hotel_enabled),
    finance_reports_enabled: restaurant.finance_reports_enabled !== false,
    finance_accounting_enabled: restaurant.finance_accounting_enabled !== false,
    kot_enabled: Boolean(restaurant.kot_enabled),
    tax_enabled: Boolean(restaurant.tax_enabled),
    trial_ends_at: formatDateTimeInput(restaurant.trial_ends_at),
    paid_ends_at: formatDateTimeInput(restaurant.paid_ends_at),
  };
}

function toAttendanceFormState(restaurant: BackendRestaurant): AttendanceFormState {
  return {
    attendance_enabled: Boolean(restaurant.attendance_enabled),
    attendance_mobile_enabled: Boolean(restaurant.attendance_mobile_enabled),
    attendance_biometric_enabled: Boolean(restaurant.attendance_biometric_enabled),
    attendance_device_limit: String(restaurant.attendance_device_limit ?? 0),
    attendance_trial_ends_at: formatDateTimeInput(restaurant.attendance_trial_ends_at),
    attendance_ends_at: formatDateTimeInput(restaurant.attendance_ends_at),
  };
}

export default function RestaurantDetailPage() {
  const params = useParams();
  const restaurantId = Number(params.id);
  const [restaurant, setRestaurant] = useState<BackendRestaurant | null>(null);
  const [form, setForm] = useState<RestaurantFormState>(emptyForm);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>(emptyAttendanceForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [billingV2Available, setBillingV2Available] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRestaurant() {
      if (!Number.isFinite(restaurantId)) {
        setError("Invalid restaurant id.");
        setIsLoading(false);
        return;
      }

      try {
        const token = window.localStorage.getItem("accessToken") || undefined;
        const response = await getRestaurant(restaurantId, { token });
        if (!active) {
          return;
        }
        setRestaurant(response.data);
        setForm(toFormState(response.data));
        setAttendanceForm(toAttendanceFormState(response.data));
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setRestaurant(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load restaurant details");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  const saveChanges = async () => {
    if (!restaurant) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const payload: RestaurantUpdatePayload = {
      name: form.name,
      address: form.address,
      phone: form.phone,
      description: form.description,
      pan_number: form.pan_number,
      timezone: form.timezone,
      local_pos_ip: form.local_pos_ip,
    };

    if (billingV2Available === false) {
      payload.billing_mode = form.billing_mode;
      const trialEndsAt = toIsoString(form.trial_ends_at);
      const paidEndsAt = toIsoString(form.paid_ends_at);
      if (trialEndsAt) {
        payload.trial_ends_at = trialEndsAt;
      }
      if (paidEndsAt) {
        payload.paid_ends_at = paidEndsAt;
      }
    }

    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const response = await updateRestaurant(restaurant.id, payload, { token });
      setRestaurant(response.data);
      setForm(toFormState(response.data));
      setAttendanceForm(toAttendanceFormState(response.data));
      setSuccess("Restaurant details saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save restaurant details");
    } finally {
      setIsSaving(false);
    }
  };

  const saveOperationalChanges = async () => {
    if (!restaurant) return;
    if (!canManageRestaurants(getStoredAuthSession())) {
      setError("You do not have permission to manage operational availability.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const response = await updateRestaurant(restaurant.id, {
        restaurant_enabled: form.restaurant_enabled,
        hotel_enabled: form.hotel_enabled,
        finance_reports_enabled: form.finance_reports_enabled,
        finance_accounting_enabled: form.finance_accounting_enabled,
        kot_enabled: form.kot_enabled,
        tax_enabled: form.tax_enabled,
      }, { token });
      setRestaurant(response.data);
      setForm(toFormState(response.data));
      setSuccess("Operational availability saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save operational availability.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveAttendanceEntitlement = async () => {
    if (!restaurant) return;
    if (!canManageRestaurants(getStoredAuthSession())) {
      setError("You do not have permission to manage attendance entitlement.");
      return;
    }

    const deviceLimit = Number.parseInt(attendanceForm.attendance_device_limit || "0", 10);
    if (!Number.isFinite(deviceLimit) || deviceLimit < 0) {
      setError("Attendance device limit must be zero or greater.");
      return;
    }

    setIsSavingAttendance(true);
    setError(null);
    setSuccess(null);

    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const response = await updateRestaurantAttendanceEntitlement(
        restaurant.id,
        {
          attendance_enabled: attendanceForm.attendance_enabled,
          attendance_mobile_enabled: attendanceForm.attendance_mobile_enabled,
          attendance_biometric_enabled: attendanceForm.attendance_biometric_enabled,
          attendance_device_limit: deviceLimit,
          attendance_trial_ends_at: toIsoString(attendanceForm.attendance_trial_ends_at),
          attendance_ends_at: toIsoString(attendanceForm.attendance_ends_at),
        },
        { token },
      );
      setRestaurant(response.data);
      setAttendanceForm(toAttendanceFormState(response.data));
      setSuccess("Attendance entitlement updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update attendance entitlement");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const saveBillingMode = async (mode: RestaurantFormState["billing_mode"]) => {
    if (!restaurant) return;
    if (!canManageRestaurants(getStoredAuthSession())) {
      setError("You do not have permission to manage billing modes.");
      return;
    }

    // Immediate feedback.
    setForm((prev) => ({ ...prev, billing_mode: mode }));
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const response = await updateRestaurant(restaurant.id, { billing_mode: mode }, { token });
      setRestaurant(response.data);
      setForm((prev) => ({
        ...prev,
        billing_mode: (response.data.billing_mode as RestaurantFormState["billing_mode"]) || mode,
      }));
      setAttendanceForm(toAttendanceFormState(response.data));
      setSuccess("Billing status updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update billing status");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#f5f7fa] p-4 sm:p-6">
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">Loading restaurant details...</p>
        </Card>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex-1 bg-[#f5f7fa] p-4 sm:p-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Restaurant not found</h1>
          <p className="mt-2 text-sm text-slate-500">The backend did not return a restaurant for this id.</p>
          <Link href="/dashboard/restaurants" className="mt-5 inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold">
            <span className="material-icons-round text-[20px]">arrow_back</span>
            Back to Restaurants
          </Link>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#f5f7fa] p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/dashboard/restaurants" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
            <span className="material-icons-round text-[18px]">arrow_back</span>
            Back to Restaurants
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <RestaurantAvatar
              name={restaurant.name}
              src={restaurant.profile_picture || restaurant.cover_photo || null}
              size={64}
              className="rounded-2xl"
            />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{restaurant.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{restaurant.address}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider">
            {(() => {
              const isTrialExpired = restaurant.plan_state === "trial_expired" || 
                (restaurant.billing_mode === "trial_paid" && restaurant.trial_ends_at && new Date(restaurant.trial_ends_at).getTime() < new Date().getTime());
              
              return (
                <>
                  <span className={`rounded-full px-3 py-1 ${isTrialExpired ? "bg-slate-100 text-slate-600" : "bg-slate-100 text-slate-600"}`}>
                    {isTrialExpired ? "free" : restaurant.billing_mode}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                    {isTrialExpired ? "trial_expired" : restaurant.plan_state}
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManageRestaurants(getStoredAuthSession()) && (
            <Link
              href={`/dashboard/restaurants/${restaurant.id}/menu-import`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span className="material-icons-round text-[18px]">upload_file</span>
              Import menu
            </Link>
          )}
          {canManageRestaurants(getStoredAuthSession()) && (
            <Link
              href={`/dashboard/restaurants/${restaurant.id}/compliance`}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
            >
              <span className="material-icons-round text-[18px]">verified</span>
              IRD / CBMS compliance
            </Link>
          )}
          {canManageRestaurants(getStoredAuthSession()) && (
            <button
              type="button"
              onClick={saveChanges}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-icons-round text-[18px]">save</span>
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Restaurant details</h2>
          <p className="mt-1 text-sm text-slate-500">Edit the core profile data shown throughout the dashboard.</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Restaurant Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
            <Field label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
            <Field label="Address" value={form.address} onChange={(value) => setForm((prev) => ({ ...prev, address: value }))} className="md:col-span-2" />
            <Field label="Timezone" value={form.timezone} onChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))} />
            <Field label="PAN Number" value={form.pan_number} onChange={(value) => setForm((prev) => ({ ...prev, pan_number: value }))} />
            <Field label="Local POS IP" value={form.local_pos_ip} onChange={(value) => setForm((prev) => ({ ...prev, local_pos_ip: value }))} />
            <Field label="Description" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} className="md:col-span-2" textarea />
          </div>
        </Card>

        <Card className="border-dashed bg-slate-50 p-6">
          <h2 className="text-lg font-bold text-slate-900">Access is managed by the plan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Plan features and restaurant exceptions appear below. Operational pauses are kept separate so they cannot be mistaken for the restaurant's subscription.</p>
        </Card>

        <RestaurantSubscriptionCard
          restaurant={restaurant}
          legacyMode={form.billing_mode}
          legacyTrialEndsAt={form.trial_ends_at}
          legacyPaidEndsAt={form.paid_ends_at}
          legacySaving={isSaving}
          canManageLegacy={canManageRestaurants(getStoredAuthSession())}
          onLegacyModeChange={saveBillingMode}
          onLegacyTrialEndsAtChange={(value) => setForm((prev) => ({ ...prev, trial_ends_at: value }))}
          onLegacyPaidEndsAtChange={(value) => setForm((prev) => ({ ...prev, paid_ends_at: value }))}
          onV2AvailabilityChange={setBillingV2Available}
        />

        <OperationalAvailabilityCard
          values={form}
          canManage={canManageRestaurants(getStoredAuthSession())}
          saving={isSaving}
          onToggle={(key) => setForm((prev) => ({ ...prev, [key]: !prev[key] }))}
          onSave={() => void saveOperationalChanges()}
        />

        {billingV2Available === false ? <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Legacy Attendance Add-on</h2>
              <p className="mt-1 text-sm text-slate-500">
                Compatibility controls shown only because Subscription V2 is unavailable.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${attendanceForm.attendance_enabled ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"}`}>
              {attendanceForm.attendance_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <ToggleRow
              label="Attendance add-on"
              enabled={attendanceForm.attendance_enabled}
              onToggle={() => setAttendanceForm((prev) => ({ ...prev, attendance_enabled: !prev.attendance_enabled }))}
            />
            <ToggleRow
              label="Mobile QR clocking"
              enabled={attendanceForm.attendance_mobile_enabled}
              onToggle={() => setAttendanceForm((prev) => ({ ...prev, attendance_mobile_enabled: !prev.attendance_mobile_enabled }))}
            />
            <ToggleRow
              label="Biometric devices"
              enabled={attendanceForm.attendance_biometric_enabled}
              onToggle={() => setAttendanceForm((prev) => ({ ...prev, attendance_biometric_enabled: !prev.attendance_biometric_enabled }))}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Biometric device limit</span>
              <input
                type="number"
                min={0}
                value={attendanceForm.attendance_device_limit}
                onChange={(event) =>
                  setAttendanceForm((prev) => ({ ...prev, attendance_device_limit: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
              />
              <p className="mt-2 text-xs text-slate-500">Set 0 to block biometric device pairing.</p>
            </label>
            <DateTimeField
              label="Attendance trial ends at"
              value={attendanceForm.attendance_trial_ends_at}
              onChange={(value) => setAttendanceForm((prev) => ({ ...prev, attendance_trial_ends_at: value }))}
              helper="Optional trial expiry for attendance add-on only."
            />
            <DateTimeField
              label="Attendance paid ends at"
              value={attendanceForm.attendance_ends_at}
              onChange={(value) => setAttendanceForm((prev) => ({ ...prev, attendance_ends_at: value }))}
              helper="Optional paid entitlement expiry for attendance add-on only."
            />
          </div>

          <button
            type="button"
            onClick={saveAttendanceEntitlement}
            disabled={isSavingAttendance || !canManageRestaurants(getStoredAuthSession())}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-icons-round text-[18px]">fingerprint</span>
            {isSavingAttendance ? "Saving attendance..." : "Save Attendance Add-on"}
          </button>
        </Card> : null}
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Restaurant record</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoBlock label="ID" value={restaurant.id} />
            <InfoBlock label="Registered By" value={restaurant.registered_by} />
            <InfoBlock label="Billing Mode" value={restaurant.billing_mode} />
            <InfoBlock label="Effective Plan" value={restaurant.effective_plan} />
            <InfoBlock label="Trial Ends" value={restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at).toLocaleString() : "-"} />
            <InfoBlock label="Paid Ends" value={restaurant.paid_ends_at ? new Date(restaurant.paid_ends_at).toLocaleString() : "-"} />
            <InfoBlock label="Attendance Trial Ends" value={restaurant.attendance_trial_ends_at ? new Date(restaurant.attendance_trial_ends_at).toLocaleString() : "-"} />
            <InfoBlock label="Attendance Ends" value={restaurant.attendance_ends_at ? new Date(restaurant.attendance_ends_at).toLocaleString() : "-"} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  textarea?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
        />
      )}
    </label>
  );
}

function OperationalAvailabilityCard({
  values,
  canManage,
  saving,
  onToggle,
  onSave,
}: {
  values: Pick<RestaurantFormState, OperationalFlagKey>;
  canManage: boolean;
  saving: boolean;
  onToggle: (key: OperationalFlagKey) => void;
  onSave: () => void;
}) {
  const controls: Array<{ key: OperationalFlagKey; label: string; description: string }> = [
    { key: "restaurant_enabled", label: "Restaurant workspace", description: "Pause the main restaurant workspace for this outlet." },
    { key: "hotel_enabled", label: "Hotel module", description: "Keep Hotel unavailable until the property is ready to operate it." },
    { key: "finance_reports_enabled", label: "Finance reports", description: "Pause legacy finance reporting access for this outlet." },
    { key: "finance_accounting_enabled", label: "Finance accounting", description: "Pause the legacy accounting module where it still applies." },
    { key: "kot_enabled", label: "Kitchen KOT", description: "Pause kitchen ticket generation while the kitchen is not operating." },
    { key: "tax_enabled", label: "Tax", description: "Pause tax handling for this outlet." },
  ];
  const paused = controls.filter((control) => !values[control.key]).length;

  return (
    <Card className="overflow-hidden xl:col-span-3">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 sm:px-7">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Operational availability</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Use only to pause a module for setup, maintenance, or an emergency. This does not change the restaurant's plan.</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${paused ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{paused ? `${paused} paused` : "No pauses"}</span>
        </summary>
        <div className="border-t border-slate-200 px-6 py-5 sm:px-7">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">A plan can include a feature while this operational control keeps it unavailable. Use plan exceptions above for commercial access; use these switches only for a temporary operational pause.</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {controls.map((control) => <ToggleRow key={control.key} label={control.label} description={control.description} enabled={values[control.key]} disabled={!canManage || saving} onToggle={() => onToggle(control.key)} />)}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs leading-5 text-slate-500">Operational changes save separately from restaurant profile details.</p>
            {canManage ? <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving availability…" : "Save operational changes"}</button> : <p className="text-xs text-slate-500">You do not have permission to change availability.</p>}
          </div>
        </div>
      </details>
    </Card>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400"
      />
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  disabled = false,
  onToggle,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description || (enabled ? "Available for this restaurant" : "Paused for this restaurant")}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${enabled ? "Pause" : "Make available"} ${label}`}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? "bg-orange-500" : "bg-slate-300"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
