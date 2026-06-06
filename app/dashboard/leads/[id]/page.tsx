"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getLead, getLeadActivity, type LeadActivityPageRead, type LeadDetailRead, type LeadSetupBreakdown, type UserActivityLogRead } from "@/lib/backend-api";
import Card from "@/components/Card";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Store, 
  Clock, 
  Activity, 
  Utensils, 
  TableProperties, 
  Receipt,
  UserCircle,
  Monitor,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

const ACTIVITY_PAGE_SIZE = 10;

function getSetupSummary(setup?: LeadSetupBreakdown | null) {
  if (!setup) return "No setup analysis yet";
  const parts: string[] = [];
  if (setup.default_kept > 0) parts.push(`${setup.default_kept} default`);
  if (setup.modified > 0) parts.push(`${setup.modified} modified`);
  if (setup.extra > 0) parts.push(`${setup.extra} extra`);
  if (setup.missing_defaults > 0) parts.push(`${setup.missing_defaults} missing`);
  return parts.length > 0 ? parts.join(" • ") : "All system defaults intact";
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getGoogleMapsUrl(address?: string | null) {
  const trimmed = (address || "").trim();
  if (!trimmed) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export default function LeadInsightsPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = Number(params.id);

  const [token, setToken] = useState<string | undefined>(undefined);
  const [lead, setLead] = useState<LeadDetailRead | null>(null);
  const [logs, setLogs] = useState<UserActivityLogRead[]>([]);
  const [activityPage, setActivityPage] = useState<LeadActivityPageRead | null>(null);
  const [activityOffset, setActivityOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem("accessToken") || undefined;
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token || !leadId) return;

    async function fetchData() {
      try {
        setLoading(true);
        const [leadData, logsData] = await Promise.all([
          getLead(leadId, { token }),
          getLeadActivity(leadId, { skip: 0, limit: ACTIVITY_PAGE_SIZE }, { token })
        ]);
        setLead(leadData);
        setActivityOffset(0);
        setActivityPage(logsData || null);
        setLogs(logsData?.items || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load lead details.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [leadId, token]);

  useEffect(() => {
    if (!token || !leadId || loading) return;

    async function fetchActivityPage() {
      try {
        setActivityLoading(true);
        const logsData = await getLeadActivity(
          leadId,
          { skip: activityOffset, limit: ACTIVITY_PAGE_SIZE },
          { token }
        );
        setActivityPage(logsData);
        setLogs(logsData?.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity timeline.");
      } finally {
        setActivityLoading(false);
      }
    }

    fetchActivityPage();
  }, [activityOffset, leadId, token, loading]);

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl">
        <div className="animate-pulse flex flex-col gap-6">
          <div className="h-10 bg-slate-200 rounded w-1/4"></div>
          <div className="h-40 bg-slate-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="p-8 max-w-7xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Leads
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          <h2 className="text-lg font-bold mb-2">Error</h2>
          <p>{error || "Lead not found."}</p>
        </div>
      </div>
    );
  }

  const restaurantMedia = lead.restaurant?.profile_picture || lead.restaurant?.cover_photo || null;
  const restaurantMapsUrl = getGoogleMapsUrl(lead.restaurant?.address);
  const activityStart = activityPage ? activityPage.skip + 1 : 0;
  const activityEnd = activityPage ? activityPage.skip + logs.length : 0;
  const canGoPrev = activityOffset > 0;
  const canGoNext = Boolean(activityPage?.has_more);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-4 text-sm font-semibold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Leads
          </button>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            {lead.name}
            {lead.restaurant ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold tracking-wide uppercase">Restaurant Owner</span>
            ) : (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold tracking-wide uppercase">Platform Signup</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4" />
            Signed up on {new Date(lead.created_at).toLocaleDateString()} at {new Date(lead.created_at).toLocaleTimeString()}
            {lead.auth_provider && <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">via {lead.auth_provider}</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Contact & Restaurant Info */}
        <div className="lg:col-span-1 space-y-6">
          
          <Card className="p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-slate-400" />
              Contact Details
            </h2>
            <div className="space-y-5">
              {restaurantMedia ? (
                <div className="flex justify-center mb-6">
                  <img src={restaurantMedia} alt={lead.restaurant?.name || lead.name} className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-md" />
                </div>
              ) : (
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-24 rounded-full border-4 border-slate-50 shadow-md bg-slate-200 text-slate-700 flex items-center justify-center text-2xl font-black">
                    {getInitials(lead.restaurant?.name || lead.name)}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-orange-500" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Address</p>
                  <a href={`mailto:${lead.email}`} className="text-sm font-semibold text-slate-900 hover:text-orange-600 truncate block transition-colors">{lead.email}</a>
                </div>
              </div>
              <div className="flex items-center gap-4 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone Number</p>
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-sm font-semibold text-slate-900 hover:text-orange-600 transition-colors">{lead.phone}</a>
                  ) : (
                    <span className="text-sm font-medium italic text-slate-400">Not provided</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
              <a href={`mailto:${lead.email}`} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
                <Mail className="w-4 h-4" /> Email
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex-1 flex justify-center items-center gap-2 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm">
                  <Phone className="w-4 h-4" /> Call
                </a>
              )}
            </div>
          </Card>

          <Card className="p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Store className="w-5 h-5 text-slate-400" />
              Restaurant Setup
            </h2>
            {lead.restaurant ? (
              <div className="space-y-6">
                {lead.restaurant.cover_photo && (
                  <div className="h-32 w-full rounded-xl bg-slate-100 overflow-hidden relative mb-4 shadow-inner">
                    <img src={lead.restaurant.cover_photo} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                )}
                
                {lead.restaurant.profile_picture && (
                   <div className="flex items-center gap-4">
                     <img src={lead.restaurant.profile_picture} alt="Profile" className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Restaurant Name</p>
                        <p className="text-lg font-bold text-slate-900 leading-tight">{lead.restaurant.name}</p>
                     </div>
                   </div>
                )}

                {!lead.restaurant.profile_picture && (
                   <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Restaurant Name</p>
                     <p className="text-lg font-bold text-slate-900">{lead.restaurant.name}</p>
                   </div>
                )}

                <div className="flex gap-4 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                    {lead.restaurant.address ? (
                      <a
                        href={restaurantMapsUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-slate-800 underline decoration-slate-300 underline-offset-4 transition hover:text-orange-600 hover:decoration-orange-300"
                      >
                        {lead.restaurant.address}
                      </a>
                    ) : (
                      <span className="text-sm font-medium italic text-slate-400">Not provided</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Store className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-900">No Restaurant Yet</p>
                <p className="text-sm font-medium text-slate-500 mt-1 max-w-[200px] mx-auto">This lead hasn&apos;t set up their restaurant profile.</p>
              </div>
            )}
          </Card>

        </div>

        {/* Right Column: Stats & Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          {lead.restaurant && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-6 flex items-center gap-5 bg-white border border-orange-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 relative z-10">
                  <Utensils className="w-7 h-7" />
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Menus</p>
                  <p className="text-3xl font-black text-slate-900">{lead.stats.menus}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{getSetupSummary(lead.stats.menu_setup)}</p>
                </div>
              </Card>
              <Card className="p-6 flex items-center gap-5 bg-white border border-blue-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 relative z-10">
                  <TableProperties className="w-7 h-7" />
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tables</p>
                  <p className="text-3xl font-black text-slate-900">{lead.stats.tables}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{getSetupSummary(lead.stats.table_setup)}</p>
                </div>
              </Card>
              <Card className="p-6 flex items-center gap-5 bg-white border border-green-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 relative z-10">
                  <Receipt className="w-7 h-7" />
                </div>
                <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Orders</p>
                  <p className="text-3xl font-black text-slate-900">{lead.stats.orders}</p>
                </div>
              </Card>
            </div>
          )}

          {/* Activity Timeline */}
          <Card className="p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                   <Activity className="w-4 h-4 text-orange-600" />
                </div>
                Activity Timeline
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {activityPage ? `${activityStart}-${activityEnd} of ${activityPage.total}` : "0 results"}
                </span>
                <button
                  type="button"
                  onClick={() => setActivityOffset((value) => Math.max(0, value - ACTIVITY_PAGE_SIZE))}
                  disabled={!canGoPrev || activityLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  type="button"
                  onClick={() => setActivityOffset((value) => value + ACTIVITY_PAGE_SIZE)}
                  disabled={!canGoNext || activityLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activityLoading && logs.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p className="text-sm font-semibold text-slate-500">Loading activity…</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-lg font-bold text-slate-900">No activity yet</p>
                <p className="text-sm font-medium text-slate-500 mt-2 max-w-sm mx-auto">This restaurant hasn&apos;t performed any significant POS actions yet.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                {logs.map((log) => (
                  <div key={log.id} className="relative pl-8 group">
                    {/* Timeline dot */}
                    <div className="absolute -left-[11px] top-1.5 w-5 h-5 rounded-full border-4 border-white bg-orange-400 group-hover:scale-125 transition-transform duration-300 shadow-sm"></div>
                    
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 group-hover:border-orange-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <p className="text-base font-bold text-slate-900 capitalize flex items-center gap-2">
                          {log.action.replace(/_/g, " ")}
                        </p>
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-100">
                          <Clock className="w-3.5 h-3.5 text-orange-500" />
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-sm font-medium text-slate-600 mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                          {log.details}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-5 mt-4 pt-4 border-t border-slate-100">
                        {log.entity_type && log.entity_id && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-100">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            <span className="capitalize">{log.entity_type} #{log.entity_id}</span>
                          </div>
                        )}
                        {log.ip_address && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-100">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{log.ip_address}</span>
                          </div>
                        )}
                        {log.user_agent && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 max-w-[200px] bg-white px-2 py-1 rounded-md border border-slate-100" title={log.user_agent}>
                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{log.user_agent.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
