import { describe, expect, it } from "vitest";

import {
  activeEntitlementOverride,
  billingNumber,
  calculateManualInvoiceTotal,
  calculateTaxedContractTotal,
  isValidPaymentAmount,
  safeCsvCell,
} from "./billing-utils";

describe("billing utilities", () => {
  it("calculates discount and tax without trusting a typed total", () => {
    expect(calculateManualInvoiceTotal("11400", "400", "1430")).toBe(12430);
    expect(calculateTaxedContractTotal("11400", "400", "13")).toBe(12430);
  });

  it("rejects invalid contract adjustments and overpayments", () => {
    expect(calculateTaxedContractTotal(100, 101, 13)).toBeNull();
    expect(isValidPaymentAmount(101, 100)).toBe(false);
    expect(isValidPaymentAmount(100, 100)).toBe(true);
  });

  it("normalizes unusable numeric input to zero", () => {
    expect(billingNumber("not-a-number")).toBe(0);
  });

  it("neutralizes spreadsheet formulas in CSV cells", () => {
    expect(safeCsvCell('=HYPERLINK("https://example.test")')).toBe(
      '"\'=HYPERLINK(""https://example.test"")"',
    );
    expect(safeCsvCell("ordinary account")).toBe('"ordinary account"');
  });

  it("finds only an entitlement override active at the requested time", () => {
    const overrides = [
      {
        id: 1,
        entitlement_key: "grow.enabled",
        starts_at: "2026-08-05T00:00:00.000Z",
        ends_at: "2026-08-10T00:00:00.000Z",
      },
      {
        id: 2,
        entitlement_key: "grow.enabled",
        starts_at: "2026-08-11T00:00:00.000Z",
      },
    ];

    expect(
      activeEntitlementOverride(
        overrides,
        "grow.enabled",
        new Date("2026-08-06T00:00:00.000Z"),
      )?.id,
    ).toBe(1);
    expect(
      activeEntitlementOverride(
        overrides,
        "grow.enabled",
        new Date("2026-08-04T00:00:00.000Z"),
      ),
    ).toBeUndefined();
  });
});
