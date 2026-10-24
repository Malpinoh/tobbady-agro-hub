export type DashboardSale = {
  id: string;
  sale_date: string;
  amount_paid: number | string | null;
  status: string | null;
};

/** Sales revenue is the amount actually received, not the full invoice value. */
export function recognizedSalesForPeriod(
  sales: DashboardSale[],
  startDate: string,
  endDate: string,
): DashboardSale[] {
  return sales.filter((sale) => {
    const status = String(sale.status ?? "").toLowerCase();
    return (
      ["completed", "approved"].includes(status) &&
      sale.sale_date >= startDate &&
      sale.sale_date <= endDate
    );
  });
}

export function sumReceivedSales(sales: DashboardSale[]): number {
  return sales.reduce((total, sale) => total + Number(sale.amount_paid ?? 0), 0);
}
