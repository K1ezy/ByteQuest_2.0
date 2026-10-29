"use client";

import Link from "next/link";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  EmptyState,
  LoadingPanel,
  Notice,
  PageHeading,
  StatCard,
  StatusChip,
  useApi,
} from "@/components/workspace/ui";
import {
  formatDateTime,
  serviceStateLabel,
  type AdminDashboard,
  type QueueItem,
} from "@/lib/workspace";

const ACTION_LABEL: Record<QueueItem["kind"], string> = {
  account: "Open account",
  job: "Inspect job",
  activity: "Open activity",
  draft: "Open draft",
  material: "Open material",
};

function AdminDashboardPage() {
  const { profile, courses } = useWorkspace();
  const { data, error, loading, reload } = useApi<AdminDashboard>("/admin/dashboard");

  if (loading && !data) return <LoadingPanel label="Loading platform status…" />;
  if (error && !data) {
    return (
      <section className="ws-panel" role="alert">
        <PageHeading eyebrow="ADMINISTRATION" title="Overview unavailable" description={error} />
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={reload}>Try again</Button>
        </div>
      </section>
    );
  }
  if (!data) return null;

  const healthy = data.counts.service_status === "healthy";

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title={`Good day, ${profile.display_name || "administrator"}`}
        description="A clear view of accounts, processing jobs, activity availability and platform health."
        status={
          <StatusChip
            state={data.overall}
            label={`Services: ${serviceStateLabel[data.overall] || data.overall}`}
            tone={data.overall === "healthy" ? "good" : data.overall === "failed" ? "bad" : "wait"}
          />
        }
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
      />

      <div className="ws-stat-grid" aria-label="Platform status">
        <StatCard
          label="Accounts needing action"
          value={data.counts.accounts_needing_action}
          hint={data.counts.accounts_needing_action ? "Review accounts →" : "All accounts have course access →"}
          icon="◉"
          tone={data.counts.accounts_needing_action ? "wait" : "good"}
          href="/admin/accounts?status=attention"
        />
        <StatCard
          label="Failed processing jobs"
          value={data.counts.failed_jobs}
          hint={data.counts.failed_jobs ? "Inspect and retry →" : "All processing jobs are healthy →"}
          icon="⚙"
          tone={data.counts.failed_jobs ? "bad" : "good"}
          href="/admin/monitoring?status=failed"
        />
        <StatCard
          label="Availability changes"
          value={data.counts.availability_changes}
          hint="Review activity status →"
          icon="▦"
          tone="info"
          href="/admin/activities?status=attention"
        />
        <StatCard
          label="Service health"
          value={healthy ? "Healthy" : serviceStateLabel[data.overall] || data.overall}
          hint={`${data.counts.healthy_services} of ${data.counts.total_services} services healthy →`}
          icon="◈"
          tone={healthy ? "good" : data.overall === "failed" ? "bad" : "wait"}
          href="/admin/monitoring"
        />
      </div>

      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="admin-queue-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">ACTION QUEUE</p>
              <h2 id="admin-queue-title">Needs action</h2>
            </div>
            <Link className="ws-text-link" href="/admin/monitoring">
              View monitoring →
            </Link>
          </div>
          {data.action_queue.length === 0 ? (
            <EmptyState
              title="Nothing is waiting for an administrator"
              tone="success"
              action={<Link className="button button-outline small" href="/admin/monitoring">View monitoring</Link>}
            >
              Accounts have course access, processing jobs are healthy and no activity availability changes are scheduled.
            </EmptyState>
          ) : (
            <ul className="ws-list">
              {data.action_queue.map((item) => (
                <li className="ws-row" key={`${item.kind}-${item.id}`}>
                  <div className="ws-row-main">
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <span className="ws-row-meta">Updated {formatDateTime(item.updated_at)}</span>
                  </div>
                  <div className="ws-row-actions">
                    <StatusChip state={item.status} tone={item.severity} />
                    <Link className="button button-outline small" href={item.href}>
                      {ACTION_LABEL[item.kind]}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="ws-stack">
          <section className="ws-panel" aria-labelledby="health-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">PLATFORM</p>
                <h2 id="health-title">Service health</h2>
              </div>
              <Link className="ws-text-link" href="/admin/monitoring">Open monitoring →</Link>
            </div>
            <ul className="ws-health-list">
              {data.services.map((service) => (
                <li key={service.service}>
                  <div>
                    <strong>{service.label}</strong>
                    <span className="ws-row-meta">{service.detail}</span>
                    <span className="ws-row-meta">Checked {formatDateTime(service.last_checked_at)}</span>
                  </div>
                  <StatusChip
                    state={service.status}
                    label={serviceStateLabel[service.status]}
                    tone={service.status === "healthy" ? "good" : service.status === "failed" ? "bad" : "wait"}
                  />
                </li>
              ))}
            </ul>
          </section>

          <section className="ws-panel" aria-labelledby="admin-recent-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">AUDIT</p>
                <h2 id="admin-recent-title">Recent changes</h2>
              </div>
              <Link className="ws-text-link" href="/admin/monitoring">Audit trail →</Link>
            </div>
            {data.recent_changes.length === 0 ? (
              <p className="ws-muted">No administrative changes have been recorded yet.</p>
            ) : (
              <ul className="ws-compact-list">
                {data.recent_changes.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.summary}</strong>
                    <span>{entry.actor} · {formatDateTime(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ws-panel" aria-labelledby="admin-scope-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">SCOPE</p>
                <h2 id="admin-scope-title">Academic boundary</h2>
              </div>
            </div>
            <p className="ws-muted">
              {courses.length} course{courses.length === 1 ? "" : "s"} configured. Account, material and availability
              operations belong here; draft approval, answer keys, hidden tests and grade changes stay with assigned
              faculty.
            </p>
            <div className="ws-inline-actions">
              <Link className="button button-outline small" href="/admin/assignments">Manage assignments</Link>
              <Link className="button button-outline small" href="/admin/configuration">Configuration</Link>
            </div>
          </section>
        </div>
      </div>

      {data.counts.failed_jobs > 0 ? (
        <Notice tone="error">
          {data.counts.failed_jobs} processing job{data.counts.failed_jobs === 1 ? " has" : "s have"} failed.{" "}
          <Link href="/admin/monitoring?status=failed">Inspect the cause and retry eligible jobs →</Link>
        </Notice>
      ) : (
        <Notice tone="success">
          All processing jobs are healthy. <Link href="/admin/monitoring">View monitoring →</Link>
        </Notice>
      )}
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="administration dashboard">
      <AdminDashboardPage />
    </WorkspaceSuspense>
  );
}
