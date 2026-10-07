import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Alerts and messages for your role." }, { property: "og:title", content: "Notifications — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Alerts and messages for your role." }] }),
  component: () => <ModulePage perm="notifications.view" title="Notifications" description="Alerts and messages for your role." planned={["Role alerts","Approval requests","Read status","Announcements"]} />,
});
