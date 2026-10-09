
import { createFileRoute } from "@tanstack/react-router";
import InventoryPage from "@/components/inventory/InventoryPage";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage feed, medicines and farm supplies.",
      },
      {
        property: "og:title",
        content: "Inventory — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content: "Manage feed, medicines and farm supplies.",
      },
    ],
  }),
  component: InventoryPage,
});
