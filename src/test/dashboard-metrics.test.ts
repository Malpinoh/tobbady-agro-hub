import { describe, expect, it } from "vitest";
import { recognizedSalesForPeriod, sumReceivedSales } from "@/lib/dashboard-metrics";

describe("dashboard sales revenue", () => {
  const sales = [
    { id: "paid", sale_date: "2026-10-24", amount_paid: 100, status: "completed" },
    { id: "partial", sale_date: "2026-10-24", amount_paid: "25", status: "approved" },
    { id: "unpaid", sale_date: "2026-10-24", amount_paid: 0, status: "completed" },
    { id: "cancelled", sale_date: "2026-10-24", amount_paid: 900, status: "cancelled" },
    { id: "other-day", sale_date: "2026-10-23", amount_paid: 500, status: "completed" },
  ];

  it("counts only money actually received for recognized sales in the selected date range", () => {
    const selected = recognizedSalesForPeriod(sales, "2026-10-24", "2026-10-24");
    expect(selected.map((sale) => sale.id)).toEqual(["paid", "partial", "unpaid"]);
    expect(sumReceivedSales(selected)).toBe(125);
  });

  it("returns zero for a period with no recognized sales", () => {
    expect(sumReceivedSales(recognizedSalesForPeriod(sales, "2026-10-25", "2026-10-31"))).toBe(0);
  });
});
