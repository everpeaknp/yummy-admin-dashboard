"use client";

import { useEffect, useMemo, useState } from "react";
import { getRestaurants, type BackendRestaurant } from "@/lib/backend-api";

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-purple-100 text-purple-600",
  "bg-amber-100 text-amber-600",
  "bg-slate-200 text-slate-700",
];

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "trial", label: "Trial" },
  { key: "free", label: "Free" },
  { key: "expired", label: "Expired" },
  { key: "disabled", label: "Disabled" },
];

type BillingRow = {
  id: number;
  restaurant: string;
  restaurantId: string;
  avatar: string;
  avatarColor: string;
  planState: string;
  billingMode: string;
  expiresAtLabel: string;
  expiresAt: Date | null;
  statusLabel: string;
  statusKey: string;
};

type StatusInfo = {
  key: string;
  label: string;
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }
  return value.toLocaleDateString();
}

function resolveStatus(restaurant: BackendRestaurant, expiresAt: Date | null): StatusInfo {
  const billingMode = (restaurant.billing_mode || "").toLowerCase();
  const planState = (restaurant.plan_state || "").toLowerCase();
  const now = new Date();

  if (!restaurant.restaurant_enabled) {
    return { key: "disabled", label: "Disabled" };
  }

  if (expiresAt && expiresAt < now) {
    return { key: "expired", label: "Expired" };
  }

  if (planState.includes("trial") || billingMode === "trial_paid") {
    return { key: "trial", label: "Trial" };
  }

  if (billingMode === "paid") {
    return { key: "paid", label: "Paid" };
  }

  if (billingMode === "free") {
    return { key: "free", label: "Free" };
  }

  return { key: "unknown", label: "Unknown" };
}

function getExpiryDate(restaurant: BackendRestaurant) {
  return parseDate(restaurant.paid_ends_at || restaurant.trial_ends_at || null);
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRestaurants() {
      try {
        const token = window.localStorage.getItem("accessToken") || undefined;
        const response = await getRestaurants({ token });
        if (!isMounted) {
          return;
        }
        setRestaurants(response.data || []);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setRestaurants([]);
        setError(loadError instanceof Error ? loadError.message : "Failed to load billing data.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRestaurants();

    return () => {
      isMounted = false;
    };
  }, []);

  const billingRows = useMemo<BillingRow[]>(() => {
    return restaurants.map((restaurant, index) => {
      const expiresAt = getExpiryDate(restaurant);
      const status = resolveStatus(restaurant, expiresAt);

      return {
        id: restaurant.id,
        restaurant: restaurant.name,
        restaurantId: `#${String(restaurant.id).padStart(5, "0")}`,
        avatar: (restaurant.name || "R").charAt(0).toUpperCase(),
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        planState: titleCase(restaurant.plan_state || restaurant.billing_mode || "unknown"),
        billingMode: titleCase(restaurant.billing_mode || "unknown"),
        expiresAtLabel: formatDate(expiresAt),
        expiresAt,
        statusLabel: status.label,
        statusKey: status.key,
      };
    });
  }, [restaurants]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return billingRows.filter((row) => {
      if (activeTab !== "all" && row.statusKey !== activeTab) {
        return false;
      }
      if (!query) {
        return true;
      }
      return row.restaurant.toLowerCase().includes(query);
    });
  }, [activeTab, billingRows, searchQuery]);

  const stats = useMemo(() => {
    const paid = billingRows.filter((row) => row.statusKey === "paid").length;
    const trial = billingRows.filter((row) => row.statusKey === "trial").length;
    const free = billingRows.filter((row) => row.statusKey === "free").length;
    const active = paid + trial;
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 14);
    const expiringSoon = billingRows.filter(
      (row) => row.expiresAt && row.expiresAt >= now && row.expiresAt <= soon,
    ).length;

    return [
      { label: "Active Plans", value: active, note: "Live", tone: "good" },
      { label: "Paid Plans", value: paid, note: "Live", tone: "good" },
      { label: "Trial Plans", value: trial, note: "Live", tone: "neutral" },
      { label: "Expiring Soon", value: expiringSoon, note: "Next 14 days", tone: "warn" },
      { label: "Free Plans", value: free, note: "Live", tone: "neutral" },
    ];
  }, [billingRows]);

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa]">
      {/* Header */}
      <header className="bg-white px-8 py-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments Monitoring</h1>
            <p className="text-sm text-slate-500 mt-1">Track billing status from live restaurant plans</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
            />
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors relative">
              <span className="material-icons-round text-slate-600 text-[20px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        {stats.map((stat) => {
          const toneClass =
            stat.tone === "good"
              ? "bg-green-50 text-green-600"
              : stat.tone === "warn"
              ? "bg-amber-50 text-amber-700"
              : "bg-blue-50 text-blue-600";

          return (
            <div key={stat.label} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${toneClass}`}>
                  {stat.note}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Restaurant</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Plan State</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Billing Mode</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Expires</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td className="py-6 text-sm text-slate-500" colSpan={6}>
                    Loading billing status...
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm ${row.avatarColor}`}
                        >
                          {row.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {row.restaurant}
                          </p>
                          <p className="text-xs text-slate-500">{row.restaurantId}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-700">{row.planState}</p>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-700">{row.billingMode}</p>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-600">{row.expiresAtLabel}</p>
                    </td>

                    <td className="py-4">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          row.statusKey === "paid"
                            ? "bg-green-100 text-green-700"
                            : row.statusKey === "trial"
                            ? "bg-blue-100 text-blue-700"
                            : row.statusKey === "expired"
                            ? "bg-red-100 text-red-700"
                            : row.statusKey === "disabled"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    <td className="py-4">
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors">
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-sm text-slate-500" colSpan={6}>
                    No billing records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}