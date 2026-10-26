"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, TicketPercent } from "lucide-react";

import type { BillingPlan, BillingPromoCode } from "@/lib/backend-api";

export type PromoDraft = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxRedemptions: string;
  perAccountLimit: number;
  planCode: string;
  interval: string;
  endsAt: string;
};

type Props = {
  promos: BillingPromoCode[];
  plans: BillingPlan[];
  draft: PromoDraft;
  setDraft: Dispatch<SetStateAction<PromoDraft>>;
  canManage: boolean;
  busy: string | null;
  onCreate: () => Promise<void>;
  onToggle: (promo: BillingPromoCode) => Promise<void>;
};

const terms = [1, 3, 6, 12];
const inputClass = "mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-100 disabled:bg-slate-100";
const formatNpr = (value: number | string) => new Intl.NumberFormat(undefined, { style: "currency", currency: "NPR" }).format(Number(value));

export default function PromoCodeManager({ promos, plans, draft, setDraft, canManage, busy, onCreate, onToggle }: Props) {
  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.4fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-medium text-orange-600">Create discount</p>
        <h2 className="mt-1 text-xl font-semibold">New promo code</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Leave the code blank to generate one. The backend always calculates the discount from the published price.</p>
        <div className="mt-5 grid gap-4">
          <label className="text-sm font-semibold">Code (optional)<input name="promo-code" autoComplete="off" spellCheck={false} disabled={!canManage} value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} maxLength={32} placeholder="Example: LAUNCH10" className={`${inputClass} font-mono uppercase`} /></label>
          <label className="text-sm font-semibold">Internal description<input name="promo-description" autoComplete="off" disabled={!canManage} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={255} placeholder="Example: Launch offer" className={inputClass} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Discount type<select name="promo-discount-type" disabled={!canManage} value={draft.discountType} onChange={(event) => setDraft((current) => ({ ...current, discountType: event.target.value as PromoDraft["discountType"] }))} className={inputClass}><option value="percentage">Percentage</option><option value="fixed">Fixed NPR</option></select></label>
            <label className="text-sm font-semibold">Value<input name="promo-discount-value" disabled={!canManage} type="number" inputMode="decimal" min="0.01" max={draft.discountType === "percentage" ? 99.99 : undefined} step="0.01" value={draft.discountValue} onChange={(event) => setDraft((current) => ({ ...current, discountValue: Number(event.target.value) }))} className={inputClass} /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Plan<select name="promo-plan" disabled={!canManage} value={draft.planCode} onChange={(event) => setDraft((current) => ({ ...current, planCode: event.target.value }))} className={inputClass}><option value="all">All paid plans</option>{plans.filter((plan) => plan.code !== "free").map((plan) => <option key={plan.id} value={plan.code}>{plan.name}</option>)}</select></label>
            <label className="text-sm font-semibold">Billing term<select name="promo-term" disabled={!canManage} value={draft.interval} onChange={(event) => setDraft((current) => ({ ...current, interval: event.target.value }))} className={inputClass}><option value="all">All terms</option>{terms.map((months) => <option key={months} value={months}>{months} month{months === 1 ? "" : "s"}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Total uses<input name="promo-total-uses" disabled={!canManage} type="number" inputMode="numeric" min="1" value={draft.maxRedemptions} onChange={(event) => setDraft((current) => ({ ...current, maxRedemptions: event.target.value }))} placeholder="Unlimited" className={inputClass} /></label>
            <label className="text-sm font-semibold">Per account<input name="promo-per-account" disabled={!canManage} type="number" inputMode="numeric" min="1" value={draft.perAccountLimit} onChange={(event) => setDraft((current) => ({ ...current, perAccountLimit: Number(event.target.value) }))} className={inputClass} /></label>
          </div>
          <label className="text-sm font-semibold">Expires on<input name="promo-expires-on" disabled={!canManage} type="date" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} className={inputClass} /></label>
          <button type="button" disabled={!canManage || busy === "create-promo" || draft.discountValue <= 0} onClick={() => void onCreate()} className="inline-flex h-11 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{busy === "create-promo" ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <TicketPercent aria-hidden="true" className="mr-2 h-4 w-4" />}Generate promo code</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6"><h2 className="text-xl font-semibold">Promo codes</h2><p className="mt-1 text-sm text-slate-500">Usage counts include verified subscription payments only.</p></div>
        <div className="divide-y divide-slate-200">
          {promos.length ? promos.map((promo) => (
            <article key={promo.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6">
              <div><div className="flex flex-wrap items-center gap-2"><code className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-slate-900">{promo.code}</code><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${promo.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{promo.is_active ? "Active" : "Disabled"}</span></div><p className="mt-2 text-sm text-slate-500">{promo.description || "No description"}</p></div>
              <div className="text-sm"><p className="font-semibold tabular-nums">{promo.discount_type === "percentage" ? `${promo.discount_value}% off` : `${formatNpr(promo.discount_value)} off`}</p><p className="mt-1 text-xs text-slate-500 tabular-nums">{promo.redeemed_count}{promo.max_redemptions ? ` / ${promo.max_redemptions}` : ""} redeemed · {promo.per_account_limit} per account</p></div>
              <button type="button" disabled={!canManage || busy === `promo-${promo.id}`} onClick={() => void onToggle(promo)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-50">{busy === `promo-${promo.id}` ? "Saving…" : promo.is_active ? "Disable" : "Enable"}</button>
            </article>
          )) : <div className="px-6 py-12 text-center text-sm text-slate-500">No promo codes have been created.</div>}
        </div>
      </div>
    </section>
  );
}
