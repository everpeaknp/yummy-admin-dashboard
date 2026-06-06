"use client";

import { useEffect, useState } from "react";
import { 
  getLeads, 
  type LeadRead,
  getLeadRecipients,
  addLeadRecipient,
  removeLeadRecipient,
  toggleLeadRecipient,
  markLeadsAsRead,
  type LeadRecipientRead
} from "@/lib/backend-api";
import Card from "@/components/Card";
import { Phone, Mail, Clock, Store, Plus, Trash2, CheckSquare, Eye, Search, X } from "lucide-react";
import Link from "next/link";

export default function LeadsPage() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [canManageLeads, setCanManageLeads] = useState(false);
  
  // Leads Data
  const [leads, setLeads] = useState<LeadRead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  // Email Configuration Data
  const [recipients, setRecipients] = useState<LeadRecipientRead[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem("accessToken") || undefined;
    setToken(t);
    const sessionRaw = window.localStorage.getItem("yummy_auth_session");
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        const isSuper = session.primaryRole === "superadmin" || 
          (session.userRoles && session.userRoles.includes("superadmin"));
        setIsSuperadmin(isSuper);
        
        const perms = session.permissions || [];
        const isPlatform = session.primaryRole === "platform_staff" || 
          (session.userRoles && session.userRoles.includes("platform_staff"));
        const hasManagePerm = perms.some((p: string) => p === "platform.leads.manage" || p === "platform.*" || p === "*");
        
        setCanManageLeads(isSuper || (isPlatform && hasManagePerm));
      } catch (e) {}
    }
  }, []);

  const loadLeads = async (authToken: string) => {
    try {
      setLeadsLoading(true);
      const data = await getLeads({ token: authToken });
      setLeads(data);
      setLeadsError(null);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLeadsLoading(false);
    }
  };

  const loadRecipients = async (authToken: string) => {
    try {
      setRecipientsLoading(true);
      const response = await getLeadRecipients({ token: authToken });
      setRecipients(response || []);
      setRecipientsError(null);
    } catch (err) {
      setRecipientsError(err instanceof Error ? err.message : "Failed to load recipients.");
    } finally {
      setRecipientsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadLeads(token);
    if (isSuperadmin) {
      loadRecipients(token);
    }
  }, [token, isSuperadmin]);

  const handleAddRecipient = async () => {
    if (!token) return;
    setFormMessage(null);
    if (!formEmail.trim()) {
      setFormMessage("Email is required.");
      return;
    }

    try {
      await addLeadRecipient({
        email: formEmail.trim(),
        name: formName.trim() || undefined,
      }, { token });
      setFormEmail("");
      setFormName("");
      setFormMessage("Recipient added successfully.");
      loadRecipients(token);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Failed to add recipient.");
    }
  };

  const handleToggleRecipient = async (recipientId: number) => {
    if (!token) return;
    try {
      await toggleLeadRecipient(recipientId, { token });
      loadRecipients(token);
    } catch (error) {
      setRecipientsError(error instanceof Error ? error.message : "Failed to toggle recipient.");
    }
  };

  const handleRemoveRecipient = async (recipientId: number) => {
    if (!token) return;
    if (!window.confirm("Remove this recipient completely?")) return;
    
    try {
      await removeLeadRecipient(recipientId, { token });
      loadRecipients(token);
    } catch (error) {
      setRecipientsError(error instanceof Error ? error.message : "Failed to remove recipient.");
    }
  };

  const handleToggleSelectLead = (id: number) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedLeads(newSet);
  };

  const handleSelectAllUnread = () => {
    const unreadIds = leads.filter(l => !l.is_read).map(l => l.id);
    if (selectedLeads.size === unreadIds.length && unreadIds.length > 0) {
      setSelectedLeads(new Set()); // Deselect all
    } else {
      setSelectedLeads(new Set(unreadIds));
    }
  };

  const handleMarkAsRead = async () => {
    if (!token || selectedLeads.size === 0) return;
    try {
      setLeadsLoading(true);
      await markLeadsAsRead(Array.from(selectedLeads), { token });
      setSelectedLeads(new Set());
      await loadLeads(token);
    } catch (error) {
      setLeadsError(error instanceof Error ? error.message : "Failed to mark leads as read.");
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleApplySearch = () => {
    setAppliedSearch(searchInput.trim().toLowerCase());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearch("");
  };

  if (leadsLoading && recipientsLoading && leads.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Lead Generation</h1>
        <div className="text-sm text-slate-500">Loading data...</div>
      </div>
    );
  }

  const filteredLeads = leads.filter((lead) => {
    if (!appliedSearch) return true;
    const haystack = [
      lead.name,
      lead.email,
      lead.phone,
      lead.restaurant_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(appliedSearch);
  });

  const unreadLeads = filteredLeads.filter(l => !l.is_read);
  const readLeads = filteredLeads.filter(l => l.is_read);
  const unreadCount = unreadLeads.length;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lead Generation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor recent signups and manage your lead notification team.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-700">Search Leads</label>
            <div className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplySearch();
                }}
                placeholder="Search by name, email, phone, or restaurant"
                className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplySearch}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {(searchInput || appliedSearch) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
        {appliedSearch && (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Showing results for <span className="font-semibold text-slate-700">&quot;{appliedSearch}&quot;</span>
          </p>
        )}
      </Card>

      {isSuperadmin && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Email Notification Recipients</h2>
              <p className="text-sm text-slate-500 max-w-2xl mt-1">
                Add team members who should receive an email automatically whenever a new user signs up in the system.
              </p>
            </div>
          </div>

          {recipientsError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {recipientsError}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-slate-200 p-4 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Add Team Member Email</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-700">Name (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  placeholder="marketing@yummy.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddRecipient}
                className="w-full sm:w-auto rounded-lg bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm font-semibold text-white h-[38px] flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {formMessage && (
              <p className={`mt-2 text-sm ${formMessage.includes("Failed") || formMessage.includes("required") ? "text-red-600" : "text-green-600"}`}>
                {formMessage}
              </p>
            )}
          </div>

          <div className="mt-6">
            {recipientsLoading ? (
              <p className="text-sm text-slate-500">Loading recipients...</p>
            ) : recipients.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recipients.map((recipient) => (
                  <div key={recipient.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-slate-900 truncate">{recipient.name || "Unnamed"}</p>
                      <p className="text-xs text-slate-500 truncate">{recipient.email}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleRecipient(recipient.id)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          recipient.is_active 
                            ? "bg-green-100 text-green-700 hover:bg-green-200" 
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {recipient.is_active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => handleRemoveRecipient(recipient.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No notification recipients configured.</p>
            )}
          </div>
        </Card>
      )}

      <div>
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab("unread")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "unread"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Unread Leads {unreadCount > 0 && <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">{unreadCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab("read")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "read"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Read Leads
          </button>
        </div>

        {activeTab === "unread" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Recent Leads Tracker
              </h2>
              <div className="flex items-center gap-3">
                {canManageLeads && (
                  <>
                    <button
                      onClick={handleSelectAllUnread}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {selectedLeads.size > 0 && selectedLeads.size === unreadCount ? "Deselect All" : "Select Unread"}
                    </button>
                    <button
                      onClick={handleMarkAsRead}
                      disabled={selectedLeads.size === 0 || leadsLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        selectedLeads.size === 0 || leadsLoading
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      <CheckSquare className="w-4 h-4" />
                      Mark as Read ({selectedLeads.size})
                    </button>
                  </>
                )}
              </div>
            </div>

            {leadsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-6">
                {leadsError}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leadsLoading && leads.length === 0 ? (
                <div className="col-span-full text-sm text-slate-500">Loading leads...</div>
              ) : unreadLeads.length > 0 ? (
                unreadLeads.map((lead) => (
                  <Card 
                    key={lead.id} 
                    className={`p-5 flex flex-col gap-4 border-2 shadow-sm transition-all ${
                      canManageLeads ? "cursor-pointer hover:shadow-md" : ""
                    } ${
                      selectedLeads.has(lead.id) 
                        ? "border-orange-500 bg-orange-50/30" 
                        : "border-slate-200"
                    }`}
                    onClick={() => {
                      if (canManageLeads) {
                        handleToggleSelectLead(lead.id);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{lead.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(lead.created_at).toLocaleDateString()} at {new Date(lead.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        New Lead
                      </div>
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-600 transition-colors">{lead.email}</a>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-600 transition-colors">{lead.phone}</a>
                        ) : (
                          <span className="text-slate-400 italic">No phone provided</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Store className="w-4 h-4 text-slate-400" />
                        {lead.restaurant_name ? (
                          <span className="font-medium text-slate-900">{lead.restaurant_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Platform Signup (No Restaurant)</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 mt-auto flex gap-3">
                      <a 
                        href={`mailto:${lead.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </a>
                      {lead.phone && (
                        <a 
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 flex justify-center items-center gap-2 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                      )}
                    </div>
                    <div className="pt-2">
                      <Link 
                        href={`/dashboard/leads/${lead.id}`}
                        className="w-full flex justify-center items-center gap-2 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Link>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <h3 className="text-lg font-semibold text-slate-900">No unread leads</h3>
                  <p className="text-sm text-slate-500 mt-1">When new users sign up, they will appear here.</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "read" && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Already Read Leads
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {readLeads.length > 0 ? (
                readLeads.map((lead) => (
                  <Card 
                    key={lead.id} 
                    className="p-5 flex flex-col gap-4 border-2 shadow-sm transition-all border-slate-200 bg-white"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{lead.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(lead.created_at).toLocaleDateString()} at {new Date(lead.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-semibold">
                        Read
                      </div>
                    </div>

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-600 transition-colors">{lead.email}</a>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-600 transition-colors">{lead.phone}</a>
                        ) : (
                          <span className="text-slate-400 italic">No phone provided</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Store className="w-4 h-4 text-slate-400" />
                        {lead.restaurant_name ? (
                          <span className="font-medium text-slate-900">{lead.restaurant_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Platform Signup (No Restaurant)</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100 mt-auto flex gap-3">
                      <a 
                        href={`mailto:${lead.email}`}
                        className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Email
                      </a>
                      {lead.phone && (
                        <a 
                          href={`tel:${lead.phone}`}
                          className="flex-1 flex justify-center items-center gap-2 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                      )}
                    </div>
                    <div className="pt-2">
                      <Link 
                        href={`/dashboard/leads/${lead.id}`}
                        className="w-full flex justify-center items-center gap-2 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </Link>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <h3 className="text-lg font-semibold text-slate-900">No read leads</h3>
                  <p className="text-sm text-slate-500 mt-1">Leads that you&apos;ve marked as read will appear here.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
