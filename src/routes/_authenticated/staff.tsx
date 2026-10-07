import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff & Users — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Employees, user accounts and roles." }, { property: "og:title", content: "Staff & Users — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Employees, user accounts and roles." }] }),
  component: () => <ModulePage perm="staff.view" title="Staff & Users" description="Employees, user accounts and roles." planned={["Employee records","User accounts","Role assignment","Permissions"]} />,
});
