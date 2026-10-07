import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/livestock")({
  head: () => ({ meta: [{ title: "Livestock — TOBADDY AGRO LIVESTOCK" }, { name: "description", content: "Individual animals and poultry batches." }, { property: "og:title", content: "Livestock — TOBADDY AGRO LIVESTOCK" }, { property: "og:description", content: "Individual animals and poultry batches." }] }),
  component: () => <ModulePage perm="livestock.view" title="Livestock" description="Individual animals and poultry batches." planned={["Individual animal register","Poultry batch tracking","Breeds","Mortality & movement"]} />,
});
