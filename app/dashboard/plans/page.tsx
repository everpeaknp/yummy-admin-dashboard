"use client";

import { useEffect, useMemo, useState } from "react";
import BillingAddonCatalog from "@/components/BillingAddonCatalog";
import BillingModal from "@/components/BillingModal";
import {
  createBillingPlan,
  createBillingPlanVersion,
  getBillingEntitlementDefinitions,
  getBillingPlan,
  getBillingPlans,
  getBillingPlanVersion,
  getBillingTrialSettings,
  isBackendRouteUnavailable,
  publishBillingPlanVersion,
  updateBillingPlan,
  updateBillingPlanVersion,
  updateBillingPlanVersionEntitlements,
  updateBillingPlanVersionPrices,
  updateBillingTrialSettings,
  type BillingEntitlementDefinition,
  type BillingEntitlementValue,
  type BillingPlan,
  type BillingPlanPrice,
  type BillingPlanValidation,
  type BillingPlanVersion,
  type BillingTrialSettings,
} from "@/lib/backend-api";
import {
  canManageBillingCatalog,
  canPublishBillingCatalog,
  canViewBillingCatalog,
  getStoredAuthSession,
} from "@/lib/auth";

type PlanForm = {
  name: string;
  description: string;
  displayOrder: string;
  isPublic: boolean;
  status: string;
};

const emptyPlanForm: PlanForm = {
  name: "",
  description: "",
  displayOrder: "0",
  isPublic: true,
  status: "active",
};

function draftPrice(
  billingIntervalMonths: number | null,
  priceType: "flat" | "initial" | "renewal",
  quoteOnly = false,
): BillingPlanPrice {
  return {
    billing_interval_months: quoteOnly ? null : billingIntervalMonths,
    price_type: priceType,
    amount: quoteOnly ? null : "",
    currency: "NPR",
    tax_inclusive: false,
    quote_only: quoteOnly,
    effective_from: null,
    effective_to: null,
    is_active: true,
  };
}

function token() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateTimeInput(value?: string | null) {
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

function versionLabel(version: BillingPlanVersion) {
  return `Version ${version.version_number} · ${version.status}`;
}

function uniqueVersions(plan: BillingPlan | null): BillingPlanVersion[] {
  if (!plan) return [];
  const candidates = [
    ...(plan.versions || []),
    plan.draft_version,
    plan.published_version,
    plan.latest_version,
    plan.current_version,
  ].filter((item): item is BillingPlanVersion => Boolean(item));
  return [...new Map(candidates.map((item) => [item.id, item])).values()].sort(
    (a, b) => b.version_number - a.version_number,
  );
}

function marketingText(value: BillingPlanVersion["marketing_content"]) {
  if (!value) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function marketingPayload(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as unknown;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Marketing content must be a valid JSON object.");
}

function marketingField(
  value: string,
  key: "headline" | "summary" | "highlights",
) {
  try {
    const parsed = marketingPayload(value) || {};
    const field = parsed[key];
    if (key === "highlights")
      return Array.isArray(field) ? field.map(String).join("\n") : "";
    return typeof field === "string" ? field : "";
  } catch {
    return "";
  }
}

function updateMarketingField(
  value: string,
  key: "headline" | "summary" | "highlights",
  nextValue: string,
) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = marketingPayload(value) || {};
  } catch {
    // A structured edit intentionally repairs malformed advanced JSON.
  }
  if (key === "highlights") {
    parsed[key] = nextValue
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (nextValue.trim()) {
    parsed[key] = nextValue;
  } else {
    delete parsed[key];
  }
  return JSON.stringify(parsed, null, 2);
}

function validationFor(
  plan: BillingPlan,
  version: BillingPlanVersion,
  prices: BillingPlanPrice[],
  entitlements: Record<string, BillingEntitlementValue>,
  definitions: BillingEntitlementDefinition[],
): BillingPlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!plan.name.trim()) errors.push("Plan name is required.");
  if (!plan.code.trim()) errors.push("Plan code is required.");
  if (version.status !== "draft")
    errors.push("Only a draft version can be published.");
  prices.forEach((price, index) => {
    if (
      price.billing_interval_months !== null &&
      (!Number.isFinite(Number(price.billing_interval_months)) ||
        Number(price.billing_interval_months) <= 0)
    ) {
      errors.push(`Price row ${index + 1} needs a positive billing interval.`);
    }
    if (price.quote_only && price.amount !== null && price.amount !== "") {
      errors.push(
        `Price row ${index + 1} is quote-only and cannot have an amount.`,
      );
    }
    if (
      !price.quote_only &&
      (!Number.isFinite(Number(price.amount)) ||
        price.amount === null ||
        price.amount === "" ||
        Number(price.amount) < 0)
    ) {
      errors.push(`Price row ${index + 1} needs a valid non-negative amount.`);
    }
    if (price.currency.trim().toUpperCase() !== "NPR")
      errors.push(`Price row ${index + 1} must use NPR.`);
    if (price.quote_only && price.billing_interval_months !== null)
      errors.push(
        `Price row ${index + 1} must leave the interval blank when quote-only.`,
      );
    const startsAt = price.effective_from
      ? new Date(price.effective_from)
      : null;
    const endsAt = price.effective_to ? new Date(price.effective_to) : null;
    if (startsAt && Number.isNaN(startsAt.getTime()))
      errors.push(`Price row ${index + 1} has an invalid effective-from date.`);
    if (endsAt && Number.isNaN(endsAt.getTime()))
      errors.push(`Price row ${index + 1} has an invalid effective-to date.`);
    if (
      startsAt &&
      endsAt &&
      !Number.isNaN(startsAt.getTime()) &&
      !Number.isNaN(endsAt.getTime()) &&
      endsAt < startsAt
    ) {
      errors.push(`Price row ${index + 1} must end after it starts.`);
    }
  });
  const activePrices = prices.filter((price) => price.is_active !== false);
  if (!activePrices.length)
    errors.push("At least one active price is required.");
  const structures = new Map<number | null, Set<string>>();
  activePrices.forEach((price) => {
    const types =
      structures.get(price.billing_interval_months) || new Set<string>();
    if (types.has(price.price_type))
      errors.push(
        `Duplicate ${price.price_type} price for ${price.billing_interval_months || "custom"} interval.`,
      );
    types.add(price.price_type);
    structures.set(price.billing_interval_months, types);
  });
  structures.forEach((types, interval) => {
    const label = interval === null ? "custom" : `${interval}-month`;
    if (types.has("flat") && types.size > 1)
      errors.push(
        `${label} pricing cannot mix flat with initial/renewal rows.`,
      );
    if (!types.has("flat") && (!types.has("initial") || !types.has("renewal")))
      errors.push(`${label} pricing needs both initial and renewal rows.`);
  });
  if (plan.code === "enterprise") {
    if (activePrices.some((price) => !price.quote_only))
      errors.push("Enterprise base prices must be quote-only.");
  } else if (activePrices.some((price) => price.quote_only)) {
    errors.push("Only the Enterprise plan can use quote-only base prices.");
  }
  if (
    plan.code === "free" &&
    activePrices.some((price) => Number(price.amount || 0) !== 0)
  ) {
    errors.push("Free plan prices must be zero.");
  }
  if (!Object.keys(entitlements).length)
    warnings.push("This draft has no configured entitlements.");
  const definitionMap = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  definitions
    .filter((definition) => definition.is_enforced)
    .forEach((definition) => {
      if (!(definition.key in entitlements))
        errors.push(`Missing enforced entitlement: ${definition.key}.`);
    });
  Object.entries(entitlements).forEach(([key, value]) => {
    const definition = definitionMap.get(key);
    if (!definition) {
      warnings.push(
        `${key} is not present in the entitlement registry returned by the backend.`,
      );
      return;
    }
    if (value === null) return;
    if (definition.value_type === "boolean" && typeof value !== "boolean") {
      errors.push(`${key} must be true or false.`);
    }
    if (
      definition.value_type === "integer" &&
      (typeof value !== "number" || !Number.isInteger(value))
    ) {
      errors.push(`${key} must be an integer or unlimited.`);
    }
  });
  return { valid: errors.length === 0, errors, warnings };
}

export default function PlansPage() {
  const session = getStoredAuthSession();
  const canView = canViewBillingCatalog(session);
  const canManage = canManageBillingCatalog(session);
  const canPublish = canPublishBillingCatalog(session);

  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [selectedVersion, setSelectedVersion] =
    useState<BillingPlanVersion | null>(null);
  const [definitions, setDefinitions] = useState<
    BillingEntitlementDefinition[]
  >([]);
  const [trialSettings, setTrialSettings] =
    useState<BillingTrialSettings | null>(null);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialPlanId, setTrialPlanId] = useState("");
  const [trialDays, setTrialDays] = useState("14");
  const [trialReason, setTrialReason] = useState("");
  const [registryUnavailable, setRegistryUnavailable] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [subtitle, setSubtitle] = useState("");
  const [marketing, setMarketing] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [prices, setPrices] = useState<BillingPlanPrice[]>([]);
  const [entitlements, setEntitlements] = useState<
    Record<string, BillingEntitlementValue>
  >({});
  const [publishReason, setPublishReason] = useState("");
  const [validation, setValidation] = useState<BillingPlanValidation | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    description: "",
  });

  const versions = useMemo(() => uniqueVersions(selectedPlan), [selectedPlan]);
  const editorDefinitions = useMemo<BillingEntitlementDefinition[]>(() => {
    if (definitions.length) return definitions;
    return Object.keys(entitlements)
      .sort()
      .map((key) => {
        const value = entitlements[key];
        return {
          key,
          label: key,
          value_type:
            typeof value === "boolean"
              ? "boolean"
              : typeof value === "number"
                ? "integer"
                : "string",
        } satisfies BillingEntitlementDefinition;
      });
  }, [definitions, entitlements]);

  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, BillingEntitlementDefinition[]>();
    editorDefinitions.forEach((definition) => {
      const moduleName =
        definition.module || definition.key.split(".")[0] || "Other";
      groups.set(moduleName, [...(groups.get(moduleName) || []), definition]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [editorDefinitions]);

  const hasUnsavedPlanChanges = useMemo(() => {
    if (!selectedPlan) return false;
    const planChanged =
      planForm.name !== selectedPlan.name ||
      planForm.description !== (selectedPlan.description || "") ||
      planForm.displayOrder !== String(selectedPlan.display_order ?? 0) ||
      planForm.isPublic !== Boolean(selectedPlan.is_public) ||
      planForm.status !== (selectedPlan.status || "active");
    if (!selectedVersion) return planChanged;
    return (
      planChanged ||
      subtitle !== (selectedVersion.subtitle || "") ||
      marketing !== marketingText(selectedVersion.marketing_content) ||
      effectiveFrom !== dateTimeInput(selectedVersion.effective_from) ||
      JSON.stringify(prices) !== JSON.stringify(selectedVersion.prices || []) ||
      JSON.stringify(entitlements) !==
        JSON.stringify(selectedVersion.entitlements || {})
    );
  }, [
    effectiveFrom,
    entitlements,
    marketing,
    planForm,
    prices,
    selectedPlan,
    selectedVersion,
    subtitle,
  ]);

  const hasUnsavedTrialChanges = useMemo(
    () =>
      Boolean(
        trialSettings &&
          (trialEnabled !== trialSettings.trial_enabled ||
            trialPlanId !== String(trialSettings.trial_plan_id) ||
            trialDays !== String(trialSettings.trial_days)),
      ),
    [trialDays, trialEnabled, trialPlanId, trialSettings],
  );

  const hasUnsavedChanges =
    hasUnsavedPlanChanges || hasUnsavedTrialChanges;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const canDiscardDraft = () =>
    !hasUnsavedPlanChanges || window.confirm("Discard unsaved plan changes?");

  const applyTrialSettings = (settings: BillingTrialSettings) => {
    setTrialSettings(settings);
    setTrialEnabled(settings.trial_enabled);
    setTrialPlanId(String(settings.trial_plan_id));
    setTrialDays(String(settings.trial_days));
    setTrialReason("");
  };

  const setEntitlementValue = (
    key: string,
    value: BillingEntitlementValue | undefined,
  ) => {
    setEntitlements((old) => {
      const next = { ...old };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const applyVersion = (version: BillingPlanVersion | null) => {
    setSelectedVersion(version);
    setSubtitle(version?.subtitle || "");
    setMarketing(marketingText(version?.marketing_content));
    setEffectiveFrom(dateTimeInput(version?.effective_from));
    setPrices((version?.prices || []).map((price) => ({ ...price })));
    setEntitlements({ ...(version?.entitlements || {}) });
    setValidation(null);
    setPublishReason("");
  };

  const applyPlan = (plan: BillingPlan, preferredVersionId?: number) => {
    setSelectedPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || "",
      displayOrder: String(plan.display_order ?? 0),
      isPublic: Boolean(plan.is_public),
      status: plan.status || "active",
    });
    const allVersions = uniqueVersions(plan);
    const next =
      allVersions.find((item) => item.id === preferredVersionId) ||
      allVersions.find((item) => item.status === "draft") ||
      allVersions[0] ||
      null;
    applyVersion(next);
  };

  const loadVersion = async (versionId: number) => {
    try {
      const response = await getBillingPlanVersion(versionId, {
        token: token(),
      });
      applyVersion(response.data);
    } catch (loadError) {
      setError(messageFrom(loadError, "Failed to load plan version."));
    }
  };

  const loadPlan = async (planId: number, preferredVersionId?: number) => {
    setBusy("plan");
    setError(null);
    try {
      const response = await getBillingPlan(planId, { token: token() });
      applyPlan(response.data, preferredVersionId);
      const candidate =
        uniqueVersions(response.data).find(
          (item) => item.id === preferredVersionId,
        ) ||
        uniqueVersions(response.data).find((item) => item.status === "draft") ||
        uniqueVersions(response.data)[0];
      if (candidate) await loadVersion(candidate.id);
    } catch (loadError) {
      setError(messageFrom(loadError, "Failed to load plan details."));
    } finally {
      setBusy(null);
    }
  };

  const refreshPlans = async (
    preferredPlanId?: number,
    preferredVersionId?: number,
  ) => {
    setError(null);
    const response = await getBillingPlans({ token: token() });
    const nextPlans = response.data || [];
    setPlans(nextPlans);
    const plan =
      nextPlans.find((item) => item.id === preferredPlanId) ||
      nextPlans[0] ||
      null;
    if (!plan) {
      setSelectedPlan(null);
      applyVersion(null);
      return;
    }
    await loadPlan(plan.id, preferredVersionId);
  };

  useEffect(() => {
    let active = true;
    if (!canView) {
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        await refreshPlans();
        const trialResponse = await getBillingTrialSettings({
          token: token(),
        });
        if (active) applyTrialSettings(trialResponse.data);
        try {
          const response = await getBillingEntitlementDefinitions({
            token: token(),
          });
          if (active) setDefinitions(response.data || []);
        } catch (registryError) {
          if (active && isBackendRouteUnavailable(registryError)) {
            setRegistryUnavailable(true);
          } else if (active) {
            setError(
              messageFrom(
                registryError,
                "Failed to load entitlement registry.",
              ),
            );
          }
        }
      } catch (loadError) {
        if (active)
          setError(messageFrom(loadError, "Failed to load billing plans."));
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // Permission is fixed for the stored session during this mounted page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const saveTrialSettings = async () => {
    const planId = Number(trialPlanId);
    const days = Number(trialDays);
    if (!Number.isInteger(planId) || planId <= 0) {
      setError("Choose the plan new customers receive during the trial.");
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError("Trial duration must be a whole number from 1 to 365 days.");
      return;
    }
    if (!trialReason.trim()) {
      setError("An audit reason is required to change the signup trial.");
      return;
    }
    const selected = plans.find((plan) => plan.id === planId);
    const summary = trialEnabled
      ? `${days}-day ${selected?.name || "selected plan"} trial`
      : "Free plan with no automatic trial";
    if (
      !window.confirm(
        `Set new restaurant signups to: ${summary}? Existing subscriptions will not change.`,
      )
    ) {
      return;
    }
    setBusy("trial-settings");
    setError(null);
    setNotice(null);
    try {
      const response = await updateBillingTrialSettings(
        {
          trial_enabled: trialEnabled,
          trial_plan_id: planId,
          trial_days: days,
          reason: trialReason.trim(),
        },
        { token: token() },
      );
      applyTrialSettings(response.data);
      setNotice(
        trialEnabled
          ? `New restaurants will receive a ${days}-day ${response.data.trial_plan_name || "configured"} trial.`
          : "Automatic signup trials are disabled; new restaurants will start on Free.",
      );
    } catch (saveError) {
      setError(messageFrom(saveError, "Failed to update signup trial settings."));
    } finally {
      setBusy(null);
    }
  };

  const createPlan = async () => {
    const code = createForm.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");
    if (!code || !createForm.name.trim()) {
      setError("Plan code and name are required.");
      return;
    }
    setBusy("create-plan");
    setError(null);
    try {
      const response = await createBillingPlan(
        {
          code,
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
        },
        { token: token() },
      );
      setShowCreate(false);
      setCreateForm({ code: "", name: "", description: "" });
      setNotice(
        "Plan created. Create its first draft version to configure prices and entitlements.",
      );
      await refreshPlans(response.data.id);
    } catch (createError) {
      setError(messageFrom(createError, "Failed to create plan."));
    } finally {
      setBusy(null);
    }
  };

  const savePlan = async () => {
    if (!selectedPlan) return;
    setBusy("save-plan");
    setError(null);
    setNotice(null);
    try {
      const response = await updateBillingPlan(
        selectedPlan.id,
        {
          name: planForm.name.trim(),
          description: planForm.description.trim() || null,
          display_order: Number(planForm.displayOrder) || 0,
          is_public: planForm.isPublic,
          status: planForm.status,
        },
        { token: token() },
      );
      setNotice("Plan details saved.");
      setPlanForm({
        name: response.data.name,
        description: response.data.description || "",
        displayOrder: String(response.data.display_order ?? 0),
        isPublic: Boolean(response.data.is_public),
        status: response.data.status || "active",
      });
      setSelectedPlan(response.data);
      setPlans((items) =>
        items.map((item) =>
          item.id === response.data.id ? response.data : item,
        ),
      );
    } catch (saveError) {
      setError(messageFrom(saveError, "Failed to save plan details."));
    } finally {
      setBusy(null);
    }
  };

  const createDraft = async () => {
    if (!selectedPlan) return;
    if (!canDiscardDraft()) return;
    const source =
      versions.find((item) => item.status === "published") || versions[0];
    setBusy("create-draft");
    setError(null);
    setNotice(null);
    try {
      const response = await createBillingPlanVersion(
        selectedPlan.id,
        source ? { source_version_id: source.id } : {},
        { token: token() },
      );
      setNotice(
        source
          ? "Draft created from the latest version."
          : "Empty draft created.",
      );
      await refreshPlans(selectedPlan.id, response.data.id);
    } catch (draftError) {
      setError(messageFrom(draftError, "Failed to create draft version."));
    } finally {
      setBusy(null);
    }
  };

  const saveVersionDetails = async () => {
    if (!selectedVersion) return;
    setBusy("save-version");
    setError(null);
    try {
      const response = await updateBillingPlanVersion(
        selectedVersion.id,
        {
          subtitle: subtitle.trim() || null,
          marketing_content: marketingPayload(marketing),
          effective_from: isoOrNull(effectiveFrom),
          lock_version: selectedVersion.lock_version,
        },
        { token: token() },
      );
      setNotice("Draft presentation details saved.");
      setSubtitle(response.data.subtitle || "");
      setMarketing(marketingText(response.data.marketing_content));
      setEffectiveFrom(dateTimeInput(response.data.effective_from));
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? {
              ...current,
              subtitle: response.data.subtitle,
              marketing_content: response.data.marketing_content,
              effective_from: response.data.effective_from,
              lock_version: response.data.lock_version,
            }
          : current,
      );
    } catch (saveError) {
      setError(messageFrom(saveError, "Failed to save version details."));
    } finally {
      setBusy(null);
    }
  };

  const savePrices = async () => {
    if (!selectedVersion) return;
    setBusy("save-prices");
    setError(null);
    try {
      prices.forEach((price, index) => {
        if (
          price.billing_interval_months !== null &&
          (!Number.isFinite(Number(price.billing_interval_months)) ||
            Number(price.billing_interval_months) <= 0)
        ) {
          throw new Error(
            `Price row ${index + 1} needs a positive interval or a blank custom interval.`,
          );
        }
        if (
          !price.quote_only &&
          (price.amount === null ||
            price.amount === "" ||
            !Number.isFinite(Number(price.amount)) ||
            Number(price.amount) < 0)
        ) {
          throw new Error(
            `Price row ${index + 1} needs a non-negative amount.`,
          );
        }
        if (price.currency.trim().toUpperCase() !== "NPR")
          throw new Error(`Price row ${index + 1} must use NPR.`);
        if (price.quote_only && price.billing_interval_months !== null)
          throw new Error(
            `Price row ${index + 1} must leave the interval blank when quote-only.`,
          );
        const startsAt = price.effective_from
          ? new Date(price.effective_from)
          : null;
        const endsAt = price.effective_to ? new Date(price.effective_to) : null;
        if (startsAt && Number.isNaN(startsAt.getTime()))
          throw new Error(
            `Price row ${index + 1} has an invalid effective-from date.`,
          );
        if (endsAt && Number.isNaN(endsAt.getTime()))
          throw new Error(
            `Price row ${index + 1} has an invalid effective-to date.`,
          );
        if (startsAt && endsAt && endsAt < startsAt)
          throw new Error(`Price row ${index + 1} must end after it starts.`);
      });
      const payload = prices.map((price) => ({
        billing_interval_months:
          price.billing_interval_months === null
            ? null
            : Number(price.billing_interval_months),
        price_type: price.price_type,
        amount: price.quote_only ? null : Number(price.amount),
        currency: "NPR",
        tax_inclusive: Boolean(price.tax_inclusive),
        quote_only: Boolean(price.quote_only),
        effective_from: price.effective_from
          ? isoOrNull(String(price.effective_from))
          : null,
        effective_to: price.effective_to
          ? isoOrNull(String(price.effective_to))
          : null,
        is_active: price.is_active !== false,
      }));
      const response = await updateBillingPlanVersionPrices(
        selectedVersion.id,
        payload,
        { token: token() },
      );
      setNotice("Draft prices saved.");
      setPrices((response.data.prices || []).map((price) => ({ ...price })));
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? { ...current, prices: response.data.prices || [] }
          : current,
      );
    } catch (saveError) {
      setError(messageFrom(saveError, "Failed to save prices."));
    } finally {
      setBusy(null);
    }
  };

  const saveEntitlements = async () => {
    if (!selectedVersion) return;
    setBusy("save-entitlements");
    setError(null);
    try {
      const response = await updateBillingPlanVersionEntitlements(
        selectedVersion.id,
        entitlements,
        { token: token() },
      );
      setNotice("Draft entitlements saved.");
      setEntitlements({ ...(response.data.entitlements || {}) });
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? { ...current, entitlements: response.data.entitlements || {} }
          : current,
      );
    } catch (saveError) {
      setError(messageFrom(saveError, "Failed to save entitlements."));
    } finally {
      setBusy(null);
    }
  };

  const validateDraft = () => {
    if (!selectedPlan || !selectedVersion) return null;
    const next = validationFor(
      selectedPlan,
      selectedVersion,
      prices,
      entitlements,
      definitions,
    );
    setValidation(next);
    return next;
  };

  const publishDraft = async () => {
    if (!selectedPlan || !selectedVersion) return;
    if (hasUnsavedPlanChanges) {
      setError(
        "Save every edited plan section before publishing this version.",
      );
      return;
    }
    const local = validateDraft();
    if (!local?.valid) {
      setError("Resolve the validation errors before publishing.");
      return;
    }
    if (!publishReason.trim()) {
      setError("A publish reason is required for the audit log.");
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      const response = await publishBillingPlanVersion(
        selectedVersion.id,
        publishReason.trim(),
        {
          token: token(),
        },
      );
      if (response.data.validation) setValidation(response.data.validation);
      else if (response.data.valid !== undefined) {
        setValidation({
          valid: response.data.valid,
          errors: response.data.validation_errors || [],
          warnings: [],
        });
      }
      setNotice(
        "Plan version published. Existing subscriptions remain pinned until migrated.",
      );
      await refreshPlans(selectedPlan.id, response.data.version.id);
    } catch (publishError) {
      setError(
        messageFrom(publishError, "The backend rejected this publication."),
      );
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <AccessDenied text="You do not have permission to view the billing catalog." />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] dark:bg-gray-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-gray-800 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Plans &amp; Pricing
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Backend-owned catalog with immutable published versions.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Create plan
            </button>
          ) : null}
        </div>
      </header>

      <main className="space-y-5 p-4 sm:p-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {registryUnavailable ? (
          <Alert tone="warning">
            The entitlement registry endpoint is unavailable. Existing keys
            remain editable, but new executable keys cannot be added here.
          </Alert>
        ) : null}

        {!isLoading && trialSettings ? (
          <Panel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    New-customer trial
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${trialEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {trialEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">
                  This applies only when a restaurant is first created. The
                  trial has no charge or invoice; when it ends, access falls
                  back to the published Free plan unless a paid subscription
                  has been assigned.
                </p>
              </div>
              {trialSettings.updated_at ? (
                <p className="text-xs text-slate-400">
                  Updated {new Date(trialSettings.updated_at).toLocaleString()}
                </p>
              ) : null}
            </div>

            {!trialSettings.configuration_valid ? (
              <div className="mt-4">
                <Alert tone="warning">
                  {trialSettings.validation_message ||
                    "The current trial configuration is unavailable."}
                </Alert>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <label className="block lg:col-span-2">
                <span className="mb-2 flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={trialEnabled}
                    onChange={(event) => setTrialEnabled(event.target.checked)}
                    disabled={!canManage}
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                  />
                  Give new restaurants an automatic trial
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Trial plan
                </span>
                <select
                  value={trialPlanId}
                  onChange={(event) => setTrialPlanId(event.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                >
                  <option value="">Choose a published plan</option>
                  {plans.map((plan) => {
                    const available =
                      plan.status === "active" && Boolean(plan.current_version);
                    return (
                      <option
                        key={plan.id}
                        value={plan.id}
                        disabled={!available}
                      >
                        {plan.name}
                        {available ? "" : " (unavailable)"}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  New trials pin the current published version at signup.
                </p>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Duration (days)
                </span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={trialDays}
                  onChange={(event) => setTrialDays(event.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Audit reason
                </span>
                <textarea
                  value={trialReason}
                  onChange={(event) => setTrialReason(event.target.value)}
                  disabled={!canManage}
                  rows={2}
                  placeholder="Why is the signup trial changing?"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50"
                />
              </label>
            </div>

            {canManage ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Existing trials and paid subscriptions are never rewritten by
                  this setting.
                </p>
                <button
                  type="button"
                  onClick={saveTrialSettings}
                  disabled={Boolean(busy) || !hasUnsavedTrialChanges}
                  className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy === "trial-settings"
                    ? "Saving..."
                    : "Save signup trial"}
                </button>
              </div>
            ) : null}
          </Panel>
        ) : null}

        {isLoading ? (
          <Panel>
            <p className="text-sm text-slate-500">
              Loading live plan catalog...
            </p>
          </Panel>
        ) : !plans.length ? (
          <Panel>
            <div className="py-10 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                No plans have been configured
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Create a plan, then create and publish its first version.
              </p>
            </div>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <Panel className="h-fit p-3">
              <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Catalog
              </p>
              <div className="space-y-2">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      if (canDiscardDraft()) void loadPlan(plan.id);
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${selectedPlan?.id === plan.id ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {plan.name}
                      </span>
                      <StatusBadge status={plan.status} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">
                      {plan.code}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {plan.current_version
                        ? `Published v${plan.current_version.version_number}`
                        : plan.published_version
                          ? `Published v${plan.published_version.version_number}`
                          : "Not published"}
                    </p>
                  </button>
                ))}
              </div>
            </Panel>

            {selectedPlan ? (
              <div className="space-y-5">
                <Panel>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedPlan.name}
                        </h2>
                        <StatusBadge status={selectedPlan.status} />
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedPlan.is_public ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {selectedPlan.is_public ? "Public" : "Hidden"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Plan code:{" "}
                        <span className="font-mono">{selectedPlan.code}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canManage &&
                      !versions.some((item) => item.status === "draft") ? (
                        <button
                          type="button"
                          onClick={createDraft}
                          disabled={Boolean(busy)}
                          className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                        >
                          {busy === "create-draft"
                            ? "Creating..."
                            : "Create draft"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        disabled={!selectedVersion}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <TextField
                      label="Plan name"
                      value={planForm.name}
                      onChange={(name) =>
                        setPlanForm((old) => ({ ...old, name }))
                      }
                      disabled={!canManage}
                    />
                    <TextField
                      label="Display order"
                      type="number"
                      value={planForm.displayOrder}
                      onChange={(displayOrder) =>
                        setPlanForm((old) => ({ ...old, displayOrder }))
                      }
                      disabled={!canManage}
                    />
                    <TextField
                      label="Description"
                      value={planForm.description}
                      onChange={(description) =>
                        setPlanForm((old) => ({ ...old, description }))
                      }
                      disabled={!canManage}
                      className="md:col-span-2"
                      textarea
                    />
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={planForm.isPublic}
                        onChange={(event) =>
                          setPlanForm((old) => ({
                            ...old,
                            isPublic: event.target.checked,
                          }))
                        }
                        disabled={!canManage}
                      />
                      Visible in customer catalog
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">
                        Plan status
                      </span>
                      <select
                        value={planForm.status}
                        onChange={(event) =>
                          setPlanForm((old) => ({
                            ...old,
                            status: event.target.value,
                          }))
                        }
                        disabled={!canManage}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="retired">Retired</option>
                      </select>
                    </label>
                  </div>
                  {canManage ? (
                    <ActionButton
                      label={
                        busy === "save-plan" ? "Saving..." : "Save plan details"
                      }
                      onClick={savePlan}
                      disabled={Boolean(busy)}
                    />
                  ) : null}
                </Panel>

                <Panel>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Versions
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Published versions are read-only; clone one to change
                        the commercial contract.
                      </p>
                    </div>
                    {versions.length ? (
                      <select
                        value={selectedVersion?.id || ""}
                        onChange={(event) => {
                          if (canDiscardDraft())
                            void loadVersion(Number(event.target.value));
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      >
                        {versions.map((version) => (
                          <option key={version.id} value={version.id}>
                            {versionLabel(version)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>

                  {!selectedVersion ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                      This plan has no versions yet.
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={selectedVersion.status} />
                        <span className="text-xs text-slate-500">
                          Version {selectedVersion.version_number}
                        </span>
                        {selectedVersion.published_at ? (
                          <span className="text-xs text-slate-500">
                            Published{" "}
                            {new Date(
                              selectedVersion.published_at,
                            ).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField
                          label="Customer-facing subtitle"
                          value={subtitle}
                          onChange={setSubtitle}
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                        />
                        <TextField
                          label="Effective from"
                          type="datetime-local"
                          value={effectiveFrom}
                          onChange={setEffectiveFrom}
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                        />
                        <TextField
                          label="Marketing headline"
                          value={marketingField(marketing, "headline")}
                          onChange={(value) =>
                            setMarketing(
                              updateMarketingField(
                                marketing,
                                "headline",
                                value,
                              ),
                            )
                          }
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                        />
                        <TextField
                          label="Short summary"
                          value={marketingField(marketing, "summary")}
                          onChange={(value) =>
                            setMarketing(
                              updateMarketingField(marketing, "summary", value),
                            )
                          }
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                        />
                        <TextField
                          label="Highlights (one per line)"
                          value={marketingField(marketing, "highlights")}
                          onChange={(value) =>
                            setMarketing(
                              updateMarketingField(
                                marketing,
                                "highlights",
                                value,
                              ),
                            )
                          }
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                          className="md:col-span-2"
                          textarea
                        />
                        <details className="md:col-span-2 rounded-xl border border-slate-200 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                            Advanced marketing JSON
                          </summary>
                          <div className="mt-3">
                            <TextField
                              label="Raw JSON"
                              value={marketing}
                              onChange={setMarketing}
                              disabled={
                                !canManage || selectedVersion.status !== "draft"
                              }
                              textarea
                            />
                          </div>
                        </details>
                      </div>
                      {canManage && selectedVersion.status === "draft" ? (
                        <ActionButton
                          label={
                            busy === "save-version"
                              ? "Saving..."
                              : "Save version details"
                          }
                          onClick={saveVersionDetails}
                          disabled={Boolean(busy)}
                        />
                      ) : null}
                    </>
                  )}
                </Panel>

                {selectedVersion ? (
                  <>
                    <Panel>
                      <SectionHeader
                        title="Prices"
                        description="Initial and renewal prices are explicit backend records; clients do not calculate them."
                      />
                      {canManage && selectedVersion.status === "draft" ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                          <span className="text-xs font-semibold text-slate-500">
                            Start with:
                          </span>
                          <button
                            type="button"
                            onClick={() => setPrices([draftPrice(1, "flat")])}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Monthly flat
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrices([draftPrice(12, "flat")])}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Annual flat
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPrices([
                                draftPrice(12, "initial"),
                                draftPrice(12, "renewal"),
                              ])
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Annual initial + renewal
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPrices([draftPrice(null, "flat", true)])
                            }
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            Quote only
                          </button>
                        </div>
                      ) : null}
                      <div className="mt-5 space-y-3">
                        {prices.length ? (
                          prices.map((price, index) => (
                            <div
                              key={`${price.id || "new"}-${index}`}
                              className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-4"
                            >
                              <MiniField
                                label="Months"
                                type="number"
                                value={
                                  price.billing_interval_months === null
                                    ? ""
                                    : String(price.billing_interval_months)
                                }
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(value) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? {
                                            ...row,
                                            billing_interval_months:
                                              value === ""
                                                ? null
                                                : Number(value),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <label className="block">
                                <MiniLabel>Price type</MiniLabel>
                                <select
                                  value={price.price_type}
                                  disabled={
                                    !canManage ||
                                    selectedVersion.status !== "draft"
                                  }
                                  onChange={(event) =>
                                    setPrices((rows) =>
                                      rows.map((row, rowIndex) =>
                                        rowIndex === index
                                          ? {
                                              ...row,
                                              price_type: event.target.value,
                                            }
                                          : row,
                                      ),
                                    )
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                >
                                  <option value="flat">Flat</option>
                                  <option value="initial">Initial</option>
                                  <option value="renewal">Renewal</option>
                                </select>
                              </label>
                              <MiniField
                                label="Amount"
                                type="number"
                                value={
                                  price.amount === null
                                    ? ""
                                    : String(price.amount)
                                }
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft" ||
                                  price.quote_only
                                }
                                onChange={(value) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, amount: value }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <MiniField
                                label="Currency"
                                value="NPR"
                                disabled
                                onChange={() => undefined}
                              />
                              <MiniField
                                label="Effective from"
                                type="datetime-local"
                                value={dateTimeInput(price.effective_from)}
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(value) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? {
                                            ...row,
                                            effective_from: value || null,
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <MiniField
                                label="Effective to"
                                type="datetime-local"
                                value={dateTimeInput(price.effective_to)}
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(value) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? {
                                            ...row,
                                            effective_to: value || null,
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <CheckField
                                label="Tax included"
                                checked={price.tax_inclusive}
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(checked) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, tax_inclusive: checked }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <CheckField
                                label="Quote only"
                                checked={price.quote_only}
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(checked) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? {
                                            ...row,
                                            quote_only: checked,
                                            amount: checked ? null : row.amount,
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              <CheckField
                                label="Active price"
                                checked={price.is_active !== false}
                                disabled={
                                  !canManage ||
                                  selectedVersion.status !== "draft"
                                }
                                onChange={(checked) =>
                                  setPrices((rows) =>
                                    rows.map((row, rowIndex) =>
                                      rowIndex === index
                                        ? { ...row, is_active: checked }
                                        : row,
                                    ),
                                  )
                                }
                              />
                              {canManage &&
                              selectedVersion.status === "draft" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPrices((rows) =>
                                      rows.filter(
                                        (_, rowIndex) => rowIndex !== index,
                                      ),
                                    )
                                  }
                                  className="self-end rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                            No price rows configured.
                          </p>
                        )}
                      </div>
                      {canManage && selectedVersion.status === "draft" ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPrices((rows) => [
                                ...rows,
                                draftPrice(12, "flat"),
                              ])
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Add price row
                          </button>
                          <ActionButton
                            label={
                              busy === "save-prices"
                                ? "Saving..."
                                : "Save prices"
                            }
                            onClick={savePrices}
                            disabled={Boolean(busy)}
                            compact
                          />
                        </div>
                      ) : null}
                    </Panel>

                    <Panel>
                      <SectionHeader
                        title="Entitlements & limits"
                        description="Only backend-registered keys are configurable. A blank integer means unlimited."
                      />
                      <div className="mt-5 space-y-5">
                        {groupedDefinitions.length ? (
                          groupedDefinitions.map(([moduleName, items]) => (
                            <div key={moduleName}>
                              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                                {moduleName}
                              </h3>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {items.map((definition) => (
                                  <EntitlementField
                                    key={definition.key}
                                    definition={definition}
                                    value={entitlements[definition.key]}
                                    disabled={
                                      !canManage ||
                                      selectedVersion.status !== "draft"
                                    }
                                    onChange={(value) =>
                                      setEntitlementValue(definition.key, value)
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                            No entitlement registry or existing entitlement
                            values were returned.
                          </p>
                        )}
                      </div>
                      {canManage && selectedVersion.status === "draft" ? (
                        <ActionButton
                          label={
                            busy === "save-entitlements"
                              ? "Saving..."
                              : "Save entitlements"
                          }
                          onClick={saveEntitlements}
                          disabled={Boolean(busy)}
                        />
                      ) : null}
                    </Panel>

                    <Panel>
                      <SectionHeader
                        title="Validate & publish"
                        description="Local checks provide fast feedback; the backend performs the authoritative validation and audit."
                      />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={validateDraft}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Validate draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPreview(true)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Preview
                        </button>
                      </div>
                      {validation ? (
                        <ValidationPanel validation={validation} />
                      ) : null}
                      {selectedVersion.status === "draft" && canPublish ? (
                        <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
                          <TextField
                            label="Publish reason (audit log)"
                            value={publishReason}
                            onChange={setPublishReason}
                          />
                          <button
                            type="button"
                            onClick={publishDraft}
                            disabled={Boolean(busy)}
                            className="mt-3 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            {busy === "publish"
                              ? "Publishing..."
                              : "Publish immutable version"}
                          </button>
                        </div>
                      ) : null}
                    </Panel>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {!isLoading ? (
          <BillingAddonCatalog
            definitions={definitions}
            plans={plans}
            canManage={canManage}
            canPublish={canPublish}
          />
        ) : null}
      </main>

      {showCreate ? (
        <Modal title="Create plan" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <TextField
              label="Stable plan code"
              value={createForm.code}
              onChange={(code) => setCreateForm((old) => ({ ...old, code }))}
              placeholder="lowercase_identifier"
            />
            <TextField
              label="Plan name"
              value={createForm.name}
              onChange={(name) => setCreateForm((old) => ({ ...old, name }))}
            />
            <TextField
              label="Description"
              value={createForm.description}
              onChange={(description) =>
                setCreateForm((old) => ({ ...old, description }))
              }
              textarea
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createPlan}
                disabled={Boolean(busy)}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {busy === "create-plan" ? "Creating..." : "Create plan"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showPreview && selectedPlan && selectedVersion ? (
        <Modal
          title="Customer catalog preview"
          onClose={() => setShowPreview(false)}
          wide
        >
          <div className="rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-500">
                  {selectedPlan.code}
                </p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">
                  {planForm.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {subtitle ||
                    planForm.description ||
                    "No customer-facing description."}
                </p>
              </div>
              <StatusBadge status={selectedVersion.status} />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {prices.map((price, index) => (
                <div key={index} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">
                    {price.price_type}
                    {price.billing_interval_months === null
                      ? " · custom interval"
                      : ` · ${price.billing_interval_months} months`}
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {price.quote_only
                      ? "Quote only"
                      : `${price.currency} ${price.amount}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Tax {price.tax_inclusive ? "included" : "excluded"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {Object.entries(entitlements).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"
                >
                  <span className="text-slate-600">
                    {definitions.find((definition) => definition.key === key)
                      ?.label || key}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {value === null ? "Unlimited" : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "published" || status === "active"
      ? "bg-green-100 text-green-700"
      : status === "draft"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone}`}
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
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled = false,
  className = "",
  textarea = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  textarea?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {textarea ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold text-slate-500">
      {children}
    </span>
  );
}

function MiniField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <MiniLabel>{label}</MiniLabel>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  compact = false,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${compact ? "" : "mt-5"} rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {label}
    </button>
  );
}

function EntitlementField({
  definition,
  value,
  onChange,
  disabled,
}: {
  definition: BillingEntitlementDefinition;
  value: BillingEntitlementValue | undefined;
  onChange: (value: BillingEntitlementValue | undefined) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {definition.label}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            {definition.key}
          </p>
          {definition.description ? (
            <p className="mt-1 text-xs text-slate-500">
              {definition.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {definition.is_enforced === false ? (
            <span className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
              Display only
            </span>
          ) : null}
          {value !== undefined && !disabled ? (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-[10px] font-semibold text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        {definition.value_type === "boolean" ? (
          <select
            value={value === undefined ? "unset" : value ? "true" : "false"}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.target.value === "unset"
                  ? undefined
                  : event.target.value === "true",
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="unset">Not configured</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        ) : definition.value_type === "integer" ? (
          <input
            type="number"
            min={0}
            value={value === undefined || value === null ? "" : String(value)}
            disabled={disabled}
            placeholder="Unlimited"
            onChange={(event) =>
              onChange(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        ) : (
          <input
            type="text"
            value={value === undefined || value === null ? "" : String(value)}
            disabled={disabled}
            placeholder="Not configured"
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        )}
      </div>
    </div>
  );
}

function ValidationPanel({
  validation,
}: {
  validation: BillingPlanValidation;
}) {
  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${validation.valid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
    >
      <p
        className={`text-sm font-semibold ${validation.valid ? "text-green-700" : "text-red-700"}`}
      >
        {validation.valid
          ? "Local validation passed"
          : "Validation needs attention"}
      </p>
      {validation.errors.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
          {validation.errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {validation.warnings.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
          {validation.warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <BillingModal
      title={title}
      onClose={onClose}
      maxWidth={wide ? "4xl" : "2xl"}
    >
      <div className="p-6">{children}</div>
    </BillingModal>
  );
}

function AccessDenied({ text }: { text: string }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa] p-6">
      <Panel>
        <div className="py-12 text-center">
          <h1 className="text-xl font-bold text-slate-900">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">{text}</p>
        </div>
      </Panel>
    </div>
  );
}
