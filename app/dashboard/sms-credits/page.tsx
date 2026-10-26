"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus, RefreshCw, Save, Users, WalletCards } from "lucide-react";
import {
  createSmsCreditPackage,
  getPlatformSmsCapacity,
  getSmsCreditPackages,
  updateSmsCreditPackage,
  updatePlatformSmsCapacitySettings,
  type PlatformSmsCapacity,
  type SmsCreditPackage,
} from "@/lib/backend-api";
import {
  canManageBillingCatalog,
  canViewBillingCatalog,
  getStoredAuthSession,
} from "@/lib/auth";

const accessToken = () => window.localStorage.getItem("accessToken") || undefined;
const emptyForm = { code: "", label: "", credits: "", price: "", order: "0" };

export default function SmsCreditsPage() {
  const session = getStoredAuthSession();
  const canView = canViewBillingCatalog(session);
  const canManage = canManageBillingCatalog(session);
  const [packages, setPackages] = useState<SmsCreditPackage[]>([]);
  const [capacity, setCapacity] = useState<PlatformSmsCapacity | null>(null);
  const [providerBalance, setProviderBalance] = useState("");
  const [safetyBuffer, setSafetyBuffer] = useState("0");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [packagesResult, capacityResult] = await Promise.allSettled([
      getSmsCreditPackages({ token: accessToken() }),
      getPlatformSmsCapacity({ token: accessToken() }),
    ]);

    if (packagesResult.status === "fulfilled") {
      setPackages(packagesResult.value.data || []);
    } else {
      setPackages([]);
      setError(packagesResult.reason instanceof Error ? packagesResult.reason.message : "Could not load SMS credit packages.");
    }

    if (capacityResult.status === "fulfilled") {
      const data = capacityResult.value.data || null;
      setCapacity(data);
      setProviderBalance(String(data?.provider_balance.available_credits ?? 0));
      setSafetyBuffer(String(data?.provider_balance.safety_buffer_credits ?? 0));
    } else {
      setCapacity(null);
      setError((current) => current || "SMS capacity data is unavailable. You can still manage SMS packages.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  async function createPackage() {
    setBusy("create"); setError(null); setNotice(null);
    try {
      await createSmsCreditPackage({
        code: form.code.trim().toLowerCase(), label: form.label.trim(),
        credits: Number(form.credits), price_npr: form.price,
        display_order: Number(form.order), is_active: true,
      }, { token: accessToken() });
      setForm(emptyForm); setNotice("SMS credit package created."); await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create SMS package.");
    } finally { setBusy(null); }
  }

  async function savePackage(item: SmsCreditPackage) {
    setBusy(`save-${item.id}`); setError(null); setNotice(null);
    try {
      await updateSmsCreditPackage(item.id, {
        label: item.label.trim(), credits: Number(item.credits),
        price_npr: String(item.price_npr), display_order: Number(item.display_order),
        is_active: item.is_active,
      }, { token: accessToken() });
      setNotice(`${item.label} saved.`); await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save SMS package.");
    } finally { setBusy(null); }
  }

  async function saveCapacity() {
    const available = Number(providerBalance);
    const buffer = Number(safetyBuffer);
    if (!Number.isInteger(available) || available < 0 || !Number.isInteger(buffer) || buffer < 0) {
      setError("Enter whole-number SMS credits for the SMSPasal balance and safety buffer.");
      return;
    }
    setBusy("capacity"); setError(null); setNotice(null);
    try {
      await updatePlatformSmsCapacitySettings({
        provider_available_credits: available,
        safety_buffer_credits: buffer,
      }, { token: accessToken() });
      setNotice("SMSPasal balance saved. The top-up recommendation has been recalculated.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the SMSPasal balance.");
    } finally { setBusy(null); }
  }

  function updateLocal(id: number, values: Partial<SmsCreditPackage>) {
    setPackages((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  }

  if (!canView) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">You do not have permission to view the billing catalog.</p></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-10 lg:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-orange-600">SMS operations</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">SMS credits & capacity</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Track restaurant credit commitments, customer growth, and the shared SMSPasal balance before deliveries are at risk.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Refresh</button></header>
      {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div aria-live="polite" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {capacity ? <>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={WalletCards} label="SMSPasal balance" value={formatCredits(capacity.provider_balance.available_credits)} detail={capacity.provider_balance.last_updated_at ? `Updated ${new Date(capacity.provider_balance.last_updated_at).toLocaleString()}` : "Enter the balance from SMSPasal"} />
          <Metric icon={RefreshCw} label="Recommended top-up" value={formatCredits(capacity.recommended_top_up.credits_to_add)} detail={capacity.recommended_top_up.credits_to_add ? "Add this many credits to meet the target" : "Current balance covers the target"} accent />
          <Metric icon={Building2} label="Restaurant commitments" value={formatCredits(capacity.recommended_top_up.restaurant_commitment_credits)} detail={`${formatCredits(capacity.restaurants.available_credits)} available · ${formatCredits(capacity.restaurants.reserved_credits)} reserved`} />
          <Metric icon={Users} label="Customers" value={formatCredits(capacity.customers.local_customers)} detail={`${formatCredits(capacity.customers.customer_accounts)} Yummy accounts · ${formatCredits(capacity.customers.verified_phone_accounts)} phone verified`} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-slate-900">Top-up plan</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">This protects all credits already sold to restaurants, plus the next 30 days of platform-funded phone activity and your buffer.</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">30-day outlook</span></div><dl className="mt-5 divide-y divide-slate-100"><CapacityRow label="Credits promised to restaurants" value={capacity.recommended_top_up.restaurant_commitment_credits} help="Available and reserved restaurant wallet credits."/><CapacityRow label="Platform phone SMS forecast" value={capacity.recommended_top_up.platform_forecast_30d_credits} help="OTP activity plus a conservative new-contact invitation estimate."/><CapacityRow label="Safety buffer" value={capacity.recommended_top_up.safety_buffer_credits} help="Extra credits held above the forecast."/><CapacityRow label="Coverage target" value={capacity.recommended_top_up.coverage_target_credits} strong/><CapacityRow label="Credits to add now" value={capacity.recommended_top_up.credits_to_add} strong accent/></dl></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">SMSPasal balance</h2><p className="mt-1 text-sm leading-6 text-slate-600">SMSPasal does not provide this balance through the connected API. Copy the current balance from SMSPasal after each top-up.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Available credits in SMSPasal"><input name="smspasal_available_credits" autoComplete="off" disabled={!canManage} type="number" min="0" step="1" value={providerBalance} onChange={(event) => setProviderBalance(event.target.value)} /></Field><Field label="Safety buffer"><input name="smspasal_safety_buffer" autoComplete="off" disabled={!canManage} type="number" min="0" step="1" value={safetyBuffer} onChange={(event) => setSafetyBuffer(event.target.value)} /></Field></div>{canManage ? <button type="button" onClick={() => void saveCapacity()} disabled={busy === "capacity"} className="mt-4 inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{busy === "capacity" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Save balance</button> : <p className="mt-4 text-xs text-slate-500">You can view this balance, but need billing catalog permission to update it.</p>}</article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Customer growth forecast</h2><p className="mt-1 text-sm text-slate-600">A straight-line 30-day forecast, based on the latest 30 days—not a prediction model.</p><div className="mt-5 grid grid-cols-2 gap-3"><ForecastStat label="New Yummy accounts" recent={capacity.forecast.customer_accounts_created_30d} forecast={capacity.forecast.forecast_customer_accounts_next_30d}/><ForecastStat label="New restaurant customers" recent={capacity.forecast.restaurant_customers_created_30d} forecast={capacity.forecast.forecast_restaurant_customers_next_30d}/><ForecastStat label="Successful phone OTPs" recent={capacity.forecast.successful_phone_otp_sms_30d} forecast={capacity.forecast.successful_phone_otp_sms_30d}/><ForecastStat label="New customer phone contacts" recent={capacity.forecast.new_customer_phone_contacts_30d} forecast={capacity.forecast.new_customer_phone_contacts_30d}/></div></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">How this is calculated</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">{capacity.forecast.assumptions.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500"/>{item}</li>)}</ul></article></section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Restaurant SMS credit activity</h2><p className="mt-1 text-xs text-slate-500">Completed purchases are kept separately from the live balance still owed to each restaurant.</p></div><p className="text-sm font-semibold text-slate-900">{formatCredits(capacity.restaurants.purchased_credits)} credits bought · NPR {formatMoney(capacity.restaurants.purchased_npr)}</p></div><div className="overflow-x-auto admin-table-scroll" tabIndex={0} role="region" aria-label="Restaurant SMS credit activity"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Restaurant</th><th className="px-5 py-3 text-right font-semibold">Purchases</th><th className="px-5 py-3 text-right font-semibold">Credits bought</th><th className="px-5 py-3 text-right font-semibold">Amount paid</th><th className="px-5 py-3 text-right font-semibold">Available</th><th className="px-5 py-3 text-right font-semibold">Reserved</th></tr></thead><tbody className="divide-y divide-slate-100">{capacity.restaurants.rows.map((row) => <tr key={row.restaurant_id} className="text-slate-700"><td className="px-5 py-3 font-medium text-slate-900">{row.restaurant_name}</td><td className="px-5 py-3 text-right">{row.purchase_count}</td><td className="px-5 py-3 text-right">{formatCredits(row.purchased_credits)}</td><td className="px-5 py-3 text-right">NPR {formatMoney(row.purchased_npr)}</td><td className="px-5 py-3 text-right">{formatCredits(row.available_credits)}</td><td className="px-5 py-3 text-right">{formatCredits(row.reserved_credits)}</td></tr>)}{capacity.restaurants.rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No restaurant SMS credit activity yet.</td></tr> : null}</tbody></table></div></section>
      </> : null}

      {canManage ? <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-orange-600"/><h2 className="font-semibold">New package</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="starter" /></Field>
          <Field label="Display name"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Starter" /></Field>
          <Field label="Credits"><input type="number" min="1" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} /></Field>
          <Field label="Price (NPR)"><input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Display order"><input type="number" min="0" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></Field>
        </div>
        <button type="button" disabled={busy === "create" || !form.code.trim() || !form.label.trim() || Number(form.credits) <= 0 || Number(form.price) <= 0} onClick={() => void createPackage()} className="mt-4 inline-flex h-10 items-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Plus className="mr-2 h-4 w-4"/>}Add package</button>
      </section> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Package catalog</h2><p className="mt-1 text-xs text-slate-500">Deactivate a package to stop new purchases. Its historical purchases remain unchanged.</p></div>
        {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-orange-500"/></div> : packages.length ? <div className="divide-y divide-slate-200">{packages.map((item) => <article key={item.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(9rem,1.2fr)_1fr_1fr_8rem_auto] md:items-end">
          <Field label={`${item.code} · Name`}><input disabled={!canManage} value={item.label} onChange={(e) => updateLocal(item.id, { label: e.target.value })}/></Field>
          <Field label="Credits"><input disabled={!canManage} type="number" min="1" value={item.credits} onChange={(e) => updateLocal(item.id, { credits: Number(e.target.value) })}/></Field>
          <Field label="Price (NPR)"><input disabled={!canManage} type="number" min="0.01" step="0.01" value={item.price_npr} onChange={(e) => updateLocal(item.id, { price_npr: e.target.value })}/></Field>
          <Field label="Order"><input disabled={!canManage} type="number" min="0" value={item.display_order} onChange={(e) => updateLocal(item.id, { display_order: Number(e.target.value) })}/></Field>
          <div className="flex h-10 items-center gap-3"><label className="flex items-center gap-2 text-sm font-medium"><input disabled={!canManage} type="checkbox" checked={item.is_active} onChange={(e) => updateLocal(item.id, { is_active: e.target.checked })}/>Active</label>{canManage ? <button type="button" disabled={busy === `save-${item.id}`} onClick={() => void savePackage(item)} className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50">{busy === `save-${item.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Save</button> : null}</div>
        </article>)}</div> : <p className="px-6 py-12 text-center text-sm text-slate-500">No SMS packages configured. Restaurants cannot buy credits until an active package is created.</p>}
      </section>
    </div>
  </main>;
}

function Metric({ icon: Icon, label, value, detail, accent = false }: { icon: typeof WalletCards; label: string; value: string; detail: string; accent?: boolean }) {
  return <article className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{label}</p><Icon className={accent ? "h-5 w-5 text-orange-600" : "h-5 w-5 text-slate-400"}/></div><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>;
}

function CapacityRow({ label, value, help, strong = false, accent = false }: { label: string; value: number; help?: string; strong?: boolean; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div><dt className={strong ? "font-semibold text-slate-900" : "text-sm font-medium text-slate-700"}>{label}</dt>{help ? <dd className="mt-0.5 text-xs text-slate-500">{help}</dd> : null}</div><dd className={`${strong ? "text-lg font-semibold" : "text-sm font-semibold"} ${accent ? "text-orange-600" : "text-slate-900"}`}>{formatCredits(value)}</dd></div>;
}

function ForecastStat({ label, recent, forecast }: { label: string; recent: number; forecast: number }) {
  return <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-medium leading-5 text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-slate-900">{formatCredits(forecast)}</p><p className="text-xs text-slate-500">next 30 days · {formatCredits(recent)} recent</p></div>;
}

function formatCredits(value: number) { return new Intl.NumberFormat().format(value || 0); }
function formatMoney(value: number) { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0); }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 [&_input]:mt-1 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:font-normal [&_input]:text-slate-900 [&_input]:outline-none focus-within:[&_input]:border-orange-500 focus-within:[&_input]:ring-2 focus-within:[&_input]:ring-orange-100 disabled:[&_input]:bg-slate-50">{label}{children}</label>;
}
