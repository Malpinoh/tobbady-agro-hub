import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/ceo-office")({
  head: () => ({ meta: [{ title: "CEO Office — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Executive overview, approvals and strategic decisions." }, { property: "og:title", content: "CEO Office — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Executive overview, approvals and strategic decisions." }] }),
  component: () => <ModulePage perm="ceo.view" title="CEO Office" description="Executive overview, approvals and strategic decisions." planned={["Executive approvals","Strategic reports","Business targets","Board documents"]} />,
});
