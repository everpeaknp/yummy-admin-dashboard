"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/Card";
import { getRestaurant, updateRestaurant, type BackendRestaurant, type RestaurantUpdatePayload } from "@/lib/backend-api";

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
  kot_enabled: boolean;
  tax_enabled: boolean;
};

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
  kot_enabled: true,
  tax_enabled: true,
};

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
    kot_enabled: Boolean(restaurant.kot_enabled),
    tax_enabled: Boolean(restaurant.tax_enabled),
  };
}

export default function RestaurantDetailPage() {
  const params = useParams();
  const restaurantId = Number(params.id);
  const [restaurant, setRestaurant] = useState<BackendRestaurant | null>(null);
  const [form, setForm] = useState<RestaurantFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  const serviceSummary = useMemo(
    () => [
      { label: "Restaurant", enabled: form.restaurant_enabled, color: "green" },
      { label: "Hotel", enabled: form.hotel_enabled, color: "blue" },
      { label: "KOT", enabled: form.kot_enabled, color: "orange" },
      { label: "Tax", enabled: form.tax_enabled, color: "teal" },
    ],
    [form.hotel_enabled, form.kot_enabled, form.restaurant_enabled, form.tax_enabled],
  );

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
      billing_mode: form.billing_mode,
      restaurant_enabled: form.restaurant_enabled,
      hotel_enabled: form.hotel_enabled,
      kot_enabled: form.kot_enabled,
      tax_enabled: form.tax_enabled,
    };

    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const response = await updateRestaurant(restaurant.id, payload, { token });
      setRestaurant(response.data);
      setForm(toFormState(response.data));
      setSuccess("Restaurant details saved successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save restaurant details");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#f5f7fa] p-6">
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">Loading restaurant details...</p>
        </Card>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex-1 bg-[#f5f7fa] p-6">
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
    <div className="flex-1 bg-[#f5f7fa] p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/dashboard/restaurants" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
            <span className="material-icons-round text-[18px]">arrow_back</span>
            Back to Restaurants
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-2xl font-bold text-orange-600">
              {restaurant.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{restaurant.name}</h1>
              <p className="mt-1 text-sm text-slate-500">{restaurant.address}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{restaurant.billing_mode}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{restaurant.plan_state}</span>
            <span className={`rounded-full px-3 py-1 ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>Restaurant</span>
            <span className={`rounded-full px-3 py-1 ${restaurant.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>Hotel</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveChanges}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-icons-round text-[18px]">save</span>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Restaurant Details</h2>
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

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Billing Status</h2>
          <p className="mt-1 text-sm text-slate-500">Switch the restaurant between paid and unpaid states.</p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <BillingToggle
              label="Paid"
              description="Full subscription active"
              active={form.billing_mode === "paid"}
              onClick={() => setForm((prev) => ({ ...prev, billing_mode: "paid" }))}
            />
            <BillingToggle
              label="Unpaid"
              description="Disable paid access / mark free"
              active={form.billing_mode === "free"}
              onClick={() => setForm((prev) => ({ ...prev, billing_mode: "free" }))}
            />
            <BillingToggle
              label="Trial"
              description="Trial paid access"
              active={form.billing_mode === "trial_paid"}
              onClick={() => setForm((prev) => ({ ...prev, billing_mode: "trial_paid" }))}
            />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Current billing mode</h3>
            <p className="mt-2 text-sm text-slate-600">{form.billing_mode}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Service Flags</h2>
          <p className="mt-1 text-sm text-slate-500">Enable or disable modules from one place.</p>

          <div className="mt-5 space-y-3">
            {serviceSummary.map((item) => (
              <ToggleRow
                key={item.label}
                label={item.label}
                enabled={item.enabled}
                onToggle={() => setForm((prev) => ({ ...prev, [toggleKeyForLabel(item.label)]: !prev[toggleKeyForLabel(item.label)] }))}
              />
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Current state</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider">
              <span className={`rounded-full px-3 py-1 ${form.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>Restaurant</span>
              <span className={`rounded-full px-3 py-1 ${form.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>Hotel</span>
              <span className={`rounded-full px-3 py-1 ${form.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>KOT</span>
              <span className={`rounded-full px-3 py-1 ${form.tax_enabled ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>Tax</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Read Only Details</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoBlock label="ID" value={restaurant.id} />
            <InfoBlock label="Registered By" value={restaurant.registered_by} />
            <InfoBlock label="Billing Mode" value={restaurant.billing_mode} />
            <InfoBlock label="Effective Plan" value={restaurant.effective_plan} />
            <InfoBlock label="Trial Ends" value={restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at).toLocaleString() : "-"} />
            <InfoBlock label="Paid Ends" value={restaurant.paid_ends_at ? new Date(restaurant.paid_ends_at).toLocaleString() : "-"} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-900">Checklist</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>{form.restaurant_enabled ? "Restaurant module is active." : "Restaurant module is disabled."}</p>
            <p>{form.hotel_enabled ? "Hotel module is active." : "Hotel module is disabled."}</p>
            <p>{form.kot_enabled ? "KOT is active." : "KOT is disabled."}</p>
            <p>{form.tax_enabled ? "Tax is active." : "Tax is disabled."}</p>
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

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{enabled ? "Enabled for this restaurant" : "Disabled for this restaurant"}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? "bg-orange-500" : "bg-slate-300"}`}
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

function BillingToggle({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}>
          {active ? "Selected" : "Set"}
        </span>
      </div>
    </button>
  );
}

function toggleKeyForLabel(label: string): keyof RestaurantFormState {
  if (label === "Restaurant") return "restaurant_enabled";
  if (label === "Hotel") return "hotel_enabled";
  if (label === "KOT") return "kot_enabled";
  return "tax_enabled";
}