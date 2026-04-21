"use client";

import { useEffect, useMemo, useState } from "react";
import { getRestaurants, type BackendRestaurant } from "@/lib/backend-api";
import RestaurantAvatar from "@/components/RestaurantAvatar";

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
  logoSrc?: string | null;
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
    return restaurants.map((restaurant) => {
      const expiresAt = getExpiryDate(restaurant);
      const status = resolveStatus(restaurant, expiresAt);

      return {
        id: restaurant.id,
        restaurant: restaurant.name,
        restaurantId: `#${String(restaurant.id).padStart(5, "0")}`,
        logoSrc: restaurant.profile_picture || restaurant.cover_photo || null,
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

  const statusBadgeClass = (statusKey: string) => {
    if (statusKey === "paid") {
      return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-200";
    }
    if (statusKey === "trial") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
    }
    if (statusKey === "expired") {
      return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200";
    }
    if (statusKey === "disabled") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
    }
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200";
  };

  const statPillClass = (tone: string) => {
    if (tone === "good") {
      return "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-200";
    }
    if (tone === "warn") {
      return "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200";
    }
    return "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa] dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payments Monitoring</h1>
            <p className="text-sm text-slate-500 dark:text-gray-300 mt-1">Track billing status from live restaurant plans</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-64 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors relative dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600/70">
              <span className="material-icons-round text-slate-600 dark:text-gray-200 text-[20px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 space-y-6">

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        {stats.map((stat) => {
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-transparent dark:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs text-slate-500 dark:text-gray-300">{stat.label}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${statPillClass(stat.tone)}`}>
                  {stat.note}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-transparent dark:border-gray-700 transition-colors">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600/70"
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
              <tr className="border-b border-slate-200 dark:border-gray-700">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Restaurant</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Plan State</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Billing Mode</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Expires</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-gray-300 uppercase tracking-wider pb-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td className="py-6 text-sm text-slate-500 dark:text-gray-300" colSpan={6}>
                    Loading billing status...
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/40 transition"
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <RestaurantAvatar name={row.restaurant} src={row.logoSrc} size={40} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {row.restaurant}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-gray-300">{row.restaurantId}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-700 dark:text-gray-200">{row.planState}</p>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-700 dark:text-gray-200">{row.billingMode}</p>
                    </td>

                    <td className="py-4">
                      <p className="text-sm text-slate-600 dark:text-gray-300">{row.expiresAtLabel}</p>
                    </td>

                    <td className="py-4">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${statusBadgeClass(row.statusKey)}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>

                    <td className="py-4">
                      <button className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors">
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-sm text-slate-500 dark:text-gray-300" colSpan={6}>
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
