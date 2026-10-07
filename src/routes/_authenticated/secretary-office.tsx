import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/secretary-office")({
  head: () => ({ meta: [{ title: "Secretary Office — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Correspondence, scheduling and records." }, { property: "og:title", content: "Secretary Office — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Correspondence, scheduling and records." }] }),
  component: () => <ModulePage perm="secretary.view" title="Secretary Office" description="Correspondence, scheduling and records." planned={["Meetings & schedules","Correspondence","Document filing","Visitor log"]} />,
});
