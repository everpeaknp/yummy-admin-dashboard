"use client";

import { useEffect, useMemo, useState } from "react";
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

type PlanAssignment = {
  id: number;
  restaurant: string;
  avatar: string;
  avatarColor: string;
  currentPlan: string;
  statusLabel: string;
  statusTone: "green" | "yellow" | "red" | "slate";
  expiresAt: string;
  expiresAtRaw: number;
  revenue: string;
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

function getStatusTone(statusKey: string): "green" | "yellow" | "red" | "slate" {
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

export default function PlansPage() {
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    let isMounted = true;

    async function loadRestaurants() {
      try {
        const token = window.localStorage.getItem("accessToken") || undefined;
        const [restaurantsResult, dashboardResult] = await Promise.allSettled([
          getRestaurants({ token }),
          getPlatformDashboard({ token }),
        ]);
        if (!isMounted) {
          return;
        }
        if (restaurantsResult.status === "fulfilled") {
          setRestaurants(restaurantsResult.value.data || []);
          setError(null);
        } else {
          setRestaurants([]);
          setError("Failed to load plan assignments.");
        }

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value.data);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setRestaurants([]);
        setError(loadError instanceof Error ? loadError.message : "Failed to load plan assignments.");
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

  const metrics = useMemo(() => {
    const total = restaurants.length;
    const paid = restaurants.filter((restaurant) => (restaurant.billing_mode || "").toLowerCase() === "paid").length;
    const trial = restaurants.filter((restaurant) => {
      const planState = (restaurant.plan_state || "").toLowerCase();
      return planState.includes("trial") || (restaurant.billing_mode || "").toLowerCase() === "trial_paid";
    }).length;
    const free = restaurants.filter((restaurant) => (restaurant.billing_mode || "").toLowerCase() === "free").length;
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 14);
    const expiringSoon = restaurants.filter((restaurant) => {
      const expiry = getExpiryDate(restaurant);
      return expiry && expiry >= now && expiry <= soon;
    }).length;
    return { total, paid, trial, free, expiringSoon };
  }, [restaurants]);

  const tierCards = useMemo(() => {
    if (dashboard?.billing_mode_breakdown?.length) {
      return dashboard.billing_mode_breakdown.map((tier) => ({
        label: tier.label,
        value: tier.value,
        formatted: tier.formatted_value,
        color: tier.color || "#f97316",
      }));
    }

    return [
      { label: "Paid", value: metrics.paid, formatted: String(metrics.paid), color: "#f97316" },
      { label: "Trial Paid", value: metrics.trial, formatted: String(metrics.trial), color: "#fbbf24" },
      { label: "Free", value: metrics.free, formatted: String(metrics.free), color: "#e5e7eb" },
    ];
  }, [dashboard?.billing_mode_breakdown, metrics.free, metrics.paid, metrics.trial]);

  const planAssignments = useMemo<PlanAssignment[]>(() => {
    const mapped = restaurants.map((restaurant, index) => {
      const expiry = getExpiryDate(restaurant);
      const status = resolveStatus(restaurant, expiry);
      const expiresAtRaw = expiry ? expiry.getTime() : Number.MAX_SAFE_INTEGER;
      return {
        id: restaurant.id,
        restaurant: restaurant.name,
        avatar: (restaurant.name || "R").charAt(0).toUpperCase(),
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        currentPlan: titleCase(restaurant.plan_state || restaurant.billing_mode || "unknown"),
        statusLabel: status.label,
        statusTone: getStatusTone(status.key),
        expiresAt: formatDate(expiry),
        expiresAtRaw,
        revenue: "—",
      };
    });

    return mapped.sort((a, b) => a.expiresAtRaw - b.expiresAtRaw).slice(0, 6);
  }, [restaurants]);

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa]">
      {/* Header */}
      <header className="bg-white px-8 py-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SaaS Plans Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors relative">
              <span className="material-icons-round text-slate-600 text-[20px]">notifications</span>
            </button>
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="material-icons-round text-slate-600 text-[20px]">person</span>
            </div>
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
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Total Restaurants</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.total}</p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="material-icons-round text-green-600 text-[14px]">trending_up</span>
              <span className="text-green-600 font-semibold">Live count</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Paid Plans</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.paid}</p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="material-icons-round text-green-600 text-[14px]">trending_up</span>
              <span className="text-green-600 font-semibold">Live count</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Trial Plans</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.trial}</p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="material-icons-round text-slate-400 text-[14px]">remove</span>
              <span className="text-slate-500 font-semibold">Live count</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-1">Expiring Soon</p>
              <p className="text-3xl font-bold text-slate-900">{metrics.expiringSoon}</p>
            </div>
            <button className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors">
              Next 14 days
            </button>
          </div>
        </div>

        {/* Subscription Tiers */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Subscription Tiers</h2>
              <p className="text-sm text-slate-500">Live tier mix from backend billing modes.</p>
            </div>
            <button className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2" onClick={() => setShowCreateModal(true)}>
              <span className="material-icons-round text-[18px]">add</span>
              Create New Plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {tierCards.map((tier) => {
              const percent = metrics.total ? Math.round((tier.value / metrics.total) * 100) : 0;
              return (
                <div
                  key={tier.label}
                  className="bg-white rounded-xl p-6 shadow-sm border-2 border-transparent"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">TIER</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: tier.color }}
                    >
                      Live
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mt-2">{tier.label}</h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{tier.formatted}</span>
                    <span className="text-sm text-slate-500">restaurants</span>
                  </div>

                  <div className="mt-5 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${percent}%`, backgroundColor: tier.color }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{percent}% of portfolio</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Plan Assignments */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900">Recent Plan Assignments</h3>
            <button className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">Restaurant</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">Current Plan</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">Expires</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider pb-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan={5}>
                      Loading plan assignments...
                    </td>
                  </tr>
                ) : planAssignments.length ? (
                  planAssignments.map((assignment) => (
                    <tr key={assignment.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${assignment.avatarColor} flex items-center justify-center font-semibold text-xs`}>
                            {assignment.avatar}
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{assignment.restaurant}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-700">{assignment.currentPlan}</span>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          assignment.statusTone === "green"
                            ? "bg-green-100 text-green-700"
                            : assignment.statusTone === "yellow"
                            ? "bg-yellow-100 text-yellow-700"
                            : assignment.statusTone === "red"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {assignment.statusLabel}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-slate-700">{assignment.expiresAt}</span>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-semibold text-slate-900">{assignment.revenue}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan={5}>
                      No plan assignments available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
