import { createFileRoute } from "@tanstack/react-router";
import LivestockPage from "@/components/livestock/LivestockPage";

export const Route = createFileRoute("/_authenticated/livestock")({
  head: () => ({
    meta: [
      {
        title: "Livestock — TOBADDY AGRO LIVESTOCK",
      },
      {
        name: "description",
        content:
          "Manage individual animals and groups of birds or fish, their value, deaths, sales and transfers.",
      },
      {
        property: "og:title",
        content: "Livestock — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content:
          "Manage individual animals and groups of birds or fish, their value, deaths, sales and transfers.",
      },
    ],
  }),
  component: LivestockPage,
});
