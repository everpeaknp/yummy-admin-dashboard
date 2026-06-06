"use client";

import { useEffect, useState } from "react";
import { 
  getPlatformStaff,
  createPlatformStaff,
  updatePlatformStaff,
  updatePlatformStaffPassword,
  type PlatformStaffRead
} from "@/lib/backend-api";
import Card from "@/components/Card";
import { Plus, Edit2, Key, Shield, User as UserIcon } from "lucide-react";

const PERMISSION_OPTIONS = [
  { id: "platform.restaurants.view", label: "View Restaurants", description: "Can view the list of restaurants" },
  { id: "platform.restaurants.manage", label: "Manage Restaurants", description: "Can edit and manage restaurants" },
  { id: "platform.leads.view", label: "View Leads", description: "Can view platform leads" },
  { id: "platform.leads.manage", label: "Manage Leads", description: "Can mark leads as read and configure emails" },
  { id: "platform.staff.view", label: "View Staff", description: "Can view other platform staff" },
  { id: "platform.staff.manage", label: "Manage Staff", description: "Can create and edit staff accounts" },
  { id: "platform.billing.manage", label: "Manage Billing", description: "Can configure billing plans" },
];

export default function PlatformStaffPage() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [staff, setStaff] = useState<PlatformStaffRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<PlatformStaffRead | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<PlatformStaffRead | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    permissions: [] as string[],
    is_active: true
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem("accessToken") || undefined;
    setToken(t);
    const sessionRaw = window.localStorage.getItem("yummy_auth_session");
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        setIsSuperadmin(
          session.primaryRole === "superadmin" || 
          (session.userRoles && session.userRoles.includes("superadmin"))
        );
      } catch (e) {}
    }
  }, []);

  const loadStaff = async (authToken: string) => {
    try {
      setLoading(true);
      const data = await getPlatformStaff({ token: authToken });
      setStaff(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadStaff(token);
  }, [token]);

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", permissions: [], is_active: true });
    setFormError(null);
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    try {
      await createPlatformStaff({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        permissions: formData.permissions
      }, { token });
      setShowCreateModal(false);
      resetForm();
      loadStaff(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create staff");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !showEditModal) return;
    setFormError(null);
    try {
      await updatePlatformStaff(showEditModal.id, {
        name: formData.name,
        email: formData.email,
        permissions: formData.permissions,
        is_active: formData.is_active
      }, { token });
      setShowEditModal(null);
      resetForm();
      loadStaff(token);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update staff");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !showPasswordModal) return;
    setFormError(null);
    try {
      await updatePlatformStaffPassword(showPasswordModal.id, {
        new_password: formData.password
      }, { token });
      setShowPasswordModal(null);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update password");
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Super Admin privileges required to manage platform staff.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Staff</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage admin dashboard access and configure granular permissions.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-slate-500 text-sm">Loading staff...</div>
        ) : staff.length === 0 ? (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <Shield className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900">No staff members yet</h3>
            <p className="text-sm text-slate-500 mt-1">Add your team members to grant them access to the dashboard.</p>
          </div>
        ) : (
          staff.map((member) => (
            <Card key={member.id} className="p-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{member.name}</h3>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-2">Permissions ({member.permissions.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {member.permissions.length > 0 ? (
                    member.permissions.map(perm => (
                      <span key={perm} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-600">
                        {perm.split('.').pop()}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No permissions</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setFormData({
                      name: member.name,
                      email: member.email,
                      password: "",
                      permissions: member.permissions,
                      is_active: member.is_active
                    });
                    setShowEditModal(member);
                  }}
                  className="flex-1 flex justify-center items-center gap-1.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowPasswordModal(member);
                  }}
                  className="flex-1 flex justify-center items-center gap-1.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" /> Password
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-2xl bg-white p-6 shadow-xl my-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {showCreateModal ? 'Add Staff Member' : 'Edit Staff Member'}
            </h2>
            
            {formError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={showCreateModal ? handleCreateSubmit : handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              {showCreateModal && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  />
                </div>
              )}

              {showEditModal && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                    Account is Active
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Permissions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERMISSION_OPTIONS.map(opt => (
                    <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${formData.permissions.includes(opt.id) ? 'border-orange-500 bg-orange-50/30' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="mt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(opt.id)}
                          onChange={() => togglePermission(opt.id)}
                          className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{opt.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
                >
                  {showCreateModal ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Change Password</h2>
            <p className="text-sm text-slate-500 mb-6">Updating password for {showPasswordModal.name}</p>
            
            {formError && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  Update
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
