export function billingNumber(
  value: number | string | null | undefined,
): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateManualInvoiceTotal(
  subtotal: number | string,
  discount: number | string,
  tax: number | string,
): number {
  const result =
    billingNumber(subtotal) - billingNumber(discount) + billingNumber(tax);
  return Math.max(0, Math.round((result + Number.EPSILON) * 100) / 100);
}

export function calculateTaxedContractTotal(
  subtotal: number | string,
  discount: number | string,
  taxRatePercent: number | string,
): number | null {
  const base = billingNumber(subtotal);
  const reduction = billingNumber(discount);
  const rate = billingNumber(taxRatePercent);
  if (base < 0 || reduction < 0 || reduction > base || rate < 0 || rate > 100)
    return null;
  return (
    Math.round(((base - reduction) * (1 + rate / 100) + Number.EPSILON) * 100) /
    100
  );
}

export function isValidPaymentAmount(
  amount: number | string,
  outstanding: number | string,
): boolean {
  const payment = billingNumber(amount);
  const due = billingNumber(outstanding);
  return payment > 0 && payment <= due;
}

export function safeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

type EntitlementOverrideWindow = {
  entitlement_key: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

export function activeEntitlementOverride<T extends EntitlementOverrideWindow>(
  overrides: T[],
  entitlementKey: string,
  now = new Date(),
): T | undefined {
  const timestamp = now.getTime();
  return overrides.find((override) => {
    if (override.entitlement_key !== entitlementKey) return false;
    const startsAt = override.starts_at
      ? new Date(override.starts_at).getTime()
      : null;
    const endsAt = override.ends_at ? new Date(override.ends_at).getTime() : null;
    if (startsAt !== null && (Number.isNaN(startsAt) || startsAt > timestamp))
      return false;
    if (endsAt !== null && (Number.isNaN(endsAt) || endsAt < timestamp))
      return false;
    return true;
  });
}
