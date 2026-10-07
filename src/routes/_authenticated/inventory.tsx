import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Feed, drugs and farm supplies." }, { property: "og:title", content: "Inventory — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Feed, drugs and farm supplies." }] }),
  component: () => <ModulePage perm="inventory.view" title="Inventory" description="Feed, drugs and farm supplies." planned={["Stock items","Stock movements","Reorder alerts","Stock counts"]} />,
});
