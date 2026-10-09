
import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/staff/StaffPage";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Users — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Manage employees, user accounts and roles.",
      },
    ],
  }),
  component: StaffPage,
});
