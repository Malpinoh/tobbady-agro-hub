import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "System configuration and your profile." }, { property: "og:title", content: "Settings — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "System configuration and your profile." }] }),
  component: () => <ModulePage perm="settings.view" title="Settings" description="System configuration and your profile." planned={["Livestock types","Business profile","Role permissions","My profile"]} />,
});
