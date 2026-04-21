"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  getPlatformDashboard,
  getRestaurants,
  type BackendRestaurant,
  type PlatformDashboardResponse,
} from "@/lib/backend-api";

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-600",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-purple-100 text-purple-600",
  "bg-amber-100 text-amber-600",
  "bg-slate-200 text-slate-700",
];

type SubscriptionRow = {
  id: number;
  restaurant: string;
  restaurantId: string;
  statusLabel: string;
  statusColor: "green" | "yellow" | "red" | "slate";
  planType: string;
  planState: string;
  expiryDate: string;
  avatar: string;
  avatarColor: string;
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

function getExpiryDate(restaurant: BackendRestaurant) {
  return parseDate(restaurant.paid_ends_at || restaurant.trial_ends_at || null);
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
    return { key: "paid", label: "Active" };
  }

  if (billingMode === "free") {
    return { key: "free", label: "Free" };
  }

  return { key: "unknown", label: "Unknown" };
}

function getStatusColor(statusKey: string): "green" | "yellow" | "red" | "slate" {
  if (statusKey === "paid") {
    return "green";
  }
  if (statusKey === "trial") {
    return "yellow";
  }
  if (statusKey === "expired" || statusKey === "disabled") {
    return "red";
  }
  if (statusKey === "free") {
    return "slate";
  }
  return "slate";
}

function getPlanType(restaurant: BackendRestaurant) {
  const source = (restaurant.billing_mode || restaurant.plan_state || "unknown").toLowerCase();
  if (source.includes("trial")) {
    return "TRIAL";
  }
  if (source.includes("free")) {
    return "FREE";
  }
  if (source.includes("paid")) {
    return "PAID";
  }
  return source.toUpperCase();
}

export default function SubscriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    planName: "",
    monthlyPrice: "",
    description: "",
    branches: "1",
    features: {
      restaurantLocations: true,
      inventoryManagement: true,
      advancedAnalytics: false,
      support247: false,
      apiAccess: false,
      multiUserAccess: false
    }
  });

  const handleFeatureToggle = (feature: keyof typeof formData.features) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature]
      }
    }));
  };

  const handleSubmit = () => {
    // Handle form submission
    console.log("Creating plan:", formData);
    setShowCreateModal(false);
    // Reset form
    setFormData({
      planName: "",
      monthlyPrice: "",
      description: "",
      branches: "1",
      features: {
        restaurantLocations: true,
        inventoryManagement: true,
        advancedAnalytics: false,
        support247: false,
        apiAccess: false,
        multiUserAccess: false
      }
    });
  };

  useEffect(() => {
    let alive = true;

    async function loadData() {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const [restaurantsResult, dashboardResult] = await Promise.allSettled([
        getRestaurants({ token }),
        getPlatformDashboard({ token }),
      ]);

      if (!alive) {
        return;
      }

      if (restaurantsResult.status === "fulfilled") {
        setRestaurants(restaurantsResult.value.data || []);
        setError(null);
      } else {
        setRestaurants([]);
        setError("Failed to load restaurant subscriptions.");
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value.data);
      }

      setIsLoading(false);
    }

    loadData();

    return () => {
      alive = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const total = restaurants.length;
    const paid = restaurants.filter((restaurant) => (restaurant.billing_mode || "").toLowerCase() === "paid").length;
    const trial = restaurants.filter((restaurant) => {
      const planState = (restaurant.plan_state || "").toLowerCase();
      return planState.includes("trial") || (restaurant.billing_mode || "").toLowerCase() === "trial_paid";
    }).length;
    const free = restaurants.filter((restaurant) => (restaurant.billing_mode || "").toLowerCase() === "free").length;
    const active = paid + trial;
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 14);
    const expiringSoon = restaurants.filter((restaurant) => {
      const expiry = getExpiryDate(restaurant);
      return expiry && expiry >= now && expiry <= soon;
    }).length;

    const restaurantEnabled = restaurants.filter((restaurant) => restaurant.restaurant_enabled).length;
    const hotelEnabled = restaurants.filter((restaurant) => restaurant.hotel_enabled).length;
    const kotEnabled = restaurants.filter((restaurant) => restaurant.kot_enabled).length;
    const taxEnabled = restaurants.filter((restaurant) => restaurant.tax_enabled).length;

    return {
      total,
      paid,
      trial,
      free,
      active,
      expiringSoon,
      restaurantEnabled,
      hotelEnabled,
      kotEnabled,
      taxEnabled,
    };
  }, [restaurants]);

  const subscriptionRows = useMemo<SubscriptionRow[]>(() => {
    return restaurants.map((restaurant, index) => {
      const expiry = getExpiryDate(restaurant);
      const status = resolveStatus(restaurant, expiry);

      return {
        id: restaurant.id,
        restaurant: restaurant.name,
        restaurantId: `#${String(restaurant.id).padStart(5, "0")}`,
        statusLabel: status.label,
        statusColor: getStatusColor(status.key),
        planType: getPlanType(restaurant),
        planState: titleCase(restaurant.plan_state || restaurant.billing_mode || "unknown"),
        expiryDate: formatDate(expiry),
        avatar: (restaurant.name || "R").charAt(0).toUpperCase(),
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      };
    });
  }, [restaurants]);

  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return subscriptionRows.filter((sub) => {
      if (!query) {
        return true;
      }
      return sub.restaurant.toLowerCase().includes(query);
    });
  }, [searchQuery, subscriptionRows]);

  const chartData = useMemo(() => {
    return dashboard?.monthly_growth.map((item) => ({
      month: item.label,
      value: item.value,
    })) || [];
  }, [dashboard]);

  const planMix = useMemo(() => {
    const total = metrics.paid + metrics.trial + metrics.free;
    return [
      { label: "Paid", value: metrics.paid, color: "#f97316" },
      { label: "Trial", value: metrics.trial, color: "#fbbf24" },
      { label: "Free", value: metrics.free, color: "#e5e7eb" },
    ].map((item) => ({
      ...item,
      percent: total ? Math.round((item.value / total) * 100) : 0,
    }));
  }, [metrics.free, metrics.paid, metrics.trial]);

  const donutSegments = useMemo(() => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return planMix.map((item) => {
      const length = circumference * (item.percent / 100);
      const segment = {
        ...item,
        dasharray: `${length} ${circumference}`,
        dashoffset: -offset,
      };
      offset += length;
      return segment;
    });
  }, [planMix]);

  const attentionItems = useMemo(() => {
    return restaurants
      .filter((restaurant) => !restaurant.restaurant_enabled || !restaurant.hotel_enabled || !restaurant.kot_enabled)
      .slice(0, 4)
      .map((restaurant) => {
        const missing: string[] = [];
        if (!restaurant.restaurant_enabled) {
          missing.push("restaurant disabled");
        }
        if (!restaurant.hotel_enabled) {
          missing.push("hotel off");
        }
        if (!restaurant.kot_enabled) {
          missing.push("kot off");
        }
        return {
          id: restaurant.id,
          name: restaurant.name,
          summary: missing.length ? missing.join(", ") : "All modules enabled",
        };
      });
  }, [restaurants]);

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa]">
      {/* Header */}
      <header className="bg-white px-8 py-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Subscriptions & Metrics</h1>
            <p className="text-sm text-slate-500 mt-0.5">Live billing mix and subscription status</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors relative">
              <span className="material-icons-round text-slate-600 text-[20px]">notifications</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
            </button>
            <button className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors" onClick={() => setShowCreateModal(true)}>
              New Campaign
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-blue-50 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-blue-600 text-[22px]">groups</span>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Live</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Active Subscriptions</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.active}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-green-50 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-green-600 text-[22px]">account_balance_wallet</span>
              </div>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Paid</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Paid Plans</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.paid}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-purple-50 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-purple-600 text-[22px]">bar_chart</span>
              </div>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Trial</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Trial Plans</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.trial}</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-yellow-50 rounded-lg flex items-center justify-center">
                <span className="material-icons-round text-yellow-600 text-[22px]">emoji_events</span>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Next 14 days</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">Expiring Soon</p>
            <p className="text-2xl font-bold text-slate-900">{metrics.expiringSoon}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Revenue Growth Chart */}
          <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Portfolio Growth</h3>
                <p className="text-xs text-slate-500 mt-0.5">New restaurants added per month</p>
              </div>
              <select className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option>Monthly</option>
                <option>Weekly</option>
                <option>Yearly</option>
              </select>
            </div>
            <div className="w-full h-[280px] min-w-0 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" style={{ fontSize: '11px' }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Source Donut */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-900">Plan Mix</h3>
              <button className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
                <span className="material-icons-round text-slate-400 text-[18px]">more_vert</span>
              </button>
            </div>
            
            {/* Donut Chart */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg viewBox="0 0 200 200" className="transform -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="28"
                />
                {donutSegments.map((segment) => (
                  <circle
                    key={segment.label}
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="28"
                    strokeDasharray={segment.dasharray}
                    strokeDashoffset={segment.dashoffset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-slate-900">{metrics.total}</div>
                <div className="text-xs text-slate-500">RESTAURANTS</div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {planMix.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Subscription List */}
          <div className="xl:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Subscription List</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tracking {metrics.active} active subscriptions</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                  <input
                    type="text"
                    placeholder="Search restaurant..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-56"
                  />
                </div>
                <button className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                  <span className="material-icons-round text-slate-600 text-[18px]">tune</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Restaurant</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Status</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Plan Type</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Plan State</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Expiry Date</th>
                    <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="py-6 text-sm text-slate-500" colSpan={6}>
                        Loading subscriptions...
                      </td>
                    </tr>
                  ) : filteredSubscriptions.length ? (
                    filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${sub.avatarColor} flex items-center justify-center font-semibold text-sm`}>
                            {sub.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{sub.restaurant}</p>
                            <p className="text-xs text-slate-500">{sub.restaurantId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded ${
                          sub.statusColor === "green"
                            ? "bg-green-100 text-green-700"
                            : sub.statusColor === "yellow"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            sub.statusColor === "green"
                              ? "bg-green-600"
                              : sub.statusColor === "yellow"
                              ? "bg-yellow-600"
                              : "bg-red-600"
                          }`}></span>
                          {sub.statusLabel}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase rounded-full ${
                          sub.planType === "PAID"
                            ? "bg-orange-500 text-white"
                            : sub.planType === "TRIAL"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {sub.planType}
                        </span>
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-slate-700">{sub.planState}</p>
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-slate-700">{sub.expiryDate}</p>
                      </td>
                      <td className="py-4">
                        <button className="p-1 hover:bg-slate-100 rounded transition-colors">
                          <span className="material-icons-round text-slate-400 text-[18px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                  ) : (
                    <tr>
                      <td className="py-6 text-sm text-slate-500" colSpan={6}>
                        No subscriptions match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">Showing {filteredSubscriptions.length} of {subscriptionRows.length} results</p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                  Previous
                </button>
                <button className="px-3 py-1.5 text-sm text-white bg-orange-500 rounded-lg font-medium">
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Recent Support Tickets */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Needs Review</h3>
                <button className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors">
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {attentionItems.length ? (
                  attentionItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {item.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-600 line-clamp-1">{item.summary}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No flagged restaurants right now.</p>
                )}
              </div>
            </div>

            {/* Subscriber Map */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Module Coverage</h3>
                <button className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                  LIVE COUNTS
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Restaurant enabled</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.restaurantEnabled}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Hotel enabled</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.hotelEnabled}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">KOT enabled</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.kotEnabled}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Tax enabled</span>
                  <span className="text-sm font-semibold text-slate-900">{metrics.taxEnabled}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Create New Plan</h2>
                <p className="text-sm text-slate-500 mt-1">Define pricing and features for a new subscription tier.</p>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-icons-round text-slate-400 text-[24px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Plan Name and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Plan Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Starter, Pro"
                    value={formData.planName}
                    onChange={(e) => setFormData({...formData, planName: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Monthly Price ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.monthlyPrice}
                    onChange={(e) => setFormData({...formData, monthlyPrice: e.target.value})}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Description</label>
                <textarea
                  placeholder="Briefly describe what this plan offers..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Number of Branches */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Number of Branches Allowed</label>
                <div className="relative">
                  <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">store</span>
                  <input
                    type="number"
                    value={formData.branches}
                    onChange={(e) => setFormData({...formData, branches: e.target.value})}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Plan Features Checklist */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-3">Plan Features Checklist</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleFeatureToggle('restaurantLocations')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.restaurantLocations
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.restaurantLocations ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.restaurantLocations ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">Restaurant Locations</span>
                  </button>

                  <button
                    onClick={() => handleFeatureToggle('inventoryManagement')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.inventoryManagement
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.inventoryManagement ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.inventoryManagement ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">Inventory Management</span>
                  </button>

                  <button
                    onClick={() => handleFeatureToggle('advancedAnalytics')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.advancedAnalytics
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.advancedAnalytics ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.advancedAnalytics ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">Advanced Analytics</span>
                  </button>

                  <button
                    onClick={() => handleFeatureToggle('support247')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.support247
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.support247 ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.support247 ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">24/7 Support</span>
                  </button>

                  <button
                    onClick={() => handleFeatureToggle('apiAccess')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.apiAccess
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.apiAccess ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.apiAccess ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">API Access</span>
                  </button>

                  <button
                    onClick={() => handleFeatureToggle('multiUserAccess')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      formData.features.multiUserAccess
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className={`material-icons-round text-[20px] ${
                      formData.features.multiUserAccess ? 'text-orange-500' : 'text-slate-300'
                    }`}>
                      {formData.features.multiUserAccess ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="text-sm font-medium text-slate-900">Multi-user access</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
