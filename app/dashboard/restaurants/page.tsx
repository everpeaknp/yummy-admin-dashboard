"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building, Hotel, MapPin, Pencil, Phone, Search, Utensils } from "lucide-react";
import { getRestaurants, type BackendRestaurant } from "@/lib/backend-api";

export default function RestaurantsPage() {
  const [restaurantsList, setRestaurantsList] = useState<BackendRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
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
      const status = (restaurant.plan_state || restaurant.billing_mode || "").toLowerCase();
      const isMatchingStatus = statusFilter === "all" || status.includes(statusFilter);
      const haystack = [restaurant.name, restaurant.address, restaurant.phone, restaurant.billing_mode, restaurant.plan_state]
        .join(" ")
        .toLowerCase();
      const isMatchingSearch = haystack.includes(searchQuery.toLowerCase());
      return isMatchingStatus && isMatchingSearch;
    });
  }, [restaurantsList, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    const total = restaurantsList.length;
    const active = restaurantsList.filter((restaurant) => restaurant.restaurant_enabled).length;
    const hotelEnabled = restaurantsList.filter((restaurant) => restaurant.hotel_enabled).length;
    const trial = restaurantsList.filter((restaurant) => (restaurant.plan_state || "").toLowerCase().includes("trial")).length;

    return { total, active, hotelEnabled, trial };
  }, [restaurantsList]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Utensils className="text-orange-500" size={28} />
              Restaurants Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live data from the Azure backend
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trial / Limited</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{summary.trial}</p>
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
                  <option value="all">Status: All</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="paused">Paused</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
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
                      Loading restaurants from Azure backend...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-red-600 dark:text-red-400" colSpan={7}>
                      {error}
                    </td>
                  </tr>
                ) : filteredRestaurants.length ? (
                  filteredRestaurants.map((restaurant) => (
                    <tr key={restaurant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {restaurant.name.charAt(0)}
                          </div>
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
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase">
                            {restaurant.billing_mode}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{restaurant.plan_state}</p>
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
                        {restaurant.trial_ends_at || restaurant.paid_ends_at || "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/restaurants/${restaurant.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-600 dark:text-gray-300"
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
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
