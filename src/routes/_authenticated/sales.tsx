
import { createFileRoute } from "@tanstack/react-router";
import SalesPage from "@/components/sales/SalesPage";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales & Customers — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage customers, sales invoices, payments and receipts.",
      },
      {
        property: "og:title",
        content: "Sales & Customers — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content: "Manage customers, sales invoices, payments and receipts.",
      },
    ],
  }),
  component: SalesPage,
});
