"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import {
  adjustBillingSubscriptionPeriod,
  assignRestaurantPlanDirectly,
  switchBillingSubscriptionCurrentPlan,
  createBillingSubscriptionOverride,
  deleteBillingSubscriptionOverride,
  getBillingEntitlementDefinitions,
  getBillingPlanVersion,
  getBillingSubscriptions,
  getPublicBillingCatalog,
  isBackendRouteUnavailable,
  type BackendRestaurant,
  type BillingEntitlementDefinition,
  type BillingPlan,
  type BillingPlanVersion,
  type BillingSubscription,
} from "@/lib/backend-api";
import {
  canManageBillingOverrides,
  canManageBillingSubscriptions,
  canViewBillingSubscriptions,
  getStoredAuthSession,
} from "@/lib/auth";

type Props = {
  restaurant: BackendRestaurant;
  legacyMode: "paid" | "free" | "trial_paid";
  legacyTrialEndsAt: string;
  legacyPaidEndsAt: string;
  legacySaving: boolean;
  canManageLegacy: boolean;
  onLegacyModeChange: (mode: "paid" | "free" | "trial_paid") => void;
  onLegacyTrialEndsAtChange: (value: string) => void;
  onLegacyPaidEndsAtChange: (value: string) => void;
  onV2AvailabilityChange?: (available: boolean) => void;
};

const ASSIGNMENT_TERMS = [1, 3, 6, 12];
const GROW_LIMIT_KEYS = ["grow.messages.monthly", "grow.campaigns.monthly_limit", "grow.campaigns.max_recipients"];

const token = () => window.localStorage.getItem("accessToken") || undefined;

function unwrap(data: BillingSubscription[] | { items: BillingSubscription[] }) {
  return Array.isArray(data) ? data : data.items || [];
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isCurrentVersion(version: BillingPlanVersion) {
  if (version.status !== "published") return false;
  const starts = version.effective_from ? new Date(version.effective_from).getTime() : 0;
  return !Number.isNaN(starts) && starts <= Date.now();
}

function currentVersion(plan: BillingPlan) {
  const versions = [plan.published_version, plan.current_version, plan.latest_version, ...(plan.versions || [])]
    .filter((version): version is BillingPlanVersion => Boolean(version && isCurrentVersion(version)));
  return [...new Map(versions.map((version) => [version.id, version])).values()]
    .sort((left, right) => right.version_number - left.version_number)[0] || null;
}

function matchesRestaurant(subscription: BillingSubscription, restaurantId: number) {
  return subscription.restaurant_id === restaurantId || Boolean(subscription.restaurant_ids?.includes(restaurantId));
}

function label(value: string) {
  return value.replace(/[._-]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function valueFromOverride(subscription: BillingSubscription | null, key: string) {
  const override = subscription?.overrides?.find((item) => item.entitlement_key === key);
  return override?.override_value ?? override?.value;
}

function expiryAt(subscription: BillingSubscription | null) {
  if (!subscription) return null;
  return subscription.effective_status === "trialing" || subscription.status === "trialing"
    ? subscription.trial_ends_at || subscription.current_period_end || null
    : subscription.current_period_end || null;
}

function expiryLabel(subscription: BillingSubscription | null) {
  return subscription?.effective_status === "trialing" || subscription?.status === "trialing" ? "Trial ends" : "Ends";
}

function daysRemaining(subscription: BillingSubscription | null) {
  const expiresAt = expiryAt(subscription);
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

function remainingLabel(subscription: BillingSubscription | null) {
  const days = daysRemaining(subscription);
  if (days === null) return "No expiry set";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString();
}

export default function RestaurantSubscriptionCard(props: Props) {
  const session = getStoredAuthSession();
  const canView = canViewBillingSubscriptions(session);
  const canManagePlans = canManageBillingSubscriptions(session);
  const canManageOverrides = canManageBillingOverrides(session);
  const [mode, setMode] = useState<"loading" | "v2" | "legacy" | "error">("loading");
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [definitions, setDefinitions] = useState<BillingEntitlementDefinition[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [assignmentDuration, setAssignmentDuration] = useState(12);
  const [adjustmentDays, setAdjustmentDays] = useState("");
  const [switchPriceId, setSwitchPriceId] = useState("");
  const [switchReason, setSwitchReason] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (!canView) {
      setMode("error");
      setError("You do not have permission to view subscription access.");
      return;
    }
    setError(null);
    try {
      const [subscriptionsResponse, catalogResponse, definitionsResponse] = await Promise.all([
        getBillingSubscriptions({ restaurantId: props.restaurant.id }, { token: token() }),
        getPublicBillingCatalog({ token: token() }),
        getBillingEntitlementDefinitions({ token: token() }),
      ]);
      const history = unwrap(subscriptionsResponse.data).filter((subscription) => matchesRestaurant(subscription, props.restaurant.id));
      const catalogPlans = catalogResponse.data?.plans || [];
      const activeSubscription = history.find((subscription) => ["active", "trialing", "grace"].includes(subscription.effective_status || subscription.status)) || history[0] || null;
      const catalogVersion = activeSubscription
        ? catalogPlans.flatMap((plan) => plan.versions || [currentVersion(plan)].filter(Boolean)).find((version) => version?.id === activeSubscription.plan_version_id) || null
        : null;
      const assignedVersion = activeSubscription
        ? await getBillingPlanVersion(activeSubscription.plan_version_id, { token: token() }).then((response) => response.data || catalogVersion).catch(() => catalogVersion)
        : null;
      const hydratedHistory = activeSubscription && assignedVersion
        ? history.map((subscription) => subscription.id === activeSubscription.id ? { ...subscription, plan_version: assignedVersion } : subscription)
        : history;
      setSubscriptions(hydratedHistory);
      setPlans(catalogPlans);
      setDefinitions(definitionsResponse.data || []);
      setSelectedPlanId((current) => current ?? assignedVersion?.plan_id ?? catalogVersion?.plan_id ?? catalogPlans.find((plan) => plan.status === "active" && currentVersion(plan))?.id ?? null);
      setMode("v2");
      props.onV2AvailabilityChange?.(true);
    } catch (loadError) {
      if (isBackendRouteUnavailable(loadError)) {
        setMode("legacy");
        props.onV2AvailabilityChange?.(false);
        setError(null);
        return;
      }
      setMode("error");
      setError(messageFrom(loadError, "Could not load subscription access."));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.restaurant.id, canView]);

  const currentSubscription = useMemo(
    () => subscriptions.find((subscription) => ["active", "trialing", "grace"].includes(subscription.effective_status || subscription.status)) || subscriptions[0] || null,
    [subscriptions],
  );
  const activePlans = useMemo(() => plans.filter((plan) => plan.status === "active" && currentVersion(plan)), [plans]);
  const selectedPlan = activePlans.find((plan) => plan.id === selectedPlanId) || activePlans[0] || null;
  const assignedPlanVersion = currentSubscription?.plan_version_number
    ?? (typeof currentSubscription?.plan_version === "object" ? currentSubscription.plan_version?.version_number : null);
  const selectedPlanVersion = selectedPlan ? currentVersion(selectedPlan) : null;
  const switchPrices = (selectedPlanVersion?.prices || []).filter((price) => {
    const now = Date.now();
    return price.id && price.is_active !== false
      && (!price.effective_from || new Date(price.effective_from).getTime() <= now)
      && (!price.effective_to || new Date(price.effective_to).getTime() >= now);
  });
  const currentPrice = currentSubscription?.plan_version_prices?.find((price) => price.id === currentSubscription.selected_price_id);
  const matchingPrice = switchPrices.find((price) => price.billing_interval_months === currentPrice?.billing_interval_months && price.price_type === currentPrice?.price_type)
    || switchPrices.find((price) => price.billing_interval_months === currentPrice?.billing_interval_months && price.price_type !== "renewal")
    || (switchPrices.length === 1 ? switchPrices[0] : null);
  const selectedSwitchPriceId = switchPriceId ? Number(switchPriceId) : matchingPrice?.id ?? null;
  const canSwitch = Boolean(currentSubscription && ["active", "trialing", "grace"].includes(currentSubscription.effective_status || currentSubscription.status)
    && selectedPlanVersion && selectedPlanVersion.id !== currentSubscription.plan_version_id);
  const selectedPlanIsNewer = Boolean(
    currentSubscription
    && selectedPlan
    && currentSubscription.plan_code === selectedPlan.code
    && assignedPlanVersion
    && selectedPlanVersion
    && selectedPlanVersion.version_number > assignedPlanVersion,
  );
  const booleanDefinitions = definitions.filter((definition) => definition.value_type === "boolean" && definition.is_client_visible !== false);
  const growLimitDefinitions = definitions.filter((definition) => definition.value_type === "integer" && GROW_LIMIT_KEYS.includes(definition.key));

  const applyPlan = async () => {
    const version = selectedPlan ? currentVersion(selectedPlan) : null;
    if (!version || !selectedPlan) return;
    if (currentSubscription && !window.confirm(`Start a new ${assignmentDuration}-month ${selectedPlan.name} term for ${props.restaurant.name}? This replaces the current access dates and feature exceptions.`)) return;
    setBusy("apply-plan");
    setError(null);
    try {
      await assignRestaurantPlanDirectly(
        props.restaurant.id,
        { plan_version_id: version.id, duration_months: assignmentDuration },
        { token: token() },
      );
      setNotice(`${props.restaurant.name} is now on ${selectedPlan.name} for ${assignmentDuration} month${assignmentDuration === 1 ? "" : "s"}.`);
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not change this restaurant's plan."));
    } finally {
      setBusy(null);
    }
  };

  const switchCurrentPlan = async () => {
    if (!currentSubscription || !selectedPlanVersion || !selectedPlan || !canSwitch || switchReason.trim().length < 3 || (switchPrices.length && !selectedSwitchPriceId)) return;
    if (!window.confirm(`Switch ${props.restaurant.name} to ${selectedPlan.name} version ${selectedPlanVersion.version_number}? The current access dates and exceptions will be preserved. This affects every restaurant on the billing account.`)) return;
    setBusy("switch-plan");
    setError(null);
    try {
      await switchBillingSubscriptionCurrentPlan(currentSubscription.id, {
        plan_version_id: selectedPlanVersion.id,
        selected_price_id: selectedSwitchPriceId,
        reason: switchReason.trim(),
      }, { token: token() });
      setSwitchReason("");
      setSwitchPriceId("");
      setNotice(`${props.restaurant.name} switched to ${selectedPlan.name} version ${selectedPlanVersion.version_number}. Access dates were preserved.`);
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not switch the current plan."));
    } finally {
      setBusy(null);
    }
  };

  const adjustRemainingDays = async () => {
    const days = Number(adjustmentDays);
    if (!currentSubscription?.current_period_end || !["active", "trialing", "grace"].includes(currentSubscription.effective_status || currentSubscription.status) || !Number.isInteger(days) || days < 1 || days > 3650 || extensionReason.trim().length < 3) return;
    setBusy("adjust-days");
    setError(null);
    try {
      await adjustBillingSubscriptionPeriod(currentSubscription.id, { days_delta: days, reason: extensionReason.trim() }, { token: token() });
      setNotice(`${days} day${days === 1 ? "" : "s"} added to this restaurant's access.`);
      setAdjustmentDays("");
      setExtensionReason("");
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not adjust the remaining access days."));
    } finally {
      setBusy(null);
    }
  };

  const toggleOverride = async (definition: BillingEntitlementDefinition) => {
    if (!currentSubscription || !canManageOverrides) return;
    const existingOverride = currentSubscription.overrides?.find((item) => item.entitlement_key === definition.key);
    const planEntitlements = typeof currentSubscription.plan_version === "object" ? currentSubscription.plan_version?.entitlements || {} : {};
    const base = Boolean(planEntitlements[definition.key]);
    const current = valueFromOverride(currentSubscription, definition.key);
    const next = current === undefined ? !base : !Boolean(current);
    setBusy(`override-${definition.key}`);
    setError(null);
    try {
      if (existingOverride) {
        await deleteBillingSubscriptionOverride(
          currentSubscription.id,
          existingOverride.id,
          "Replacing the restaurant feature override from this restaurant access page",
          { token: token() },
        );
      }
      if (next === base) {
        setNotice(`${definition.label || label(definition.key)} returned to its plan default.`);
      } else {
        await createBillingSubscriptionOverride(
          currentSubscription.id,
          {
            entitlement_key: definition.key,
            override_value: next,
            reason: `${next ? "Enabled" : "Disabled"} from this restaurant access page`,
          },
          { token: token() },
        );
        setNotice(`${definition.label || label(definition.key)} ${next ? "enabled" : "disabled"} for this restaurant.`);
      }
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not update this feature."));
    } finally {
      setBusy(null);
    }
  };

  const clearOverride = async (definition: BillingEntitlementDefinition) => {
    const override = currentSubscription?.overrides?.find((item) => item.entitlement_key === definition.key);
    if (!currentSubscription || !override || !canManageOverrides) return;
    setBusy(`clear-${definition.key}`);
    setError(null);
    try {
      await deleteBillingSubscriptionOverride(
        currentSubscription.id,
        override.id,
        "Returned to the plan default from this restaurant access page",
        { token: token() },
      );
      setNotice(`${definition.label || label(definition.key)} returned to its plan default.`);
      await load();
    } catch (saveError) {
      setError(messageFrom(saveError, "Could not remove this feature override."));
    } finally {
      setBusy(null);
    }
  };

  const saveGrowLimit = async (definition: BillingEntitlementDefinition, value: number | null) => {
    if (!currentSubscription || !canManageOverrides) return;
    const existing = currentSubscription.overrides?.find((item) => item.entitlement_key === definition.key);
    const planEntitlements = typeof currentSubscription.plan_version === "object" ? currentSubscription.plan_version?.entitlements || {} : {};
    const planValue = planEntitlements[definition.key] ?? null;
    setBusy(`limit-${definition.key}`);
    setError(null);
    try {
      if (value !== planValue) {
        await createBillingSubscriptionOverride(currentSubscription.id, {
          entitlement_key: definition.key,
          override_value: value,
          reason: "Restaurant Grow limit set from restaurant access page",
        }, { token: token() });
      }
      if (existing) {
        await deleteBillingSubscriptionOverride(currentSubscription.id, existing.id, "Replacing restaurant Grow limit", { token: token() });
      }
      setNotice(`${definition.label || label(definition.key)} ${value === planValue ? "reset to the plan default" : "updated for this restaurant"}.`);
      await load();
    } catch (saveError) {
      await load();
      setError(messageFrom(saveError, "Could not update this Grow limit."));
    } finally {
      setBusy(null);
    }
  };

  if (mode === "loading") {
    return <Card className="p-6 xl:col-span-3"><h2 className="text-lg font-bold text-slate-900">Plan & access</h2><p className="mt-2 text-sm text-slate-500">Loading restaurant access...</p></Card>;
  }

  if (mode === "legacy") {
    return <LegacyCard {...props} />;
  }

  if (mode === "error") {
    return <Card className="p-6 xl:col-span-3"><h2 className="text-lg font-bold text-slate-900">Plan & access</h2><p className="mt-2 text-sm text-red-600">{error || "Unable to load subscription access."}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Retry</button></Card>;
  }

  return (
    <Card className="overflow-hidden xl:col-span-3">
      <section className="border-b border-slate-200 bg-gradient-to-r from-orange-50 via-white to-white px-6 py-6 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Restaurant access</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Plan & access for {props.restaurant.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Set a clear access term, make a plan change, or grant an exception without opening a billing workflow.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy !== null} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">Refresh access</button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
      </section>

      <section className="grid divide-y divide-slate-200 lg:grid-cols-[minmax(17rem,0.7fr)_minmax(0,1.6fr)] lg:divide-x lg:divide-y-0">
        <aside className="bg-slate-50/70 p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current access</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-slate-950">{currentSubscription?.plan_name || currentSubscription?.plan_code || "No plan assigned"}</p><p className="mt-1 text-sm text-slate-500">{currentSubscription?.effective_status || currentSubscription?.status || "Not active"}</p></div><Status value={currentSubscription?.effective_status || currentSubscription?.status || "unassigned"} /></div>
            <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-2xl font-bold tracking-tight text-slate-900">{remainingLabel(currentSubscription)}</p><p className="mt-1 text-sm text-slate-500">{expiryLabel(currentSubscription)} {formatDate(expiryAt(currentSubscription))}</p></div>
          </div>
          <div className="mt-5 space-y-3 text-sm"><SummaryRow label="Started" value={formatDate(currentSubscription?.current_period_start || currentSubscription?.started_at)} /><SummaryRow label="Plan version" value={currentSubscription ? `Version ${assignedPlanVersion || currentSubscription.plan_version_id}` : "—"} /><SummaryRow label="Feature exceptions" value={currentSubscription?.overrides?.length ? `${currentSubscription.overrides.length} active` : "None"} /></div>
        </aside>

        <div className="p-6 sm:p-7">
          <div><h3 className="text-lg font-bold text-slate-950">Choose a plan</h3><p className="mt-1 text-sm leading-6 text-slate-500">Select the current published version to switch this access or start a new term.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activePlans.map((plan) => {
              const version = currentVersion(plan);
              const selected = plan.id === selectedPlan?.id;
              return <button key={plan.id} type="button" onClick={() => { setSelectedPlanId(plan.id); setSwitchPriceId(""); }} className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${selected ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-950">{plan.name}</p>{selected ? <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Selected</span> : null}</div><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{plan.description || "Configured restaurant access"}</p><p className="mt-3 text-xs font-semibold text-slate-600">Version {version?.version_number}</p></button>;
            })}
          </div>
          {selectedPlanIsNewer ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">This restaurant is on {selectedPlan?.name} version {assignedPlanVersion}. Version {selectedPlanVersion?.version_number} is available. Use “Switch current plan” to keep the existing term.</p> : null}
          {!activePlans.length ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">There are no published plans to assign yet.</p> : null}
          {currentSubscription ? <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
            <h4 className="text-sm font-bold text-slate-900">Switch current plan</h4>
            <p className="mt-1 text-sm leading-5 text-slate-600">Keep the current start and end dates, feature exceptions, and add-ons. Existing invoices stay on the previous plan. The selected price is used for the next renewal invoice, if the term renews.</p>
            {(currentSubscription.restaurant_ids?.length || 0) > 1 ? <p className="mt-2 text-sm font-semibold text-amber-800">This billing account covers {currentSubscription.restaurant_ids?.length} restaurants; the switch affects all of them.</p> : null}
            {switchPrices.length ? <label className="mt-4 block max-w-sm"><span className="text-sm font-semibold text-slate-800">Price at renewal</span><select name="switch_price_id" value={selectedSwitchPriceId ?? ""} onChange={(event) => setSwitchPriceId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100"><option value="">Choose price</option>{switchPrices.map((price) => <option key={price.id} value={price.id}>{price.billing_interval_months || "Custom"} month{price.billing_interval_months === 1 ? "" : "s"} · {price.price_type} · {price.quote_only ? "Quote required" : new Intl.NumberFormat("en-NP", { style: "currency", currency: price.currency }).format(Number(price.amount))}</option>)}</select></label> : null}
            <label className="mt-4 block"><span className="text-sm font-semibold text-slate-800">Reason for audit</span><input type="text" name="switch_reason" autoComplete="off" value={switchReason} maxLength={500} onChange={(event) => setSwitchReason(event.target.value)} placeholder="Why is this plan being switched?" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100" /></label>
            <button type="button" disabled={!canManagePlans || busy !== null || !canSwitch || switchReason.trim().length < 3 || (switchPrices.length > 0 && !selectedSwitchPriceId)} onClick={() => void switchCurrentPlan()} className="mt-4 h-11 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{busy === "switch-plan" ? "Switching..." : "Switch current plan"}</button>
            {!canSwitch ? <p className="mt-2 text-xs text-slate-500">Choose a different plan or a newer version to enable the switch.</p> : null}
          </div> : null}
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="block min-w-52"><span className="block text-sm font-semibold text-slate-800">Start a new term</span><select value={assignmentDuration} onChange={(event) => setAssignmentDuration(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{ASSIGNMENT_TERMS.map((months) => <option key={months} value={months}>{months} month{months === 1 ? "" : "s"}</option>)}</select></label>
            <div className="sm:text-right"><p className="text-xs leading-5 text-slate-500">Replaces the current access period and does not create a payment or invoice.</p><button type="button" disabled={!canManagePlans || !selectedPlan || busy !== null} onClick={() => void applyPlan()} className="mt-3 inline-flex h-11 items-center justify-center rounded-xl border border-orange-300 bg-white px-5 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">{busy === "apply-plan" ? "Applying..." : `Start new ${selectedPlan?.name || "plan"} term`}</button></div>
          </div>
          {currentSubscription ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><h3 className="text-sm font-bold text-slate-900">Extend access by custom days</h3><p className="mt-1 text-sm leading-5 text-slate-500">Adds days to the current expiry without changing the plan. This change is recorded in the billing audit log.</p>{currentSubscription.current_period_end ? <div className="mt-4 flex flex-wrap items-end gap-3"><label><span className="block text-sm font-semibold text-slate-800">Days to add</span><input type="number" name="extension_days" autoComplete="off" min={1} max={3650} step={1} value={adjustmentDays} onChange={(event) => setAdjustmentDays(event.target.value)} placeholder="e.g. 7" className="mt-2 h-11 w-32 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100" /></label><label className="min-w-52 flex-1"><span className="block text-sm font-semibold text-slate-800">Reason for audit</span><input type="text" name="extension_reason" autoComplete="off" maxLength={500} value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder="Why is access being extended?" className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100" /></label><button type="button" disabled={!canManagePlans || busy !== null || !Number.isInteger(Number(adjustmentDays)) || Number(adjustmentDays) < 1 || Number(adjustmentDays) > 3650 || extensionReason.trim().length < 3} onClick={() => void adjustRemainingDays()} className="h-11 rounded-xl border border-orange-300 bg-white px-4 text-sm font-bold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">{busy === "adjust-days" ? "Extending..." : "Extend access"}</button></div> : <p className="mt-3 text-sm text-slate-600">This plan has no expiry date, so there is no end date to extend.</p>}</div> : null}
          {!canManagePlans ? <p className="mt-3 text-xs text-slate-500">You have read-only subscription access.</p> : null}
        </div>
      </section>

      <FeatureOverrides definitions={booleanDefinitions} subscription={currentSubscription} canManage={canManageOverrides} busy={busy} onToggle={toggleOverride} onClear={clearOverride} />
      {currentSubscription && growLimitDefinitions.length ? <GrowLimits definitions={growLimitDefinitions} subscription={currentSubscription} canManage={canManageOverrides} busy={busy} onSave={saveGrowLimit} /> : null}
      <AssignmentHistory subscriptions={subscriptions} />
    </Card>
  );
}

function FeatureOverrides({ definitions, subscription, canManage, busy, onToggle, onClear }: { definitions: BillingEntitlementDefinition[]; subscription: BillingSubscription | null; canManage: boolean; busy: string | null; onToggle: (definition: BillingEntitlementDefinition) => Promise<void>; onClear: (definition: BillingEntitlementDefinition) => Promise<void> }) {
  if (!subscription) return <section className="border-t border-slate-200 px-6 py-6 sm:px-7"><h3 className="text-lg font-bold text-slate-950">Feature access</h3><p className="mt-1 text-sm text-slate-500">Assign a plan before reviewing this restaurant&apos;s feature access.</p></section>;
  const planEntitlements = typeof subscription.plan_version === "object" ? subscription.plan_version?.entitlements || {} : {};
  const visibleDefinitions = definitions.filter((definition) => definition.is_client_visible !== false);
  const includedCount = visibleDefinitions.filter((definition) => Boolean(planEntitlements[definition.key])).length;
  const planName = subscription.plan_name || subscription.plan_code || "this plan";

  return <section className="border-t border-slate-200 px-6 py-6 sm:px-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h3 className="text-lg font-bold text-slate-950">Feature access</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">The plan is the default. Restaurant exceptions are shown explicitly and can be reset at any time.</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{includedCount} included in plan</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{subscription.overrides?.length || 0} exceptions</span>
      </div>
    </div>
    <div className="mt-5 grid overflow-hidden rounded-2xl border border-slate-200 sm:grid-cols-2">
      {visibleDefinitions.map((definition) => {
        const override = subscription.overrides?.find((item) => item.entitlement_key === definition.key);
        const base = Boolean(planEntitlements[definition.key]);
        const value = override ? Boolean(override.override_value ?? override.value) : base;
        const changing = busy === `override-${definition.key}` || busy === `clear-${definition.key}`;
        const stateLabel = value ? "Available" : "Not included";
        const stateClass = value ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
        const actionLabel = value ? "Disable for restaurant" : "Enable exception";

        return <div key={definition.key} className="flex min-h-28 items-center gap-3 border-b border-slate-200 p-4 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-900">{definition.label || label(definition.key)}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${stateClass}`}>{stateLabel}</span></div>
            <p className="mt-1 text-xs leading-5 text-slate-500">{override ? `Restaurant exception: ${value ? "available" : "unavailable"}.` : base ? `Included in ${planName}.` : `Not included in ${planName}.`}</p>
          </div>
          {override ? <button type="button" disabled={!canManage || changing} onClick={() => void onClear(definition)} className="shrink-0 text-xs font-bold text-orange-700 hover:text-orange-800 disabled:opacity-50">{changing ? "Saving..." : "Reset"}</button> : canManage ? <button type="button" disabled={changing} onClick={() => void onToggle(definition)} className="shrink-0 text-xs font-bold text-slate-700 hover:text-orange-700 disabled:opacity-50">{changing ? "Saving..." : actionLabel}</button> : null}
        </div>;
      })}
    </div>
    {!visibleDefinitions.length ? <p className="mt-4 text-sm text-slate-500">No feature controls are available for this catalog.</p> : null}
    {!canManage ? <p className="mt-3 text-xs text-slate-500">You have read-only access to plan features and restaurant exceptions.</p> : null}
  </section>;
}

function GrowLimits({ definitions, subscription, canManage, busy, onSave }: { definitions: BillingEntitlementDefinition[]; subscription: BillingSubscription; canManage: boolean; busy: string | null; onSave: (definition: BillingEntitlementDefinition, value: number | null) => Promise<void> }) {
  const planEntitlements = typeof subscription.plan_version === "object" ? subscription.plan_version?.entitlements || {} : {};
  return <section className="border-t border-slate-200 px-6 py-6 sm:px-7">
    <h3 className="text-lg font-bold text-slate-950">Grow limits for this restaurant</h3>
    <p className="mt-1 text-sm leading-6 text-slate-500">These limits use the assigned {subscription.plan_name || subscription.plan_code || "plan"} version. A restaurant value takes precedence until reset.</p>
    <div className="mt-4 divide-y rounded-2xl border border-slate-200">
      {definitions.map((definition) => {
        const override = subscription.overrides?.find((item) => item.entitlement_key === definition.key);
        const planValue = planEntitlements[definition.key] ?? null;
        const value = override ? (override.override_value !== undefined ? override.override_value : override.value ?? null) : planValue;
        return <GrowLimitRow key={`${definition.key}:${value}:${Boolean(override)}`} definition={definition} value={value} planValue={planValue} overridden={Boolean(override)} canManage={canManage} busy={busy === `limit-${definition.key}`} onSave={(next) => onSave(definition, next)} />;
      })}
    </div>
  </section>;
}

function GrowLimitRow({ definition, value, planValue, overridden, canManage, busy, onSave }: { definition: BillingEntitlementDefinition; value: boolean | number | string | null; planValue: boolean | number | string | null; overridden: boolean; canManage: boolean; busy: boolean; onSave: (value: number | null) => Promise<void> }) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const parsed = draft.trim() === "" ? null : Number(draft);
  const valid = parsed === null || (Number.isSafeInteger(parsed) && parsed >= 0);
  const changed = valid && parsed !== value;
  const blankLabel = definition.key === "grow.messages.monthly" ? "Unlimited" : definition.key === "grow.campaigns.monthly_limit" ? "Default: 4" : "Default: 500";
  return <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><p className="text-sm font-bold text-slate-900">{definition.label || label(definition.key)}</p><p className="mt-1 text-xs leading-5 text-slate-500">{definition.description} Plan: {planValue === null ? blankLabel : String(planValue)}{overridden ? " · Restaurant exception" : ""}</p></div>
    <div className="flex flex-wrap items-center gap-2"><label><span className="sr-only">{definition.label || label(definition.key)} for this restaurant</span><input type="number" name={definition.key} autoComplete="off" min="0" step="1" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!canManage || busy} placeholder={blankLabel} aria-invalid={!valid} className="h-10 w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-orange-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-100 disabled:bg-slate-50" /></label><button type="button" disabled={!canManage || busy || !changed} onClick={() => void onSave(parsed)} className="h-10 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : "Save limit"}</button>{overridden ? <button type="button" disabled={!canManage || busy} onClick={() => void onSave(planValue === null ? null : Number(planValue))} className="h-10 px-2 text-sm font-semibold text-orange-700 hover:text-orange-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50">Reset</button> : null}</div>
    {!valid ? <p className="text-xs text-red-700" role="alert">Enter a whole number of zero or more.</p> : null}
  </div>;
}

function AssignmentHistory({ subscriptions }: { subscriptions: BillingSubscription[] }) {
  return <section className="border-t border-slate-200 bg-slate-50/70 px-6 py-6 sm:px-7"><div><h3 className="text-lg font-bold text-slate-950">Plan assignment history</h3><p className="mt-1 text-sm text-slate-500">Previous assignments remain available as an access record.</p></div><div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">{subscriptions.length ? subscriptions.map((subscription) => <div key={subscription.id} className="grid gap-2 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><p className="font-semibold text-slate-900">{subscription.plan_name || subscription.plan_code || "Plan"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(subscription.current_period_start || subscription.started_at)} to {formatDate(expiryAt(subscription))}</p></div><span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{subscription.effective_status || subscription.status}</span><span className="text-sm font-semibold text-slate-700">{remainingLabel(subscription)}</span></div>) : <p className="px-4 py-8 text-center text-sm text-slate-500">No plan assignments have been recorded.</p>}</div></section>;
}

function LegacyCard(props: Props) {
  return <Card className="p-6 xl:col-span-3"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Compatibility mode</p><h2 className="mt-2 text-xl font-bold text-slate-950">Legacy plan access</h2><p className="mt-2 text-sm leading-6 text-slate-600">Subscription V2 is not available on this backend. These fields only maintain the previous restaurant access behaviour.</p></div><div className="mt-6 grid gap-3 md:grid-cols-3"><LegacyToggle label="Paid" description="Legacy full access" active={props.legacyMode === "paid"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("paid")} /><LegacyToggle label="Free" description="Legacy free access" active={props.legacyMode === "free"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("free")} /><LegacyToggle label="Trial" description="Legacy paid trial" active={props.legacyMode === "trial_paid"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("trial_paid")} /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><LegacyField label="Legacy trial ends" value={props.legacyTrialEndsAt} onChange={props.onLegacyTrialEndsAtChange} disabled={!props.canManageLegacy} /><LegacyField label="Legacy paid period ends" value={props.legacyPaidEndsAt} onChange={props.onLegacyPaidEndsAtChange} disabled={!props.canManageLegacy} /></div></Card>;
}

function Status({ value }: { value: string }) { const tone = value === "active" ? "bg-emerald-100 text-emerald-700" : value === "trialing" ? "bg-blue-100 text-blue-700" : value === "unassigned" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone}`}>{value}</span>; }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-800">{value}</span></div>; }
function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) { return <p role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{children}</p>; }
function LegacyField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50" /></label>; }
function LegacyToggle({ label, description, active, disabled, onClick }: { label: string; description: string; active: boolean; disabled: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl border px-4 py-4 text-left transition disabled:opacity-50 ${active ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">{label}</p><p className="mt-1 text-xs text-slate-500">{description}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}>{active ? "Selected" : "Set"}</span></div></button>; }
