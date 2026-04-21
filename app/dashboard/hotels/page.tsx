"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Hotel, Pencil, Phone, Search } from "lucide-react";
import { getRestaurants, type BackendRestaurant } from "@/lib/backend-api";

export default function HotelsPage() {
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHotels() {
      try {
        const token = window.localStorage.getItem("accessToken") || undefined;
        const response = await getRestaurants({ token });
        if (!active) {
          return;
        }
        setRestaurants((response.data || []).filter((restaurant) => restaurant.hotel_enabled));
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load hotel-enabled restaurants");
        setRestaurants([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadHotels();

    return () => {
      active = false;
    };
  }, []);

  const filteredHotels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      const haystack = [restaurant.name, restaurant.address, restaurant.phone, restaurant.billing_mode, restaurant.plan_state]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [restaurants, searchQuery]);

  return (
    <div className="flex-1 bg-[#f5f7fa] p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-200 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Hotel className="text-orange-500" size={28} />
            Hotel-Enabled Restaurants
          </h1>
          <p className="mt-1 text-sm text-slate-500">Live restaurants with hotel services enabled</p>
        </div>

        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search hotels"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-orange-400 lg:w-72"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Hotel Enabled" value={restaurants.length} />
        <MetricCard label="Restaurant Enabled" value={restaurants.filter((restaurant) => restaurant.restaurant_enabled).length} />
        <MetricCard label="KOT Enabled" value={restaurants.filter((restaurant) => restaurant.kot_enabled).length} />
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">Hotel Inventory</h2>
          <p className="text-sm text-slate-500">Open any hotel-enabled restaurant to edit details and flags.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Restaurant</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Modules</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Billing</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>
                    Loading hotel-enabled restaurants...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-6 py-8 text-sm text-red-600" colSpan={5}>
                    {error}
                  </td>
                </tr>
              ) : filteredHotels.length ? (
                filteredHotels.map((restaurant) => (
                  <tr key={restaurant.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-sm font-bold text-orange-600">
                          {restaurant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{restaurant.name}</p>
                          <p className="text-xs text-slate-500">{restaurant.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span className={`rounded-full px-2.5 py-1 ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>Restaurant</span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Hotel</span>
                        <span className={`rounded-full px-2.5 py-1 ${restaurant.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>KOT</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{restaurant.billing_mode}</p>
                      <p className="text-xs text-slate-500">{restaurant.plan_state}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <p className="flex items-center gap-1"><Phone size={12} /> {restaurant.phone}</p>
                      <p className="text-xs text-slate-500">{restaurant.timezone}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/restaurants/${restaurant.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-8 text-sm text-slate-500" colSpan={5}>
                    No hotel-enabled restaurants match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
