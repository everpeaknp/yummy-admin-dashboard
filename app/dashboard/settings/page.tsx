"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import Card from "@/components/Card";
import {
  addRestaurantAdmin,
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  getBuiltInRoles,
  getPermissionsCatalog,
  getRestaurantAdmins,
  getRestaurants,
  getRoles,
  getUsers,
  removeRestaurantAdmin,
  updateRole,
  updateUser,
  updateUserPermissions,
  type AdminInvitePayload,
  type BackendRestaurant,
  type BackendUser,
  type PermissionRead,
  type RestaurantAdminItem,
  type RoleRead,
  type RoleCreatePayload,
  type RoleUpdatePayload,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "@/lib/backend-api";

const ROLE_FALLBACK = [
  "superadmin",
  "admin",
  "manager",
  "staff",
  "kitchen",
  "waiter",
  "cashier",
  "delivery",
  "customer",
];

const TABS = [
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles & Permissions" },
  { key: "admins", label: "Restaurant Admins" },
  { key: "settings", label: "Settings" },
];

const EMPTY_USER_FORM = {
  name: "",
  email: "",
  password: "",
  role: "staff",
  roleMode: "built-in" as "built-in" | "custom",
  customRoleId: "",
  restaurantId: "",
};

const EMPTY_ROLE_FORM = {
  name: "",
  description: "",
  permissions: [] as string[],
};

const EMPTY_ADMIN_FORM: AdminInvitePayload = {
  name: "",
  email: "",
  password: "",
};

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleDateString();
}

function groupPermissions(perms: PermissionRead[]) {
  const groups = new Map<string, PermissionRead[]>();
  perms.forEach((perm) => {
    const key = perm.module || "general";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(perm);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("users");
  const [token, setToken] = useState<string | undefined>(undefined);

  const [users, setUsers] = useState<BackendUser[]>([]);
  const [roles, setRoles] = useState<RoleRead[]>([]);
  const [permissions, setPermissions] = useState<PermissionRead[]>([]);
  const [builtInRoles, setBuiltInRoles] = useState<Record<string, string[]>>({});
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [restaurantAdmins, setRestaurantAdmins] = useState<RestaurantAdminItem[]>([]);

  const [usersLoading, setUsersLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const [usersError, setUsersError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormMessage, setUserFormMessage] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<BackendUser | null>(null);
  const [editForm, setEditForm] = useState<UserUpdatePayload>({});
  const [editRoleMode, setEditRoleMode] = useState<"built-in" | "custom">("built-in");
  const [editCustomRoleId, setEditCustomRoleId] = useState<string>("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editPermissionsEnabled, setEditPermissionsEnabled] = useState(false);

  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [roleFormMessage, setRoleFormMessage] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [adminForm, setAdminForm] = useState<AdminInvitePayload>(EMPTY_ADMIN_FORM);
  const [adminFormMessage, setAdminFormMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setToken(window.localStorage.getItem("accessToken") || undefined);
  }, []);

  const loadUsers = async (search?: string) => {
    if (!token) {
      return;
    }
    setUsersLoading(true);
    try {
      const response = await getUsers(search, { token });
      setUsers(response.data || []);
      setUsersError(null);
    } catch (error) {
      setUsers([]);
      setUsersError(error instanceof Error ? error.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadRoles = async () => {
    if (!token) {
      return;
    }
    setRolesLoading(true);
    try {
      const [rolesResult, permissionsResult, builtInResult] = await Promise.allSettled([
        getRoles({ token }),
        getPermissionsCatalog({ token }),
        getBuiltInRoles({ token }),
      ]);

      if (rolesResult.status === "fulfilled") {
        setRoles(rolesResult.value.data || []);
      } else {
        setRoles([]);
      }

      if (permissionsResult.status === "fulfilled") {
        setPermissions(permissionsResult.value.data || []);
      } else {
        setPermissions([]);
      }

      if (builtInResult.status === "fulfilled") {
        setBuiltInRoles(builtInResult.value.data || {});
      } else {
        setBuiltInRoles({});
      }

      setRolesError(null);
    } catch (error) {
      setRoles([]);
      setPermissions([]);
      setBuiltInRoles({});
      setRolesError(error instanceof Error ? error.message : "Failed to load roles.");
    } finally {
      setRolesLoading(false);
    }
  };

  const loadRestaurants = async () => {
    if (!token) {
      return;
    }
    setRestaurantsLoading(true);
    try {
      const response = await getRestaurants({ token });
      const data = response.data || [];
      setRestaurants(data);
      if (!selectedRestaurantId && data.length) {
        setSelectedRestaurantId(data[0].id);
      }
    } catch (error) {
      setRestaurants([]);
    } finally {
      setRestaurantsLoading(false);
    }
  };

  const loadRestaurantAdmins = async (restaurantId: number) => {
    if (!token) {
      return;
    }
    setAdminsLoading(true);
    try {
      const response = await getRestaurantAdmins(restaurantId, { token });
      setRestaurantAdmins(response.data || []);
      setAdminsError(null);
    } catch (error) {
      setRestaurantAdmins([]);
      setAdminsError(error instanceof Error ? error.message : "Failed to load restaurant admins.");
    } finally {
      setAdminsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }
    loadUsers();
    loadRoles();
    loadRestaurants();
  }, [token]);

  useEffect(() => {
    if (!selectedRestaurantId) {
      return;
    }
    loadRestaurantAdmins(selectedRestaurantId);
  }, [selectedRestaurantId]);

  const builtInRoleOptions = useMemo(() => {
    const keys = Object.keys(builtInRoles);
    return keys.length ? keys.sort() : ROLE_FALLBACK;
  }, [builtInRoles]);

  const customRoleOptions = useMemo(() => roles.filter((role) => !role.is_system_role), [roles]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => {
      const haystack = [user.name, user.email, user.role, user.primary_role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [userSearch, users]);

  const permissionsByModule = useMemo(() => groupPermissions(permissions), [permissions]);

  const resetUserForm = () => {
    setUserForm(EMPTY_USER_FORM);
    setShowCreateUser(false);
    setUserFormError(null);
  };

  const handleCreateUser = async () => {
    if (!token) {
      return;
    }
    setUserFormError(null);
    setUserFormMessage(null);

    if (!userForm.name.trim() || !userForm.email.trim()) {
      setUserFormError("Name and email are required.");
      return;
    }

    const payload: UserCreatePayload = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.roleMode === "custom" ? "staff" : userForm.role,
    };

    if (userForm.password.trim()) {
      payload.password = userForm.password.trim();
    }

    if (userForm.roleMode === "custom") {
      if (!userForm.customRoleId) {
        setUserFormError("Select a custom role.");
        return;
      }
      payload.custom_role_id = Number(userForm.customRoleId);
    }

    if (userForm.restaurantId) {
      payload.restaurant_id = Number(userForm.restaurantId);
    }

    try {
      await createUser(payload, { token });
      setUserFormMessage("User created successfully.");
      resetUserForm();
      loadUsers();
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : "Failed to create user.");
    }
  };

  const handleEditUser = (user: BackendUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      restaurant_id: user.restaurant_id ?? null,
      custom_role_id: user.custom_role_id ?? null,
    });
    setEditRoleMode(user.custom_role_id ? "custom" : "built-in");
    setEditCustomRoleId(user.custom_role_id ? String(user.custom_role_id) : "");
    setEditPermissions(user.permissions || []);
    setEditPermissionsEnabled(false);
    setUserFormMessage(null);
  };

  const handleUpdateUser = async () => {
    if (!token || !editingUser) {
      return;
    }

    const payload: UserUpdatePayload = {
      name: editForm.name,
      email: editForm.email,
      role: editRoleMode === "custom" ? "staff" : editForm.role,
      restaurant_id: editForm.restaurant_id ?? null,
    };

    if (editRoleMode === "custom" && editCustomRoleId) {
      payload.custom_role_id = Number(editCustomRoleId);
    }

    try {
      await updateUser(editingUser.id, payload, { token });
      if (editPermissionsEnabled) {
        await updateUserPermissions(editingUser.id, editPermissions, { token });
      }
      setUserFormMessage("User updated successfully.");
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : "Failed to update user.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!token) {
      return;
    }
    const confirmed = window.confirm("Remove this user? This will deactivate the account.");
    if (!confirmed) {
      return;
    }
    try {
      await deleteUser(userId, { token });
      loadUsers();
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to remove user.");
    }
  };

  const handleSaveRole = async () => {
    if (!token) {
      return;
    }
    if (!roleForm.name.trim()) {
      setRoleFormError("Role name is required.");
      return;
    }
    setRoleFormError(null);
    setRoleFormMessage(null);

    const payload: RoleCreatePayload | RoleUpdatePayload = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim() || null,
      permissions: roleForm.permissions,
    };

    try {
      if (editingRoleId) {
        await updateRole(editingRoleId, payload, { token });
        setRoleFormMessage("Role updated successfully.");
      } else {
        await createRole(payload as RoleCreatePayload, { token });
        setRoleFormMessage("Role created successfully.");
      }
      setEditingRoleId(null);
      setRoleForm(EMPTY_ROLE_FORM);
      loadRoles();
    } catch (error) {
      setRoleFormError(error instanceof Error ? error.message : "Failed to save role.");
    }
  };

  const handleEditRole = (role: RoleRead) => {
    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions || [],
    });
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!token) {
      return;
    }
    const confirmed = window.confirm("Delete this role? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    try {
      await deleteRole(roleId, { token });
      loadRoles();
    } catch (error) {
      setRoleFormError(error instanceof Error ? error.message : "Failed to delete role.");
    }
  };

  const handleAddAdmin = async () => {
    if (!token || !selectedRestaurantId) {
      return;
    }
    setAdminFormMessage(null);
    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password.trim()) {
      setAdminFormMessage("Name, email, and password are required.");
      return;
    }

    try {
      await addRestaurantAdmin(selectedRestaurantId, {
        name: adminForm.name.trim(),
        email: adminForm.email.trim(),
        password: adminForm.password.trim(),
      }, { token });
      setAdminForm(EMPTY_ADMIN_FORM);
      setAdminFormMessage("Admin added successfully.");
      loadRestaurantAdmins(selectedRestaurantId);
    } catch (error) {
      setAdminFormMessage(error instanceof Error ? error.message : "Failed to add admin.");
    }
  };

  const handleRemoveAdmin = async (userId: number) => {
    if (!token || !selectedRestaurantId) {
      return;
    }
    const confirmed = window.confirm("Remove this admin from the restaurant?");
    if (!confirmed) {
      return;
    }
    try {
      await removeRestaurantAdmin(selectedRestaurantId, userId, { token });
      loadRestaurantAdmins(selectedRestaurantId);
    } catch (error) {
      setAdminsError(error instanceof Error ? error.message : "Failed to remove admin.");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f5f7fa]">
      <header className="bg-white px-8 py-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Access & Settings</h1>
            <p className="text-sm text-slate-500 mt-1">Manage users, roles, and restaurant admins.</p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-orange-500 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "users" ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Users</h2>
                  <p className="text-sm text-slate-500">Staff and admin accounts for the current restaurant.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    placeholder="Search users"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-64"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateUser((prev) => !prev)}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {showCreateUser ? "Close" : "Add user"}
                  </button>
                </div>
              </div>

              {usersError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {usersError}
                </div>
              ) : null}

              {showCreateUser ? (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Name</label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Password (optional)</label>
                    <input
                      type="text"
                      value={userForm.password}
                      onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Role mode</label>
                    <select
                      value={userForm.roleMode}
                      onChange={(event) => setUserForm({ ...userForm, roleMode: event.target.value as "built-in" | "custom" })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="built-in">Built-in</option>
                      <option value="custom">Custom role</option>
                    </select>
                  </div>
                  {userForm.roleMode === "built-in" ? (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Role</label>
                      <select
                        value={userForm.role}
                        onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {builtInRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {titleCase(role)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Custom role</label>
                      <select
                        value={userForm.customRoleId}
                        onChange={(event) => setUserForm({ ...userForm, customRoleId: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select role</option>
                        {customRoleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Restaurant (optional)</label>
                    <select
                      value={userForm.restaurantId}
                      onChange={(event) => setUserForm({ ...userForm, restaurantId: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Use current</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Create user
                    </button>
                    <button
                      type="button"
                      onClick={resetUserForm}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      Cancel
                    </button>
                    {userFormError ? (
                      <span className="text-sm text-red-600">{userFormError}</span>
                    ) : null}
                    {userFormMessage ? (
                      <span className="text-sm text-green-600">{userFormMessage}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-3">User</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Restaurant</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          Loading users...
                        </td>
                      </tr>
                    ) : filteredUsers.length ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-slate-100">
                          <td className="py-4">
                            <div className="font-semibold text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </td>
                          <td className="py-4 text-sm text-slate-700">
                            {titleCase(user.primary_role || user.role)}
                          </td>
                          <td className="py-4 text-sm text-slate-600">
                            {user.restaurant_id ? `#${user.restaurant_id}` : "-"}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditUser(user)}
                              className="text-sm font-semibold text-orange-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              className="ml-4 text-sm font-semibold text-red-500"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {editingUser ? (
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Edit {editingUser.name}</h3>
                    <p className="text-sm text-slate-500">Update role, restaurant, or permissions.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-sm font-semibold text-slate-500"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Name</label>
                    <input
                      type="text"
                      value={editForm.name || ""}
                      onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Role mode</label>
                    <select
                      value={editRoleMode}
                      onChange={(event) => setEditRoleMode(event.target.value as "built-in" | "custom")}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="built-in">Built-in</option>
                      <option value="custom">Custom role</option>
                    </select>
                  </div>
                  {editRoleMode === "built-in" ? (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Role</label>
                      <select
                        value={editForm.role || ""}
                        onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        {builtInRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {titleCase(role)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Custom role</label>
                      <select
                        value={editCustomRoleId}
                        onChange={(event) => setEditCustomRoleId(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select role</option>
                        {customRoleOptions.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Restaurant</label>
                    <select
                      value={editForm.restaurant_id ?? ""}
                      onChange={(event) => setEditForm({ ...editForm, restaurant_id: Number(event.target.value) || null })}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Use current</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editPermissionsEnabled}
                      onChange={(event) => setEditPermissionsEnabled(event.target.checked)}
                    />
                    Override permissions
                  </label>
                  {editPermissionsEnabled ? (
                    <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm">
                      {permissionsByModule.map(([module, items]) => (
                        <div key={module} className="mb-4">
                          <p className="text-xs font-semibold uppercase text-slate-500">{module}</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {items.map((perm) => (
                              <label key={perm.key} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={editPermissions.includes(perm.key)}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setEditPermissions((prev) =>
                                      checked ? [...prev, perm.key] : prev.filter((key) => key !== perm.key),
                                    );
                                  }}
                                />
                                <span>
                                  <span className="font-semibold text-slate-700">{perm.key}</span>
                                  <span className="block text-xs text-slate-500">{perm.description || perm.title || ""}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleUpdateUser}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Save user
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                  {userFormError ? (
                    <span className="text-sm text-red-600">{userFormError}</span>
                  ) : null}
                  {userFormMessage ? (
                    <span className="text-sm text-green-600">{userFormMessage}</span>
                  ) : null}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {activeTab === "roles" ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Built-in roles</h2>
                <p className="text-sm text-slate-500">System roles and their permission counts.</p>
              </div>
              {rolesError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {rolesError}
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(builtInRoles).length ? (
                  Object.entries(builtInRoles).map(([role, perms]) => (
                    <div key={role} className="rounded-lg border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{titleCase(role)}</p>
                      <p className="text-xs text-slate-500">{perms.length} permissions</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No built-in roles available.</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Custom roles</h2>
                  <p className="text-sm text-slate-500">Create or edit restaurant-specific roles.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoleId(null);
                    setRoleForm(EMPTY_ROLE_FORM);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  New role
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Description</th>
                      <th className="pb-3">Permissions</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolesLoading ? (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          Loading roles...
                        </td>
                      </tr>
                    ) : roles.length ? (
                      roles.map((role) => (
                        <tr key={role.id} className="border-b border-slate-100">
                          <td className="py-4 text-sm font-semibold text-slate-900">{role.name}</td>
                          <td className="py-4 text-sm text-slate-600">{role.description || "-"}</td>
                          <td className="py-4 text-sm text-slate-600">{role.permissions.length}</td>
                          <td className="py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditRole(role)}
                              className="text-sm font-semibold text-orange-600"
                            >
                              Edit
                            </button>
                            {!role.is_system_role ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(role.id)}
                                className="ml-4 text-sm font-semibold text-red-500"
                              >
                                Delete
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          No roles available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Role name</label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Permissions</label>
                  <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm">
                    {permissionsByModule.map(([module, items]) => (
                      <div key={module} className="mb-4">
                        <p className="text-xs font-semibold uppercase text-slate-500">{module}</p>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {items.map((perm) => (
                            <label key={perm.key} className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={roleForm.permissions.includes(perm.key)}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  setRoleForm((prev) => ({
                                    ...prev,
                                    permissions: checked
                                      ? [...prev.permissions, perm.key]
                                      : prev.permissions.filter((key) => key !== perm.key),
                                  }));
                                }}
                              />
                              <span>
                                <span className="font-semibold text-slate-700">{perm.key}</span>
                                <span className="block text-xs text-slate-500">{perm.description || perm.title || ""}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {editingRoleId ? "Update role" : "Create role"}
                  </button>
                  {roleFormError ? (
                    <span className="text-sm text-red-600">{roleFormError}</span>
                  ) : null}
                  {roleFormMessage ? (
                    <span className="text-sm text-green-600">{roleFormMessage}</span>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "admins" ? (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Restaurant admins</h2>
                  <p className="text-sm text-slate-500">Assign admin users to restaurants.</p>
                </div>
                <select
                  value={selectedRestaurantId ?? ""}
                  onChange={(event) => setSelectedRestaurantId(Number(event.target.value) || null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {restaurantsLoading ? (
                    <option>Loading...</option>
                  ) : restaurants.length ? (
                    restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))
                  ) : (
                    <option>No restaurants</option>
                  )}
                </select>
              </div>

              {adminsError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {adminsError}
                </div>
              ) : null}

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Name</label>
                  <input
                    type="text"
                    value={adminForm.name}
                    onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={adminForm.email}
                    onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Temporary password</label>
                  <input
                    type="text"
                    value={adminForm.password}
                    onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddAdmin}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Add admin
                  </button>
                  {adminFormMessage ? (
                    <span className="text-sm text-slate-600">{adminFormMessage}</span>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="pb-3">Admin</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Added</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminsLoading ? (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          Loading admins...
                        </td>
                      </tr>
                    ) : restaurantAdmins.length ? (
                      restaurantAdmins.map((admin) => (
                        <tr key={admin.id} className="border-b border-slate-100">
                          <td className="py-4">
                            <div className="font-semibold text-slate-900">{admin.name}</div>
                            <div className="text-xs text-slate-500">{admin.email}</div>
                          </td>
                          <td className="py-4 text-sm text-slate-700">
                            {admin.is_owner ? "Owner" : "Admin"}
                          </td>
                          <td className="py-4 text-sm text-slate-600">{formatDate(admin.added_at)}</td>
                          <td className="py-4 text-right">
                            {admin.is_owner ? (
                              <span className="text-xs text-slate-400">Owner</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveAdmin(admin.id)}
                                className="text-sm font-semibold text-red-500"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-4 text-sm text-slate-500" colSpan={4}>
                          No admins found for this restaurant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900">Display preferences</h2>
              <p className="text-sm text-slate-500">Choose how the dashboard looks for your session.</p>
              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                    theme === "light"
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Light mode
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                    theme === "dark"
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  Dark mode
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-900">System notes</h2>
              <p className="text-sm text-slate-500">Some settings still require backend automation.</p>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
                <li>Global maintenance mode is not wired yet.</li>
                <li>Trial extension defaults to backend rules.</li>
              </ul>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
