"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import {
  createSmsCreditPackage,
  getSmsCreditPackages,
  updateSmsCreditPackage,
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
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await getSmsCreditPackages({ token: accessToken() });
      setPackages(response.data || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load SMS packages.");
    } finally {
      setLoading(false);
    }
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

  function updateLocal(id: number, values: Partial<SmsCreditPackage>) {
    setPackages((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  }

  if (!canView) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">You do not have permission to view the billing catalog.</p></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-10 lg:py-8">
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-slate-200 pb-6"><p className="text-sm font-medium text-orange-600">Billing catalog</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">SMS credit packages</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Control the packages restaurants can buy. Existing purchases keep the price and credit quantity captured at checkout.</p></header>
      {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600 [&_input]:mt-1 [&_input]:h-10 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:font-normal [&_input]:text-slate-900 [&_input]:outline-none focus-within:[&_input]:border-orange-500 focus-within:[&_input]:ring-2 focus-within:[&_input]:ring-orange-100 disabled:[&_input]:bg-slate-50">{label}{children}</label>;
}
