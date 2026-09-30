"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleX,
  ClipboardCheck,
  Crown,
  Loader2,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";

import {
  adjustBillingSubscriptionPeriod,
  assignRestaurantPlanDirectly,
  createBillingPlanVersion,
  createBillingSubscriptionOverride,
  deleteBillingSubscriptionOverride,
  getBillingEntitlementDefinitions,
  getBillingSubscriptions,
  getBillingUpgradeRequests,
  getPublicBillingCatalog,
  getRestaurants,
  publishBillingPlanVersion,
  resolveBillingUpgradeRequest,
  updateBillingPlanVersionEntitlements,
  type BackendRestaurant,
  type BillingEntitlementDefinition,
  type BillingEntitlementValue,
  type BillingPlan,
  type BillingPlanVersion,
  type BillingSubscription,
  type BillingUpgradeRequest,
} from "@/lib/backend-api";
import {
  canManageBillingCatalog,
  canManageBillingOverrides,
  canManageBillingSubscriptions,
  canPublishBillingCatalog,
  canViewBillingSubscriptions,
  getStoredAuthSession,
} from "@/lib/auth";

type DeskView = "restaurants" | "requests" | "history" | "plans";
const ASSIGNMENT_TERMS = [1, 3, 6, 12];

const token = () => window.localStorage.getItem("accessToken") || undefined;

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function unwrapSubscriptions(data: BillingSubscription[] | { items: BillingSubscription[] }) {
  return Array.isArray(data) ? data : data.items || [];
}

function isCurrentVersion(version: BillingPlanVersion) {
  if (version.status !== "published") return false;
  const starts = version.effective_from ? new Date(version.effective_from).getTime() : 0;
  return !Number.isNaN(starts) && starts <= Date.now();
}

function currentVersion(plan: BillingPlan) {
  const versions = [
    plan.published_version,
    plan.current_version,
    plan.latest_version,
    ...(plan.versions || []),
  ].filter((version): version is BillingPlanVersion => Boolean(version && isCurrentVersion(version)));
  return [...new Map(versions.map((version) => [version.id, version])).values()]
    .sort((left, right) => right.version_number - left.version_number)[0] || null;
}

function subscriptionRestaurantIds(subscription: BillingSubscription) {
  return subscription.restaurant_ids || subscription.restaurants?.map((restaurant) => restaurant.id) || (subscription.restaurant_id ? [subscription.restaurant_id] : []);
}

function label(value: string) {
  return value.replace(/[._-]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function valueFromOverride(subscription: BillingSubscription | null, key: string) {
  const override = subscription?.overrides?.find((item) => item.entitlement_key === key);
  return override?.override_value ?? override?.value;
}

function daysRemaining(subscription: BillingSubscription | null) {
  if (!subscription?.current_period_end) return null;
  const milliseconds = new Date(subscription.current_period_end).getTime() - Date.now();
  return Math.ceil(milliseconds / 86_400_000);
}

function remainingLabel(subscription: BillingSubscription | null) {
  const days = daysRemaining(subscription);
  if (days === null) return "No expiry set";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

function Toggle({ checked, disabled, onClick }: { checked: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 shrink-0 overflow-hidden rounded-full border-2 p-0 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "border-orange-500 bg-orange-500" : "border-slate-300 bg-white"}`}
    >
      <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function SubscriptionDesk({ initialView = "restaurants" }: { initialView?: DeskView }) {
  const session = getStoredAuthSession();
  const canView = canViewBillingSubscriptions(session);
  const canManagePlans = canManageBillingSubscriptions(session);
  const canManageOverrides = canManageBillingOverrides(session);
  const canEditCatalog = canManageBillingCatalog(session) && canPublishBillingCatalog(session);
  const [view, setView] = useState<DeskView>(initialView);
  const [restaurants, setRestaurants] = useState<BackendRestaurant[]>([]);
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [definitions, setDefinitions] = useState<BillingEntitlementDefinition[]>([]);
  const [requests, setRequests] = useState<BillingUpgradeRequest[]>([]);
  const [restaurantQuery, setRestaurantQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [assignmentDuration, setAssignmentDuration] = useState(12);
  const [adjustmentDays, setAdjustmentDays] = useState(0);
  const [featurePlanId, setFeaturePlanId] = useState<number | null>(null);
  const [featureDraft, setFeatureDraft] = useState<Record<string, BillingEntitlementValue>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [restaurantsResponse, subscriptionsResponse, catalogResponse, definitionsResponse, requestsResponse] = await Promise.all([
        getRestaurants({ token: token() }),
        getBillingSubscriptions({}, { token: token() }),
        getPublicBillingCatalog({ token: token() }),
        getBillingEntitlementDefinitions({ token: token() }),
        getBillingUpgradeRequests(undefined, { token: token() }),
      ]);
      const nextRestaurants = restaurantsResponse.data || [];
      const nextPlans = catalogResponse.data?.plans || [];
      setRestaurants(nextRestaurants);
      setSubscriptions(unwrapSubscriptions(subscriptionsResponse.data));
      setPlans(nextPlans);
      setDefinitions(definitionsResponse.data || []);
      setRequests(requestsResponse.data || []);
      setSelectedRestaurantId((current) => current ?? nextRestaurants[0]?.id ?? null);
      setSelectedPlanId((current) => current ?? nextPlans.find((plan) => plan.status === "active")?.id ?? null);
      setFeaturePlanId((current) => current ?? nextPlans.find((plan) => plan.status === "active")?.id ?? null);
    } catch (loadError) {
      setError(messageFrom(loadError, "Could not load subscription administration."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canView) void load(); else setLoading(false); }, [canView]);

  const subscriptionForRestaurant = (restaurantId: number) =>
    subscriptions.find((subscription) => subscriptionRestaurantIds(subscription).includes(restaurantId)) || null;
  const restaurantAssignmentSummary = (restaurantId: number) => {
    const subscription = subscriptionForRestaurant(restaurantId);
    return subscription ? `${subscription.plan_name || subscription.plan_code || "Plan"} · ${remainingLabel(subscription)}` : "No plan assigned";
  };

  const filteredRestaurants = useMemo(() => {
    const query = restaurantQuery.trim().toLowerCase();
    return restaurants.filter((restaurant) => {
      const subscription = subscriptionForRestaurant(restaurant.id);
      const planCode = subscription?.plan_code || "unassigned";
      const status = subscription?.effective_status || subscription?.status || "unassigned";
      const matchesQuery = !query || [restaurant.name, restaurant.address, restaurant.phone].some((value) => value?.toLowerCase().includes(query));
      return matchesQuery && (planFilter === "all" || planCode === planFilter) && (statusFilter === "all" || status === statusFilter);
    });
  }, [planFilter, restaurantQuery, restaurants, statusFilter, subscriptions]);
  const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null;
  const restaurantNameById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants],
  );
  const requestRestaurantName = (restaurantId: number) =>
    restaurantNameById.get(restaurantId) || `Restaurant #${restaurantId}`;
  const selectedSubscription = selectedRestaurantId === null ? null : subscriptionForRestaurant(selectedRestaurantId);
  const activePlans = plans.filter((plan) => plan.status === "active" && currentVersion(plan));
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId) || activePlans[0] || null;
  // An access term is controlled by the operator, not by a plan's historical
  // price rows. Every plan therefore exposes the same predictable choices.
  const assignmentTerms = ASSIGNMENT_TERMS;
  const selectedFeaturePlan = activePlans.find((plan) => plan.id === featurePlanId) || activePlans[0] || null;
  const selectedFeatureVersion = selectedFeaturePlan ? currentVersion(selectedFeaturePlan) : null;
  const pendingRequests = requests.filter((request) => !["completed", "rejected"].includes(request.status));
  const booleanDefinitions = definitions.filter((definition) => definition.value_type === "boolean" && definition.is_client_visible !== false);

  useEffect(() => {
    if (!selectedFeatureVersion) return;
    setFeatureDraft({ ...(selectedFeatureVersion.entitlements || {}) });
  }, [selectedFeatureVersion?.id]);

  useEffect(() => {
    if (!assignmentTerms.includes(assignmentDuration)) setAssignmentDuration(assignmentTerms[0] || 1);
  }, [assignmentDuration, assignmentTerms]);

  const applyPlan = async () => {
    const version = selectedPlan ? currentVersion(selectedPlan) : null;
    if (!selectedRestaurant || !version) return;
    setBusy("apply-plan"); setError(null);
    try {
      await assignRestaurantPlanDirectly(selectedRestaurant.id, { plan_version_id: version.id, duration_months: assignmentDuration }, { token: token() });
      setNotice(`${selectedRestaurant.name} is now on ${selectedPlan.name} for ${assignmentDuration} month${assignmentDuration === 1 ? "" : "s"}.`);
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not change this restaurant's plan."));
    } finally { setBusy(null); }
  };

  const adjustRemainingDays = async () => {
    if (!selectedRestaurant || !selectedSubscription || !Number.isInteger(adjustmentDays) || adjustmentDays === 0) return;
    setBusy("adjust-days"); setError(null);
    try {
      await adjustBillingSubscriptionPeriod(selectedSubscription.id, { days_delta: adjustmentDays }, { token: token() });
      setNotice(`${selectedRestaurant.name} now has ${adjustmentDays > 0 ? `${adjustmentDays} additional` : `${Math.abs(adjustmentDays)} fewer`} day${Math.abs(adjustmentDays) === 1 ? "" : "s"} of access.`);
      setAdjustmentDays(0);
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not adjust the remaining access days."));
    } finally { setBusy(null); }
  };

  const toggleOverride = async (definition: BillingEntitlementDefinition) => {
    if (!selectedSubscription || !canManageOverrides) return;
    const existingOverride = selectedSubscription.overrides?.find((item) => item.entitlement_key === definition.key);
    const current = valueFromOverride(selectedSubscription, definition.key);
    const base = selectedSubscription.plan_version && typeof selectedSubscription.plan_version !== "number"
      ? Boolean(selectedSubscription.plan_version.entitlements?.[definition.key])
      : false;
    const next = current === undefined ? !base : !Boolean(current);
    setBusy(`override-${definition.key}`); setError(null);
    try {
      if (existingOverride) {
        await deleteBillingSubscriptionOverride(
          selectedSubscription.id,
          existingOverride.id,
          "Replacing the restaurant feature override from the admin subscription desk",
          { token: token() },
        );
      }
      if (next === base) {
        setNotice(`${definition.label || label(definition.key)} returned to its plan default.`);
        await load();
        return;
      }
      await createBillingSubscriptionOverride(selectedSubscription.id, {
        entitlement_key: definition.key,
        override_value: next,
        reason: `${next ? "Enabled" : "Disabled"} from the admin subscription desk`,
      }, { token: token() });
      setNotice(`${definition.label || label(definition.key)} ${next ? "enabled" : "disabled"} for this restaurant.`);
      await load();
    } catch (saveError) { setError(messageFrom(saveError, "Could not update this feature.")); }
    finally { setBusy(null); }
  };

  const clearOverride = async (key: string) => {
    const override = selectedSubscription?.overrides?.find((item) => item.entitlement_key === key);
    if (!selectedSubscription || !override || !canManageOverrides) return;
    setBusy(`clear-${key}`); setError(null);
    try {
      await deleteBillingSubscriptionOverride(selectedSubscription.id, override.id, "Returned to plan defaults from the admin subscription desk", { token: token() });
      setNotice("Restaurant feature returned to its plan default."); await load();
    } catch (saveError) { setError(messageFrom(saveError, "Could not remove this feature override.")); }
    finally { setBusy(null); }
  };

  const resolveRequest = async (request: BillingUpgradeRequest, action: "approve" | "reject") => {
    setBusy(`request-${request.id}`); setError(null);
    try {
      await resolveBillingUpgradeRequest(request.id, action, request.billing_interval_months || assignmentDuration, { token: token() });
      setNotice(action === "approve" ? "Request approved and plan assigned." : "Request rejected.");
      await load();
    } catch (saveError) { setError(messageFrom(saveError, "Could not resolve this request.")); }
    finally { setBusy(null); }
  };

  const savePlanFeatures = async () => {
    if (!selectedFeaturePlan || !selectedFeatureVersion || !canEditCatalog) return;
    setBusy("save-plan-features"); setError(null);
    try {
      const draft = await createBillingPlanVersion(selectedFeaturePlan.id, { source_version_id: selectedFeatureVersion.id }, { token: token() });
      await updateBillingPlanVersionEntitlements(draft.data.id, featureDraft, { token: token() });
      await publishBillingPlanVersion(draft.data.id, "Plan features updated from the admin subscription desk", { token: token() });
      setNotice(`${selectedFeaturePlan.name} features published.`); await load();
    } catch (saveError) { setError(messageFrom(saveError, "Could not publish the plan features.")); }
    finally { setBusy(null); }
  };

  if (!canView) return <AccessDenied />;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-medium text-orange-600">Subscription desk</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Restaurant access, made simple.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Choose a restaurant, assign a plan term, and grant a specific feature only when it is needed.</p></div>
          <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-100">Refresh</button>
        </header>

        <nav className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Subscription desk">
          {([ ["restaurants", "Restaurants", Crown], ["requests", `Requests${pendingRequests.length ? ` (${pendingRequests.length})` : ""}`, ClipboardCheck], ["history", "History", ClipboardCheck], ["plans", "Plan features", Settings2] ] as const).map(([nextView, name, Icon]) => <button key={nextView} type="button" onClick={() => setView(nextView)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${view === nextView ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon className="h-4 w-4" />{name}</button>)}
        </nav>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {loading ? <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-orange-500" /></div> : null}

        {!loading && view === "restaurants" ? <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={restaurantQuery} onChange={(event) => setRestaurantQuery(event.target.value)} placeholder="Find a restaurant" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><div className="mt-3 grid grid-cols-2 gap-2"><select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium"><option value="all">All plans</option><option value="unassigned">No plan</option>{activePlans.map((plan) => <option key={plan.id} value={plan.code}>{plan.name}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium"><option value="all">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="canceled">Canceled</option><option value="unassigned">No plan</option></select></div><div className="mt-3 max-h-[60vh] divide-y overflow-y-auto">{filteredRestaurants.map((restaurant) => <button key={restaurant.id} type="button" onClick={() => setSelectedRestaurantId(restaurant.id)} className={`w-full px-2 py-3 text-left ${restaurant.id === selectedRestaurantId ? "rounded-lg bg-orange-50" : "hover:bg-slate-50"}`}><p className="text-sm font-semibold">{restaurant.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{restaurantAssignmentSummary(restaurant.id)}</p></button>)}</div></div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">{selectedRestaurant ? <><div className="border-b border-slate-200 px-5 py-5 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-slate-500">Selected restaurant</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{selectedRestaurant.name}</h2><p className="mt-1 text-sm text-slate-500">Current plan: <span className="font-medium text-slate-800">{selectedSubscription?.plan_name || selectedRestaurant.effective_plan || "No assigned plan"}</span></p>{selectedSubscription?.current_period_end ? <p className="mt-1 text-sm font-medium text-slate-700">{remainingLabel(selectedSubscription)} <span className="font-normal text-slate-500">· ends {new Date(selectedSubscription.current_period_end).toLocaleDateString()}</span></p> : null}</div><span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{selectedSubscription?.effective_status || selectedRestaurant.plan_state || "Ready"}</span></div></div>
            <div className="p-5 sm:p-6"><h3 className="text-base font-semibold">Change plan</h3><p className="mt-1 text-sm text-slate-500">Choose the plan and its term. Access ends automatically when the term ends; no invoice is created.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activePlans.map((plan) => { const version = currentVersion(plan); const selected = plan.id === selectedPlan?.id; return <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-slate-200 hover:border-slate-300"}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold">{plan.name}</p>{selected ? <Check className="h-4 w-4 text-orange-600" /> : null}</div><p className="mt-1 text-xs leading-5 text-slate-500">{plan.description || "Custom plan features"}</p><p className="mt-3 text-xs font-medium text-slate-600">Version {version?.version_number}</p></button>})}</div><div className="mt-5 max-w-xs"><label className="text-sm font-semibold text-slate-700">Assignment term<select value={assignmentDuration} onChange={(event) => setAssignmentDuration(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium">{assignmentTerms.map((months) => <option key={months} value={months}>{months} month{months === 1 ? "" : "s"}</option>)}</select></label><p className="mt-2 text-xs text-slate-500">The plan will expire after this term unless it is renewed or changed.</p></div><button type="button" disabled={!canManagePlans || !selectedPlan || busy === "apply-plan"} onClick={() => void applyPlan()} className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{busy === "apply-plan" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Apply {selectedPlan?.name || "plan"}</button></div>
            {selectedSubscription ? <section className="border-t border-slate-200 px-5 py-5 sm:px-6"><div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-base font-semibold">Adjust remaining days</h3><p className="mt-1 max-w-lg text-sm text-slate-500">Use a positive number to extend access or a negative number to shorten it. The plan and its features stay the same.</p></div><div className="flex w-full gap-2 sm:w-auto"><label className="min-w-0 flex-1 sm:w-36"><span className="sr-only">Days to add or remove</span><input type="number" min={-3650} max={3650} value={adjustmentDays || ""} onChange={(event) => setAdjustmentDays(event.target.value === "" ? 0 : Number(event.target.value))} placeholder="e.g. +7" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><button type="button" disabled={!canManagePlans || adjustmentDays === 0 || busy === "adjust-days"} onClick={() => void adjustRemainingDays()} className="h-11 shrink-0 rounded-xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">{busy === "adjust-days" ? "Saving..." : adjustmentDays > 0 ? `Add ${adjustmentDays}d` : adjustmentDays < 0 ? `Remove ${Math.abs(adjustmentDays)}d` : "Adjust days"}</button></div></div></section> : null}
            <FeatureOverrides definitions={booleanDefinitions} subscription={selectedSubscription} canManage={canManageOverrides} busy={busy} onToggle={toggleOverride} onClear={clearOverride} />
          </> : <Empty text="Choose a restaurant to manage its subscription." />}</div></section> : null}

        {!loading && view === "requests" ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-5 sm:px-6"><h2 className="text-xl font-semibold">Restaurant requests</h2><p className="mt-1 text-sm text-slate-500">Approve assigns the requested plan immediately. No invoice or separate fulfilment step is required here.</p></div><div className="divide-y">{pendingRequests.length ? pendingRequests.map((request) => <article key={request.id} className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold">{requestRestaurantName(request.restaurant_id)} requested {label(request.requested_plan_code)}</p><p className="mt-1 text-sm text-slate-500">{request.message || "No message provided"}</p><p className="mt-2 text-xs text-slate-400">Restaurant #{request.restaurant_id} · Requested {new Date(request.created_at).toLocaleDateString()}</p></div><div className="flex gap-2"><button type="button" disabled={!canManagePlans || busy === `request-${request.id}`} onClick={() => void resolveRequest(request, "reject")} className="inline-flex h-10 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><CircleX className="mr-2 h-4 w-4" />Reject</button><button type="button" disabled={!canManagePlans || busy === `request-${request.id}`} onClick={() => void resolveRequest(request, "approve")} className="inline-flex h-10 items-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{busy === `request-${request.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Approve & assign</button></div></article>) : <Empty text="No subscription requests need a decision." />}</div></section> : null}

        {!loading && view === "history" ? <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-5 sm:px-6"><h2 className="text-xl font-semibold">Plan assignment history</h2><p className="mt-1 text-sm text-slate-500">Every plan assignment is retained, including replaced and expired terms.</p></div><div className="divide-y">{subscriptions.length ? subscriptions.map((subscription) => <article key={subscription.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6"><div><p className="font-semibold">{subscription.restaurant_names?.join(", ") || subscriptionRestaurantIds(subscription).map(requestRestaurantName).join(", ") || subscription.billing_account_name || "Restaurant"}</p><p className="mt-1 text-sm text-slate-500">{subscription.plan_name || subscription.plan_code || "Plan"} · {subscription.status}</p></div><p className="text-sm text-slate-600">{subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString() : "Started"} – {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "No expiry"}</p><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${daysRemaining(subscription) !== null && daysRemaining(subscription)! < 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>{remainingLabel(subscription)}</span></article>) : <Empty text="No plan assignments have been recorded." />}</div></section> : null}

        {!loading && view === "plans" ? <section className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]"><div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-2 pb-2 pt-1 text-sm font-semibold">Plans</p>{activePlans.map((plan) => <button key={plan.id} type="button" onClick={() => setFeaturePlanId(plan.id)} className={`w-full rounded-xl px-3 py-3 text-left ${featurePlanId === plan.id ? "bg-orange-50 text-orange-900" : "hover:bg-slate-50"}`}><p className="text-sm font-semibold">{plan.name}</p><p className="mt-1 text-xs text-slate-500">{plan.description || "Plan feature set"}</p></button>)}</div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm">{selectedFeaturePlan && selectedFeatureVersion ? <><div className="border-b border-slate-200 px-5 py-5 sm:px-6"><h2 className="text-xl font-semibold">{selectedFeaturePlan.name} features</h2><p className="mt-1 text-sm text-slate-500">Turn features on or off for this plan. Saving creates and publishes a new version automatically, so existing subscriptions keep their recorded history.</p></div><div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">{definitions.filter((definition) => definition.is_client_visible !== false).map((definition) => <PlanFeatureField key={definition.key} definition={definition} value={featureDraft[definition.key]} onChange={(value) => setFeatureDraft((current) => ({ ...current, [definition.key]: value }))} />)}</div><div className="border-t border-slate-200 px-5 py-4 sm:px-6"><button type="button" disabled={!canEditCatalog || busy === "save-plan-features"} onClick={() => void savePlanFeatures()} className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy === "save-plan-features" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save plan features</button>{!canEditCatalog ? <p className="mt-2 text-xs text-slate-500">You need catalog and publish permission to change plan features.</p> : null}</div></> : <Empty text="No published plan version is available." />}</div></section> : null}
      </div>
    </main>
  );
}

function FeatureOverrides({ definitions, subscription, canManage, busy, onToggle, onClear }: { definitions: BillingEntitlementDefinition[]; subscription: BillingSubscription | null; canManage: boolean; busy: string | null; onToggle: (definition: BillingEntitlementDefinition) => Promise<void>; onClear: (key: string) => Promise<void> }) {
  if (!subscription) return <section className="border-t border-slate-200 px-5 py-6 sm:px-6"><h3 className="font-semibold">Extra features</h3><p className="mt-1 text-sm text-slate-500">Apply a plan first to enable restaurant-specific features.</p></section>;
  const planEntitlements = typeof subscription.plan_version === "object" ? subscription.plan_version?.entitlements || {} : {};
  return <section className="border-t border-slate-200 px-5 py-6 sm:px-6"><div><h3 className="font-semibold">Extra features for this restaurant</h3><p className="mt-1 text-sm text-slate-500">Override the plan only when this restaurant needs an exception. Remove an override to return to the plan default.</p></div><div className="mt-4 grid divide-y rounded-xl border border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">{definitions.map((definition) => { const override = subscription.overrides?.find((item) => item.entitlement_key === definition.key); const base = Boolean(planEntitlements[definition.key]); const value = override ? Boolean(override.override_value ?? override.value) : base; const changing = busy === `override-${definition.key}` || busy === `clear-${definition.key}`; return <div key={definition.key} className="flex items-center gap-3 p-4"><Toggle checked={value} disabled={!canManage || changing} onClick={() => void onToggle(definition)} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{definition.label || label(definition.key)}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{override ? "Restaurant override" : base ? "Included in this plan" : "Not included in this plan"}</p></div>{override ? <button type="button" disabled={!canManage || changing} onClick={() => void onClear(definition.key)} className="text-xs font-semibold text-orange-700 hover:text-orange-800 disabled:opacity-50">Reset</button> : null}</div>})}</div></section>;
}

function PlanFeatureField({ definition, value, onChange }: { definition: BillingEntitlementDefinition; value: BillingEntitlementValue; onChange: (value: BillingEntitlementValue) => void }) {
  return <div className="flex min-h-20 items-center gap-3 px-5 py-4 sm:px-6"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{definition.label || label(definition.key)}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{definition.description || definition.key}</p></div>{definition.value_type === "boolean" ? <Toggle checked={Boolean(value)} onClick={() => onChange(!Boolean(value))} /> : <input value={value == null ? "" : String(value)} type={definition.value_type === "integer" ? "number" : "text"} min={definition.value_type === "integer" ? 0 : undefined} onChange={(event) => onChange(definition.value_type === "integer" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)} className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />}</div>;
}

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) { return <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="px-6 py-12 text-center text-sm text-slate-500">{text}</div>; }
function AccessDenied() { return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"><h1 className="text-xl font-semibold">Subscription access is unavailable</h1><p className="mt-2 text-sm text-slate-500">Ask a platform administrator for billing access.</p></div></main>; }
