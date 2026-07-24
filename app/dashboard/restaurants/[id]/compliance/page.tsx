"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BILLING_MODE_LABELS,
  fiscalApi,
  REGISTRATION_LABELS,
  STATUS_LABELS,
  type CbmsConfigInput,
  type CbmsStatus,
  type FiscalBillingMode,
  type FiscalProfile,
  type FiscalProfileDraft,
  type FiscalRegistrationType,
  type FiscalValidationResult,
} from "@/lib/fiscal";
import { getRestaurant, type BackendRestaurant } from "@/lib/backend-api";

type FormState = {
  registration_type: FiscalRegistrationType;
  fiscal_billing_mode: FiscalBillingMode;
  legal_name: string;
  registered_address: string;
  seller_pan: string;
  ird_software_listing_number: string;
  ird_permission_number: string;
  ird_permission_date: string;
  approved_software_name: string;
  approved_software_version: string;
  abbreviated_invoice_approved: boolean;
  cloud_agreement_reference: string;
  next_invoice_seed: number;
  activation_effective_at: string;
};

const emptyForm: FormState = {
  registration_type: "unverified",
  fiscal_billing_mode: "legacy_flexible",
  legal_name: "",
  registered_address: "",
  seller_pan: "",
  ird_software_listing_number: "",
  ird_permission_number: "",
  ird_permission_date: "",
  approved_software_name: "Yummy",
  approved_software_version: "",
  abbreviated_invoice_approved: false,
  cloud_agreement_reference: "",
  next_invoice_seed: 1,
  activation_effective_at: "",
};

const emptyCbms: CbmsConfigInput = {
  username: "",
  password: "",
  environment: "test",
  realtime_required: true,
};

function dateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toForm(profile: FiscalProfile | null, restaurant?: BackendRestaurant | null): FormState {
  return {
    registration_type: profile?.registration_type || "unverified",
    fiscal_billing_mode: profile?.fiscal_billing_mode || "legacy_flexible",
    legal_name: profile?.legal_name || restaurant?.name || "",
    registered_address: profile?.registered_address || restaurant?.address || "",
    seller_pan: profile?.seller_pan || restaurant?.pan_number || "",
    ird_software_listing_number: profile?.ird_software_listing_number || "",
    ird_permission_number: profile?.ird_permission_number || "",
    ird_permission_date: dateInput(profile?.ird_permission_date),
    approved_software_name: profile?.approved_software_name || "Yummy",
    approved_software_version: profile?.approved_software_version || "",
    abbreviated_invoice_approved: Boolean(profile?.abbreviated_invoice_approved),
    cloud_agreement_reference: profile?.cloud_agreement_reference || "",
    next_invoice_seed: profile?.next_invoice_seed || 1,
    activation_effective_at: dateTimeInput(profile?.activation_effective_at),
  };
}

function fieldLabel(label: string, required = false) {
  return <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{required ? " *" : ""}</label>;
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
}

export default function RestaurantCompliancePage() {
  const params = useParams<{ id: string }>();
  const restaurantId = Number(params.id);
  const [restaurant, setRestaurant] = useState<BackendRestaurant | null>(null);
  const [profile, setProfile] = useState<FiscalProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [cbms, setCbms] = useState<CbmsConfigInput>(emptyCbms);
  const [cbmsStatus, setCbmsStatus] = useState<CbmsStatus | null>(null);
  const [validation, setValidation] = useState<FiscalValidationResult | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(restaurantId) || restaurantId < 1) {
      setError("Invalid restaurant id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const restaurantResult = await getRestaurant(restaurantId, { token });
      const [nextProfile, nextCbms] = await Promise.all([
        fiscalApi.getProfileOrLegacy(restaurantId, token),
        fiscalApi.getCbmsStatus(restaurantId, token).catch((requestError) => {
          if (requestError instanceof Error && requestError.message.startsWith("[404]")) return null;
          throw requestError;
        }),
      ]);
      setRestaurant(restaurantResult.data);
      setProfile(nextProfile);
      setForm(toForm(nextProfile, restaurantResult.data));
      setCbmsStatus(nextCbms);
      const saved = nextCbms?.config;
      setCbms({
        username: saved?.username || nextCbms?.username || "",
        password: "",
        environment: saved?.environment || nextCbms?.environment || "test",
        realtime_required: saved?.realtime_required ?? nextCbms?.realtime_required ?? true,
      });
      setValidation(null);
      setDirty(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load compliance data.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load]);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setValidation(null);
    setSuccess(null);
  };

  const saveProfile = async () => {
    if (form.next_invoice_seed < 1 || !Number.isInteger(form.next_invoice_seed)) {
      setError("Next fiscal invoice number must be a positive whole number.");
      return;
    }
    setBusy("profile"); setError(null); setSuccess(null);
    const payload: FiscalProfileDraft = {
      registration_type: form.registration_type,
      fiscal_billing_mode: form.fiscal_billing_mode,
      legal_name: form.legal_name.trim() || null,
      registered_address: form.registered_address.trim() || null,
      seller_pan: form.seller_pan.trim() || null,
      ird_software_listing_number: form.ird_software_listing_number.trim() || null,
      ird_permission_number: form.ird_permission_number.trim() || null,
      ird_permission_date: form.ird_permission_date || null,
      approved_software_name: form.approved_software_name.trim() || null,
      approved_software_version: form.approved_software_version.trim() || null,
      abbreviated_invoice_approved: form.abbreviated_invoice_approved,
      cloud_agreement_reference: form.cloud_agreement_reference.trim() || null,
      next_invoice_seed: form.next_invoice_seed,
      activation_effective_at: form.activation_effective_at ? new Date(form.activation_effective_at).toISOString() : null,
    };
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const saved = await fiscalApi.updateProfile(restaurantId, payload, token);
      setProfile(saved); setForm(toForm(saved, restaurant)); setDirty(false); setSuccess("Fiscal draft saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save fiscal draft."); }
    finally { setBusy(null); }
  };

  const validate = async () => {
    setBusy("validate"); setError(null); setSuccess(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const result = await fiscalApi.validateProfile(restaurantId, token);
      setValidation(result); if (result.profile) setProfile(result.profile);
      setSuccess(result.is_ready ? "Readiness validation passed." : "Readiness validation found blockers.");
    } catch (validateError) { setError(validateError instanceof Error ? validateError.message : "Could not validate readiness."); }
    finally { setBusy(null); }
  };

  const activate = async () => {
    if (!profile || dirty || !validation?.is_ready || profile.compliance_status !== "ready_for_activation") {
      setError("Save the draft and pass readiness validation before activation.");
      return;
    }
    if (!window.confirm(`Activate VAT e-billing for ${restaurant?.name || "this restaurant"}? Active fiscal settings become read-only.`)) return;
    setBusy("activate"); setError(null); setSuccess(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const activated = await fiscalApi.activateProfile(restaurantId, token);
      setProfile(activated); setForm(toForm(activated, restaurant)); setDirty(false); setSuccess("VAT e-billing activated.");
    } catch (activateError) { setError(activateError instanceof Error ? activateError.message : "Could not activate fiscal billing."); }
    finally { setBusy(null); }
  };

  const saveCbms = async () => {
    if (!cbms.username.trim() || (!cbmsStatus?.has_password && !cbms.password?.trim())) {
      setError("Enter the CBMS username and initial password.");
      return;
    }
    setBusy("cbms"); setError(null); setSuccess(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      const saved = await fiscalApi.updateCbmsConfig(restaurantId, { ...cbms, username: cbms.username.trim(), ...(cbms.password?.trim() ? { password: cbms.password.trim() } : {}) }, token);
      setCbmsStatus((current) => ({ ...current, config: saved, username: saved.username, environment: saved.environment, realtime_required: saved.realtime_required, has_password: saved.has_password }));
      setCbms((current) => ({ ...current, username: saved.username || current.username, password: "", environment: saved.environment, realtime_required: saved.realtime_required }));
      setSuccess("CBMS configuration saved securely.");
    } catch (cbmsError) { setError(cbmsError instanceof Error ? cbmsError.message : "Could not save CBMS configuration."); }
    finally { setBusy(null); }
  };

  const reconcile = async () => {
    setBusy("reconcile"); setError(null); setSuccess(null);
    try {
      const token = window.localStorage.getItem("accessToken") || undefined;
      setCbmsStatus(await fiscalApi.reconcileCbms(restaurantId, token)); setSuccess("CBMS reconciliation completed.");
    } catch (reconcileError) { setError(reconcileError instanceof Error ? reconcileError.message : "Could not reconcile CBMS."); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading compliance workspace...</div>;
  if (!restaurant) return <div className="p-8"><p className="text-sm text-red-600">{error || "Restaurant not found."}</p><Link className="mt-4 inline-block text-sm font-semibold text-orange-600" href="/dashboard/restaurants">Back to restaurants</Link></div>;

  const readiness = validation || profile?.readiness;
  const locked = profile?.compliance_status === "active";
  const cbmsConfigured = Boolean(cbmsStatus?.has_password || cbmsStatus?.config?.has_password);

  return (
    <div className="min-h-screen bg-[#f5f7fa] p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={`/dashboard/restaurants/${restaurant.id}`} className="text-sm font-semibold text-slate-500 hover:text-slate-900">← Back to restaurant</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">IRD / CBMS compliance</h1>
            <p className="mt-1 text-sm text-slate-500">{restaurant.name} · Operator-only activation workspace</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Refresh</button>
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Summary label="Billing mode" value={BILLING_MODE_LABELS[profile?.fiscal_billing_mode || form.fiscal_billing_mode]} />
          <Summary label="Compliance status" value={profile ? STATUS_LABELS[profile.compliance_status] : "Not configured"} />
          <Summary label="Readiness" value={readiness?.is_ready ? "Ready" : `${readiness?.blockers?.length || 0} blocker(s)`} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Restaurant fiscal declaration</h2>
          <p className="mt-1 text-sm text-slate-500">Verify the documents outside the app, then record the verified IRD details here.</p>
          <fieldset disabled={locked || busy === "profile"} className="mt-5 grid gap-4 md:grid-cols-2 disabled:opacity-60">
            <SelectField label="Registration type" value={form.registration_type} onChange={(value) => patch("registration_type", value as FiscalRegistrationType)} options={Object.entries(REGISTRATION_LABELS)} />
            <SelectField label="Fiscal billing mode" value={form.fiscal_billing_mode} onChange={(value) => patch("fiscal_billing_mode", value as FiscalBillingMode)} options={Object.entries(BILLING_MODE_LABELS)} />
            <TextField label="Registered legal name" value={form.legal_name} onChange={(value) => patch("legal_name", value)} required />
            <TextField label="Seller PAN / VAT number" value={form.seller_pan} onChange={(value) => patch("seller_pan", value)} required />
            <TextField label="Registered address" value={form.registered_address} onChange={(value) => patch("registered_address", value)} required wide />
            <TextField label="IRD software listing number" value={form.ird_software_listing_number} onChange={(value) => patch("ird_software_listing_number", value)} />
            <TextField label="IRD permission number" value={form.ird_permission_number} onChange={(value) => patch("ird_permission_number", value)} />
            <TextField label="IRD permission date" type="date" value={form.ird_permission_date} onChange={(value) => patch("ird_permission_date", value)} />
            <TextField label="Approved software name" value={form.approved_software_name} onChange={(value) => patch("approved_software_name", value)} />
            <TextField label="Approved software version" value={form.approved_software_version} onChange={(value) => patch("approved_software_version", value)} required />
            <TextField label="Cloud agreement reference" value={form.cloud_agreement_reference} onChange={(value) => patch("cloud_agreement_reference", value)} />
            <TextField label="Requested activation time" type="datetime-local" value={form.activation_effective_at} onChange={(value) => patch("activation_effective_at", value)} />
            <TextField label="Next fiscal invoice number" type="number" value={String(form.next_invoice_seed)} onChange={(value) => patch("next_invoice_seed", Number(value))} />
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={form.abbreviated_invoice_approved} onChange={(event) => patch("abbreviated_invoice_approved", event.target.checked)} /> Documentary abbreviated-invoice approval is recorded</label>
          </fieldset>

          {readiness?.blockers?.length ? <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Activation blockers</p><ul className="mt-2 list-disc space-y-1 pl-5">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => void validate()} disabled={!profile || dirty || Boolean(busy)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy === "validate" ? "Validating..." : "Validate readiness"}</button>
            <button type="button" onClick={() => void saveProfile()} disabled={locked || Boolean(busy)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "profile" ? "Saving..." : "Save draft"}</button>
            <button type="button" onClick={() => void activate()} disabled={locked || Boolean(busy) || dirty || !validation?.is_ready || profile?.compliance_status !== "ready_for_activation"} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "activate" ? "Activating..." : "Activate"}</button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">CBMS connection</h2>
          <p className="mt-1 text-sm text-slate-500">Credentials are sent only to the backend. Saved passwords are never returned to this dashboard.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Summary label="Configuration" value={cbmsConfigured ? "Credentials saved" : "Not configured"} />
            <Summary label="Queue" value={`${cbmsStatus?.pending_count || 0} pending / ${cbmsStatus?.failed_count || 0} failed`} />
            <Summary label="Last successful sync" value={cbmsStatus?.last_success_at ? new Date(cbmsStatus.last_success_at).toLocaleString() : "Never"} />
          </div>
          {cbmsStatus?.last_failure_message ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{cbmsStatus.last_failure_message}</div> : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextField label="Taxpayer login username" value={cbms.username} onChange={(value) => setCbms((current) => ({ ...current, username: value }))} />
            <TextField label={cbmsConfigured ? "Replace password" : "Password"} type="password" value={cbms.password || ""} onChange={(value) => setCbms((current) => ({ ...current, password: value }))} />
            <SelectField label="Environment" value={cbms.environment} onChange={(value) => setCbms((current) => ({ ...current, environment: value as "test" | "production" }))} options={[["test", "Setup/test"], ["production", "IRD production"]]} />
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={cbms.realtime_required} onChange={(event) => setCbms((current) => ({ ...current, realtime_required: event.target.checked }))} /> Real-time synchronization required</label>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => void reconcile()} disabled={!cbmsConfigured || Boolean(busy)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy === "reconcile" ? "Reconciling..." : "Reconcile"}</button><button type="button" onClick={() => void saveCbms()} disabled={Boolean(busy)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "cbms" ? "Saving..." : "Save CBMS configuration"}</button></div>
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{value}</p></div>;
}

function TextField({ label, value, onChange, type = "text", required = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean }) {
  return <div className={wide ? "md:col-span-2" : ""}>{fieldLabel(label, required)}<input className={inputClass()} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div>{fieldLabel(label)}<select className={inputClass()} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></div>;
}
