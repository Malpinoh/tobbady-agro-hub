import { describe, expect, it } from "vitest";
import { expenseCorrectionValues, validateMortality } from "@/lib/business-corrections";

describe("Mortality submissions", () => {
  it("requires positive whole stock quantities", () => {
    expect(validateMortality(0, 10, "2026-10-24", "2026-10-24", "Disease")).not.toBeNull();
    expect(validateMortality(11, 10, "2026-10-24", "2026-10-24", "Disease")).not.toBeNull();
    expect(validateMortality(1, 1, "2026-10-24", "2026-10-24", "Disease")).toBeNull();
  });
  it("requires a past or current death date and a reason", () => {
    expect(validateMortality(1, 10, "2026-10-25", "2026-10-24", "Disease")).not.toBeNull();
    expect(validateMortality(1, 10, "2026-10-24", "2026-10-24", "")).not.toBeNull();
  });
});
describe("Expense correction", () => {
  const form = { date: "2026-09-30", description: "Corrected", reference: "R1", amount: "250", category: "Animal feed", livestockLink: "animal:a1" };
  it("preserves approved and paid financial metadata", () => {
    expect(expenseCorrectionValues({ status: "approved", payment_status: "paid" }, form)).toEqual({ spent_on: "2026-09-30", description: "Corrected", reference: "R1" });
  });
  it("updates pending expenses without approval or payment fields", () => {
    expect(expenseCorrectionValues({ status: "pending", payment_status: "unpaid" }, form)).toEqual({ spent_on: "2026-09-30", description: "Corrected", reference: "R1", amount: 250, category: "Animal feed", animal_id: "a1", batch_id: null });
  });
});