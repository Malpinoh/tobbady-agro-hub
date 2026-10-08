```tsx
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
          "Manage individual animals, poultry batches, livestock values, mortality and movements.",
      },
      {
        property: "og:title",
        content: "Livestock — TOBADDY AGRO LIVESTOCK",
      },
      {
        property: "og:description",
        content:
          "Manage individual animals, poultry batches, livestock values, mortality and movements.",
      },
    ],
  }),
  component: LivestockPage,
});
```
