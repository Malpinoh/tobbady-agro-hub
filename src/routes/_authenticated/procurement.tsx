import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({ meta: [{ title: "Suppliers & Procurement — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Suppliers and purchasing." }, { property: "og:title", content: "Suppliers & Procurement — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Suppliers and purchasing." }] }),
  component: () => <ModulePage perm="procurement.view" title="Suppliers & Procurement" description="Suppliers and purchasing." planned={["Supplier directory","Purchase requests","Purchase orders","Goods received"]} />,
});
