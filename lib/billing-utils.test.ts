import { describe, expect, it } from "vitest";

import {
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
});
