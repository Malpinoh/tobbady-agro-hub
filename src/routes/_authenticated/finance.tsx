import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Income, expenses and approvals." }, { property: "og:title", content: "Finance — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Income, expenses and approvals." }] }),
  component: () => <ModulePage perm="finance.view" title="Finance" description="Income, expenses and approvals." planned={["Income records","Expense approvals","Cash flow","Budgets"]} />,
});
