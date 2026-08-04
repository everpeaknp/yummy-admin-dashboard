"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import {
  assignBillingSubscription,
  createBillingSubscriptionOverride,
  deleteBillingSubscriptionOverride,
  getBillingAccounts,
  getPublicBillingCatalog,
  getBillingSubscriptions,
  isBackendRouteUnavailable,
  updateBillingSubscription,
  type BackendRestaurant,
  type BillingAccount,
  type BillingPlan,
  type BillingPlanPrice,
  type BillingPlanVersion,
  type BillingSubscription,
} from "@/lib/backend-api";
import {
  canManageBillingOverrides,
  canManageBillingSubscriptions,
  canViewBillingSubscriptions,
  getStoredAuthSession,
} from "@/lib/auth";
import { activeEntitlementOverride } from "@/lib/billing-utils";

const GROW_ENTITLEMENT_KEY = "grow.enabled";

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

function token() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function unwrap(data: BillingSubscription[] | { items: BillingSubscription[] }) {
  return Array.isArray(data) ? data : data.items || [];
}

function currentCatalogVersion(plan: BillingPlan): BillingPlanVersion | null {
  const version = plan.current_version;
  return version && version.status === "published" && isEffectiveNow(version.effective_from)
    ? version
    : null;
}

function isEffectiveNow(startsAt?: string | null, endsAt?: string | null) {
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start !== null && (Number.isNaN(start) || start > now)) return false;
  if (end !== null && (Number.isNaN(end) || end < now)) return false;
  return true;
}

function selectablePrice(price: BillingPlanPrice) {
  return Boolean(price.id && price.is_active !== false && isEffectiveNow(price.effective_from, price.effective_to));
}

function priceOptionLabel(price: BillingPlanPrice) {
  const term = price.billing_interval_months === null ? "custom interval" : `${price.billing_interval_months} months`;
  if (price.quote_only) return `Quote contract - ${term}`;
  return `${price.price_type} - ${term} - ${price.currency} ${price.amount}`;
}

function isActiveAddon(addon: NonNullable<BillingSubscription["addons"]>[number]) {
  return (addon.status || "active") === "active" && isEffectiveNow(addon.started_at, addon.ends_at);
}

function dateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function iso(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function matchesRestaurant(subscription: BillingSubscription, restaurantId: number) {
  return (
    subscription.restaurant_id === restaurantId ||
    Boolean(subscription.restaurant_ids?.includes(restaurantId))
  );
}

export default function RestaurantSubscriptionCard(props: Props) {
  const session = getStoredAuthSession();
  const canView = canViewBillingSubscriptions(session);
  const canManage = canManageBillingSubscriptions(session);
  const canOverride = canManageBillingOverrides(session);
  const [mode, setMode] = useState<"loading" | "v2" | "legacy" | "error">("loading");
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [billingAccount, setBillingAccount] = useState<BillingAccount | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [planVersionId, setPlanVersionId] = useState("");
  const [selectedPriceId, setSelectedPriceId] = useState("");
  const [status, setStatus] = useState("active");
  const [billingSource, setBillingSource] = useState<"manual" | "gateway" | "contract" | "trial">("manual");
  const [startedAt, setStartedAt] = useState("");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [graceEndsAt, setGraceEndsAt] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [growBusy, setGrowBusy] = useState<"set" | "remove" | null>(null);
  const [growReason, setGrowReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const options = useMemo(
    () => plans.flatMap((plan) => {
      const version = currentCatalogVersion(plan);
      return version ? [{ plan, version }] : [];
    }),
    [plans],
  );
  const selectedPlanVersion = useMemo(
    () => options.find(({ version }) => version.id === Number(planVersionId))?.version || null,
    [options, planVersionId],
  );
  const activeAddons = useMemo(
    () => (subscription?.addons || []).filter(isActiveAddon),
    [subscription],
  );
  const historicalAddons = useMemo(
    () => (subscription?.addons || []).filter((addon) => !isActiveAddon(addon)),
    [subscription],
  );
  const activeGrowOverride = useMemo(
    () =>
      activeEntitlementOverride(
        subscription?.overrides || [],
        GROW_ENTITLEMENT_KEY,
      ),
    [subscription],
  );
  const activeGrowOverrideValue = activeGrowOverride
    ? activeGrowOverride.override_value ?? activeGrowOverride.value
    : undefined;
  const growEnabled = subscription?.entitlements
    ? Boolean(subscription.entitlements[GROW_ENTITLEMENT_KEY])
    : activeGrowOverrideValue === true;

  const load = async () => {
    if (!canView) {
      setMode("error");
      setError("You do not have permission to view V2 subscriptions.");
      return;
    }
    setError(null);
    try {
      const [subscriptionResponse, planResponse, accountResponse] = await Promise.all([
        getBillingSubscriptions({ restaurantId: props.restaurant.id }, { token: token() }),
        getPublicBillingCatalog({ token: token() }),
        getBillingAccounts({ restaurantId: props.restaurant.id }, { token: token() }),
      ]);
      const rows = unwrap(subscriptionResponse.data);
      const account = (accountResponse.data || []).find((item) =>
        item.restaurants.some((membership) => membership.restaurant_id === props.restaurant.id),
      ) || null;
      const matched =
        rows.find((item) => matchesRestaurant(item, props.restaurant.id)) ||
        rows.find((item) => props.restaurant.billing_account_id && item.billing_account_id === props.restaurant.billing_account_id) ||
        account?.current_subscription ||
        null;
      setPlans(planResponse.data.plans || []);
      setBillingAccount(account);
      setSubscription(matched);
      setPlanVersionId(matched ? String(matched.plan_version_id) : "");
      setSelectedPriceId(matched?.selected_price_id ? String(matched.selected_price_id) : "");
      setStatus(matched?.effective_status || matched?.status || "active");
      setBillingSource(
        matched?.billing_source === "gateway" ||
          matched?.billing_source === "contract" ||
          matched?.billing_source === "trial"
          ? matched.billing_source
          : "manual",
      );
      setStartedAt(dateInput(matched?.started_at));
      setTrialEndsAt(dateInput(matched?.trial_ends_at));
      setPeriodStart(dateInput(matched?.current_period_start));
      setPeriodEnd(dateInput(matched?.current_period_end));
      setGraceEndsAt(dateInput(matched?.grace_ends_at));
      setCancelAtPeriodEnd(Boolean(matched?.cancel_at_period_end));
      setNotes(matched?.notes || "");
      setReason("");
      setMode("v2");
      props.onV2AvailabilityChange?.(true);
    } catch (loadError) {
      if (isBackendRouteUnavailable(loadError)) {
        setMode("legacy");
        props.onV2AvailabilityChange?.(false);
        setError(null);
      } else {
        setMode("error");
        setError(loadError instanceof Error ? loadError.message : "Failed to load V2 billing details.");
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.restaurant.id, canView]);

  useEffect(() => {
    if (!selectedPriceId || !selectedPlanVersion) return;
    const remainsSelectable = (selectedPlanVersion.prices || []).some(
      (price) => price.id === Number(selectedPriceId) && selectablePrice(price),
    );
    if (!remainsSelectable) setSelectedPriceId("");
  }, [selectedPlanVersion, selectedPriceId]);

  const saveAssignment = async () => {
    const accountId = subscription?.billing_account_id || billingAccount?.id || props.restaurant.billing_account_id;
    if (!accountId || !selectedPlanVersion || !selectedPriceId || !reason.trim()) {
      setError("A billing account, current plan version, selected price, and audit reason are required.");
      return;
    }
    if (billingSource === "trial") {
      setError("Automatic trial is reserved for new signups. Choose Manual or Contract for a replacement plan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await assignBillingSubscription(
        accountId,
        {
          plan_version_id: selectedPlanVersion.id,
          selected_price_id: Number(selectedPriceId),
          status,
          billing_source: billingSource,
          started_at: iso(startedAt),
          trial_ends_at: iso(trialEndsAt),
          current_period_start: iso(periodStart),
          current_period_end: iso(periodEnd),
          grace_ends_at: iso(graceEndsAt),
          notes: notes.trim() || null,
          reason: reason.trim(),
        },
        { token: token() },
      );
      setNotice("V2 subscription assignment saved.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to assign plan.");
    } finally {
      setBusy(false);
    }
  };

  const saveRenewal = async () => {
    if (!subscription || !reason.trim()) {
      setError("An audit reason is required.");
      return;
    }
    if (Number(planVersionId) !== subscription.plan_version_id) {
      setError("Use Assign new plan to move this account to a different plan version.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateBillingSubscription(
        subscription.id,
        {
          status,
          ...(selectedPlanVersion && selectedPriceId
            ? { selected_price_id: Number(selectedPriceId) }
            : {}),
          current_period_start: iso(periodStart),
          current_period_end: iso(periodEnd),
          grace_ends_at: iso(graceEndsAt),
          cancel_at_period_end: cancelAtPeriodEnd,
          notes: notes.trim() || null,
          reason: reason.trim(),
        },
        { token: token() },
      );
      setNotice("Subscription status and period updated.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update subscription.");
    } finally {
      setBusy(false);
    }
  };

  const setGrowOverride = async (enabled: boolean) => {
    if (!subscription || growReason.trim().length < 3) {
      setError(
        "Provide an audit reason of at least 3 characters before changing Yummy Grow access.",
      );
      return;
    }
    setGrowBusy("set");
    setError(null);
    setNotice(null);
    try {
      await createBillingSubscriptionOverride(
        subscription.id,
        {
          entitlement_key: GROW_ENTITLEMENT_KEY,
          override_value: enabled,
          reason: growReason.trim(),
          starts_at: null,
          ends_at: null,
        },
        { token: token() },
      );
      setNotice(
        `Yummy Grow ${enabled ? "enabled" : "disabled"} through an audited subscription override.`,
      );
      setGrowReason("");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update Yummy Grow access.",
      );
    } finally {
      setGrowBusy(null);
    }
  };

  const removeGrowOverride = async () => {
    if (
      !subscription ||
      !activeGrowOverride ||
      growReason.trim().length < 3
    ) {
      setError(
        "Provide an audit reason of at least 3 characters before removing the Yummy Grow override.",
      );
      return;
    }
    setGrowBusy("remove");
    setError(null);
    setNotice(null);
    try {
      await deleteBillingSubscriptionOverride(
        subscription.id,
        activeGrowOverride.id,
        growReason.trim(),
        { token: token() },
      );
      setNotice(
        "Yummy Grow override removed. Access now follows the plan and active add-ons.",
      );
      setGrowReason("");
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove the Yummy Grow override.",
      );
    } finally {
      setGrowBusy(null);
    }
  };

  if (mode === "loading") {
    return <Card className="p-6"><h2 className="text-lg font-bold text-slate-900">Subscription</h2><p className="mt-3 text-sm text-slate-500">Loading V2 billing account...</p></Card>;
  }

  if (mode === "legacy") {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-900">Legacy Billing Status</h2>
        <p className="mt-1 text-sm text-amber-700">Subscription V2 is unavailable on this backend. These compatibility controls only update the old restaurant billing fields.</p>
        <div className="mt-5 grid grid-cols-1 gap-3">
          <LegacyToggle label="Paid" description="Legacy full-access mode" active={props.legacyMode === "paid"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("paid")} />
          <LegacyToggle label="Free" description="Legacy free mode" active={props.legacyMode === "free"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("free")} />
          <LegacyToggle label="Trial" description="Legacy paid trial mode" active={props.legacyMode === "trial_paid"} disabled={!props.canManageLegacy || props.legacySaving} onClick={() => props.onLegacyModeChange("trial_paid")} />
        </div>
        <div className="mt-5 space-y-4">
          <Field label="Legacy trial ends" type="datetime-local" value={props.legacyTrialEndsAt} onChange={props.onLegacyTrialEndsAtChange} disabled={!props.canManageLegacy} />
          <Field label="Legacy paid period ends" type="datetime-local" value={props.legacyPaidEndsAt} onChange={props.onLegacyPaidEndsAtChange} disabled={!props.canManageLegacy} />
        </div>
      </Card>
    );
  }

  if (mode === "error") {
    return <Card className="p-6"><h2 className="text-lg font-bold text-slate-900">Subscription</h2><p className="mt-3 text-sm text-red-600">{error || "Unable to load subscription."}</p><button type="button" onClick={load} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Retry</button></Card>;
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-900">Subscription V2</h2><p className="mt-1 text-sm text-slate-500">Backend-owned plan assignment and live quota usage.</p></div>
        {subscription ? <Status value={subscription.effective_status || subscription.status} /> : null}
      </div>
      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p> : null}

      {!subscription && !billingAccount ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <p className="text-sm text-slate-600">The V2 endpoint did not return a billing account for this restaurant.</p>
          <p className="mt-1 text-xs text-slate-500">Create or backfill a billing account before assigning a plan.</p>
          <Link href="/dashboard/subscriptions" className="mt-3 inline-flex text-sm font-semibold text-orange-600">Open subscriptions</Link>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Info label="Billing account" value={subscription?.billing_account_name || billingAccount?.name || `#${subscription?.billing_account_id || billingAccount?.id}`} />
            <Info label="Current plan" value={subscription ? (subscription.plan_name || subscription.plan_code || `Version #${subscription.plan_version_id}`) : "No plan assigned"} />
            <Info label="Plan version" value={subscription ? String(subscription.plan_version_number || (typeof subscription.plan_version === "number" ? subscription.plan_version : subscription.plan_version?.version_number) || subscription.plan_version_id) : "—"} />
            <Info label="Effective status" value={subscription?.effective_status || subscription?.status || "—"} />
            <Info label="Trial ends" value={subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleString() : "—"} />
            <Info label="Period starts" value={subscription?.current_period_start ? new Date(subscription.current_period_start).toLocaleString() : "—"} />
            <Info label="Period ends" value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleString() : "—"} />
          </div>
          <div className="mt-5 space-y-4">
            <label className="block"><Label>Current published plan version</Label><select value={planVersionId} onChange={(event) => { setPlanVersionId(event.target.value); setSelectedPriceId(""); }} disabled={!canManage} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Choose current version</option>{options.map(({ plan, version }) => <option key={version.id} value={version.id}>{plan.name} · v{version.version_number}</option>)}</select></label>
            {subscription && !selectedPlanVersion ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This subscription is pinned to a superseded plan version. It remains visible for history, but cannot be assigned again. Choose a current published version to move the account.</p> : null}
            <label className="block"><Label>Price / billing cycle</Label><select value={selectedPriceId} onChange={(event) => setSelectedPriceId(event.target.value)} disabled={!canManage || !selectedPlanVersion} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Choose a price</option>{(selectedPlanVersion?.prices || []).filter(selectablePrice).map((price) => <option key={price.id} value={price.id}>{priceOptionLabel(price)}</option>)}</select></label>
            <label className="block"><Label>Status</Label><select value={status} onChange={(event) => setStatus(event.target.value)} disabled={!canManage} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">{["trialing", "active", "grace", "past_due", "expired", "canceled"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="block"><Label>Billing source</Label><select value={billingSource} onChange={(event) => setBillingSource(event.target.value as "manual" | "gateway" | "contract" | "trial")} disabled={!canManage} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"><option value="manual">Manual</option><option value="gateway">Gateway</option><option value="contract">Contract</option>{billingSource === "trial" ? <option value="trial" disabled>Automatic signup trial</option> : null}</select></label>
            <Field label="Started at" type="datetime-local" value={startedAt} onChange={setStartedAt} disabled={!canManage || Boolean(subscription)} />
            <Field label="Trial ends" type="datetime-local" value={trialEndsAt} onChange={setTrialEndsAt} disabled={!canManage || Boolean(subscription)} />
            <Field label="Current period starts" type="datetime-local" value={periodStart} onChange={setPeriodStart} disabled={!canManage} />
            <Field label="Current period ends" type="datetime-local" value={periodEnd} onChange={setPeriodEnd} disabled={!canManage} />
            <Field label="Grace ends" type="datetime-local" value={graceEndsAt} onChange={setGraceEndsAt} disabled={!canManage} />
            {subscription ? <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"><input type="checkbox" checked={cancelAtPeriodEnd} onChange={(event) => setCancelAtPeriodEnd(event.target.checked)} disabled={!canManage} />Cancel at period end</label> : null}
            <Field label="Internal notes" value={notes} onChange={setNotes} disabled={!canManage} />
            <Field label="Audit reason" value={reason} onChange={setReason} disabled={!canManage} />
            {canManage ? <div className={`grid gap-2 ${subscription ? "grid-cols-2" : "grid-cols-1"}`}><button type="button" onClick={saveAssignment} disabled={busy} className="rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{subscription ? "Assign new plan" : "Assign first plan"}</button>{subscription ? <button type="button" onClick={saveRenewal} disabled={busy} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Update / renew</button> : null}</div> : null}
          </div>
          {subscription ? <><div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-bold text-slate-900">Live usage</h3><div className="mt-3 space-y-2">{Object.entries(subscription.usage || {}).length ? Object.entries(subscription.usage || {}).map(([key, usage]) => <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-medium text-slate-600">{key}</span><span className="font-semibold text-slate-900">{usage.used} / {usage.limit === null ? "Unlimited" : usage.limit}</span></div>) : <p className="text-sm text-slate-500">No usage counters returned.</p>}</div></div><div className="mt-5 border-t border-slate-100 pt-5"><h3 className="text-sm font-bold text-slate-900">Active add-ons</h3><div className="mt-2 flex flex-wrap gap-2">{activeAddons.length ? activeAddons.map((addon) => <span key={addon.id || addon.addon_version_id} className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">{addon.name || addon.addon_name || addon.code || addon.addon_code || `Add-on version #${addon.addon_version_id}`}</span>) : <span className="text-sm text-slate-500">No active add-ons.</span>}</div>{historicalAddons.length ? <><h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Historical add-ons</h4><div className="mt-2 flex flex-wrap gap-2">{historicalAddons.map((addon) => <span key={addon.id || addon.addon_version_id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{addon.name || addon.addon_name || addon.code || addon.addon_code || `Add-on version #${addon.addon_version_id}`} · {addon.status || "ended"}</span>)}</div></> : null}</div></> : null}
          {subscription ? (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Yummy Grow
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Product access is controlled by the subscription entitlement.
                    WhatsApp delivery remains separately gated.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                    growEnabled
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {growEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {activeGrowOverride
                  ? `Current value comes from override #${activeGrowOverride.id}.`
                  : "Current value comes from the plan and active add-ons."}
              </p>
              {canOverride ? (
                <div className="mt-3 space-y-3">
                  <Field
                    label="Grow access audit reason"
                    value={growReason}
                    onChange={setGrowReason}
                    disabled={Boolean(growBusy)}
                  />
                  {activeGrowOverride ? (
                    <button
                      type="button"
                      onClick={removeGrowOverride}
                      disabled={
                        Boolean(growBusy) || growReason.trim().length < 3
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {growBusy === "remove"
                        ? "Removing..."
                        : "Remove Grow override"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGrowOverride(!growEnabled)}
                      disabled={
                        Boolean(growBusy) || growReason.trim().length < 3
                      }
                      className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {growBusy === "set"
                        ? "Saving..."
                        : growEnabled
                          ? "Disable Yummy Grow"
                          : "Enable Yummy Grow"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-amber-700">
                  Your account needs platform.billing.overrides.manage to change
                  Grow access.
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-xs font-semibold text-slate-600">{children}</span>; }
function Field({ label, value, onChange, disabled = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) { return <label className="block"><Label>{label}</Label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50" /></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>; }
function Status({ value }: { value: string }) { const tone = value === "active" ? "bg-green-100 text-green-700" : value === "trialing" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-800"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${tone}`}>{value}</span>; }
function LegacyToggle({ label, description, active, disabled, onClick }: { label: string; description: string; active: boolean; disabled: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} disabled={disabled} className={`w-full rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${active ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="text-xs text-slate-500">{description}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}>{active ? "Selected" : "Set"}</span></div></button>; }
