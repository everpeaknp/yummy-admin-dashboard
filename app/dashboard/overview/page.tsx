"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Hotel, ShieldCheck, UtensilsCrossed } from "lucide-react";
import Card from "@/components/Card";
import KPICard from "@/components/KPICard";
import { getPlatformDashboard, getRestaurants, type BackendRestaurant, type PlatformDashboardResponse } from "@/lib/backend-api";

const palette = ["#f97316", "#2563eb", "#8b5cf6", "#14b8a6", "#ef4444", "#f59e0b"];

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function OverviewPage() {
  const [dashboard, setDashboard] = useState<PlatformDashboardResponse | null>(null);
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
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
      } else {
        setRestaurants([]);
      }

      if (dashboardResult.status === "fulfilled") {
        setDashboard(dashboardResult.value.data);
        setFallbackNote(null);
      } else {
        setDashboard(null);
        setFallbackNote("Using live restaurant aggregates because the platform analytics endpoint is unavailable right now.");
      }

      setIsLoading(false);
    }

    loadDashboard();

    return () => {
      alive = false;
    };
  }, []);

  const filteredRestaurants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      const haystack = [
        restaurant.name,
        restaurant.address,
        restaurant.phone,
        restaurant.billing_mode,
        restaurant.plan_state,
        restaurant.timezone,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [restaurants, searchQuery]);

  const metrics = useMemo(() => {
    const total = restaurants.length;
    const restaurantEnabled = restaurants.filter((restaurant) => restaurant.restaurant_enabled).length;
    const hotelEnabled = restaurants.filter((restaurant) => restaurant.hotel_enabled).length;
    const kotEnabled = restaurants.filter((restaurant) => restaurant.kot_enabled).length;
    const taxEnabled = restaurants.filter((restaurant) => restaurant.tax_enabled).length;
    const trial = restaurants.filter((restaurant) => (restaurant.plan_state || "").toLowerCase().includes("trial")).length;
    const free = restaurants.filter((restaurant) => (restaurant.billing_mode || "").toLowerCase().includes("free")).length;

    return {
      total,
      restaurantEnabled,
      hotelEnabled,
      kotEnabled,
      taxEnabled,
      trial,
      free,
    };
  }, [restaurants]);

  const billingData = useMemo(() => {
    const groups = new Map<string, number>();

    for (const restaurant of restaurants) {
      const key = (restaurant.billing_mode || restaurant.plan_state || "unknown").toUpperCase();
      groups.set(key, (groups.get(key) || 0) + 1);
    }

    return Array.from(groups.entries()).map(([name, value], index) => ({
      name,
      value,
      color: palette[index % palette.length],
    }));
  }, [restaurants]);

  const serviceMixData = useMemo(
    () => [
      { name: "Restaurant Enabled", value: metrics.restaurantEnabled, color: "#f97316" },
      { name: "Hotel Enabled", value: metrics.hotelEnabled, color: "#2563eb" },
      { name: "KOT Enabled", value: metrics.kotEnabled, color: "#8b5cf6" },
      { name: "Tax Enabled", value: metrics.taxEnabled, color: "#14b8a6" },
    ],
    [metrics.hotelEnabled, metrics.kotEnabled, metrics.restaurantEnabled, metrics.taxEnabled],
  );

  const recentRestaurants = useMemo(() => restaurants.slice(0, 5), [restaurants]);
  const attentionItems = useMemo(
    () => restaurants.filter((restaurant) => !restaurant.restaurant_enabled || !restaurant.hotel_enabled || !restaurant.kot_enabled).slice(0, 4),
    [restaurants],
  );

  const moduleData = useMemo(
    () =>
      dashboard?.module_breakdown.map((item, index) => ({
        name: item.label,
        value: item.value,
        color: item.color || palette[(index + 1) % palette.length],
      })) || [],
    [dashboard],
  );
  const growthData = useMemo(() => dashboard?.monthly_growth.map((item) => ({ label: item.label, value: item.value })) || [], [dashboard]);

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa]">
      <header className="bg-white px-8 py-6 border-b border-slate-200">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">Super Admin Console</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Platform Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Live restaurant portfolio, hotel enablement, and service configuration. This view is built from reusable widgets instead of flat analytics cards.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {dashboard ? `Platform endpoint updated ${new Date(dashboard.generated_at).toLocaleString()}` : isLoading ? "Loading live data..." : "Live restaurant data loaded."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search restaurants"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 outline-none ring-0 transition focus:border-orange-400/60 focus:bg-white sm:w-72"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">AW</div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Main Admin</p>
                <p className="text-xs text-slate-500">Superadmin</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {fallbackNote ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {fallbackNote}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KPICard title="Total Restaurants" value={metrics.total} icon={Building2} trend={dashboard?.kpis?.[0]?.trend || "Live count from backend"} trendUp />
          <KPICard title="Restaurant Enabled" value={metrics.restaurantEnabled} icon={UtensilsCrossed} trend={`${metrics.total ? Math.round((metrics.restaurantEnabled / metrics.total) * 100) : 0}% of portfolio`} trendUp />
          <KPICard title="Hotel Enabled" value={metrics.hotelEnabled} icon={Hotel} trend={`${metrics.total ? Math.round((metrics.hotelEnabled / metrics.total) * 100) : 0}% of portfolio`} trendUp />
          <KPICard title="KOT Enabled" value={metrics.kotEnabled} icon={ShieldCheck} trend={`${metrics.total ? Math.round((metrics.kotEnabled / metrics.total) * 100) : 0}% active kitchens`} trendUp />
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Restaurant Portfolio</h2>
                <p className="text-sm text-slate-500">Billing mix and service enablement at a glance</p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold text-orange-600 bg-orange-50 rounded-full">Live widgets</span>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={billingData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={84} paddingAngle={4} strokeWidth={0}>
                        {billingData.map((entry, index) => (
                          <Cell key={entry.name} fill={entry.color || palette[index % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {billingData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{titleCase(item.name.toLowerCase())}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="grid grid-cols-1 gap-3">
                  {serviceMixData.map((item) => (
                    <div key={item.name} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Service availability across restaurants</p>
                        </div>
                        <p className="text-xl font-bold text-slate-900">{item.value}</p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${metrics.total ? Math.max((item.value / metrics.total) * 100, 6) : 0}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trial / Limited</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.trial}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Free / Starter</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.free}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Platform Insights</h2>
                <p className="text-sm text-slate-500">Signals from the backend when available</p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full">Live</span>
            </div>
            <div className="space-y-3">
              {(dashboard?.insights || [
                `${metrics.hotelEnabled} restaurants have hotel enabled.`,
                `${metrics.restaurantEnabled} restaurants have restaurant enabled.`,
                `${attentionItems.length} restaurants need a quick review.`,
              ]).map((insight) => (
                <div key={insight} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  {insight}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Restaurant Details</h2>
                <p className="text-sm text-slate-500">View service flags, billing, and open the edit screen</p>
              </div>
              <Link href="/dashboard/restaurants" className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
                View all
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Restaurant</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Billing</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Services</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="py-8 text-sm text-slate-500" colSpan={5}>
                        Loading live restaurant data...
                      </td>
                    </tr>
                  ) : filteredRestaurants.length ? (
                    filteredRestaurants.map((restaurant) => (
                      <tr key={restaurant.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-4 pr-4">
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
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900">{titleCase(restaurant.billing_mode || restaurant.plan_state || "unknown")}</p>
                            <p className="text-xs text-slate-500">{titleCase(restaurant.plan_state || "unknown")}</p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              Restaurant
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                              Hotel
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                              KOT
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.tax_enabled ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                              Tax
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-sm text-slate-600">
                          <p>{restaurant.phone}</p>
                          <p className="text-xs text-slate-400">{restaurant.timezone}</p>
                        </td>
                        <td className="py-4 text-right">
                          <Link
                            href={`/dashboard/restaurants/${restaurant.id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                          >
                            <PencilIcon />
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-8 text-sm text-slate-500" colSpan={5}>
                        No restaurants matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Needs Review</h2>
                <p className="text-sm text-slate-500">Entries missing one or more modules</p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full">Attention</span>
            </div>

            <div className="space-y-3">
              {attentionItems.length ? attentionItems.map((restaurant) => (
                <div key={restaurant.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{restaurant.name}</p>
                      <p className="text-xs text-slate-500">{restaurant.address}</p>
                    </div>
                    <Link href={`/dashboard/restaurants/${restaurant.id}`} className="text-sm font-semibold text-orange-600">
                      Edit
                    </Link>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      Restaurant
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                      Hotel
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${restaurant.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                      KOT
                    </span>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No attention items right now.</p>
              )}
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent Restaurants</h2>
                <p className="text-sm text-slate-500">Latest platform entries and their service flags</p>
              </div>
              <span className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-full">Recent</span>
            </div>

            <div className="space-y-3">
              {recentRestaurants.length ? recentRestaurants.map((restaurant) => (
                <div key={restaurant.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-sm font-bold text-orange-600">
                      {restaurant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{restaurant.name}</p>
                      <p className="text-xs text-slate-500">{restaurant.address}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className={`rounded-full px-2.5 py-1 ${restaurant.restaurant_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>Restaurant</span>
                    <span className={`rounded-full px-2.5 py-1 ${restaurant.hotel_enabled ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>Hotel</span>
                    <span className={`rounded-full px-2.5 py-1 ${restaurant.kot_enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>KOT</span>
                  </div>
                  <Link href={`/dashboard/restaurants/${restaurant.id}`} className="text-sm font-semibold text-orange-600 hover:text-orange-700">
                    Open details
                  </Link>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No restaurants available yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Growth Snapshot</h2>
              <p className="text-sm text-slate-500">Monthly platform growth when available</p>
            </div>

            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthData.length ? growthData : serviceMixData.map((item) => ({ label: item.name, value: item.value }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" style={{ fontSize: "11px" }} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: "11px" }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function PencilIcon() {
  return <span className="material-icons-round text-[16px]">edit</span>;
}
