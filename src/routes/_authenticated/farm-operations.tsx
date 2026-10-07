import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/farm-operations")({
  head: () => ({ meta: [{ title: "Farm Operations — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Farms, sections and daily operations." }, { property: "og:title", content: "Farm Operations — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Farms, sections and daily operations." }] }),
  component: () => <ModulePage perm="farm.view" title="Farm Operations" description="Farms, sections and daily operations." planned={["Farms & sections","Feeding schedules","Veterinary records","Daily tasks"]} />,
});
