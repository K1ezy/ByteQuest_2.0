"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  LoadingPanel,
  Notice,
  PageHeading,
  prettify,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  formatDateTime,
  retryJob,
  serviceStateLabel,
  type AuditItem,
  type JobRecord,
  type MonitoringResponse,
} from "@/lib/workspace";

const SERVICE_OPTIONS = [
  { value: "api", label: "API" },
  { value: "rag_index", label: "RAG indexing" },
  { value: "code_runner", label: "Code-assessment runner" },
  { value: "prediction", label: "Prediction service" },
];

const JOB_STATUS_OPTIONS = [
  { value: "failed", label: "Failed" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "completed", label: "Completed" },
];

const jobTitle = (job: JobRecord) => job.document_title || job.job_type;
const canRetry = (job: JobRecord) => job.status === "failed" && job.retryable;

function JobStatus({ job }: { job: JobRecord }) {
  return <StatusChip
    state={job.status === "completed" ? "ready" : job.status === "failed" ? "failed" : "processing"}
    label={prettify(job.status)}
    tone={job.status === "completed" ? "good" : job.status === "failed" ? "bad" : "wait"}
  />;
}

/** The job, its material's audit history and, when eligible, a confirmed retry: one place per job. */
function JobDrawer({ job, onClose, onRetried }: {
  job: JobRecord | null;
  onClose: () => void;
  onRetried: (job: JobRecord, message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const history = useApi<{ items: AuditItem[] }>(job?.material_id ? `/admin/audit?entity_id=${encodeURIComponent(job.material_id)}` : null);

  useEffect(() => {
    // A different job starts without the previous job's result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(null);
  }, [job?.id]);

  async function retry() {
    if (!job) return;
    setBusy(true);
    try {
      const outcome = await retryJob(job.id);
      const next = { ...outcome.job, document_title: job.document_title, material_id: job.material_id };
      setResult({ tone: next.status === "failed" ? "error" : "success", text: outcome.message });
      onRetried(next, outcome.message);
      history.reload();
    } catch (caught) {
      setResult({ tone: "error", text: `${getErrorMessage(caught)} The job status is unchanged.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={Boolean(job)}
      variant="drawer"
      title={job ? jobTitle(job) : "Job"}
      cancelLabel="Close"
      confirmLabel={busy ? "Retrying…" : "Retry this job"}
      busy={busy}
      hideConfirm={!job || !canRetry(job)}
      onCancel={onClose}
      onConfirm={() => void retry()}
    >
      {job ? (
        <>
          {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
          <dl className="ws-summary-list">
            <div><dt>Status</dt><dd><JobStatus job={job} /></dd></div>
            <div><dt>Cause</dt><dd>{job.cause || "No failure cause is recorded for this job."}</dd></div>
            <div><dt>Trace</dt><dd><code>{job.trace_id}</code> <CopyButton value={job.trace_id} label={`trace ${job.trace_id}`} /></dd></div>
            <div><dt>Attempts</dt><dd>{job.attempts} of {job.max_attempts}</dd></div>
            <div><dt>Service</dt><dd>{job.service} · started {formatDateTime(job.created_at)}</dd></div>
            <div><dt>Last checked</dt><dd>{formatDateTime(job.last_checked_at)}</dd></div>
          </dl>
          {canRetry(job) ? (
            <p className="ws-callout">
              Retrying reprocesses only <strong>{jobTitle(job)}</strong> (trace <code>{job.trace_id}</code>). Other jobs and
              materials are not touched, and the outcome is added to the audit trail below.
            </p>
          ) : job.status === "failed" ? (
            <p className="ws-muted">This failure can&apos;t be retried. Upload a corrected or searchable PDF instead.</p>
          ) : null}
          <h3 className="ws-drawer-subtitle">Audit trail for this material</h3>
          {!job.material_id ? <p className="ws-muted">This job has no material record.</p> : null}
          {history.loading && !history.data ? <p role="status" className="ws-muted">Loading entries…</p> : null}
          {history.error ? <p className="ws-field-error">{history.error}</p> : null}
          {history.data && history.data.items.length === 0 ? <p className="ws-muted">No entries yet.</p> : null}
          {history.data && history.data.items.length > 0 ? (
            <ul className="ws-compact-list">
              {history.data.items.slice(0, 8).map((event) => (
                <li key={event.id}><strong>{event.summary}</strong><span>{event.action} · {formatDateTime(event.created_at)}</span></li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </ConfirmDialog>
  );
}

function Monitoring() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") || "";
  const jobStatus = searchParams.get("status") || "";
  const appliedSearch = searchParams.get("q") || "";
  const auditSearch = searchParams.get("audit") || "";
  const openJobId = searchParams.get("job") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [auditQuery, setAuditQuery] = useState(auditSearch);
  const [retried, setRetried] = useState<JobRecord | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
    setAuditQuery(auditSearch);
  }, [appliedSearch, auditSearch]);

  const path = useMemo(
    () =>
      `/admin/monitoring?${new URLSearchParams({
        ...(service ? { service } : {}),
        ...(jobStatus ? { status: jobStatus } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(auditSearch ? { audit_search: auditSearch } : {}),
      }).toString()}`,
    [appliedSearch, auditSearch, jobStatus, service],
  );
  const { data, error, loading, reload } = useApi<MonitoringResponse>(path);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const jobs = data?.jobs || [];
  // The job opened from the URL keeps the list's filters; a just-retried job stays open even if a filter now hides it.
  const openJob = jobs.find((job) => job.id === openJobId) ?? (retried?.id === openJobId ? retried : null);
  const hasJobFilters = Boolean(service || jobStatus || appliedSearch);

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Platform monitoring"
        description="Check service health, open a job to see its cause and history, and retry it when the platform allows."
        status={
          data ? (
            <StatusChip
              state={data.overall}
              label={`Overall: ${serviceStateLabel[data.overall] || data.overall}`}
              tone={data.overall === "healthy" ? "good" : data.overall === "failed" ? "bad" : "wait"}
            />
          ) : undefined
        }
        actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
      />

      {error ? (
        <Notice tone="error">
          Monitoring could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Checking platform services…" /> : null}

      {data ? (
        <section className="ws-panel" aria-labelledby="services-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">SERVICES</p>
              <h2 id="services-title">Service health</h2>
            </div>
            <span className="ws-muted">Checked {formatDateTime(data.checked_at)}</span>
          </div>
          <div className="ws-health-grid">
            {data.services.map((health) => (
              <article className={`ws-health-card ${health.status}`} key={health.service}>
                <div className="ws-health-head">
                  <h3>{health.label}</h3>
                  <StatusChip state={health.status} label={serviceStateLabel[health.status]} tone={health.status === "healthy" ? "good" : health.status === "failed" ? "bad" : health.status === "off" ? "muted" : "wait"} />
                </div>
                <p>{health.detail}</p>
                <span className="ws-row-meta">Last checked {formatDateTime(health.last_checked_at)}</span>
                {health.trace_id ? <span className="ws-row-meta">Trace <code>{health.trace_id}</code> <CopyButton value={health.trace_id} label={`trace ${health.trace_id}`} /></span> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ws-panel" aria-labelledby="jobs-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">PROCESSING</p>
            <h2 id="jobs-title">Jobs</h2>
          </div>
          {data ? (
            <span className="ws-chip-row">
              <StatusChip state="info" label={`${data.job_counts.failed} failed`} tone={data.job_counts.failed ? "bad" : "good"} />
              <StatusChip state="info" label={`${data.job_counts.retryable} retryable`} tone="wait" />
            </span>
          ) : null}
        </div>

        <Toolbar label="Job filters">
          <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search job or trace ID" label="Search jobs" />
          <SelectField label="Service" value={service} onChange={(value) => updateQuery({ service: value || null })} options={SERVICE_OPTIONS} includeAll allLabel="All services" />
          <SelectField label="Status" value={jobStatus} onChange={(value) => updateQuery({ status: value || null })} options={JOB_STATUS_OPTIONS} includeAll allLabel="All statuses" />
          {hasJobFilters ? (
            <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ service: null, status: null, q: null }); }}>
              Clear filters
            </Button>
          ) : null}
        </Toolbar>

        {!loading && data && jobs.length === 0 ? (
          <EmptyState title={hasJobFilters ? "No jobs match these filters" : "No processing jobs recorded"}>
            {hasJobFilters
              ? "Try another service, status or trace search. Filters stay until cleared."
              : "Jobs appear here when a PDF upload or reprocess starts."}
          </EmptyState>
        ) : null}

        {jobs.length > 0 ? (
          <div className="ws-table-wrap">
            <table className="ws-table">
              <caption className="sr-only">Processing jobs</caption>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Trace</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Job">
                      <strong>{jobTitle(job)}</strong>
                      <span className="ws-row-meta">{job.service} · {formatDateTime(job.created_at)}</span>
                      {job.cause ? <span className="ws-row-meta">Cause: {job.cause}</span> : null}
                    </td>
                    <td data-label="Status"><JobStatus job={job} /></td>
                    <td data-label="Attempts">{job.attempts} / {job.max_attempts}</td>
                    <td data-label="Trace"><code>{job.trace_id}</code> <CopyButton value={job.trace_id} label={`trace ${job.trace_id}`} /></td>
                    <td data-label="Action">
                      <Button variant={canRetry(job) ? "outline" : "quiet"} onClick={() => updateQuery({ job: job.id })}>
                        {canRetry(job) ? "Review and retry" : "Details"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="ws-footnote">Retry is offered only for a failed job the platform marks retryable. Unsearchable PDFs need a replacement.</p>
      </section>

      <section className="ws-panel" aria-labelledby="audit-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">GOVERNANCE</p>
            <h2 id="audit-title">Audit trail</h2>
          </div>
          <span className="ws-muted">Read-only</span>
        </div>
        <Toolbar label="Audit search">
          <SearchField value={auditQuery} onChange={setAuditQuery} onSubmit={() => updateQuery({ audit: auditQuery || null })} placeholder="Search audit events" label="Search audit events" />
          {auditSearch ? (
            <Button variant="quiet" onClick={() => { setAuditQuery(""); updateQuery({ audit: null }); }}>Clear search</Button>
          ) : null}
        </Toolbar>
        {data && data.audit.length === 0 ? (
          <EmptyState title="No audit events match this view">
            Consequential changes such as publication, deactivation, archival and configuration edits appear here.
          </EmptyState>
        ) : null}
        {data && data.audit.length > 0 ? (
          <ul className="ws-compact-list">
            {data.audit.map((event) => (
              <li key={event.id}>
                <strong>{event.summary}</strong>
                <span>{event.actor} · {event.action} · {formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <JobDrawer
        job={openJob}
        onClose={() => updateQuery({ job: null })}
        onRetried={(next) => { setRetried(next); updateQuery({ job: next.id }); reload(); }}
      />
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="monitoring">
      <Monitoring />
    </WorkspaceSuspense>
  );
}
