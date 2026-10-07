import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales & Customers — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Invoices, customers and payments." }, { property: "og:title", content: "Sales & Customers — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Invoices, customers and payments." }] }),
  component: () => <ModulePage perm="sales.view" title="Sales & Customers" description="Invoices, customers and payments." planned={["Sales invoices","Customer records","Payments","Receipts"]} />,
});
