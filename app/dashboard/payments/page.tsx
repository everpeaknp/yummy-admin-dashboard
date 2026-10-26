"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BillingModal from "@/components/BillingModal";
import {
  billingNumber as numeric,
  calculateManualInvoiceTotal,
  isValidPaymentAmount,
  safeCsvCell,
} from "@/lib/billing-utils";
import {
  createBillingContractInvoice,
  createBillingInvoice,
  createBillingPayment,
  getBillingInvoices,
  getBillingMetrics,
  getBillingPayments,
  getBillingSubscriptions,
  isBackendRouteUnavailable,
  reverseBillingPayment,
  runBillingLifecycle,
  voidBillingInvoice,
  type BillingInvoice,
  type BillingMetrics,
  type BillingPayment,
  type BillingSubscription,
} from "@/lib/backend-api";
import {
  canManageBillingPayments,
  canViewBillingPayments,
  getStoredAuthSession,
} from "@/lib/auth";

type InvoiceMode = "contract" | "manual";

const EMPTY_INVOICE_FORM = {
  mode: "contract" as InvoiceMode,
  subscriptionId: "",
  invoiceNumber: "",
  subtotal: "",
  discountAmount: "0",
  taxValue: "0",
  dueAt: "",
  periodStart: "",
  periodEnd: "",
  notes: "",
  reason: "",
};

function token() {
  return window.localStorage.getItem("accessToken") || undefined;
}

function money(value: number | string, currency = "NPR") {
  const amount = numeric(value);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function displayDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function localDateTimeNow() {
  const current = new Date();
  const local = new Date(
    current.getTime() - current.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function isoOrNull(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function unwrapSubscriptions(
  data: BillingSubscription[] | { items: BillingSubscription[] },
) {
  return Array.isArray(data) ? data : data.items || [];
}

function subscriptionLabel(subscription: BillingSubscription) {
  return (
    subscription.billing_account_name ||
    subscription.restaurant_name ||
    subscription.restaurant_names?.join(", ") ||
    `Billing account #${subscription.billing_account_id}`
  );
}

function invoiceAccountLabel(
  invoice: BillingInvoice,
  subscriptions: BillingSubscription[],
) {
  const subscription = subscriptions.find(
    (item) => item.id === invoice.subscription_id,
  );
  return subscription
    ? subscriptionLabel(subscription)
    : invoice.billing_account_name ||
        `Subscription #${invoice.subscription_id}`;
}

function invoicePaid(invoice: BillingInvoice, payments: BillingPayment[]) {
  if (invoice.amount_paid !== undefined) return numeric(invoice.amount_paid);
  return payments
    .filter(
      (payment) =>
        payment.invoice_id === invoice.id && payment.status !== "reversed",
    )
    .reduce((sum, payment) => sum + numeric(payment.amount), 0);
}

function invoiceOutstanding(
  invoice: BillingInvoice,
  payments: BillingPayment[],
) {
  if (invoice.amount_due !== undefined) return numeric(invoice.amount_due);
  return Math.max(
    0,
    numeric(invoice.total_amount) - invoicePaid(invoice, payments),
  );
}

function contractSubtotal(subscription: BillingSubscription | undefined) {
  if (!subscription) return null;
  const base = subscription.plan_version_prices?.find(
    (price) => price.id === subscription.selected_price_id,
  );
  if (!base || base.quote_only || base.amount === null) return null;
  let total = numeric(base.amount);
  for (const assignment of subscription.addons || []) {
    if (assignment.status && assignment.status !== "active") continue;
    const price = assignment.prices?.find(
      (candidate) => candidate.id === assignment.selected_price_id,
    );
    if (!price || price.quote_only || price.amount === null) return null;
    total += numeric(price.amount);
  }
  return total;
}

function invoiceSourceLabel(invoice: BillingInvoice) {
  if (invoice.source !== "self_service") return invoice.source || "manual";
  if (invoice.status === "paid") return "Self-service purchase";
  if (invoice.checkout_status === "review_required") return "Late payment needs review";
  if (invoice.checkout_status === "superseded") return "Superseded checkout";
  if (["canceled", "void"].includes(invoice.status)) return "Abandoned checkout";
  return "Checkout awaiting payment";
}

function invoicePlanLabel(invoice: BillingInvoice) {
  const name = invoice.line_items?.[0]?.name;
  return typeof name === "string" && name.trim() ? name : null;
}

function downloadCsv(
  invoices: BillingInvoice[],
  subscriptions: BillingSubscription[],
) {
  const rows = [
    [
      "Invoice",
      "Account",
      "Status",
      "Currency",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
      "Paid",
      "Due",
      "Due date",
      "Source",
    ],
    ...invoices.map((invoice) => [
      invoice.invoice_number || invoice.id,
      invoiceAccountLabel(invoice, subscriptions),
      invoice.status,
      invoice.currency,
      invoice.subtotal || 0,
      invoice.discount_amount || 0,
      invoice.tax_amount || 0,
      invoice.total_amount,
      invoice.amount_paid || 0,
      invoice.amount_due || 0,
      invoice.due_at || "",
      invoice.source || "manual",
    ]),
  ];
  const blob = new Blob(
    [rows.map((row) => row.map(safeCsvCell).join(",")).join("\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `subscription-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const session = getStoredAuthSession();
  const canView = canViewBillingPayments(session);
  const canManage = canManageBillingPayments(session);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(
    null,
  );
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "bank_transfer",
    reference: "",
    paidAt: localDateTimeNow(),
    reason: "",
  });
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE_FORM);

  const load = useCallback(async () => {
    setError(null);
    const [invoiceResult, paymentResult, subscriptionResult, metricsResult] =
      await Promise.allSettled([
        getBillingInvoices({ token: token() }),
        getBillingPayments({ token: token() }),
        getBillingSubscriptions({}, { token: token() }),
        getBillingMetrics({ token: token() }),
      ]);
    if (invoiceResult.status === "fulfilled")
      setInvoices(invoiceResult.value.data || []);
    else if (isBackendRouteUnavailable(invoiceResult.reason))
      setRouteUnavailable(true);
    else
      setError(
        invoiceResult.reason instanceof Error
          ? invoiceResult.reason.message
          : "Failed to load invoices.",
      );
    if (paymentResult.status === "fulfilled")
      setPayments(paymentResult.value.data || []);
    else if (!isBackendRouteUnavailable(paymentResult.reason))
      setError(
        (old) =>
          old ||
          (paymentResult.reason instanceof Error
            ? paymentResult.reason.message
            : "Failed to load payments."),
      );
    if (subscriptionResult.status === "fulfilled")
      setSubscriptions(unwrapSubscriptions(subscriptionResult.value.data));
    if (metricsResult.status === "fulfilled")
      setMetrics(metricsResult.value.data);
  }, []);

  useEffect(() => {
    let active = true;
    if (!canView) {
      setIsLoading(false);
      return;
    }
    void load().finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [canView, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (status !== "all" && invoice.status !== status) return false;
      return (
        !query ||
        [
          invoiceAccountLabel(invoice, subscriptions),
          invoice.invoice_number,
          invoice.id,
          invoice.subscription_id,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        )
      );
    });
  }, [invoices, search, status, subscriptions]);

  const invoiceStatuses = useMemo(
    () => [...new Set(invoices.map((invoice) => invoice.status))].sort(),
    [invoices],
  );
  const formSubscription = subscriptions.find(
    (subscription) => subscription.id === Number(invoiceForm.subscriptionId),
  );
  const previewSubtotal = contractSubtotal(formSubscription);
  const manualTotal = calculateManualInvoiceTotal(
    invoiceForm.subtotal,
    invoiceForm.discountAmount,
    invoiceForm.taxValue,
  );
  const invoiceDirty =
    JSON.stringify(invoiceForm) !== JSON.stringify(EMPTY_INVOICE_FORM);

  const closeInvoiceForm = () => {
    if (invoiceDirty && !window.confirm("Discard the unsaved invoice draft?"))
      return;
    setShowInvoiceForm(false);
    setInvoiceForm(EMPTY_INVOICE_FORM);
  };

  const openPayment = (invoice: BillingInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: String(invoiceOutstanding(invoice, payments)),
      method: "bank_transfer",
      reference: "",
      paidAt: localDateTimeNow(),
      reason: "",
    });
    setError(null);
  };

  const savePayment = async () => {
    if (!selectedInvoice) return;
    const amount = numeric(paymentForm.amount);
    const outstanding = invoiceOutstanding(selectedInvoice, payments);
    if (
      !isValidPaymentAmount(amount, outstanding) ||
      !paymentForm.method ||
      paymentForm.reason.trim().length < 3
    ) {
      setError(
        `Enter a valid payment up to ${money(outstanding, selectedInvoice.currency)}, select a method, and provide an audit reason.`,
      );
      return;
    }
    setIsSaving(true);
    try {
      await createBillingPayment(
        selectedInvoice.id,
        {
          amount,
          currency: selectedInvoice.currency,
          payment_method: paymentForm.method,
          reference: paymentForm.reference.trim() || null,
          paid_at: isoOrNull(paymentForm.paidAt),
          reason: paymentForm.reason.trim(),
        },
        { token: token() },
      );
      setSelectedInvoice(null);
      setNotice(
        "Payment recorded. A linked pending upgrade was activated if the invoice is now fully paid.",
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to record payment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveInvoice = async () => {
    const subscriptionId = Number(invoiceForm.subscriptionId);
    const discountAmount = numeric(invoiceForm.discountAmount);
    const periodStart = isoOrNull(invoiceForm.periodStart);
    const periodEnd = isoOrNull(invoiceForm.periodEnd);
    if (!subscriptionId || invoiceForm.reason.trim().length < 3) {
      setError("Choose a subscription and provide an audit reason.");
      return;
    }
    if (
      periodStart &&
      periodEnd &&
      new Date(periodEnd) < new Date(periodStart)
    ) {
      setError("Invoice period end cannot be before its start.");
      return;
    }
    setIsSaving(true);
    try {
      if (invoiceForm.mode === "contract") {
        await createBillingContractInvoice(
          subscriptionId,
          {
            invoice_number: invoiceForm.invoiceNumber.trim() || null,
            tax_rate_percent: numeric(invoiceForm.taxValue),
            discount_amount: discountAmount,
            due_at: isoOrNull(invoiceForm.dueAt),
            period_start: periodStart,
            period_end: periodEnd,
            notes: invoiceForm.notes.trim() || null,
            source: "contract",
            reason: invoiceForm.reason.trim(),
          },
          { token: token() },
        );
      } else {
        const subtotal = numeric(invoiceForm.subtotal);
        const taxAmount = numeric(invoiceForm.taxValue);
        if (
          !invoiceForm.invoiceNumber.trim() ||
          subtotal < 0 ||
          discountAmount > subtotal
        ) {
          setError(
            "Manual invoices require an invoice number and a discount no greater than the subtotal.",
          );
          return;
        }
        await createBillingInvoice(
          subscriptionId,
          {
            invoice_number: invoiceForm.invoiceNumber.trim(),
            currency: "NPR",
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            total_amount: manualTotal,
            due_at: isoOrNull(invoiceForm.dueAt),
            period_start: periodStart,
            period_end: periodEnd,
            notes: invoiceForm.notes.trim() || null,
            source: "manual",
            reason: invoiceForm.reason.trim(),
          },
          { token: token() },
        );
      }
      setShowInvoiceForm(false);
      setInvoiceForm(EMPTY_INVOICE_FORM);
      setNotice(
        invoiceForm.mode === "contract"
          ? "Invoice calculated from the pinned contract."
          : "Manual adjustment invoice created with a calculated total.",
      );
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to create invoice.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const voidInvoice = async (invoice: BillingInvoice) => {
    const reason = window
      .prompt(
        `Reason for voiding ${invoice.invoice_number || `invoice #${invoice.id}`}?`,
      )
      ?.trim();
    if (
      !reason ||
      !window.confirm(
        "Void this invoice? This cannot be undone; recorded payments must be reversed first.",
      )
    )
      return;
    try {
      await voidBillingInvoice(invoice.id, reason, { token: token() });
      setNotice("Invoice voided and any pending linked upgrade was reopened.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to void invoice.",
      );
    }
  };

  const reversePayment = async (payment: BillingPayment) => {
    const reason = window
      .prompt(`Reason for reversing payment #${payment.id}?`)
      ?.trim();
    if (
      !reason ||
      !window.confirm(
        "Reverse this payment? A linked active upgrade will move to past due.",
      )
    )
      return;
    try {
      await reverseBillingPayment(payment.id, reason, { token: token() });
      setNotice("Payment reversed and linked subscription state reconciled.");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to reverse payment.",
      );
    }
  };

  const runLifecycle = async () => {
    const reason = window
      .prompt("Audit reason for running subscription lifecycle processing?")
      ?.trim();
    if (
      !reason ||
      !window.confirm(
        "Run overdue, activation, expiry, and renewal-invoice processing now?",
      )
    )
      return;
    try {
      const response = await runBillingLifecycle(reason, { token: token() });
      setNotice(
        `Lifecycle processing completed: ${JSON.stringify(response.data)}.`,
      );
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Lifecycle processing failed.",
      );
    }
  };

  if (!canView) return <Denied />;

  return (
    <div className="min-h-screen bg-[#f5f7fa] dark:bg-gray-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-gray-800 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Invoices &amp; Payments
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Contract-derived billing, corrections, and lifecycle controls.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadCsv(filtered, subscriptions)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={runLifecycle}
                className="rounded-xl border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50"
              >
                Run lifecycle
              </button>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(true)}
                disabled={!subscriptions.length || routeUnavailable}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                Create invoice
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="space-y-5 p-4 sm:p-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {routeUnavailable ? (
          <Alert tone="warning">
            The Subscription V2 billing routes are unavailable. Legacy billing
            rows are intentionally not shown as invoice records.
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Stat
            label="Estimated MRR"
            value={money(metrics?.estimated_mrr || 0)}
          />
          <Stat label="Outstanding" value={money(metrics?.outstanding || 0)} />
          <Stat
            label="Overdue"
            value={money(metrics?.overdue || 0)}
            tone={numeric(metrics?.overdue) > 0 ? "danger" : undefined}
          />
          <Stat
            label="Paid in 30 days"
            value={money(metrics?.payments_last_30_days || 0)}
          />
          <Stat
            label="Pending payment"
            value={String(metrics?.pending_payment || 0)}
          />
          <Stat
            label="Renewals in 30 days"
            value={String(metrics?.renewals_next_30_days || 0)}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Invoice ledger
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filtered.length} matching records
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                value={search}
                aria-label="Search invoices"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice or account…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-64"
              />
              <select
                value={status}
                aria-label="Filter invoices by status"
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                {invoiceStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto admin-table-scroll" tabIndex={0} role="region" aria-label="Invoice ledger">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Invoice</Th>
                  <Th>Account</Th>
                  <Th>Period</Th>
                  <Th>Total</Th>
                  <Th>Paid / due</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-sm text-slate-500">
                      Loading invoice ledger…
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-slate-100 align-top hover:bg-slate-50"
                    >
                      <Td>
                        <p className="font-semibold text-slate-900">
                          {invoice.invoice_number || `#${invoice.id}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {invoiceSourceLabel(invoice)} ·{" "}
                          {displayDate(invoice.created_at)}
                        </p>
                        {invoice.line_items?.length ? (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-orange-600">
                              {invoicePlanLabel(invoice)
                                ? `View ${invoicePlanLabel(invoice)}`
                                : `${invoice.line_items.length} line item(s)`}
                            </summary>
                            <pre className="mt-2 max-w-sm overflow-auto rounded bg-slate-900 p-2 text-[10px] text-white">
                              {JSON.stringify(invoice.line_items, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </Td>
                      <Td>{invoiceAccountLabel(invoice, subscriptions)}</Td>
                      <Td>
                        {displayDate(invoice.period_start)}
                        <br />
                        <span className="text-xs text-slate-500">
                          to {displayDate(invoice.period_end)}
                        </span>
                      </Td>
                      <Td>
                        {money(invoice.total_amount, invoice.currency)}
                        {numeric(invoice.discount_amount) ? (
                          <p className="text-xs text-green-700">
                            Discount{" "}
                            {money(
                              invoice.discount_amount || 0,
                              invoice.currency,
                            )}
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        {money(
                          invoicePaid(invoice, payments),
                          invoice.currency,
                        )}{" "}
                        paid
                        <br />
                        <span className="text-xs text-slate-500">
                          {money(
                            invoiceOutstanding(invoice, payments),
                            invoice.currency,
                          )}{" "}
                          due
                        </span>
                      </Td>
                      <Td>
                        <Status status={invoice.status} />
                      </Td>
                      <Td>
                        <div className="flex flex-col items-start gap-2">
                          {canManage &&
                          invoiceOutstanding(invoice, payments) > 0 &&
                          !["void", "canceled"].includes(invoice.status) ? (
                            <button
                              type="button"
                              onClick={() => openPayment(invoice)}
                              className="text-sm font-semibold text-orange-600"
                            >
                              Record payment
                            </button>
                          ) : null}
                          {canManage && invoice.status !== "void" ? (
                            <button
                              type="button"
                              onClick={() => voidInvoice(invoice)}
                              className="text-xs font-semibold text-red-600"
                            >
                              Void invoice
                            </button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-sm text-slate-500"
                    >
                      No invoices match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <h2 className="text-lg font-bold text-slate-900">Payment records</h2>
          <div className="mt-4 overflow-x-auto admin-table-scroll" tabIndex={0} role="region" aria-label="Payment records">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <Th>Paid at</Th>
                  <Th>Invoice</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {payments.length ? (
                  payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100">
                      <Td>{displayDate(payment.paid_at)}</Td>
                      <Td>#{payment.invoice_id}</Td>
                      <Td>{money(payment.amount, payment.currency)}</Td>
                      <Td>{payment.payment_method || "—"}</Td>
                      <Td>{payment.reference || "—"}</Td>
                      <Td>
                        <Status status={payment.status || "recorded"} />
                      </Td>
                      <Td>
                        {canManage && payment.status !== "reversed" ? (
                          <button
                            type="button"
                            onClick={() => reversePayment(payment)}
                            className="text-xs font-semibold text-red-600"
                          >
                            Reverse
                          </button>
                        ) : null}
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-sm text-slate-500">
                      No payments have been recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showInvoiceForm ? (
        <BillingModal
          title="Create subscription invoice"
          description="Contract mode uses the subscription's pinned plan and add-on prices. Manual mode is reserved for audited adjustments."
          maxWidth="2xl"
          onClose={closeInvoiceForm}
        >
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <Label>Invoice source</Label>
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                {(["contract", "manual"] as InvoiceMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInvoiceForm((old) => ({ ...old, mode }))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${invoiceForm.mode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {mode === "contract"
                      ? "From contract"
                      : "Manual adjustment"}
                  </button>
                ))}
              </div>
            </label>
            <label className="block sm:col-span-2">
              <Label>Subscription</Label>
              <select
                value={invoiceForm.subscriptionId}
                onChange={(event) =>
                  setInvoiceForm((old) => ({
                    ...old,
                    subscriptionId: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Choose a subscription</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscriptionLabel(subscription)} —{" "}
                    {subscription.plan_name ||
                      subscription.plan_code ||
                      `Plan version #${subscription.plan_version_id}`}
                  </option>
                ))}
              </select>
              {invoiceForm.mode === "contract" ? (
                <p className="mt-1 text-xs text-slate-500">
                  Pinned price preview:{" "}
                  {previewSubtotal === null
                    ? "quote/custom pricing; backend will require negotiated values"
                    : money(previewSubtotal)}
                </p>
              ) : null}
            </label>
            <Field
              label={`Invoice number${invoiceForm.mode === "contract" ? " (optional)" : ""}`}
              value={invoiceForm.invoiceNumber}
              onChange={(invoiceNumber) =>
                setInvoiceForm((old) => ({ ...old, invoiceNumber }))
              }
            />
            {invoiceForm.mode === "manual" ? (
              <Field
                label="Subtotal (NPR)"
                type="number"
                value={invoiceForm.subtotal}
                onChange={(subtotal) =>
                  setInvoiceForm((old) => ({ ...old, subtotal }))
                }
              />
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                Prices and line items are resolved by the backend from the
                pinned contract.
              </div>
            )}
            <Field
              label="Discount (NPR)"
              type="number"
              value={invoiceForm.discountAmount}
              onChange={(discountAmount) =>
                setInvoiceForm((old) => ({ ...old, discountAmount }))
              }
            />
            <Field
              label={
                invoiceForm.mode === "contract"
                  ? "Tax rate (%)"
                  : "Tax amount (NPR)"
              }
              type="number"
              value={invoiceForm.taxValue}
              onChange={(taxValue) =>
                setInvoiceForm((old) => ({ ...old, taxValue }))
              }
            />
            {invoiceForm.mode === "manual" ? (
              <div className="sm:col-span-2 rounded-xl bg-slate-100 px-4 py-3 text-sm">
                <span className="text-slate-500">Calculated total:</span>{" "}
                <strong className="ml-2">{money(manualTotal)}</strong>
              </div>
            ) : null}
            <Field
              label="Due at"
              type="datetime-local"
              value={invoiceForm.dueAt}
              onChange={(dueAt) => setInvoiceForm((old) => ({ ...old, dueAt }))}
            />
            <div />
            <Field
              label="Period starts"
              type="datetime-local"
              value={invoiceForm.periodStart}
              onChange={(periodStart) =>
                setInvoiceForm((old) => ({ ...old, periodStart }))
              }
            />
            <Field
              label="Period ends"
              type="datetime-local"
              value={invoiceForm.periodEnd}
              onChange={(periodEnd) =>
                setInvoiceForm((old) => ({ ...old, periodEnd }))
              }
            />
            <div className="sm:col-span-2">
              <Field
                label="Notes"
                value={invoiceForm.notes}
                onChange={(notes) =>
                  setInvoiceForm((old) => ({ ...old, notes }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label="Audit reason"
                value={invoiceForm.reason}
                onChange={(reason) =>
                  setInvoiceForm((old) => ({ ...old, reason }))
                }
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={closeInvoiceForm}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveInvoice}
                disabled={isSaving}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Creating…" : "Create invoice"}
              </button>
            </div>
          </div>
        </BillingModal>
      ) : null}

      {selectedInvoice ? (
        <BillingModal
          title="Record payment"
          description={
            selectedInvoice.invoice_number || `Invoice #${selectedInvoice.id}`
          }
          onClose={() => setSelectedInvoice(null)}
        >
          <div className="space-y-4 p-6">
            <Field
              label={`Amount (${selectedInvoice.currency})`}
              type="number"
              value={paymentForm.amount}
              onChange={(amount) =>
                setPaymentForm((old) => ({ ...old, amount }))
              }
            />
            <label className="block">
              <Label>Payment method</Label>
              <select
                value={paymentForm.method}
                onChange={(event) =>
                  setPaymentForm((old) => ({
                    ...old,
                    method: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
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
              label="Reference"
              value={paymentForm.reference}
              onChange={(reference) =>
                setPaymentForm((old) => ({ ...old, reference }))
              }
            />
            <Field
              label="Paid at"
              type="datetime-local"
              value={paymentForm.paidAt}
              onChange={(paidAt) =>
                setPaymentForm((old) => ({ ...old, paidAt }))
              }
            />
            <Field
              label="Audit reason"
              value={paymentForm.reason}
              onChange={(reason) =>
                setPaymentForm((old) => ({ ...old, reason }))
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePayment}
                disabled={isSaving}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Recording…" : "Record payment"}
              </button>
            </div>
          </div>
        </BillingModal>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${tone === "danger" ? "border-red-200" : "border-slate-200"}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold ${tone === "danger" ? "text-red-700" : "text-slate-900"}`}
      >
        {value}
      </p>
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
function Status({ status }: { status: string }) {
  const tone =
    status === "paid" || status === "recorded"
      ? "bg-green-100 text-green-700"
      : status === "overdue" || status === "reversed"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
      />
    </label>
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
          You do not have permission to view billing payments.
        </p>
      </section>
    </div>
  );
}
