"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Fingerprint, MapPin, Pencil, Phone, Search, Utensils } from "lucide-react";
import { getRestaurants, type BackendRestaurant } from "@/lib/backend-api";
import { canManageRestaurants, getStoredAuthSession } from "@/lib/auth";
import RestaurantAvatar from "@/components/RestaurantAvatar";

function formatExpiryDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(parsed);
}

function getExpiryDateObj(restaurant: BackendRestaurant): Date | null {
  const planState = (restaurant.plan_state || "").toLowerCase();
  const billingMode = (restaurant.billing_mode || "").toLowerCase();
  if (billingMode === "free") return null;

  const isTrialPlan = planState.includes("trial") || billingMode === "trial_paid";
  const isPaidPlan = billingMode === "paid" || planState === "paid";
  let fallback = restaurant.paid_ends_at || restaurant.trial_ends_at || null;
  if (isTrialPlan && restaurant.trial_ends_at) fallback = restaurant.trial_ends_at;
  else if (isPaidPlan && restaurant.paid_ends_at) fallback = restaurant.paid_ends_at;
  
  if (!fallback) return null;
  const d = new Date(fallback);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getExpiryCellData(restaurant: BackendRestaurant): { label: string; value: string; isExpiringSoon: boolean; isExpired: boolean } {
  const planState = (restaurant.plan_state || "").toLowerCase();
  const billingMode = (restaurant.billing_mode || "").toLowerCase();
  const isTrialPlan = planState.includes("trial") || billingMode === "trial_paid";
  const isPaidPlan = billingMode === "paid" || planState === "paid";

  if (billingMode === "free") {
    return {
      label: "Free",
      value: "Lifetime",
      isExpiringSoon: false,
      isExpired: false
    };
  }

  const dateObj = getExpiryDateObj(restaurant);
  let isExpiringSoon = false;
  let isExpired = false;
  
  if (dateObj) {
    const diffDays = (dateObj.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    if (diffDays < 0) isExpired = true;
    else if (diffDays <= 7) isExpiringSoon = true;
  }

  if (isTrialPlan) {
    return {
      label: "Trial",
      value: formatExpiryDate(restaurant.trial_ends_at),
      isExpiringSoon,
      isExpired
    };
  }

  if (isPaidPlan) {
    return {
      label: "Paid",
      value: formatExpiryDate(restaurant.paid_ends_at),
      isExpiringSoon,
      isExpired
    };
  }

  const fallback = restaurant.paid_ends_at || restaurant.trial_ends_at || null;
  return {
    label: "Plan",
    value: formatExpiryDate(fallback),
    isExpiringSoon,
    isExpired
  };
}

export default function RestaurantsPage() {
  const [restaurantsList, setRestaurantsList] = useState<BackendRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expiryDateFrom, setExpiryDateFrom] = useState("");
  const [expiryDateTo, setExpiryDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadRestaurants() {
      try {
        const token = window.localStorage.getItem("accessToken") || undefined;
        const response = await getRestaurants({ token });
        if (!isMounted) {
          return;
        }
        setRestaurantsList(response.data || []);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load restaurants");
        setRestaurantsList([]);
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

  const filteredRestaurants = useMemo(() => {
    return restaurantsList.filter((restaurant) => {
      let isMatchingStatus = true;
      const status = (restaurant.plan_state || restaurant.billing_mode || "").toLowerCase();
      
      switch (statusFilter) {
        case "restaurant_enabled":
          isMatchingStatus = Boolean(restaurant.restaurant_enabled);
          break;
        case "hotel_enabled":
          isMatchingStatus = Boolean(restaurant.hotel_enabled);
          break;
        case "attendance_enabled":
          isMatchingStatus = Boolean(restaurant.attendance_enabled);
          break;
        case "attendance_disabled":
          isMatchingStatus = !restaurant.attendance_enabled;
          break;
        case "trial": {
          const expDate = getExpiryDateObj(restaurant);
          const isExpired = expDate ? (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) < 0 : false;
          isMatchingStatus = status.includes("trial") && !status.includes("trial_expired") && !isExpired;
          break;
        }
        case "trial_paid": {
          const expDate = getExpiryDateObj(restaurant);
          const isExpired = expDate ? (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) < 0 : false;
          isMatchingStatus = (restaurant.billing_mode || "").toLowerCase() === "trial_paid" && !status.includes("trial_expired") && !isExpired;
          break;
        }
        case "free": {
          const expDate = getExpiryDateObj(restaurant);
          const isExpired = expDate ? (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) < 0 : false;
          const isTrialExpired = status.includes("trial_expired") || ((restaurant.billing_mode || "").toLowerCase() === "trial_paid" && isExpired);
          isMatchingStatus = (restaurant.billing_mode || "").toLowerCase() === "free" || isTrialExpired;
          break;
        }
        case "trial_expired": {
          isMatchingStatus = status.includes("trial_expired");
          if (!isMatchingStatus && (restaurant.billing_mode || "").toLowerCase() === "trial_paid") {
            const expDate = getExpiryDateObj(restaurant);
            if (expDate && (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24) < 0) {
              isMatchingStatus = true;
            }
          }
          break;
        }
        case "expired": {
          const expDate = getExpiryDateObj(restaurant);
          if (!expDate) {
            isMatchingStatus = false;
          } else {
            const diffDays = (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
            isMatchingStatus = diffDays < 0;
          }
          break;
        }
        case "expiring_7": {
          const expDate = getExpiryDateObj(restaurant);
          if (!expDate) {
            isMatchingStatus = false;
          } else {
            const diffDays = (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
            isMatchingStatus = diffDays >= 0 && diffDays <= 7;
          }
          break;
        }
        case "expiring_30": {
          const expDate = getExpiryDateObj(restaurant);
          if (!expDate) {
            isMatchingStatus = false;
          } else {
            const diffDays = (expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
            isMatchingStatus = diffDays >= 0 && diffDays <= 30;
          }
          break;
        }
        default:
          isMatchingStatus = true;
      }
      let isMatchingExpiry = true;
      if (expiryDateFrom || expiryDateTo) {
        const expDate = getExpiryDateObj(restaurant);
        if (!expDate) {
          isMatchingExpiry = false;
        } else {
          if (expiryDateFrom && expDate < new Date(expiryDateFrom)) {
            isMatchingExpiry = false;
          }
          if (expiryDateTo && expDate > new Date(expiryDateTo + "T23:59:59")) {
            isMatchingExpiry = false;
          }
        }
      }

      const haystack = [
        restaurant.id,
        restaurant.registered_by,
        restaurant.name || "",
        restaurant.address || "",
        restaurant.phone || "",
        restaurant.billing_mode || "",
        restaurant.plan_state || ""
      ].join(" ").toLowerCase();
      const isMatchingSearch = haystack.includes(searchQuery.trim().toLowerCase());
      
      return isMatchingStatus && isMatchingExpiry && isMatchingSearch;
    });
  }, [restaurantsList, statusFilter, expiryDateFrom, expiryDateTo, searchQuery]);

  const summary = useMemo(() => {
    const total = restaurantsList.length;
    const active = restaurantsList.filter((restaurant) => restaurant.restaurant_enabled).length;
    const hotelEnabled = restaurantsList.filter((restaurant) => restaurant.hotel_enabled).length;
    const attendanceEnabled = restaurantsList.filter((restaurant) => restaurant.attendance_enabled).length;
    const trial = restaurantsList.filter((restaurant) => (restaurant.plan_state || "").toLowerCase().includes("trial")).length;

    const now = new Date();
    let expiringSoon = 0;
    restaurantsList.forEach(r => {
      const expDate = getExpiryDateObj(r);
      if (expDate) {
        const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 7) {
          expiringSoon++;
        }
      }
    });

    return { total, active, hotelEnabled, attendanceEnabled, trial, expiringSoon };
  }, [restaurantsList]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Utensils className="text-orange-500" size={28} />
              Restaurants Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live data from the platform backend
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Restaurants</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restaurant Enabled</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.active}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hotel Enabled</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.hotelEnabled}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attendance</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.attendanceEnabled}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trial / Limited</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.trial}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-red-100 dark:border-red-900/30">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Expiring ≤ 7 Days</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">{summary.expiringSoon}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">All Restaurants</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pulled directly from the backend</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Filter: All</option>
                  <optgroup label="Services">
                    <option value="restaurant_enabled">Restaurant Enabled</option>
                    <option value="hotel_enabled">Hotel Enabled</option>
                    <option value="attendance_enabled">Attendance Enabled</option>
                    <option value="attendance_disabled">Attendance Disabled</option>
                  </optgroup>
                  <optgroup label="Billing Status">
                    <option value="free">Free</option>
                    <option value="trial">Trial</option>
                    <option value="trial_paid">Trial Paid</option>
                    <option value="trial_expired">Trial Expired</option>
                  </optgroup>
                  <optgroup label="Expiry Status">
                    <option value="expired">Expired</option>
                    <option value="expiring_7">Expiring ≤ 7 Days</option>
                    <option value="expiring_30">Expiring ≤ 30 Days</option>
                  </optgroup>
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">Expires From:</label>
                  <input
                    type="date"
                    value={expiryDateFrom}
                    onChange={(event) => setExpiryDateFrom(event.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400 font-medium">To:</label>
                  <input
                    type="date"
                    value={expiryDateTo}
                    onChange={(event) => setExpiryDateTo(event.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <label className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search restaurants..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Restaurant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Billing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Modules
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Timezone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-gray-500 dark:text-gray-400" colSpan={7}>
                      Loading restaurants...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-red-600 dark:text-red-400" colSpan={7}>
                      {error}
                    </td>
                  </tr>
                ) : filteredRestaurants.length ? (
                  filteredRestaurants.map((restaurant) => {
                    const expiry = getExpiryCellData(restaurant);
                    return (
                      <tr key={restaurant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <RestaurantAvatar
                            name={restaurant.name}
                            src={restaurant.profile_picture || restaurant.cover_photo || null}
                            size={40}
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{restaurant.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <MapPin size={12} />
                              {restaurant.address}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 text-xs font-semibold rounded uppercase bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300`}>
                            {((restaurant.billing_mode || "").toLowerCase() === "trial_paid" && expiry.isExpired) || restaurant.plan_state === "trial_expired" 
                              ? "FREE" 
                              : restaurant.billing_mode}
                          </span>
                          <p className={`text-xs ${
                            ((restaurant.billing_mode || "").toLowerCase() === "trial_paid" && expiry.isExpired) || restaurant.plan_state === "trial_expired"
                              ? "text-red-500 font-semibold"
                              : "text-gray-500 dark:text-gray-400"
                          }`}>
                            {((restaurant.billing_mode || "").toLowerCase() === "trial_paid" && expiry.isExpired) || restaurant.plan_state === "trial_expired"
                              ? "trial_expired"
                              : restaurant.plan_state}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            Restaurant
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${restaurant.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                            Hotel
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${restaurant.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>
                            KOT
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded ${restaurant.attendance_enabled ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                            <Fingerprint size={12} />
                            Attendance
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{restaurant.timezone}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="space-y-1">
                          <p className="flex items-center gap-1"><Phone size={12} /> {restaurant.phone}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Owner ID {restaurant.registered_by}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{expiry.label}</p>
                          <p className={expiry.isExpired ? "text-red-600 font-bold" : expiry.isExpiringSoon ? "text-orange-500 font-semibold" : ""}>{expiry.value}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canManageRestaurants(getStoredAuthSession()) && (
                          <Link
                            href={`/dashboard/restaurants/${restaurant.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-600 dark:text-gray-300"
                          >
                            <Pencil size={14} />
                            Edit
                          </Link>
                        )}
                        {!canManageRestaurants(getStoredAuthSession()) && (
                          <Link
                            href={`/dashboard/restaurants/${restaurant.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-600 dark:border-gray-600 dark:text-gray-300"
                          >
                            View
                          </Link>
                        )}
                      </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-sm text-gray-500 dark:text-gray-400" colSpan={7}>
                      No restaurants matched the current filters.
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
