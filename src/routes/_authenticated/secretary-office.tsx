
import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  RequirePermission,
  StatusBadge,
} from "@/components/app/PageKit";

export const Route = createFileRoute("/_authenticated/secretary-office")({
  head: () => ({
    meta: [
      { title: "Secretary Office — TOBADDY AGRO LIVESTOCK" },
      {
        name: "description",
        content: "Meetings, correspondence, document filing and visitor records.",
      },
    ],
  }),
  component: SecretaryOffice,
});

const modules = [
  {
    number: "01",
    title: "Meetings & Schedules",
    description:
      "Plan management meetings, record agendas, schedule appointments and track meeting outcomes.",
    features: [
      "Meeting date, time and venue",
      "Meeting agenda and participants",
      "Upcoming and completed meetings",
      "Meeting minutes and follow-up actions",
    ],
  },
  {
    number: "02",
    title: "Correspondence",
    description:
      "Organize incoming and outgoing letters and track official communications.",
    features: [
      "Incoming and outgoing letters",
      "Sender, recipient and subject",
      "Reference numbers and dates",
      "Pending replies and correspondence status",
    ],
  },
  {
    number: "03",
    title: "Document Filing",
    description:
      "Organize administrative records so authorized staff can locate documents easily.",
    features: [
      "Administrative records",
      "Meeting minutes and resolutions",
      "Letters and official reports",
      "Document categories and reference numbers",
    ],
  },
  {
    number: "04",
    title: "Visitor Log",
    description:
      "Keep a record of visitors attending the farm office and their official purpose.",
    features: [
      "Visitor name and organization",
      "Purpose of visit",
      "Arrival and departure times",
      "Staff member visited",
    ],
  },
];

function SecretaryOffice() {
  return (
    <RequirePermission perm="secretary.view">
      <PageHeader
        title="Secretary Office"
        description="Correspondence, scheduling and records."
      />

      <div className="mb-6 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Administrative overview
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A central workspace for the farm's meetings, official
              communications, documents and visitors.
            </p>
          </div>
          <StatusBadge tone="info">
            Setup in progress
          </StatusBadge>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No meeting, correspondence or visitor records are displayed
          because the Secretary Office database has not been connected.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {modules.map((item) => (
          <Panel key={item.number}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold">
                {item.number}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold">
                Planned capabilities
              </h3>
              <ul className="mt-3 space-y-2">
                {item.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <StatusBadge tone="warning">
                Database connection pending
              </StatusBadge>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border px-4 py-2 text-sm opacity-50"
              >
                Coming soon
              </button>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Secretary Office implementation status" >
        <div className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span>Page layout and module descriptions</span>
            <StatusBadge tone="success">Included</StatusBadge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span>Meeting and correspondence records</span>
            <StatusBadge tone="warning">Pending</StatusBadge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span>Document storage and visitor log</span>
            <StatusBadge tone="warning">Pending</StatusBadge>
          </div>
          <p className="pt-2 text-muted-foreground">
            Saving records, uploading documents and managing visitor
            entries will be enabled after database tables, secure
            storage and access permissions are configured.
          </p>
        </div>
      </Panel>
    </RequirePermission>
  );
}
