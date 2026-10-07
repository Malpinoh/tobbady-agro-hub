import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Business performance reports." }, { property: "og:title", content: "Reports & Analytics — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Business performance reports." }] }),
  component: () => <ModulePage perm="reports.view" title="Reports & Analytics" description="Business performance reports." planned={["Profit & loss","Livestock reports","Sales analytics","Activity log"]} />,
});
