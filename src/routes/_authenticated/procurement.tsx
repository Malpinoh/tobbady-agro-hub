import { createFileRoute } from "@tanstack/react-router";
import ProcurementPage from "@/components/procurement/ProcurementPage";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({
    meta: [
      { title: "Suppliers & Purchases — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage suppliers, purchasing and deliveries.",
      },
      {
        property: "og:title",
        content: "Suppliers & Purchases — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content: "Manage suppliers, purchasing and deliveries.",
      },
    ],
  }),
  component: ProcurementPage,
});
