import { createFileRoute } from "@tanstack/react-router";
import ReportsPage from "@/components/reports/ReportsPage";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      {
        title: "Reports & Analytics — TOBADDY AGRO LIVESTOCK",
      },
      {
        name: "description",
        content: "Business performance reports and farm analytics.",
      },
    ],
  }),
  component: ReportsPage,
});
