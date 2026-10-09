import { createFileRoute } from "@tanstack/react-router";
import FinancePage from "@/components/finance/FinancePage";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Income, expenses and approvals.",
      },
      {
        property: "og:title",
        content: "Finance — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content: "Income, expenses and approvals.",
      },
    ],
  }),
  component: FinancePage,
});
