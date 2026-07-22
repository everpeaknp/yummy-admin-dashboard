"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BillingAccountManager from "@/components/BillingAccountManager";
import {
  assignBillingSubscription,
  createBillingSubscriptionOverride,
  deleteBillingSubscriptionOverride,
  fulfillBillingUpgradeRequest,
  getBillingAccounts,
  getBillingAuditLogs,
  getBillingEntitlementDefinitions,
  getPublicBillingCatalog,
  getBillingSubscriptions,
  getBillingUpgradeRequests,
  getRestaurants,
  isBackendRouteUnavailable,
  updateBillingSubscription,
  updateBillingSubscriptionAddons,
  reviewBillingUpgradeRequest,
  type BillingAddon,
  type BillingAddonVersion,
  type BillingAccount,
  type BillingAuditLog,
  type BillingEntitlementValue,
  type BillingEntitlementDefinition,
  type BillingPlan,
  type BillingPlanPrice,
  type BillingPlanVersion,
  type BillingSubscription,
  type BillingSubscriptionAddonAssignment,
  type BillingSubscriptionOverride,
  type BillingUpgradeRequest,
  type BackendRestaurant,
} from "@/lib/backend-api";
import {
  canManageBillingOverrides,
  canManageBillingPayments,
  canManageBillingSubscriptions,
  canViewBillingAudit,
  canViewAllBillingOperations,
  canViewBillingSubscriptions,
  getStoredAuthSession,
} from "@/lib/auth";

const SUBSCRIPTION_STATES = [
  "scheduled",
  "pending_payment",
  "trialing",
  "active",
  "grace",
  "past_due",
  "expired",
  "canceled",
];

function accessToken() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function unwrapSubscriptions(
  data: BillingSubscription[] | { items: BillingSubscription[] },
) {
  return Array.isArray(data) ? data : data.items || [];
}

function planVersions(plan: BillingPlan): BillingPlanVersion[] {
  const values = [
    ...(plan.versions || []),
    plan.published_version,
    plan.latest_version,
    plan.current_version,
  ].filter((value): value is BillingPlanVersion =>
    Boolean(
      value &&
      value.status === "published" &&
      isEffectiveNow(value.effective_from),
    ),
  );
  return [...new Map(values.map((value) => [value.id, value])).values()];
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
  return Boolean(
    price.id &&
    price.is_active !== false &&
    isEffectiveNow(price.effective_from, price.effective_to),
  );
}

function priceOptionLabel(price: BillingPlanPrice) {
  const term =
    price.billing_interval_months === null
      ? "custom interval"
      : `${price.billing_interval_months} months`;
  if (price.quote_only) return `Quote contract - ${term}`;
  return `${price.price_type} - ${term} - ${price.currency} ${price.amount}`;
}

function isActiveAddonAssignment(
  assignment: BillingSubscriptionAddonAssignment,
) {
  if (!assignment || assignment.status !== "active") return false;
  return (
    !assignment.ends_at || new Date(assignment.ends_at).getTime() >= Date.now()
  );
}

function effectiveSubscriptionStatus(subscription: BillingSubscription) {
  return subscription.effective_status || subscription.status;
}

function overrideLifecycle(override: BillingSubscriptionOverride) {
  const now = Date.now();
  const starts = override.starts_at
    ? new Date(override.starts_at).getTime()
    : null;
  const ends = override.ends_at ? new Date(override.ends_at).getTime() : null;
  if (starts !== null && starts > now) return "scheduled";
  if (ends !== null && ends < now) return "expired";
  return "active";
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function dateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function isoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function accountLabel(subscription: BillingSubscription) {
  return (
    subscription.billing_account_name ||
    subscription.restaurant_name ||
    subscription.restaurant_names?.join(", ") ||
    `Billing account #${subscription.billing_account_id}`
  );
}

function planLabel(subscription: BillingSubscription, plans: BillingPlan[]) {
  if (subscription.plan_name) return subscription.plan_name;
  const plan = plans.find((candidate) =>
    planVersions(candidate).some(
      (version) => version.id === subscription.plan_version_id,
    ),
  );
  return (
    plan?.name ||
    subscription.plan_code ||
    `Version #${subscription.plan_version_id}`
  );
}

function subscriptionVersionNumber(subscription: BillingSubscription) {
  if (
    subscription.plan_version_number !== null &&
    subscription.plan_version_number !== undefined
  ) {
    return subscription.plan_version_number;
  }
  if (typeof subscription.plan_version === "number")
    return subscription.plan_version;
  return (
    subscription.plan_version?.version_number || subscription.plan_version_id
  );
}

function parseOverrideValue(raw: string): BillingEntitlementValue {
  const value = raw.trim();
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  const number = Number(value);
  return Number.isFinite(number) ? number : raw;
}

export default function SubscriptionsPage() {
  const session = getStoredAuthSession();
  const canView = canViewBillingSubscriptions(session);
  const canManage = canManageBillingSubscriptions(session);
  const canFulfill = canManage && canManageBillingPayments(session);
  const canOverride = canManageBillingOverrides(session);
  const canAudit = canViewBillingAudit(session);
  const canViewOperations = canViewAllBillingOperations(session);

  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [restaurantDirectory, setRestaurantDirectory] = useState<
    BackendRestaurant[]
  >([]);
  const [restaurantDirectoryUnavailable, setRestaurantDirectoryUnavailable] =
    useState(false);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [addons, setAddons] = useState<BillingAddon[]>([]);
  const [addonsUnavailable, setAddonsUnavailable] = useState(false);
  const [upgradeRequests, setUpgradeRequests] = useState<
    BillingUpgradeRequest[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<BillingAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [activeSection, setActiveSection] = useState<
    "subscriptions" | "requests" | "accounts" | "audit"
  >("subscriptions");
  const [definitions, setDefinitions] = useState<
    BillingEntitlementDefinition[]
  >([]);
  const [upgradeFilter, setUpgradeFilter] = useState("pending");
  const [selectedUpgradeId, setSelectedUpgradeId] = useState<number | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] = useState<
    "reviewing" | "approved" | "rejected"
  >("reviewing");
  const [reviewReason, setReviewReason] = useState("");
  const [fulfillPriceId, setFulfillPriceId] = useState("");
  const [fulfillAddonPrices, setFulfillAddonPrices] = useState<
    Record<string, string>
  >({});
  const [fulfillBillingSource, setFulfillBillingSource] = useState<
    "manual" | "contract"
  >("manual");
  const [fulfillTaxRate, setFulfillTaxRate] = useState("0");
  const [fulfillDiscount, setFulfillDiscount] = useState("0");
  const [fulfillDueAt, setFulfillDueAt] = useState("");
  const [fulfillPaymentMethod, setFulfillPaymentMethod] = useState("");
  const [fulfillPaymentReference, setFulfillPaymentReference] = useState("");
  const [fulfillNegotiatedBase, setFulfillNegotiatedBase] = useState("");
  const [fulfillNegotiatedAddons, setFulfillNegotiatedAddons] = useState<
    Record<string, string>
  >({});
  const [fulfillReason, setFulfillReason] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [v2Unavailable, setV2Unavailable] = useState(false);
  const [planVersionId, setPlanVersionId] = useState("");
  const [selectedPriceId, setSelectedPriceId] = useState("");
  const [status, setStatus] = useState("active");
  const [billingSource, setBillingSource] = useState<
    "manual" | "gateway" | "contract" | "trial"
  >("manual");
  const [startedAt, setStartedAt] = useState("");
  const [trialEnd, setTrialEnd] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [graceEnd, setGraceEnd] = useState("");
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [addonVersionIds, setAddonVersionIds] = useState<number[]>([]);
  const [addonPriceSelections, setAddonPriceSelections] = useState<
    Record<number, string>
  >({});
  const [overrideKey, setOverrideKey] = useState("");
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideStartsAt, setOverrideStartsAt] = useState("");
  const [overrideEndsAt, setOverrideEndsAt] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const selected =
    subscriptions.find((subscription) => subscription.id === selectedId) ||
    null;
  const selectedOverrideDefinition =
    definitions.find((definition) => definition.key === overrideKey) || null;

  const publishedVersions = useMemo(
    () =>
      plans.flatMap((plan) =>
        planVersions(plan).map((version) => ({ plan, version })),
      ),
    [plans],
  );

  const addonVersionOptions = useMemo(() => {
    const currentOptions = addons.flatMap((addon) => {
      const versions = [
        ...(addon.versions || []),
        addon.published_version,
        addon.current_version,
      ].filter((value): value is NonNullable<typeof value> =>
        Boolean(
          value &&
          value.status === "published" &&
          isEffectiveNow(value.effective_from),
        ),
      );
      return [
        ...new Map(versions.map((version) => [version.id, version])).values(),
      ].map((version) => ({ addon, version, grandfathered: false }));
    });
    const knownIds = new Set(currentOptions.map(({ version }) => version.id));
    const grandfathered = (selected?.addons || [])
      .filter(isActiveAddonAssignment)
      .filter((assignment) => !knownIds.has(assignment.addon_version_id))
      .map((assignment) => ({
        grandfathered: true,
        addon: {
          id: -(assignment.addon_id || assignment.addon_version_id),
          code:
            assignment.code ||
            assignment.addon_code ||
            `addon-${assignment.addon_version_id}`,
          name:
            assignment.name ||
            assignment.addon_name ||
            `Add-on version #${assignment.addon_version_id}`,
          status: "active" as const,
          compatible_plan_codes: [],
        } satisfies BillingAddon,
        version: {
          id: assignment.addon_version_id,
          version_number: 0,
          status: "published" as const,
          prices: assignment.prices || [],
        } satisfies BillingAddonVersion,
      }));
    return [...currentOptions, ...grandfathered];
  }, [addons, selected]);

  const selectedPlanVersion = useMemo(
    () =>
      publishedVersions.find(
        ({ version }) => version.id === Number(planVersionId),
      )?.version || null,
    [planVersionId, publishedVersions],
  );

  const selectedPlanCode = useMemo(
    () =>
      publishedVersions.find(
        ({ version }) => version.id === Number(planVersionId),
      )?.plan.code ||
      selected?.plan_code ||
      null,
    [planVersionId, publishedVersions, selected?.plan_code],
  );

  const selectedPlanPrices = useMemo(
    () =>
      selectedPlanVersion?.prices ||
      (selected && Number(planVersionId) === selected.plan_version_id
        ? selected.plan_version_prices || []
        : []),
    [planVersionId, selected, selectedPlanVersion],
  );

  const currentAddonContract = (selected?.addons || [])
    .filter(isActiveAddonAssignment)
    .map((assignment) => ({
      versionId: assignment.addon_version_id,
      priceId: assignment.selected_price_id
        ? String(assignment.selected_price_id)
        : "",
    }))
    .sort((left, right) => left.versionId - right.versionId);
  const draftAddonContract = [...addonVersionIds]
    .sort((left, right) => left - right)
    .map((versionId) => ({
      versionId,
      priceId: addonPriceSelections[versionId] || "",
    }));
  const subscriptionDraftDirty = Boolean(
    selected &&
    (planVersionId !== String(selected.plan_version_id || "") ||
      selectedPriceId !==
        (selected.selected_price_id
          ? String(selected.selected_price_id)
          : "") ||
      status !== (selected.status || "active") ||
      billingSource !== (selected.billing_source || "manual") ||
      startedAt !== dateInput(selected.started_at) ||
      trialEnd !== dateInput(selected.trial_ends_at) ||
      periodStart !== dateInput(selected.current_period_start) ||
      periodEnd !== dateInput(selected.current_period_end) ||
      graceEnd !== dateInput(selected.grace_ends_at) ||
      cancelAtPeriodEnd !== Boolean(selected.cancel_at_period_end) ||
      notes !== (selected.notes || "") ||
      reason.trim() !== "" ||
      JSON.stringify(draftAddonContract) !==
        JSON.stringify(currentAddonContract) ||
      overrideKey !== "" ||
      overrideValue !== "" ||
      overrideStartsAt !== "" ||
      overrideEndsAt !== "" ||
      overrideReason !== ""),
  );

  const resetSubscriptionDraft = () => {
    if (!selected) return;
    setPlanVersionId(String(selected.plan_version_id || ""));
    setSelectedPriceId(
      selected.selected_price_id ? String(selected.selected_price_id) : "",
    );
    setStatus(selected.status || "active");
    setBillingSource(
      (selected.billing_source as
        | "manual"
        | "gateway"
        | "contract"
        | "trial") ||
        "manual",
    );
    setStartedAt(dateInput(selected.started_at));
    setTrialEnd(dateInput(selected.trial_ends_at));
    setPeriodStart(dateInput(selected.current_period_start));
    setPeriodEnd(dateInput(selected.current_period_end));
    setGraceEnd(dateInput(selected.grace_ends_at));
    setCancelAtPeriodEnd(Boolean(selected.cancel_at_period_end));
    setNotes(selected.notes || "");
    setReason("");
    setAddonVersionIds(currentAddonContract.map((item) => item.versionId));
    setAddonPriceSelections(
      Object.fromEntries(
        currentAddonContract.map((item) => [item.versionId, item.priceId]),
      ),
    );
    setOverrideKey("");
    setOverrideValue("");
    setOverrideStartsAt("");
    setOverrideEndsAt("");
    setOverrideReason("");
  };

  const confirmDiscardSubscriptionDraft = () => {
    if (!subscriptionDraftDirty) return true;
    if (!window.confirm("Discard the unsaved subscription changes?")) {
      return false;
    }
    resetSubscriptionDraft();
    return true;
  };

  const billingRestaurantOptions = useMemo(() => {
    const options = new Map<
      number,
      { id: number; name: string; registered_by?: number | null }
    >();
    restaurantDirectory.forEach((restaurant) =>
      options.set(restaurant.id, restaurant),
    );
    accounts.forEach((account) =>
      account.restaurants.forEach((restaurant) => {
        if (!options.has(restaurant.restaurant_id)) {
          options.set(restaurant.restaurant_id, {
            id: restaurant.restaurant_id,
            name:
              restaurant.restaurant_name ||
              `Restaurant #${restaurant.restaurant_id}`,
          });
        }
      }),
    );
    return [...options.values()];
  }, [accounts, restaurantDirectory]);

  const loadData = async (preferredId?: number) => {
    setError(null);
    try {
      const [
        subscriptionResponse,
        accountResponse,
        catalogResponse,
        upgradeResult,
        definitionResult,
      ] = await Promise.all([
        getBillingSubscriptions({}, { token: accessToken() }),
        getBillingAccounts({}, { token: accessToken() }),
        getPublicBillingCatalog({ token: accessToken() }),
        Promise.resolve(
          canManage || canViewOperations
            ? getBillingUpgradeRequests(undefined, { token: accessToken() })
            : null,
        ),
        getBillingEntitlementDefinitions({ token: accessToken() }),
      ]);
      const nextSubscriptions = unwrapSubscriptions(subscriptionResponse.data);
      setSubscriptions(nextSubscriptions);
      setAccounts(accountResponse.data || []);
      setUpgradeRequests(upgradeResult?.data || []);
      setDefinitions(definitionResult.data || []);
      setPlans(catalogResponse.data?.plans || []);
      setAddons(catalogResponse.data?.addons || []);
      setAddonsUnavailable(false);
      const nextId = nextSubscriptions.some((item) => item.id === preferredId)
        ? preferredId || null
        : nextSubscriptions[0]?.id || null;
      setSelectedId(nextId);
      setV2Unavailable(false);

      try {
        const restaurantResponse = await getRestaurants({
          token: accessToken(),
        });
        setRestaurantDirectory(restaurantResponse.data || []);
        setRestaurantDirectoryUnavailable(false);
      } catch {
        setRestaurantDirectory([]);
        setRestaurantDirectoryUnavailable(true);
      }
    } catch (loadError) {
      if (isBackendRouteUnavailable(loadError)) setV2Unavailable(true);
      setError(errorMessage(loadError, "Failed to load V2 subscriptions."));
      setSubscriptions([]);
      setAccounts([]);
    }
  };

  useEffect(() => {
    let active = true;
    if (!canView) {
      setIsLoading(false);
      return;
    }
    (async () => {
      await loadData();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
    // loadData intentionally reads the latest local filters and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!subscriptionDraftDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [subscriptionDraftDirty]);

  useEffect(() => {
    if (!selected) return;
    setPlanVersionId(String(selected.plan_version_id || ""));
    setSelectedPriceId(
      selected.selected_price_id ? String(selected.selected_price_id) : "",
    );
    setStatus(selected.status || "active");
    setBillingSource(
      (selected.billing_source as
        | "manual"
        | "gateway"
        | "contract"
        | "trial") ||
        "manual",
    );
    setStartedAt(dateInput(selected.started_at));
    setTrialEnd(dateInput(selected.trial_ends_at));
    setPeriodStart(dateInput(selected.current_period_start));
    setPeriodEnd(dateInput(selected.current_period_end));
    setGraceEnd(dateInput(selected.grace_ends_at));
    setCancelAtPeriodEnd(Boolean(selected.cancel_at_period_end));
    setNotes(selected.notes || "");
    setReason("");
    const activeAddons = (selected.addons || []).filter(
      isActiveAddonAssignment,
    );
    setAddonVersionIds(
      activeAddons.map((assignment) => assignment.addon_version_id),
    );
    setAddonPriceSelections(
      Object.fromEntries(
        activeAddons.map((assignment) => [
          assignment.addon_version_id,
          assignment.selected_price_id
            ? String(assignment.selected_price_id)
            : "",
        ]),
      ),
    );
    setOverrideKey("");
    setOverrideValue("");
    setOverrideStartsAt("");
    setOverrideEndsAt("");
    setOverrideReason("");
  }, [selected]);

  useEffect(() => {
    if (!selectedPriceId) return;
    const availablePrices =
      selectedPlanVersion?.prices ||
      (selected && Number(planVersionId) === selected.plan_version_id
        ? selected.plan_version_prices || []
        : []);
    if (!availablePrices.length) return;
    const remainsSelectable = availablePrices.some(
      (price) => price.id === Number(selectedPriceId) && selectablePrice(price),
    );
    if (!remainsSelectable) setSelectedPriceId("");
  }, [planVersionId, selected, selectedPlanVersion, selectedPriceId]);

  useEffect(() => {
    setAddonPriceSelections((old) => {
      let changed = false;
      const next = { ...old };
      addonVersionIds.forEach((versionId) => {
        const selection = next[versionId];
        if (!selection) return;
        const option = addonVersionOptions.find(
          ({ version }) => version.id === versionId,
        );
        const isPinnedSelection = (selected?.addons || []).some(
          (assignment) =>
            isActiveAddonAssignment(assignment) &&
            assignment.addon_version_id === versionId &&
            assignment.selected_price_id === Number(selection),
        );
        if (
          option &&
          !(option.version.prices || []).some(
            (price) =>
              price.id === Number(selection) &&
              (selectablePrice(price) || isPinnedSelection),
          )
        ) {
          next[versionId] = "";
          changed = true;
        }
      });
      return changed ? next : old;
    });
  }, [addonVersionIds, addonVersionOptions, selected]);

  useEffect(() => {
    let active = true;
    if (!canAudit) {
      setAuditLogs([]);
      return () => {
        active = false;
      };
    }
    setAuditLoading(true);
    getBillingAuditLogs(undefined, { token: accessToken() })
      .then((response) => {
        if (active) setAuditLogs(response.data || []);
      })
      .catch((auditError) => {
        if (active)
          setError(
            errorMessage(auditError, "Failed to load billing audit history."),
          );
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canAudit]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      if (
        statusFilter !== "all" &&
        effectiveSubscriptionStatus(subscription) !== statusFilter
      )
        return false;
      if (!query) return true;
      return [
        accountLabel(subscription),
        subscription.owner?.name || subscription.owner_name,
        subscription.owner?.email || subscription.owner_email,
        subscription.plan_name,
        subscription.plan_code,
        ...(subscription.restaurant_names || []),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [search, statusFilter, subscriptions]);

  const filteredUpgradeRequests = useMemo(
    () =>
      upgradeRequests.filter(
        (request) =>
          upgradeFilter === "all" || request.status === upgradeFilter,
      ),
    [upgradeFilter, upgradeRequests],
  );

  const filteredAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditLogs;
    return auditLogs.filter((log) =>
      [
        log.action,
        log.entity_type,
        log.entity_id,
        log.billing_account_id,
        log.actor_id,
        log.reason,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [auditLogs, auditSearch]);

  const selectedAccountAuditLogs = useMemo(
    () =>
      selected
        ? auditLogs.filter(
            (log) => log.billing_account_id === selected.billing_account_id,
          )
        : [],
    [auditLogs, selected],
  );

  const selectedUpgradeRequest =
    upgradeRequests.find((request) => request.id === selectedUpgradeId) || null;

  const selectedUpgradePlan = selectedUpgradeRequest
    ? plans.find(
        (plan) =>
          plan.code.toLowerCase() ===
          selectedUpgradeRequest.requested_plan_code.toLowerCase(),
      ) || null
    : null;
  const selectedUpgradeVersion = selectedUpgradePlan
    ? planVersions(selectedUpgradePlan)[0] || null
    : null;
  const selectedUpgradePrices = (selectedUpgradeVersion?.prices || []).filter(
    (price) =>
      selectablePrice(price) &&
      price.billing_interval_months ===
        selectedUpgradeRequest?.billing_interval_months,
  );
  const selectedUpgradeAddonOptions = (
    selectedUpgradeRequest?.requested_addon_codes || []
  ).map((code) => {
    const addon =
      addons.find(
        (candidate) => candidate.code.toLowerCase() === code.toLowerCase(),
      ) || null;
    const versions = [
      ...(addon?.versions || []),
      addon?.published_version,
      addon?.current_version,
    ].filter((value): value is BillingAddonVersion =>
      Boolean(
        value &&
        value.status === "published" &&
        isEffectiveNow(value.effective_from),
      ),
    );
    const version =
      [...new Map(versions.map((value) => [value.id, value])).values()][0] ||
      null;
    const prices = (version?.prices || []).filter(
      (price) =>
        selectablePrice(price) &&
        (price.billing_interval_months ===
          selectedUpgradeRequest?.billing_interval_months ||
          price.billing_interval_months === null),
    );
    return { code, addon, version, prices };
  });

  const fulfillmentEstimate = useMemo(() => {
    if (!selectedUpgradeRequest) return null;
    const planPrice = selectedUpgradePrices.find(
      (price) => price.id === Number(fulfillPriceId),
    );
    if (!planPrice) return null;
    const base = planPrice.quote_only
      ? Number(fulfillNegotiatedBase)
      : Number(planPrice.amount || 0);
    if (!Number.isFinite(base)) return null;
    let subtotal = base;
    for (const option of selectedUpgradeAddonOptions) {
      const price = option.prices.find(
        (candidate) => candidate.id === Number(fulfillAddonPrices[option.code]),
      );
      if (!price) return null;
      const amount = price.quote_only
        ? Number(fulfillNegotiatedAddons[option.code])
        : Number(price.amount || 0);
      if (!Number.isFinite(amount)) return null;
      subtotal += amount;
    }
    const discount = Number(fulfillDiscount || 0);
    const taxRate = Number(fulfillTaxRate || 0);
    if (
      !Number.isFinite(discount) ||
      !Number.isFinite(taxRate) ||
      discount > subtotal
    )
      return null;
    return (
      Math.round(
        ((subtotal - discount) * (1 + taxRate / 100) + Number.EPSILON) * 100,
      ) / 100
    );
  }, [
    fulfillAddonPrices,
    fulfillDiscount,
    fulfillNegotiatedAddons,
    fulfillNegotiatedBase,
    fulfillPriceId,
    fulfillTaxRate,
    selectedUpgradeAddonOptions,
    selectedUpgradePrices,
    selectedUpgradeRequest,
  ]);

  const unassignedAccounts = useMemo(
    () => accounts.filter((account) => !account.current_subscription),
    [accounts],
  );

  const stats = useMemo(() => {
    const count = (state: string) =>
      subscriptions.filter(
        (item) => effectiveSubscriptionStatus(item) === state,
      ).length;
    return [
      { label: "Total", value: subscriptions.length },
      { label: "Active", value: count("active") },
      { label: "Trialing", value: count("trialing") },
      { label: "Grace / past due", value: count("grace") + count("past_due") },
      {
        label: "Expired / canceled",
        value: count("expired") + count("canceled"),
      },
    ];
  }, [subscriptions]);

  const saveAssignment = async () => {
    if (
      !selected ||
      !selectedPlanVersion ||
      !selectedPriceId ||
      !reason.trim()
    ) {
      setError(
        "Choose the current published plan version, its price contract, and provide an audit reason.",
      );
      return;
    }
    const selectedContractPrice = selectedPlanPrices.find(
      (price) => price.id === Number(selectedPriceId),
    );
    if (billingSource === "gateway") {
      setError(
        "Gateway billing is not configured. Use manual payment or an externally signed contract.",
      );
      return;
    }
    if (billingSource === "trial") {
      setError(
        "Automatic trial is reserved for new signups. Choose manual payment or an external contract for this assignment.",
      );
      return;
    }
    if (
      billingSource === "manual" &&
      SUBSCRIPTION_STATES.includes(status) &&
      ["trialing", "active", "grace", "past_due"].includes(status) &&
      (selectedContractPrice?.quote_only ||
        Number(selectedContractPrice?.amount || 0) > 0)
    ) {
      setError(
        "Paid manual assignments must start as Pending payment. Create the invoice in Payments; full payment will activate the plan.",
      );
      return;
    }
    if (
      !window.confirm(
        `Assign ${selectedPlanVersion.version_number ? `plan version ${selectedPlanVersion.version_number}` : "this plan"} with status ${status}? This creates a new subscription record.`,
      )
    )
      return;
    setBusy("assignment");
    setError(null);
    try {
      await assignBillingSubscription(
        selected.billing_account_id,
        {
          plan_version_id: selectedPlanVersion.id,
          selected_price_id: Number(selectedPriceId),
          status,
          billing_source: billingSource,
          started_at: isoOrNull(startedAt),
          trial_ends_at: isoOrNull(trialEnd),
          current_period_start: isoOrNull(periodStart),
          current_period_end: isoOrNull(periodEnd),
          grace_ends_at: isoOrNull(graceEnd),
          notes: notes.trim() || null,
          reason: reason.trim(),
        },
        { token: accessToken() },
      );
      setNotice("Subscription assignment saved.");
      await loadData(selected.id);
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to assign subscription."));
    } finally {
      setBusy(null);
    }
  };

  const saveStatusAndRenewal = async () => {
    if (!selected || !reason.trim()) {
      setError("An audit reason is required.");
      return;
    }
    if (
      !window.confirm(
        `Apply status ${status} and the edited billing period to this subscription?`,
      )
    )
      return;
    if (Number(planVersionId) !== selected.plan_version_id) {
      setError(
        "Use Assign plan to move this account to a different plan version.",
      );
      return;
    }
    setBusy("renewal");
    setError(null);
    try {
      await updateBillingSubscription(
        selected.id,
        {
          status,
          ...(selectedPriceId &&
          Number(selectedPriceId) !== selected.selected_price_id
            ? { selected_price_id: Number(selectedPriceId) }
            : {}),
          current_period_start: isoOrNull(periodStart),
          current_period_end: isoOrNull(periodEnd),
          grace_ends_at: isoOrNull(graceEnd),
          cancel_at_period_end: cancelAtPeriodEnd,
          notes: notes.trim() || null,
          reason: reason.trim(),
        },
        { token: accessToken() },
      );
      setNotice("Subscription status and period updated.");
      await loadData(selected.id);
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to update subscription."));
    } finally {
      setBusy(null);
    }
  };

  const saveAddons = async () => {
    if (!selected || !reason.trim()) {
      setError("Provide an audit reason before replacing add-ons.");
      return;
    }
    if (
      !window.confirm(
        "Replace the active add-on set with the selected contracts? Removed add-ons will be ended and kept in history.",
      )
    )
      return;
    const missingPrice = addonVersionIds.find(
      (versionId) => !addonPriceSelections[versionId],
    );
    if (missingPrice !== undefined) {
      setError(`Choose a price contract for add-on version #${missingPrice}.`);
      return;
    }
    setBusy("addons");
    setError(null);
    try {
      await updateBillingSubscriptionAddons(
        selected.id,
        {
          addon_version_ids: [],
          addons: addonVersionIds.map((addonVersionId) => ({
            addon_version_id: addonVersionId,
            selected_price_id: addonPriceSelections[addonVersionId]
              ? Number(addonPriceSelections[addonVersionId])
              : null,
          })),
          reason: reason.trim(),
        },
        { token: accessToken() },
      );
      setNotice("Subscription add-ons updated.");
      await loadData(selected.id);
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to update add-ons."));
    } finally {
      setBusy(null);
    }
  };

  const addOverride = async () => {
    if (!selected || !overrideKey.trim() || !overrideReason.trim()) {
      setError("Entitlement key and override reason are required.");
      return;
    }
    if (
      selectedOverrideDefinition?.value_type === "boolean" &&
      !["true", "false"].includes(overrideValue)
    ) {
      setError("Choose Enabled or Disabled for this boolean entitlement.");
      return;
    }
    if (
      selectedOverrideDefinition?.value_type === "integer" &&
      overrideValue.trim() !== "" &&
      !Number.isInteger(Number(overrideValue))
    ) {
      setError(
        "This entitlement requires a whole number or blank for unlimited.",
      );
      return;
    }
    if (
      overrideStartsAt &&
      overrideEndsAt &&
      new Date(overrideEndsAt) < new Date(overrideStartsAt)
    ) {
      setError("Override end cannot be before its start.");
      return;
    }
    setBusy("override");
    setError(null);
    try {
      await createBillingSubscriptionOverride(
        selected.id,
        {
          entitlement_key: overrideKey.trim(),
          override_value: parseOverrideValue(overrideValue),
          reason: overrideReason.trim(),
          starts_at: isoOrNull(overrideStartsAt),
          ends_at: isoOrNull(overrideEndsAt),
        },
        { token: accessToken() },
      );
      setNotice("Temporary entitlement override added.");
      await loadData(selected.id);
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to add override."));
    } finally {
      setBusy(null);
    }
  };

  const removeOverride = async (overrideId: number) => {
    if (!selected) return;
    const removalReason = window
      .prompt("Reason for removing this override?")
      ?.trim();
    if (!removalReason) return;
    setBusy(`remove-${overrideId}`);
    setError(null);
    try {
      await deleteBillingSubscriptionOverride(
        selected.id,
        overrideId,
        removalReason,
        {
          token: accessToken(),
        },
      );
      setNotice("Override removed.");
      await loadData(selected.id);
    } catch (removeError) {
      setError(errorMessage(removeError, "Failed to remove override."));
    } finally {
      setBusy(null);
    }
  };

  const openUpgradeRequest = (request: BillingUpgradeRequest) => {
    setSelectedUpgradeId(request.id);
    setReviewStatus(
      request.status === "pending"
        ? "reviewing"
        : request.status === "rejected"
          ? "rejected"
          : "approved",
    );
    setReviewReason("");
    const plan = plans.find(
      (candidate) =>
        candidate.code.toLowerCase() ===
        request.requested_plan_code.toLowerCase(),
    );
    const version = plan ? planVersions(plan)[0] : null;
    const price = (version?.prices || []).find(
      (candidate) =>
        selectablePrice(candidate) &&
        candidate.billing_interval_months === request.billing_interval_months,
    );
    setFulfillPriceId(price?.id ? String(price.id) : "");
    const addonPrices: Record<string, string> = {};
    for (const code of request.requested_addon_codes) {
      const addon = addons.find(
        (candidate) => candidate.code.toLowerCase() === code.toLowerCase(),
      );
      const addonVersion = [
        addon?.published_version,
        addon?.current_version,
        ...(addon?.versions || []),
      ].find(
        (candidate) =>
          candidate?.status === "published" &&
          isEffectiveNow(candidate.effective_from),
      );
      const addonPrice = (addonVersion?.prices || []).find(
        (candidate) =>
          selectablePrice(candidate) &&
          (candidate.billing_interval_months ===
            request.billing_interval_months ||
            candidate.billing_interval_months === null),
      );
      if (addonPrice?.id) addonPrices[code] = String(addonPrice.id);
    }
    setFulfillAddonPrices(addonPrices);
    setFulfillBillingSource("manual");
    setFulfillTaxRate("0");
    setFulfillDiscount("0");
    setFulfillDueAt("");
    setFulfillPaymentMethod("");
    setFulfillPaymentReference("");
    setFulfillNegotiatedBase("");
    setFulfillNegotiatedAddons({});
    setFulfillReason("");
  };

  const reviewUpgradeRequest = async () => {
    if (!selectedUpgradeRequest || !reviewReason.trim()) {
      setError("A review reason is required.");
      return;
    }
    setBusy("upgrade-review");
    setError(null);
    try {
      await reviewBillingUpgradeRequest(
        selectedUpgradeRequest.id,
        { status: reviewStatus, reason: reviewReason.trim() },
        { token: accessToken() },
      );
      setNotice(`Upgrade request marked ${reviewStatus}.`);
      setSelectedUpgradeId(null);
      setReviewReason("");
      await loadData(selected?.id);
    } catch (reviewError) {
      setError(errorMessage(reviewError, "Failed to review upgrade request."));
    } finally {
      setBusy(null);
    }
  };

  const fulfillUpgradeRequest = async () => {
    if (!canFulfill) {
      setError(
        "Fulfilling a request requires both subscription and payment management permissions.",
      );
      return;
    }
    if (
      !selectedUpgradeRequest ||
      selectedUpgradeRequest.status !== "approved"
    ) {
      setError("Approve the request before fulfilment.");
      return;
    }
    if (
      !fulfillPriceId ||
      selectedUpgradeAddonOptions.some(
        (option) => !fulfillAddonPrices[option.code],
      )
    ) {
      setError(
        "Choose the plan price and one price for each requested add-on.",
      );
      return;
    }
    if (fulfillmentEstimate === null || fulfillReason.trim().length < 3) {
      setError(
        "Resolve quote amounts, discount/tax values, and provide an audit reason.",
      );
      return;
    }
    const paidNow = Boolean(fulfillPaymentMethod);
    const confirmation = paidNow
      ? `Create an invoice for NPR ${fulfillmentEstimate.toLocaleString()} and record it as fully paid? The new subscription will activate immediately.`
      : fulfillBillingSource === "contract"
        ? `Activate this contract subscription with an invoice for NPR ${fulfillmentEstimate.toLocaleString()}?`
        : `Create an unpaid invoice for NPR ${fulfillmentEstimate.toLocaleString()}? The existing subscription stays active until full payment.`;
    if (!window.confirm(confirmation)) return;
    setBusy("upgrade-fulfill");
    setError(null);
    try {
      await fulfillBillingUpgradeRequest(
        selectedUpgradeRequest.id,
        {
          selected_plan_price_id: Number(fulfillPriceId),
          selected_addon_price_ids: Object.fromEntries(
            Object.entries(fulfillAddonPrices).map(([code, priceId]) => [
              code,
              Number(priceId),
            ]),
          ),
          billing_source: fulfillBillingSource,
          tax_rate_percent: Number(fulfillTaxRate || 0),
          discount_amount: Number(fulfillDiscount || 0),
          negotiated_base_amount: fulfillNegotiatedBase
            ? Number(fulfillNegotiatedBase)
            : null,
          negotiated_addon_amounts: Object.fromEntries(
            Object.entries(fulfillNegotiatedAddons)
              .filter(([, amount]) => amount !== "")
              .map(([code, amount]) => [code, Number(amount)]),
          ),
          due_at: isoOrNull(fulfillDueAt),
          payment_method: fulfillPaymentMethod || null,
          payment_reference: fulfillPaymentReference.trim() || null,
          reason: fulfillReason.trim(),
        },
        { token: accessToken() },
      );
      setNotice(
        paidNow || fulfillBillingSource === "contract"
          ? "Request fulfilled and subscription activated."
          : "Invoice created. The current plan remains active until the invoice is fully paid.",
      );
      setSelectedUpgradeId(null);
      await loadData(selected?.id);
    } catch (fulfillError) {
      setError(errorMessage(fulfillError, "Failed to fulfil upgrade request."));
    } finally {
      setBusy(null);
    }
  };

  if (!canView) return <Denied />;

  return (
    <div className="min-h-screen bg-[#f5f7fa] dark:bg-gray-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-gray-800 sm:px-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Subscriptions
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Assign published plan versions, renew periods, and manage exceptions.
        </p>
      </header>

      <main className="space-y-5 p-4 sm:p-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {v2Unavailable ? (
          <Alert tone="warning">
            Subscription V2 routes are not available on this backend. Legacy
            restaurant billing is intentionally not presented as equivalent
            subscription data.
          </Alert>
        ) : null}
        {restaurantDirectoryUnavailable ? (
          <Alert tone="warning">
            The full restaurant directory could not be loaded. Existing account
            branches remain visible, but adding a new branch is unavailable
            until the directory responds.
          </Alert>
        ) : null}

        <nav
          aria-label="Subscription administration sections"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          {(
            [
              ["subscriptions", "Subscriptions"],
              [
                "requests",
                `Upgrade requests (${upgradeRequests.filter((request) => !["completed", "rejected"].includes(request.status)).length})`,
              ],
              ["accounts", "Billing accounts"],
              ...(canAudit ? [["audit", "Audit log"]] : []),
            ] as Array<[typeof activeSection, string]>
          ).map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() => {
                if (
                  section !== activeSection &&
                  activeSection === "subscriptions" &&
                  !confirmDiscardSubscriptionDraft()
                ) {
                  return;
                }
                setActiveSection(section);
              }}
              className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${activeSection === section ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className={activeSection === "accounts" ? "space-y-5" : "hidden"}>
          {unassignedAccounts.length ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-amber-950">
                  Unassigned billing accounts
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  These accounts exist but do not have a subscription. Open a
                  linked restaurant to make the first plan assignment.
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-amber-200">
                      <Th>Account</Th>
                      <Th>Currency</Th>
                      <Th>Primary restaurant</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedAccounts.map((account) => {
                      const primaryRestaurant =
                        account.restaurants.find(
                          (restaurant) => restaurant.is_primary,
                        ) || account.restaurants[0];
                      return (
                        <tr
                          key={account.id}
                          className="border-b border-amber-100 last:border-0"
                        >
                          <Td>
                            <p className="font-semibold text-slate-900">
                              {account.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              Account #{account.id}
                            </p>
                          </Td>
                          <Td>{account.currency}</Td>
                          <Td>
                            {primaryRestaurant?.restaurant_name ||
                              (primaryRestaurant
                                ? `Restaurant #${primaryRestaurant.restaurant_id}`
                                : "No linked restaurant")}
                          </Td>
                          <Td>
                            {canManage && primaryRestaurant ? (
                              <Link
                                href={`/dashboard/restaurants/${primaryRestaurant.restaurant_id}`}
                                className="text-sm font-semibold text-orange-700 hover:text-orange-800"
                              >
                                Assign plan
                              </Link>
                            ) : null}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <BillingAccountManager
            accounts={accounts}
            restaurants={billingRestaurantOptions}
            subscriptions={subscriptions}
            canManage={canManage}
            onSaved={() => loadData(selected?.id)}
          />
        </div>

        <section
          className={`${activeSection === "requests" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Upgrade request queue
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Customer requests are durable workflow records; approving does
                not silently change their subscription.
              </p>
            </div>
            <select
              value={upgradeFilter}
              onChange={(event) => setUpgradeFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All requests</option>
              {[
                "pending",
                "reviewing",
                "approved",
                "rejected",
                "completed",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Requested</Th>
                  <Th>Restaurant / account</Th>
                  <Th>Plan request</Th>
                  <Th>Add-ons</Th>
                  <Th>Message</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filteredUpgradeRequests.length ? (
                  filteredUpgradeRequests.map((request) => (
                    <tr key={request.id} className="border-b border-slate-100">
                      <Td>{displayDate(request.created_at)}</Td>
                      <Td>
                        <Link
                          href={`/dashboard/restaurants/${request.restaurant_id}`}
                          className="font-semibold text-orange-600 hover:text-orange-700"
                        >
                          Restaurant #{request.restaurant_id}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Account #{request.billing_account_id}
                        </p>
                      </Td>
                      <Td>
                        <p className="font-semibold text-slate-800">
                          {request.requested_plan_code}
                        </p>
                        <p className="text-xs text-slate-500">
                          {request.billing_interval_months
                            ? `${request.billing_interval_months} months`
                            : "Custom interval"}
                        </p>
                      </Td>
                      <Td>
                        {request.requested_addon_codes.length
                          ? request.requested_addon_codes.join(", ")
                          : "—"}
                      </Td>
                      <Td>
                        <p
                          className="max-w-xs truncate"
                          title={request.message || ""}
                        >
                          {request.message || "—"}
                        </p>
                      </Td>
                      <Td>
                        <Status status={request.status} />
                      </Td>
                      <Td>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => openUpgradeRequest(request)}
                            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                          >
                            {request.status === "approved"
                              ? "Fulfil"
                              : "Review"}
                          </button>
                        ) : null}
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      No upgrade requests match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {selectedUpgradeRequest ? (
            <div className="mt-5 space-y-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                  Step 1 · Decision
                </p>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <label className="block">
                    <Label>Review status</Label>
                    <select
                      value={reviewStatus}
                      onChange={(event) =>
                        setReviewStatus(
                          event.target.value as typeof reviewStatus,
                        )
                      }
                      className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="reviewing">Reviewing</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <Field
                    label="Review reason"
                    value={reviewReason}
                    onChange={setReviewReason}
                    placeholder="Required audit reason"
                  />
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUpgradeId(null)}
                      className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={reviewUpgradeRequest}
                      disabled={
                        Boolean(busy) ||
                        selectedUpgradeRequest.status === "completed"
                      }
                      className="rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 disabled:opacity-50"
                    >
                      {busy === "upgrade-review" ? "Saving…" : "Save decision"}
                    </button>
                  </div>
                </div>
              </div>
              {selectedUpgradeRequest.status === "approved" ? (
                <div className="border-t border-orange-200 pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-700">
                    Step 2 · Price, invoice, and activate
                  </p>
                  <p className="mt-1 text-xs text-orange-800">
                    The request and published catalog prefill this form. Without
                    a payment, the existing plan remains active until the
                    invoice is fully paid.
                  </p>
                  {!canFulfill ? (
                    <p className="mt-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                      You can review this request, but fulfilment also requires
                      payment-management permission.
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <Label>Plan price contract</Label>
                      <select
                        value={fulfillPriceId}
                        onChange={(event) =>
                          setFulfillPriceId(event.target.value)
                        }
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose requested price</option>
                        {selectedUpgradePrices.map((price) => (
                          <option key={price.id} value={price.id}>
                            {priceOptionLabel(price)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedUpgradePrices.find(
                      (price) => price.id === Number(fulfillPriceId),
                    )?.quote_only ? (
                      <Field
                        label="Negotiated plan amount (NPR)"
                        type="number"
                        value={fulfillNegotiatedBase}
                        onChange={setFulfillNegotiatedBase}
                      />
                    ) : null}
                    {selectedUpgradeAddonOptions.map((option) => (
                      <div
                        key={option.code}
                        className="rounded-xl border border-orange-200 bg-white p-3 sm:col-span-2"
                      >
                        <Label>{option.addon?.name || option.code} price</Label>
                        <select
                          value={fulfillAddonPrices[option.code] || ""}
                          onChange={(event) =>
                            setFulfillAddonPrices((old) => ({
                              ...old,
                              [option.code]: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Choose add-on price</option>
                          {option.prices.map((price) => (
                            <option key={price.id} value={price.id}>
                              {priceOptionLabel(price)}
                            </option>
                          ))}
                        </select>
                        {option.prices.find(
                          (price) =>
                            price.id ===
                            Number(fulfillAddonPrices[option.code]),
                        )?.quote_only ? (
                          <div className="mt-2">
                            <Field
                              label="Negotiated add-on amount (NPR)"
                              type="number"
                              value={fulfillNegotiatedAddons[option.code] || ""}
                              onChange={(amount) =>
                                setFulfillNegotiatedAddons((old) => ({
                                  ...old,
                                  [option.code]: amount,
                                }))
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <label className="block">
                      <Label>Billing source</Label>
                      <select
                        value={fulfillBillingSource}
                        onChange={(event) =>
                          setFulfillBillingSource(
                            event.target.value as typeof fulfillBillingSource,
                          )
                        }
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="manual">
                          Invoice then activate on payment
                        </option>
                        <option value="contract">
                          Signed external contract
                        </option>
                      </select>
                    </label>
                    <Field
                      label="Due at"
                      type="datetime-local"
                      value={fulfillDueAt}
                      onChange={setFulfillDueAt}
                    />
                    <Field
                      label="Discount (NPR)"
                      type="number"
                      value={fulfillDiscount}
                      onChange={setFulfillDiscount}
                    />
                    <Field
                      label="Tax rate (%)"
                      type="number"
                      value={fulfillTaxRate}
                      onChange={setFulfillTaxRate}
                    />
                    <label className="block">
                      <Label>Record full payment now (optional)</Label>
                      <select
                        value={fulfillPaymentMethod}
                        onChange={(event) =>
                          setFulfillPaymentMethod(event.target.value)
                        }
                        className="w-full rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">No — leave invoice due</option>
                        {[
                          "bank_transfer",
                          "cash",
                          "card",
                          "esewa",
                          "khalti",
                          "fonepay",
                          "other",
                        ].map((method) => (
                          <option key={method} value={method}>
                            {method.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="Payment reference"
                      value={fulfillPaymentReference}
                      onChange={setFulfillPaymentReference}
                    />
                    <div className="sm:col-span-2 rounded-xl bg-white px-4 py-3 text-sm">
                      <span className="text-slate-500">
                        Calculated invoice:
                      </span>{" "}
                      <strong className="ml-2 text-slate-900">
                        {fulfillmentEstimate === null
                          ? "Complete price fields"
                          : `NPR ${fulfillmentEstimate.toLocaleString()}`}
                      </strong>
                    </div>
                    <div className="sm:col-span-2">
                      <Field
                        label="Fulfilment audit reason"
                        value={fulfillReason}
                        onChange={setFulfillReason}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={fulfillUpgradeRequest}
                      disabled={Boolean(busy) || !canFulfill}
                      title={
                        !canFulfill
                          ? "Requires subscription and payment management permissions"
                          : undefined
                      }
                      className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
                    >
                      {busy === "upgrade-fulfill"
                        ? "Fulfilling…"
                        : "Confirm fulfilment"}
                    </button>
                  </div>
                </div>
              ) : selectedUpgradeRequest.status !== "completed" &&
                selectedUpgradeRequest.status !== "rejected" ? (
                <p className="border-t border-orange-200 pt-3 text-xs text-orange-800">
                  Approve this request first. The fulfilment step then creates
                  the linked subscription and invoice atomically.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {canAudit ? (
          <section
            className={`${activeSection === "audit" ? "" : "hidden"} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Global billing audit
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Includes catalog, plan, add-on, account, subscription,
                  invoice, and payment events.
                </p>
              </div>
              <input
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                placeholder="Search action, account, actor, reason..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-80"
              />
            </div>
            <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
              {auditLoading ? (
                <p className="text-sm text-slate-500">
                  Loading complete audit history...
                </p>
              ) : filteredAuditLogs.length ? (
                filteredAuditLogs.map((log) => (
                  <details
                    key={log.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900">
                          {log.action}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {displayDate(log.created_at)}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {log.entity_type} #{log.entity_id ?? "—"} · account{" "}
                        {log.billing_account_id ?? "catalog/global"} · actor{" "}
                        {log.actor_id ?? "system"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {log.reason || "No reason recorded"}
                      </p>
                    </summary>
                    {log.before || log.after ? (
                      <pre className="mt-3 max-h-56 overflow-auto rounded bg-slate-900 p-3 text-[10px] text-slate-100">
                        {JSON.stringify(
                          { before: log.before, after: log.after },
                          null,
                          2,
                        )}
                      </pre>
                    ) : null}
                  </details>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No audit records match this filter.
                </p>
              )}
            </div>
          </section>
        ) : null}

        <div
          className={`${activeSection === "subscriptions" ? "grid" : "hidden"} grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]`}
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Billing accounts
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filtered.length} matching subscription records
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search account, owner, restaurant..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All states</option>
                  {SUBSCRIPTION_STATES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <Th>Billing account</Th>
                    <Th>Plan</Th>
                    <Th>Status</Th>
                    <Th>Period end</Th>
                    <Th>Usage alerts</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-sm text-slate-500">
                        Loading live subscriptions...
                      </td>
                    </tr>
                  ) : filtered.length ? (
                    filtered.map((subscription) => {
                      const usageAlerts = Object.values(
                        subscription.usage || {},
                      ).filter(
                        (item) =>
                          item.limit !== null && item.used >= item.limit,
                      ).length;
                      return (
                        <tr
                          key={subscription.id}
                          className={`border-b border-slate-100 ${selectedId === subscription.id ? "bg-orange-50" : "hover:bg-slate-50"}`}
                        >
                          <Td>
                            <p className="font-semibold text-slate-900">
                              {accountLabel(subscription)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Account #{subscription.billing_account_id}
                              {subscription.owner?.email ||
                              subscription.owner_email
                                ? ` · ${subscription.owner?.email || subscription.owner_email}`
                                : ""}
                            </p>
                          </Td>
                          <Td>
                            <p className="text-sm font-semibold text-slate-800">
                              {planLabel(subscription, plans)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Version {subscriptionVersionNumber(subscription)}
                            </p>
                          </Td>
                          <Td>
                            <Status
                              status={effectiveSubscriptionStatus(subscription)}
                            />
                          </Td>
                          <Td>
                            {displayDate(subscription.current_period_end)}
                          </Td>
                          <Td>
                            {usageAlerts ? (
                              <span className="font-semibold text-red-600">
                                {usageAlerts} at limit
                              </span>
                            ) : (
                              <span className="text-slate-500">None</span>
                            )}
                          </Td>
                          <Td>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  subscription.id !== selectedId &&
                                  !confirmDiscardSubscriptionDraft()
                                ) {
                                  return;
                                }
                                setSelectedId(subscription.id);
                              }}
                              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                            >
                              Manage
                            </button>
                          </Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        {v2Unavailable
                          ? "No V2 data available."
                          : "No subscriptions match these filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="h-fit space-y-5 xl:sticky xl:top-5">
            {!selected ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-sm text-slate-500">
                  Select a subscription to manage its plan, renewal, usage,
                  add-ons, and overrides.
                </p>
              </section>
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {accountLabel(selected)}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Subscription #{selected.id}
                      </p>
                    </div>
                    <Status status={effectiveSubscriptionStatus(selected)} />
                  </div>
                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <Label>Published plan version</Label>
                      <select
                        value={planVersionId}
                        onChange={(event) => {
                          setPlanVersionId(event.target.value);
                          setSelectedPriceId("");
                        }}
                        disabled={!canManage}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose a version</option>
                        {!publishedVersions.some(
                          ({ version }) =>
                            version.id === selected.plan_version_id,
                        ) ? (
                          <option value={selected.plan_version_id}>
                            Current pinned version{" "}
                            {subscriptionVersionNumber(selected)}{" "}
                            (grandfathered)
                          </option>
                        ) : null}
                        {publishedVersions.map(({ plan, version }) => (
                          <option key={version.id} value={version.id}>
                            {plan.name} · v{version.version_number}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <Label>Price / billing cycle</Label>
                      <select
                        value={selectedPriceId}
                        onChange={(event) =>
                          setSelectedPriceId(event.target.value)
                        }
                        disabled={!canManage || !selectedPlanPrices.length}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose a price contract</option>
                        {selectedPlanPrices
                          .filter(selectablePrice)
                          .map((price) => (
                            <option key={price.id} value={price.id}>
                              {priceOptionLabel(price)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      <Label>Status</Label>
                      <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        disabled={!canManage}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        {SUBSCRIPTION_STATES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <Label>Billing source</Label>
                      <select
                        value={billingSource}
                        onChange={(event) =>
                          setBillingSource(
                            event.target.value as typeof billingSource,
                          )
                        }
                        disabled={!canManage}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="manual">Manual invoice/payment</option>
                        <option value="contract">
                          Externally signed contract
                        </option>
                        {billingSource === "gateway" ? (
                          <option value="gateway" disabled>
                            Gateway (not configured)
                          </option>
                        ) : null}
                        {billingSource === "trial" ? (
                          <option value="trial" disabled>
                            Automatic signup trial
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <Field
                      label="Starts at"
                      type="datetime-local"
                      value={startedAt}
                      onChange={setStartedAt}
                      disabled={!canManage}
                    />
                    <Field
                      label="Trial ends"
                      type="datetime-local"
                      value={trialEnd}
                      onChange={setTrialEnd}
                      disabled={!canManage}
                    />
                    <Field
                      label="Current period starts"
                      type="datetime-local"
                      value={periodStart}
                      onChange={setPeriodStart}
                      disabled={!canManage}
                    />
                    <Field
                      label="Current period ends"
                      type="datetime-local"
                      value={periodEnd}
                      onChange={setPeriodEnd}
                      disabled={!canManage}
                    />
                    <Field
                      label="Grace ends"
                      type="datetime-local"
                      value={graceEnd}
                      onChange={setGraceEnd}
                      disabled={!canManage}
                    />
                    <Field
                      label="Notes"
                      value={notes}
                      onChange={setNotes}
                      disabled={!canManage}
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={cancelAtPeriodEnd}
                        onChange={(event) =>
                          setCancelAtPeriodEnd(event.target.checked)
                        }
                        disabled={!canManage}
                      />{" "}
                      Cancel at period end
                    </label>
                    <Field
                      label="Audit reason"
                      value={reason}
                      onChange={setReason}
                      disabled={!canManage}
                      placeholder="Required for every mutation"
                    />
                    {canManage ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={saveAssignment}
                          disabled={Boolean(busy)}
                          className="rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {busy === "assignment"
                            ? "Saving..."
                            : "Create replacement"}
                        </button>
                        <button
                          type="button"
                          onClick={saveStatusAndRenewal}
                          disabled={Boolean(busy)}
                          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy === "renewal" ? "Saving..." : "Update current"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">
                    Live usage
                  </h2>
                  <div className="mt-3 space-y-3">
                    {Object.entries(selected.usage || {}).length ? (
                      Object.entries(selected.usage || {}).map(
                        ([key, usage]) => (
                          <div key={key}>
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-medium text-slate-600">
                                {key}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {usage.used} /{" "}
                                {usage.limit === null
                                  ? "Unlimited"
                                  : usage.limit}
                              </span>
                            </div>
                            {usage.limit !== null && usage.limit > 0 ? (
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${usage.used >= usage.limit ? "bg-red-500" : "bg-orange-500"}`}
                                  style={{
                                    width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                        ),
                      )
                    ) : (
                      <p className="text-sm text-slate-500">
                        No usage counters returned.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">
                    Add-ons
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selected.addons || []).filter(isActiveAddonAssignment)
                      .length ? (
                      (selected.addons || [])
                        .filter(isActiveAddonAssignment)
                        .map((assignment) => (
                          <span
                            key={assignment.id || assignment.addon_version_id}
                            className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700"
                          >
                            {assignment.name ||
                              assignment.addon_name ||
                              assignment.code ||
                              assignment.addon_code ||
                              `Add-on version #${assignment.addon_version_id}`}{" "}
                            (active
                            {assignment.selected_price_id
                              ? `, price #${assignment.selected_price_id}`
                              : ""}
                            )
                          </span>
                        ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        No active add-ons.
                      </span>
                    )}
                  </div>
                  {(selected.addons || []).some(
                    (assignment) => !isActiveAddonAssignment(assignment),
                  ) ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Historical:{" "}
                      {(selected.addons || [])
                        .filter(
                          (assignment) => !isActiveAddonAssignment(assignment),
                        )
                        .map(
                          (assignment) =>
                            `${assignment.name || assignment.code || `version #${assignment.addon_version_id}`} (${assignment.status || "ended"})`,
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {addonsUnavailable ? (
                    <p className="mt-3 text-sm text-amber-700">
                      Add-on management is not available on this backend.
                    </p>
                  ) : addonVersionOptions.length ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      {addonVersionOptions.map(
                        ({ addon, version, grandfathered }) => {
                          const checked = addonVersionIds.includes(version.id);
                          const compatible =
                            !addon.compatible_plan_codes?.length ||
                            !selectedPlanCode ||
                            addon.compatible_plan_codes
                              .map((code) => code.toLowerCase())
                              .includes(selectedPlanCode.toLowerCase());
                          const prices = (version.prices || []).filter(
                            (price) =>
                              selectablePrice(price) ||
                              String(price.id) ===
                                addonPriceSelections[version.id],
                          );
                          return (
                            <div
                              key={version.id}
                              className={`rounded-lg border px-3 py-3 text-sm ${compatible ? "border-slate-200" : "border-amber-200 bg-amber-50"}`}
                            >
                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={
                                    !canManage || (!compatible && !checked)
                                  }
                                  onChange={(event) => {
                                    setAddonVersionIds((old) =>
                                      event.target.checked
                                        ? [...new Set([...old, version.id])]
                                        : old.filter((id) => id !== version.id),
                                    );
                                    if (!event.target.checked) {
                                      setAddonPriceSelections((old) => {
                                        const next = { ...old };
                                        delete next[version.id];
                                        return next;
                                      });
                                    }
                                  }}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="font-semibold text-slate-900">
                                    {addon.name}
                                  </span>
                                  <span className="ml-1 text-xs text-slate-500">
                                    {grandfathered
                                      ? "grandfathered"
                                      : `v${version.version_number}`}
                                  </span>
                                  {!compatible ? (
                                    <span className="ml-2 text-xs font-semibold text-amber-700">
                                      Not compatible with {selectedPlanCode}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                              {checked ? (
                                <label className="mt-3 block border-t border-slate-100 pt-3">
                                  <Label>Price / billing cycle</Label>
                                  <select
                                    value={
                                      addonPriceSelections[version.id] || ""
                                    }
                                    onChange={(event) =>
                                      setAddonPriceSelections((old) => ({
                                        ...old,
                                        [version.id]: event.target.value,
                                      }))
                                    }
                                    disabled={!canManage}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                  >
                                    <option value="">
                                      Choose a price contract
                                    </option>
                                    {prices.map((price) => (
                                      <option key={price.id} value={price.id}>
                                        {priceOptionLabel(price)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}
                            </div>
                          );
                        },
                      )}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={saveAddons}
                          disabled={Boolean(busy)}
                          className="w-full rounded-xl border border-orange-300 px-3 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                        >
                          {busy === "addons"
                            ? "Saving..."
                            : "Replace assigned add-ons"}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      No published add-ons returned.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900">
                    Overrides
                  </h2>
                  <div className="mt-3 space-y-2">
                    {(selected.overrides || []).length ? (
                      (selected.overrides || []).map((override) => {
                        const value =
                          override.value !== undefined
                            ? override.value
                            : override.override_value;
                        const lifecycle = overrideLifecycle(override);
                        return (
                          <div
                            key={override.id}
                            className="rounded-lg border border-slate-200 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-xs font-semibold text-slate-800">
                                    {override.entitlement_key}
                                  </p>
                                  <Status status={lifecycle} />
                                </div>
                                <p className="mt-1 text-sm text-slate-600">
                                  {value === null ? "Unlimited" : String(value)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {override.reason}
                                  {override.starts_at
                                    ? ` · starts ${displayDate(override.starts_at)}`
                                    : ""}
                                  {override.ends_at
                                    ? ` · ends ${displayDate(override.ends_at)}`
                                    : ""}
                                </p>
                              </div>
                              {canOverride ? (
                                <button
                                  type="button"
                                  onClick={() => removeOverride(override.id)}
                                  disabled={Boolean(busy)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">
                        No overrides configured.
                      </p>
                    )}
                  </div>
                  {canOverride ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <label className="block">
                        <Label>Entitlement</Label>
                        <select
                          value={overrideKey}
                          onChange={(event) => {
                            setOverrideKey(event.target.value);
                            setOverrideValue("");
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        >
                          <option value="">
                            Choose a registered entitlement
                          </option>
                          {definitions.map((definition) => (
                            <option key={definition.key} value={definition.key}>
                              {definition.label} ({definition.key})
                            </option>
                          ))}
                        </select>
                        {selectedOverrideDefinition ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {selectedOverrideDefinition.description ||
                              `${selectedOverrideDefinition.value_type} value`}
                          </p>
                        ) : null}
                      </label>
                      {selectedOverrideDefinition?.value_type === "boolean" ? (
                        <label className="block">
                          <Label>Override value</Label>
                          <select
                            value={overrideValue}
                            onChange={(event) =>
                              setOverrideValue(event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                          >
                            <option value="">Choose true or false</option>
                            <option value="true">Enabled</option>
                            <option value="false">Disabled</option>
                          </select>
                        </label>
                      ) : (
                        <Field
                          label="Override value"
                          type={
                            selectedOverrideDefinition?.value_type === "integer"
                              ? "number"
                              : "text"
                          }
                          value={overrideValue}
                          onChange={setOverrideValue}
                          placeholder={
                            selectedOverrideDefinition?.value_type === "integer"
                              ? "Whole number; blank means unlimited"
                              : "Text value"
                          }
                        />
                      )}
                      <Field
                        label="Starts at (optional)"
                        type="datetime-local"
                        value={overrideStartsAt}
                        onChange={setOverrideStartsAt}
                      />
                      <Field
                        label="Ends at (optional)"
                        type="datetime-local"
                        value={overrideEndsAt}
                        onChange={setOverrideEndsAt}
                      />
                      <Field
                        label="Override reason"
                        value={overrideReason}
                        onChange={setOverrideReason}
                      />
                      <button
                        type="button"
                        onClick={addOverride}
                        disabled={Boolean(busy)}
                        className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {busy === "override" ? "Adding..." : "Add override"}
                      </button>
                    </div>
                  ) : null}
                </section>

                {canAudit ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-base font-bold text-slate-900">
                      Account audit history
                    </h2>
                    <div className="mt-3 space-y-3">
                      {auditLoading ? (
                        <p className="text-sm text-slate-500">
                          Loading audit history...
                        </p>
                      ) : selectedAccountAuditLogs.length ? (
                        selectedAccountAuditLogs.map((log) => (
                          <details
                            key={log.id}
                            className="rounded-lg border border-slate-200 p-3"
                          >
                            <summary className="cursor-pointer list-none">
                              <p className="text-xs font-semibold text-slate-900">
                                {log.action}
                              </p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {displayDate(log.created_at)}
                                {log.actor_id
                                  ? ` · actor #${log.actor_id}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                {log.reason || "No reason recorded"}
                              </p>
                            </summary>
                            {log.before || log.after ? (
                              <pre className="mt-3 max-h-56 overflow-auto rounded bg-slate-900 p-3 text-[10px] text-slate-100">
                                {JSON.stringify(
                                  { before: log.before, after: log.after },
                                  null,
                                  2,
                                )}
                              </pre>
                            ) : null}
                          </details>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">
                          No audit records returned for this billing account.
                        </p>
                      )}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="pb-3 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-4 pr-4 text-sm text-slate-700">{children}</td>;
}
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm disabled:bg-slate-50"
      />
    </label>
  );
}
function Status({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-green-100 text-green-700"
      : status === "trialing"
        ? "bg-blue-100 text-blue-700"
        : status === "grace" || status === "past_due"
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  const color =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`sticky top-3 z-40 rounded-xl border px-4 py-3 text-sm shadow-sm ${color}`}
    >
      {children}
    </div>
  );
}
function Denied() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <h1 className="text-xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          You do not have permission to view subscriptions.
        </p>
      </section>
    </div>
  );
}
