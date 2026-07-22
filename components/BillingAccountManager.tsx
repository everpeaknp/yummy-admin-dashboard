"use client";

import { useEffect, useMemo, useState } from "react";
import {
  replaceBillingAccountRestaurants,
  updateBillingAccount,
  type BillingAccount,
  type BillingSubscription,
} from "@/lib/backend-api";

type Props = {
  accounts: BillingAccount[];
  restaurants: Array<{ id: number; name: string; registered_by?: number | null }>;
  subscriptions: BillingSubscription[];
  canManage: boolean;
  onSaved: () => Promise<void>;
};

function token() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function BillingAccountManager({ accounts, restaurants, subscriptions, canManage, onSaved }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(accounts[0]?.id || null);
  const [name, setName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [metadataReason, setMetadataReason] = useState("");
  const [restaurantIds, setRestaurantIds] = useState<number[]>([]);
  const [primaryRestaurantId, setPrimaryRestaurantId] = useState<number | null>(null);
  const [allowMove, setAllowMove] = useState(false);
  const [membershipReason, setMembershipReason] = useState("");
  const [restaurantSearch, setRestaurantSearch] = useState("");
  const [busy, setBusy] = useState<"metadata" | "restaurants" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = accounts.find((account) => account.id === selectedId) || null;
  const selectedSubscription = subscriptions.find((subscription) => subscription.billing_account_id === selected?.id) || selected?.current_subscription || null;

  useEffect(() => {
    if (selectedId !== null && accounts.some((account) => account.id === selectedId)) return;
    setSelectedId(accounts[0]?.id || null);
  }, [accounts, selectedId]);

  useEffect(() => {
    setName(selected?.name || "");
    setOwnerUserId(selected?.owner_user_id ? String(selected.owner_user_id) : "");
    const memberships = selected?.restaurants || [];
    setRestaurantIds(memberships.map((membership) => membership.restaurant_id));
    setPrimaryRestaurantId(
      memberships.find((membership) => membership.is_primary)?.restaurant_id ||
      memberships[0]?.restaurant_id ||
      null,
    );
    setMetadataReason("");
    setMembershipReason("");
    setAllowMove(false);
    setError(null);
    setNotice(null);
    // Reset only when the operator switches accounts; a same-account refresh
    // after saving should keep the success notice and current form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const ownershipByRestaurant = useMemo(() => {
    const map = new Map<number, BillingAccount>();
    accounts.forEach((account) => account.restaurants.forEach((membership) => map.set(membership.restaurant_id, account)));
    return map;
  }, [accounts]);

  const ownerCandidates = useMemo(() => {
    const map = new Map<number, string[]>();
    restaurants.forEach((restaurant) => {
      if (!restaurant.registered_by) return;
      map.set(restaurant.registered_by, [...(map.get(restaurant.registered_by) || []), restaurant.name]);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [restaurants]);

  const visibleRestaurants = useMemo(() => {
    const query = restaurantSearch.trim().toLowerCase();
    return restaurants
      .filter((restaurant) =>
        restaurantIds.includes(restaurant.id) ||
        !query ||
        restaurant.name.toLowerCase().includes(query) ||
        String(restaurant.id).includes(query),
      )
      .sort((a, b) => Number(restaurantIds.includes(b.id)) - Number(restaurantIds.includes(a.id)) || a.name.localeCompare(b.name))
      .slice(0, 200);
  }, [restaurantIds, restaurantSearch, restaurants]);

  const usageItems = Object.entries(selectedSubscription?.usage || {});
  const branchUsage = usageItems.find(([key]) => key.toLowerCase().includes("branch"))?.[1];
  const userUsage = usageItems.find(([key]) => key.toLowerCase().includes("user"))?.[1];

  const saveMetadata = async () => {
    if (!selected || !name.trim() || metadataReason.trim().length < 3) {
      setError("Account name and an audit reason of at least 3 characters are required.");
      return;
    }
    const ownerText = ownerUserId.trim();
    if (selected.owner_user_id && !ownerText) {
      setError("A billing account owner cannot be cleared. Enter a valid linked owner user ID.");
      return;
    }
    const nextOwnerId = ownerText ? Number(ownerText) : null;
    if (ownerText && (!Number.isInteger(nextOwnerId) || Number(nextOwnerId) <= 0)) {
      setError("Owner user ID must be a positive integer.");
      return;
    }
    setBusy("metadata");
    setError(null);
    setNotice(null);
    try {
      await updateBillingAccount(
        selected.id,
        {
          name: name.trim(),
          ...(nextOwnerId !== selected.owner_user_id && nextOwnerId !== null ? { owner_user_id: nextOwnerId } : {}),
          reason: metadataReason.trim(),
        },
        { token: token() },
      );
      setNotice("Billing account ownership details updated.");
      await onSaved();
    } catch (saveError) {
      setError(message(saveError, "Failed to update the billing account."));
    } finally {
      setBusy(null);
    }
  };

  const saveRestaurants = async () => {
    if (!selected || !restaurantIds.length || !primaryRestaurantId || membershipReason.trim().length < 3) {
      setError("Select at least one restaurant, choose the primary branch, and provide an audit reason of at least 3 characters.");
      return;
    }
    setBusy("restaurants");
    setError(null);
    setNotice(null);
    try {
      await replaceBillingAccountRestaurants(
        selected.id,
        {
          restaurant_ids: restaurantIds,
          primary_restaurant_id: primaryRestaurantId,
          allow_move: allowMove,
          reason: membershipReason.trim(),
        },
        { token: token() },
      );
      setNotice("Billing account branches updated. Quotas continue to apply across the entire account.");
      await onSaved();
    } catch (saveError) {
      setError(message(saveError, "Failed to update billing account branches."));
    } finally {
      setBusy(null);
    }
  };

  if (!accounts.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Billing account ownership &amp; branches</h2>
          <p className="mt-1 text-sm text-slate-500">A subscription and its branch/user limits belong to this account, not to each restaurant separately.</p>
        </div>
        <select value={selectedId || ""} onChange={(event) => setSelectedId(Number(event.target.value))} className="min-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} (#{account.id})</option>)}
        </select>
      </div>

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</p> : null}

      {selected ? (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Account details</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info label="Currency" value={selected.currency} />
              <Info label="Status" value={selected.status} />
              <Info label="Branches" value={branchUsage ? `${branchUsage.used} / ${branchUsage.limit === null ? "Unlimited" : branchUsage.limit}` : String(selected.restaurants.length)} />
              <Info label="Users (staff included)" value={userUsage ? `${userUsage.used} / ${userUsage.limit === null ? "Unlimited" : userUsage.limit}` : "Live quota unavailable"} />
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Account name" value={name} onChange={setName} disabled={!canManage} />
              <label className="block">
                <Label>Owner user ID</Label>
                <input list="billing-owner-candidates" type="number" min={1} value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)} disabled={!canManage} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50" />
                <datalist id="billing-owner-candidates">{ownerCandidates.map(([ownerId, names]) => <option key={ownerId} value={ownerId}>{[...new Set(names)].join(", ")}</option>)}</datalist>
                <span className="mt-1 block text-xs text-slate-500">The backend accepts only an active owner/admin/member of a linked restaurant.</span>
              </label>
              <Field label="Audit reason" value={metadataReason} onChange={setMetadataReason} disabled={!canManage} />
              {canManage ? <button type="button" onClick={saveMetadata} disabled={Boolean(busy)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy === "metadata" ? "Saving..." : "Save account details"}</button> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-900">Linked restaurants</h3>
            <p className="mt-1 text-xs text-slate-500">Exactly one selected restaurant must be the primary branch. Moving a restaurant is explicit and audited.</p>
            <input value={restaurantSearch} onChange={(event) => setRestaurantSearch(event.target.value)} placeholder="Search restaurant name or ID..." className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {visibleRestaurants.map((restaurant) => {
                const checked = restaurantIds.includes(restaurant.id);
                const currentAccount = ownershipByRestaurant.get(restaurant.id);
                const belongsElsewhere = Boolean(currentAccount && currentAccount.id !== selected.id);
                return (
                  <div key={restaurant.id} className={`rounded-lg border p-3 ${belongsElsewhere ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManage}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setRestaurantIds((old) => [...new Set([...old, restaurant.id])]);
                            setPrimaryRestaurantId((old) => old || restaurant.id);
                          } else {
                            const remaining = restaurantIds.filter((id) => id !== restaurant.id);
                            setRestaurantIds(remaining);
                            if (primaryRestaurantId === restaurant.id) setPrimaryRestaurantId(remaining[0] || null);
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{restaurant.name}</p>
                        <p className="text-xs text-slate-500">Restaurant #{restaurant.id}{belongsElsewhere ? ` - currently in ${currentAccount?.name}` : ""}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <input type="radio" name="primary-billing-restaurant" checked={primaryRestaurantId === restaurant.id} disabled={!canManage || !checked} onChange={() => setPrimaryRestaurantId(restaurant.id)} />
                        Primary
                      </label>
                    </div>
                  </div>
                );
              })}
              {!visibleRestaurants.length ? <p className="py-6 text-center text-sm text-slate-500">No restaurants match this search.</p> : null}
            </div>
            {restaurants.length > visibleRestaurants.length ? <p className="mt-2 text-xs text-slate-500">Showing selected branches and the first 200 search matches.</p> : null}
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input type="checkbox" checked={allowMove} onChange={(event) => setAllowMove(event.target.checked)} disabled={!canManage} className="mt-0.5" />
              <span><span className="font-semibold">Allow explicit moves</span><span className="mt-0.5 block text-xs">Move selected restaurants out of another billing account when necessary. The backend blocks unsafe moves and enforces branch and user limits.</span></span>
            </label>
            <div className="mt-3"><Field label="Audit reason" value={membershipReason} onChange={setMembershipReason} disabled={!canManage} /></div>
            {canManage ? <button type="button" onClick={saveRestaurants} disabled={Boolean(busy)} className="mt-3 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{busy === "restaurants" ? "Saving..." : "Save linked restaurants"}</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-slate-600">{children}</span>;
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="block"><Label>{label}</Label><input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50" /></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>;
}
