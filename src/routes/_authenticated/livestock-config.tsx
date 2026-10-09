
import { createFileRoute } from "@tanstack/react-router";
import LivestockConfigPage from "@/components/livestock/LivestockConfigPage";

export const Route = createFileRoute("/_authenticated/livestock-config")({
  head: () => ({
    meta: [
      { title: "Livestock Configuration — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage livestock categories and livestock setup.",
      },
    ],
  }),
  component: LivestockConfigPage,
});
