"use client";

import { useEffect, useMemo, useState } from "react";
import BillingModal from "@/components/BillingModal";
import {
  createBillingAddon,
  createBillingAddonVersion,
  getBillingAddons,
  getBillingAddonVersion,
  publishBillingAddonVersion,
  updateBillingAddon,
  updateBillingAddonVersion,
  updateBillingAddonVersionEntitlements,
  updateBillingAddonVersionPrices,
  type BillingAddon,
  type BillingAddonVersion,
  type BillingEntitlementDefinition,
  type BillingEntitlementValue,
  type BillingPlan,
  type BillingPlanPrice,
} from "@/lib/backend-api";

type Props = {
  definitions: BillingEntitlementDefinition[];
  plans: BillingPlan[];
  canManage: boolean;
  canPublish: boolean;
};

function token() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function versions(addon: BillingAddon | null) {
  if (!addon) return [];
  const values = [
    ...(addon.versions || []),
    addon.current_version,
    addon.published_version,
  ].filter((item): item is BillingAddonVersion => Boolean(item));
  return [...new Map(values.map((item) => [item.id, item])).values()].sort(
    (a, b) => b.version_number - a.version_number,
  );
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

function iso(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export default function BillingAddonCatalog({
  definitions,
  plans,
  canManage,
  canPublish,
}: Props) {
  const [addons, setAddons] = useState<BillingAddon[]>([]);
  const [selectedAddon, setSelectedAddon] = useState<BillingAddon | null>(null);
  const [selectedVersion, setSelectedVersion] =
    useState<BillingAddonVersion | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [status, setStatus] = useState("active");
  const [compatiblePlans, setCompatiblePlans] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [prices, setPrices] = useState<BillingPlanPrice[]>([]);
  const [entitlements, setEntitlements] = useState<
    Record<string, BillingEntitlementValue>
  >({});
  const [publishReason, setPublishReason] = useState("");
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allVersions = useMemo(() => versions(selectedAddon), [selectedAddon]);
  const compatiblePlanSet = useMemo(
    () =>
      new Set(
        compatiblePlans
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      ),
    [compatiblePlans],
  );
  const editorDefinitions = useMemo(() => {
    if (definitions.length) return definitions;
    return Object.keys(entitlements)
      .sort()
      .map(
        (key) =>
          ({
            key,
            label: key,
            value_type:
              typeof entitlements[key] === "boolean"
                ? "boolean"
                : typeof entitlements[key] === "number"
                  ? "integer"
                  : "string",
          }) satisfies BillingEntitlementDefinition,
      );
  }, [definitions, entitlements]);
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedAddon) return false;
    const metadataChanged =
      name !== selectedAddon.name ||
      description !== (selectedAddon.description || "") ||
      isPublic !== (selectedAddon.is_public !== false) ||
      status !== (selectedAddon.status || "active") ||
      compatiblePlans !==
        (selectedAddon.compatible_plan_codes || []).join(", ");
    if (!selectedVersion) return metadataChanged;
    return (
      metadataChanged ||
      effectiveFrom !== dateInput(selectedVersion.effective_from) ||
      JSON.stringify(prices) !== JSON.stringify(selectedVersion.prices || []) ||
      JSON.stringify(entitlements) !==
        JSON.stringify(selectedVersion.entitlements || {})
    );
  }, [
    compatiblePlans,
    description,
    effectiveFrom,
    entitlements,
    isPublic,
    name,
    prices,
    selectedAddon,
    selectedVersion,
    status,
  ]);

  const canDiscardDraft = () =>
    !hasUnsavedChanges || window.confirm("Discard the unsaved add-on changes?");

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

  const applyVersion = (value: BillingAddonVersion | null) => {
    setSelectedVersion(value);
    setEffectiveFrom(dateInput(value?.effective_from));
    setPrices((value?.prices || []).map((price) => ({ ...price })));
    setEntitlements({ ...(value?.entitlements || {}) });
    setPublishReason("");
  };

  const applyAddon = (addon: BillingAddon, preferredVersionId?: number) => {
    setSelectedAddon(addon);
    setName(addon.name);
    setDescription(addon.description || "");
    setIsPublic(addon.is_public !== false);
    setStatus(addon.status || "active");
    setCompatiblePlans((addon.compatible_plan_codes || []).join(", "));
    const items = versions(addon);
    applyVersion(
      items.find((item) => item.id === preferredVersionId) ||
        items.find((item) => item.status === "draft") ||
        items[0] ||
        null,
    );
  };

  const loadVersion = async (versionId: number) => {
    const response = await getBillingAddonVersion(versionId, {
      token: token(),
    });
    applyVersion(response.data);
  };

  const load = async (
    preferredAddonId?: number,
    preferredVersionId?: number,
  ) => {
    const response = await getBillingAddons({ token: token() });
    const next = response.data || [];
    setAddons(next);
    const addon =
      next.find((item) => item.id === preferredAddonId) || next[0] || null;
    if (!addon) {
      setSelectedAddon(null);
      applyVersion(null);
      return;
    }
    applyAddon(addon, preferredVersionId);
    const candidate =
      versions(addon).find((item) => item.id === preferredVersionId) ||
      versions(addon).find((item) => item.status === "draft") ||
      versions(addon)[0];
    if (candidate) await loadVersion(candidate.id);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load add-ons.",
          );
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Add-on operation failed.",
      );
    } finally {
      setBusy(null);
    }
  };

  const createAddon = () =>
    run("create", async () => {
      const code = createForm.code
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_");
      if (!code || !createForm.name.trim())
        throw new Error("Add-on code and name are required.");
      const response = await createBillingAddon(
        {
          code,
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
        },
        { token: token() },
      );
      setShowCreate(false);
      setCreateForm({ code: "", name: "", description: "" });
      setNotice("Add-on created with its first draft version.");
      await load(response.data.id);
    });

  const saveMetadata = () => {
    if (!selectedAddon) return;
    run("metadata", async () => {
      const response = await updateBillingAddon(
        selectedAddon.id,
        {
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          status,
          compatible_plan_codes: compatiblePlans
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean),
        },
        { token: token() },
      );
      setNotice("Add-on metadata saved.");
      setName(response.data.name);
      setDescription(response.data.description || "");
      setIsPublic(response.data.is_public !== false);
      setStatus(response.data.status || "active");
      setCompatiblePlans(
        (response.data.compatible_plan_codes || []).join(", "),
      );
      setSelectedAddon(response.data);
      setAddons((items) =>
        items.map((item) =>
          item.id === response.data.id ? response.data : item,
        ),
      );
    });
  };

  const createDraft = () => {
    if (!selectedAddon) return;
    if (!canDiscardDraft()) return;
    const source =
      allVersions.find((item) => item.status === "published") || allVersions[0];
    run("draft", async () => {
      const response = await createBillingAddonVersion(
        selectedAddon.id,
        source ? { source_version_id: source.id } : {},
        { token: token() },
      );
      setNotice(
        source
          ? "Add-on draft cloned from its latest version."
          : "Empty add-on draft created.",
      );
      await load(selectedAddon.id, response.data.id);
    });
  };

  const saveEffectiveDate = () => {
    if (!selectedAddon || !selectedVersion) return;
    run("version", async () => {
      const response = await updateBillingAddonVersion(
        selectedVersion.id,
        { effective_from: iso(effectiveFrom) },
        { token: token() },
      );
      setNotice("Add-on draft effective date saved.");
      setEffectiveFrom(dateInput(response.data.effective_from));
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? { ...current, effective_from: response.data.effective_from }
          : current,
      );
    });
  };

  const savePrices = () => {
    if (!selectedAddon || !selectedVersion) return;
    run("prices", async () => {
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
      const activePrices = prices.filter((price) => price.is_active !== false);
      const structures = new Map<number | null, Set<string>>();
      activePrices.forEach((price) => {
        const types =
          structures.get(price.billing_interval_months) || new Set<string>();
        if (types.has(price.price_type)) {
          throw new Error(
            `Duplicate ${price.price_type} price for ${price.billing_interval_months || "custom"} interval.`,
          );
        }
        types.add(price.price_type);
        structures.set(price.billing_interval_months, types);
      });
      structures.forEach((types, interval) => {
        const label = interval === null ? "custom" : `${interval}-month`;
        if (types.has("flat") && types.size > 1) {
          throw new Error(
            `${label} pricing cannot mix flat with initial/renewal rows.`,
          );
        }
        if (
          !types.has("flat") &&
          (!types.has("initial") || !types.has("renewal"))
        ) {
          throw new Error(
            `${label} pricing needs both initial and renewal rows.`,
          );
        }
      });
      const response = await updateBillingAddonVersionPrices(
        selectedVersion.id,
        prices.map((price) => ({
          billing_interval_months:
            price.billing_interval_months === null
              ? null
              : Number(price.billing_interval_months),
          price_type: price.price_type,
          amount: price.quote_only ? null : Number(price.amount),
          currency: "NPR",
          tax_inclusive: price.tax_inclusive,
          quote_only: price.quote_only,
          effective_from: price.effective_from
            ? iso(String(price.effective_from))
            : null,
          effective_to: price.effective_to
            ? iso(String(price.effective_to))
            : null,
          is_active: price.is_active !== false,
        })),
        { token: token() },
      );
      setNotice("Add-on prices saved.");
      setPrices((response.data.prices || []).map((price) => ({ ...price })));
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? { ...current, prices: response.data.prices || [] }
          : current,
      );
    });
  };

  const saveEntitlements = () => {
    if (!selectedAddon || !selectedVersion) return;
    run("entitlements", async () => {
      const response = await updateBillingAddonVersionEntitlements(
        selectedVersion.id,
        entitlements,
        { token: token() },
      );
      setNotice("Add-on entitlements saved.");
      setEntitlements({ ...(response.data.entitlements || {}) });
      setSelectedVersion((current) =>
        current?.id === response.data.id
          ? { ...current, entitlements: response.data.entitlements || {} }
          : current,
      );
    });
  };

  const publish = () => {
    if (!selectedAddon || !selectedVersion) return;
    if (hasUnsavedChanges) {
      setError(
        "Save every edited add-on section before publishing this version.",
      );
      return;
    }
    run("publish", async () => {
      if (!publishReason.trim())
        throw new Error("A publish reason is required.");
      if (!Object.keys(entitlements).length)
        throw new Error(
          "At least one entitlement is required before publishing.",
        );
      const response = await publishBillingAddonVersion(
        selectedVersion.id,
        publishReason.trim(),
        { token: token() },
      );
      if (!response.data.valid)
        throw new Error(
          response.data.validation_errors.join(" ") ||
            "Backend validation failed.",
        );
      setNotice("Immutable add-on version published.");
      await load(selectedAddon.id, response.data.version.id);
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Add-on catalog</h2>
          <p className="mt-1 text-sm text-slate-500">
            Versioned optional products with their own prices and entitlements.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-xl border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50"
          >
            Create add-on
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-sm text-slate-500">Loading add-on catalog...</p>
      ) : !addons.length ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No add-ons configured.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
          <div className="space-y-2">
            {addons.map((addon) => (
              <button
                key={addon.id}
                type="button"
                onClick={() => {
                  if (addon.id !== selectedAddon?.id && !canDiscardDraft()) {
                    return;
                  }
                  applyAddon(addon);
                }}
                className={`w-full rounded-xl border p-3 text-left ${selectedAddon?.id === addon.id ? "border-orange-300 bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {addon.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                    {addon.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {addon.code}
                </p>
              </button>
            ))}
          </div>
          {selectedAddon ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-bold text-slate-900">
                  Catalog details
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field
                    label="Name"
                    value={name}
                    onChange={setName}
                    disabled={!canManage}
                  />
                  <label className="block">
                    <SmallLabel>Compatible plans</SmallLabel>
                    <div className="flex min-h-[42px] flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
                      {plans
                        .filter((plan) => plan.status === "active")
                        .map((plan) => (
                          <label
                            key={plan.id}
                            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={compatiblePlanSet.has(
                                plan.code.toLowerCase(),
                              )}
                              disabled={!canManage}
                              onChange={(event) => {
                                const next = new Set(compatiblePlanSet);
                                if (event.target.checked)
                                  next.add(plan.code.toLowerCase());
                                else next.delete(plan.code.toLowerCase());
                                setCompatiblePlans([...next].sort().join(", "));
                              }}
                            />
                            {plan.name}
                          </label>
                        ))}
                      {!plans.length ? (
                        <span className="text-xs text-slate-500">
                          No plans loaded
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      No selection means compatible with all plans.
                    </p>
                  </label>
                  <Field
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    disabled={!canManage}
                    className="md:col-span-2"
                  />
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(event) => setIsPublic(event.target.checked)}
                      disabled={!canManage}
                    />
                    Visible in customer catalog
                  </label>
                  <label className="block">
                    <SmallLabel>Status</SmallLabel>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      disabled={!canManage}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="retired">Retired</option>
                    </select>
                  </label>
                </div>
                {canManage ? (
                  <Button
                    label={
                      busy === "metadata" ? "Saving..." : "Save add-on details"
                    }
                    onClick={saveMetadata}
                    disabled={Boolean(busy)}
                  />
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Versions
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Published add-on versions are immutable.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {allVersions.length ? (
                      <select
                        value={selectedVersion?.id || ""}
                        onChange={(event) => {
                          if (!canDiscardDraft()) return;
                          loadVersion(Number(event.target.value));
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {allVersions.map((item) => (
                          <option key={item.id} value={item.id}>
                            v{item.version_number} - {item.status}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {canManage &&
                    !allVersions.some((item) => item.status === "draft") ? (
                      <button
                        type="button"
                        onClick={createDraft}
                        disabled={Boolean(busy)}
                        className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-700"
                      >
                        Create draft
                      </button>
                    ) : null}
                  </div>
                </div>
                {selectedVersion ? (
                  <div className="mt-4">
                    <Field
                      label="Effective from"
                      type="datetime-local"
                      value={effectiveFrom}
                      onChange={setEffectiveFrom}
                      disabled={
                        !canManage || selectedVersion.status !== "draft"
                      }
                    />
                    {canManage && selectedVersion.status === "draft" ? (
                      <Button
                        label={
                          busy === "version"
                            ? "Saving..."
                            : "Save effective date"
                        }
                        onClick={saveEffectiveDate}
                        disabled={Boolean(busy)}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No versions configured.
                  </p>
                )}
              </div>

              {selectedVersion ? (
                <>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-base font-bold text-slate-900">
                      Prices
                    </h3>
                    <div className="mt-3 space-y-3">
                      {prices.map((price, index) => (
                        <div
                          key={`${price.id || "new"}-${index}`}
                          className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-4"
                        >
                          <MiniField
                            label="Months"
                            type="number"
                            value={
                              price.billing_interval_months === null
                                ? ""
                                : String(price.billing_interval_months)
                            }
                            onChange={(value) =>
                              setPrices((old) =>
                                old.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        billing_interval_months:
                                          value === "" ? null : Number(value),
                                      }
                                    : item,
                                ),
                              )
                            }
                            disabled={
                              !canManage || selectedVersion.status !== "draft"
                            }
                          />
                          <label>
                            <SmallLabel>Type</SmallLabel>
                            <select
                              value={price.price_type}
                              onChange={(event) =>
                                setPrices((old) =>
                                  old.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          price_type: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canManage || selectedVersion.status !== "draft"
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
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
                              price.amount === null ? "" : String(price.amount)
                            }
                            onChange={(value) =>
                              setPrices((old) =>
                                old.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, amount: value }
                                    : item,
                                ),
                              )
                            }
                            disabled={
                              !canManage ||
                              selectedVersion.status !== "draft" ||
                              price.quote_only
                            }
                          />
                          <MiniField
                            label="Currency"
                            value="NPR"
                            onChange={() => undefined}
                            disabled
                          />
                          <MiniField
                            label="Effective from"
                            type="datetime-local"
                            value={dateInput(price.effective_from)}
                            onChange={(value) =>
                              setPrices((old) =>
                                old.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, effective_from: value || null }
                                    : item,
                                ),
                              )
                            }
                            disabled={
                              !canManage || selectedVersion.status !== "draft"
                            }
                          />
                          <MiniField
                            label="Effective to"
                            type="datetime-local"
                            value={dateInput(price.effective_to)}
                            onChange={(value) =>
                              setPrices((old) =>
                                old.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, effective_to: value || null }
                                    : item,
                                ),
                              )
                            }
                            disabled={
                              !canManage || selectedVersion.status !== "draft"
                            }
                          />
                          <label className="flex items-end gap-2 pb-2 text-xs">
                            <input
                              type="checkbox"
                              checked={price.tax_inclusive}
                              onChange={(event) =>
                                setPrices((old) =>
                                  old.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          tax_inclusive: event.target.checked,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canManage || selectedVersion.status !== "draft"
                              }
                            />
                            Tax included
                          </label>
                          <label className="flex items-end gap-2 pb-2 text-xs">
                            <input
                              type="checkbox"
                              checked={price.quote_only}
                              onChange={(event) =>
                                setPrices((old) =>
                                  old.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          quote_only: event.target.checked,
                                          billing_interval_months: event.target
                                            .checked
                                            ? null
                                            : item.billing_interval_months,
                                          amount: event.target.checked
                                            ? null
                                            : item.amount,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canManage || selectedVersion.status !== "draft"
                              }
                            />
                            Quote only
                          </label>
                          <label className="flex items-end gap-2 pb-2 text-xs">
                            <input
                              type="checkbox"
                              checked={price.is_active !== false}
                              onChange={(event) =>
                                setPrices((old) =>
                                  old.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          is_active: event.target.checked,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              disabled={
                                !canManage || selectedVersion.status !== "draft"
                              }
                            />
                            Active price
                          </label>
                          {canManage && selectedVersion.status === "draft" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPrices((old) =>
                                  old.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              className="self-end rounded-lg px-2 py-2 text-xs font-semibold text-red-600"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {!prices.length ? (
                        <p className="text-sm text-slate-500">
                          No price rows configured.
                        </p>
                      ) : null}
                    </div>
                    {canManage && selectedVersion.status === "draft" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPrices((old) => [
                              ...old,
                              {
                                billing_interval_months: 12,
                                price_type: "flat",
                                amount: "",
                                currency: "NPR",
                                tax_inclusive: false,
                                quote_only: false,
                                effective_from: null,
                                effective_to: null,
                                is_active: true,
                              },
                            ])
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Add price
                        </button>
                        <Button
                          label={
                            busy === "prices" ? "Saving..." : "Save prices"
                          }
                          onClick={savePrices}
                          disabled={Boolean(busy)}
                          compact
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="text-base font-bold text-slate-900">
                      Entitlements
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {editorDefinitions.map((definition) => (
                        <Entitlement
                          key={definition.key}
                          definition={definition}
                          value={entitlements[definition.key]}
                          disabled={
                            !canManage || selectedVersion.status !== "draft"
                          }
                          onChange={(value) =>
                            setEntitlementValue(definition.key, value)
                          }
                        />
                      ))}
                    </div>
                    {canManage && selectedVersion.status === "draft" ? (
                      <Button
                        label={
                          busy === "entitlements"
                            ? "Saving..."
                            : "Save entitlements"
                        }
                        onClick={saveEntitlements}
                        disabled={Boolean(busy)}
                      />
                    ) : null}
                  </div>

                  {selectedVersion.status === "draft" && canPublish ? (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <Field
                        label="Publish reason"
                        value={publishReason}
                        onChange={setPublishReason}
                      />
                      <button
                        type="button"
                        onClick={publish}
                        disabled={Boolean(busy)}
                        className="mt-3 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {busy === "publish"
                          ? "Publishing..."
                          : "Publish immutable add-on version"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {showCreate ? (
        <BillingModal
          title="Create add-on"
          onClose={() => setShowCreate(false)}
        >
          <div className="space-y-3 p-6">
            <Field
              label="Stable add-on code"
              value={createForm.code}
              onChange={(code) => setCreateForm((old) => ({ ...old, code }))}
            />
            <Field
              label="Name"
              value={createForm.name}
              onChange={(name) => setCreateForm((old) => ({ ...old, name }))}
            />
            <Field
              label="Description"
              value={createForm.description}
              onChange={(description) =>
                setCreateForm((old) => ({ ...old, description }))
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createAddon}
                disabled={Boolean(busy)}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "create" ? "Creating..." : "Create add-on"}
              </button>
            </div>
          </div>
        </BillingModal>
      ) : null}
    </section>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold text-slate-500">
      {children}
    </span>
  );
}
function Field({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
  className = "",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <SmallLabel>{label}</SmallLabel>
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
    <label>
      <SmallLabel>{label}</SmallLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm disabled:bg-slate-50"
      />
    </label>
  );
}
function Button({
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
      className={`${compact ? "" : "mt-3"} rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50`}
    >
      {label}
    </button>
  );
}
function Entitlement({
  definition,
  value,
  disabled,
  onChange,
}: {
  definition: BillingEntitlementDefinition;
  value: BillingEntitlementValue | undefined;
  disabled: boolean;
  onChange: (value: BillingEntitlementValue | undefined) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-slate-900">
            {definition.label}
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
            {definition.key}
          </span>
        </div>
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
      {definition.value_type === "boolean" ? (
        <select
          value={value === undefined ? "unset" : value ? "true" : "false"}
          onChange={(event) =>
            onChange(
              event.target.value === "unset"
                ? undefined
                : event.target.value === "true",
            )
          }
          disabled={disabled}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
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
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          disabled={disabled}
          placeholder="Unlimited"
          className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
        />
      ) : (
        <input
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
        />
      )}
    </div>
  );
}
